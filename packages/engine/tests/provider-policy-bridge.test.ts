import {
  DiscoveryRequestV1Schema,
  LiveProviderRunTelemetryV1Schema,
  LocalDiscoveryExecutionRecordV1Schema,
  ProviderPolicyTraceV1Schema,
  createOpaqueId,
  type DiscoveryProviderPolicy,
} from "@cluvvi/core";
import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { randomUUID } from "node:crypto";
import { afterEach, describe, expect, it } from "vitest";
import {
  LocalProcessDiscoveryRuntime,
  discoveryExchangePaths,
  parseDiscoveryRuntimeConfig,
  type BridgeDiscoveryRequestV1,
} from "../src";

const cleanupDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(
    cleanupDirectories.splice(0).map((path) => rm(path, { recursive: true, force: true })),
  );
});

async function controlledProject(mode: string): Promise<{
  projectPath: string;
  runsDirectory: string;
}> {
  const root = resolve(process.cwd(), ".cluvvi-test", randomUUID());
  const projectPath = resolve(root, "fake-discovery-engine");
  const runsDirectory = resolve(root, "runs");
  cleanupDirectories.push(root);
  await mkdir(root, { recursive: true });
  await cp(resolve(process.cwd(), "tests/fixtures/local-discovery-engine"), projectPath, {
    recursive: true,
  });
  await writeFile(resolve(projectPath, "behavior.json"), `${JSON.stringify({ mode })}\n`, "utf8");
  return { projectPath, runsDirectory };
}

function requestFor(runId: string, policy: DiscoveryProviderPolicy): BridgeDiscoveryRequestV1 {
  const request = DiscoveryRequestV1Schema.parse({
    schemaVersion: "1.0",
    artifactKind: "discovery_request.v1",
    requestId: runId,
    goal: "customer_opportunities",
    description: "Find public evidence of video editing workflow and capacity problems.",
    answerRequirement: {
      outputType: "evidence_collection",
      completenessTarget: "balanced",
      evidenceRequirement: "multiple_sources",
      maximumResults: 10,
    },
    retrievalObjective: {
      recallPriority: 0.7,
      precisionPriority: 0.8,
      freshnessPriority: 0.8,
      authorityPriority: 0.6,
      diversityPriority: 0.7,
    },
    subject: {
      type: "product_or_service",
      name: "AI-assisted video editing",
      description: "Managed long-form editing workflow software.",
    },
    domainPackIds: ["content-production"],
    discoveryMode: policy,
    providerPreference:
      policy === "free_only" ? "free_first" : policy === "balanced" ? "paid_allowed" : "paid_only",
  });
  return request as BridgeDiscoveryRequestV1;
}

function runtime(input: {
  projectPath: string;
  runsDirectory: string;
  policy: DiscoveryProviderPolicy;
  providerEnvironment?: Record<string, string | undefined>;
}): LocalProcessDiscoveryRuntime {
  return new LocalProcessDiscoveryRuntime({
    config: {
      projectPath: input.projectPath,
      command: "pnpm",
      timeoutMs: 60_000,
      keepExchangeFiles: true,
      providerMode: "live_search",
      providerPolicy: input.policy,
      providerEnvironment: input.providerEnvironment ?? {},
    },
    runsDirectory: input.runsDirectory,
  });
}

function failureCode(error: unknown): string | undefined {
  if (typeof error !== "object" || error === null || !("failure" in error)) return undefined;
  const failure = (error as { failure?: { code?: unknown } }).failure;
  return typeof failure?.code === "string" ? failure.code : undefined;
}

async function expectFailure(operation: Promise<unknown>, code: string): Promise<void> {
  try {
    await operation;
    throw new Error("Expected policy validation to fail.");
  } catch (error) {
    expect(failureCode(error)).toBe(code);
  }
}

async function runControlled(mode: string, policy: DiscoveryProviderPolicy) {
  const fixture = await controlledProject(mode);
  const runId = createOpaqueId("run");
  const artifact = await runtime({ ...fixture, policy }).execute({
    runId,
    request: requestFor(runId, policy),
  });
  return {
    ...fixture,
    runId,
    artifact,
    paths: discoveryExchangePaths(fixture.runsDirectory, runId),
  };
}

describe("C1-HF provider policy bridge", () => {
  it("passes one validated free-only policy argument and persists zero-paid provenance", async () => {
    const fixture = await controlledProject("success");
    const parsed = parseDiscoveryRuntimeConfig({
      CLUVVI_DISCOVERY_MODE: "local_discovery_engine",
      CLUVVI_DISCOVERY_PROVIDER_MODE: "live_search",
      CLUVVI_DISCOVERY_PROVIDER_POLICY: "free_only",
      CLUVVI_DISCOVERY_ENGINE_PATH: fixture.projectPath,
      CLUVVI_DISCOVERY_ENGINE_COMMAND: "pnpm",
      DISCOVERY_TAVILY_API_KEY: "must-not-reach-child",
      DISCOVERY_BRAVE_API_KEY: "must-not-reach-child",
    });
    if (parsed.mode !== "local_discovery_engine") throw new Error("Expected local runtime.");
    const runId = createOpaqueId("run");
    const artifact = await new LocalProcessDiscoveryRuntime({
      config: parsed.local,
      runsDirectory: fixture.runsDirectory,
    }).execute({ runId, request: requestFor(runId, "free_only") });
    const paths = discoveryExchangePaths(fixture.runsDirectory, runId);
    const execution = LocalDiscoveryExecutionRecordV1Schema.parse(
      JSON.parse(await readFile(paths.executionPath, "utf8")) as unknown,
    );
    const telemetry = LiveProviderRunTelemetryV1Schema.parse(
      JSON.parse(await readFile(paths.providerTelemetryPath, "utf8")) as unknown,
    );
    const trace = ProviderPolicyTraceV1Schema.parse(
      JSON.parse(await readFile(paths.providerPolicyTracePath, "utf8")) as unknown,
    );

    expect(execution.arguments).toContain("--provider-policy");
    expect(execution.arguments.at(execution.arguments.indexOf("--provider-policy") + 1)).toBe(
      "free_only",
    );
    expect(execution.providerPolicy).toBe("free_only");
    expect(execution.providerPolicyTraceImported).toBe(true);
    expect(JSON.stringify(execution)).not.toContain("must-not-reach-child");
    expect(artifact.summary.paidCreditsUsed).toBe(0);
    expect(artifact.summary.providersUsed).not.toContain("tavily_search");
    expect(artifact.summary.providersUsed).not.toContain("brave_web_search");
    expect(telemetry.usage.tavilyRequests).toBe(0);
    expect(telemetry.usage.braveRequests).toBe(0);
    expect(trace.providerPolicy).toBe("free_only");
    expect(trace.paidProviderAttempted).toBe(false);
    expect(trace.paidFallbackUsed).toBe(false);
  }, 20_000);

  it("includes provider policy in the configuration fingerprint", async () => {
    const fixture = await controlledProject("success");
    const freeFingerprint = runtime({
      ...fixture,
      policy: "free_only",
    }).providerConfigurationFingerprint;
    const balancedFingerprint = runtime({
      ...fixture,
      policy: "balanced",
    }).providerConfigurationFingerprint;
    const paidFingerprint = runtime({
      ...fixture,
      policy: "paid_deep",
    }).providerConfigurationFingerprint;
    expect(new Set([freeFingerprint, balancedFingerprint, paidFingerprint]).size).toBe(3);
  });

  it("accepts balanced free-first success without paid fallback", async () => {
    const { artifact, paths } = await runControlled("success", "balanced");
    const trace = ProviderPolicyTraceV1Schema.parse(
      JSON.parse(await readFile(paths.providerPolicyTracePath, "utf8")) as unknown,
    );
    expect(artifact.summary.providersUsed).toEqual(["duckduckgo_html_search"]);
    expect(artifact.summary.paidCreditsUsed).toBe(0);
    expect(trace.queries[0]?.finalDecision).toBe("sufficient_free_coverage");
    expect(trace.paidFallbackUsed).toBe(false);
  }, 20_000);

  it("accepts balanced paid fallback only after insufficient free coverage with a reason", async () => {
    const { artifact, paths } = await runControlled("balanced-fallback", "balanced");
    const trace = ProviderPolicyTraceV1Schema.parse(
      JSON.parse(await readFile(paths.providerPolicyTracePath, "utf8")) as unknown,
    );
    expect(artifact.summary.providersUsed).toEqual(["brave_web_search"]);
    expect(trace.queries[0]?.attempts.map((attempt) => attempt.providerId)).toEqual([
      "startpage_html_search",
      "brave_web_search",
    ]);
    expect(trace.queries[0]?.paidFallbackReason).toMatch(/below/i);
    expect(trace.paidFallbackUsed).toBe(true);
  }, 20_000);

  it("accepts paid-deep direct paid execution with consistent usage", async () => {
    const { artifact, paths } = await runControlled("success", "paid_deep");
    const telemetry = LiveProviderRunTelemetryV1Schema.parse(
      JSON.parse(await readFile(paths.providerTelemetryPath, "utf8")) as unknown,
    );
    expect(artifact.summary.providersUsed).toEqual(["brave_web_search"]);
    expect(telemetry.usage.braveRequests).toBe(1);
    expect(artifact.summary.paidCreditsUsed).toBe(0);
  }, 20_000);

  it("rejects a paid provider under free-only policy", async () => {
    const fixture = await controlledProject("policy-violation");
    const runId = createOpaqueId("run");
    await expectFailure(
      runtime({ ...fixture, policy: "free_only" }).execute({
        runId,
        request: requestFor(runId, "free_only"),
      }),
      "FREE_ONLY_POLICY_VIOLATION",
    );
  }, 20_000);

  it.each([
    ["policy-trace-missing", "PROVIDER_POLICY_TRACE_MISSING"],
    ["policy-trace-invalid-json", "PROVIDER_POLICY_TRACE_INVALID"],
    ["policy-trace-schema-mismatch", "PROVIDER_POLICY_TRACE_INVALID"],
    ["policy-trace-wrong-request", "PROVIDER_POLICY_TRACE_MISMATCH"],
    ["policy-mismatch", "PROVIDER_POLICY_TRACE_MISMATCH"],
  ])(
    "rejects %s safely",
    async (mode, code) => {
      const fixture = await controlledProject(mode);
      const runId = createOpaqueId("run");
      await expectFailure(
        runtime({ ...fixture, policy: "balanced" }).execute({
          runId,
          request: requestFor(runId, "balanced"),
        }),
        code,
      );
    },
    20_000,
  );

  it.each([
    ["balanced-no-reason", "PROVIDER_POLICY_TRACE_MISMATCH"],
    ["balanced-paid-first", "PROVIDER_POLICY_TRACE_MISMATCH"],
    ["usage-mismatch", "DISCOVERY_ENGINE_USAGE_MISMATCH"],
  ])(
    "rejects invalid balanced behavior %s",
    async (mode, code) => {
      const fixture = await controlledProject(mode);
      const runId = createOpaqueId("run");
      await expectFailure(
        runtime({ ...fixture, policy: "balanced" }).execute({
          runId,
          request: requestFor(runId, "balanced"),
        }),
        code,
      );
    },
    20_000,
  );
});
