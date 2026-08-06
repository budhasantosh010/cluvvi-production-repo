import {
  DiscoveryRequestV1Schema,
  LiveProviderRunTelemetryV1Schema,
  LocalDiscoveryExecutionRecordV1Schema,
  SearchResultsArtifactV2Schema,
  createOpaqueId,
} from "@cluvvi/core";
import { mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { randomUUID } from "node:crypto";
import { afterEach, describe, expect, it } from "vitest";
import type { BridgeDiscoveryRequestV1 } from "../src/discovery-request-adapter";
import { LocalProcessDiscoveryRuntime } from "../src/local-process-discovery-runtime";

const cleanupDirectories: string[] = [];

const FAKE_CLI = `
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
const args = process.argv.slice(2);
const inputPath = args[0];
const providerModeIndex = args.indexOf("--provider-mode");
const providerPolicyIndex = args.indexOf("--provider-policy");
const outputIndex = args.indexOf("--output");
const providerMode = providerModeIndex >= 0 ? args[providerModeIndex + 1] : "fixture_only";
const providerPolicy = providerPolicyIndex >= 0 ? args[providerPolicyIndex + 1] : "free_only";
const outputPath = outputIndex >= 0 ? args[outputIndex + 1] : undefined;
const behavior = JSON.parse(await readFile(resolve("behavior.json"), "utf8"));
console.log("fixture cli stdout");
console.error("fixture cli stderr");
if (behavior.delayMs) await new Promise((resolveDelay) => setTimeout(resolveDelay, behavior.delayMs));
if (behavior.mode === "nonzero") process.exit(7);
if (behavior.mode === "missing") process.exit(0);
if (!inputPath || !outputPath || !["fixture_only", "live_search"].includes(providerMode) || !["free_only", "balanced", "paid_deep"].includes(providerPolicy)) process.exit(9);
if (behavior.mode === "invalid-json") {
  await writeFile(outputPath, "{not-json", "utf8");
  process.exit(0);
}
const request = JSON.parse(await readFile(inputPath, "utf8"));
const live = providerMode === "live_search";
const providerId = behavior.mode === "unexpected-provider"
  ? "unexpected_live_provider"
  : live
    ? "brave_web_search"
    : "fixture_test_provider";
const providerCategory = live || behavior.mode === "unexpected-provider" ? "paid" : "fixture";
const artifact = {
  schemaVersion: behavior.mode === "wrong-schema" ? "1.0" : "2.0",
  artifactKind: behavior.mode === "wrong-schema" ? "search_results.v1" : "search_results.v2",
  requestId: behavior.mode === "wrong-request" ? "req_wrong" : request.requestId,
  discoveryGoal: request.goal,
  discoveryMode: request.discoveryMode,
  domainPackIds: request.domainPackIds ?? [],
  summary: {
    queriesPlanned: 1,
    queriesExecuted: 1,
    providersUsed: [providerId],
    rawResults: 0,
    dedupedResults: 0,
    paidCreditsUsed: behavior.mode === "usage-mismatch" ? 1 : 0,
    startedAt: "2026-08-01T10:00:00.000Z",
    completedAt: "2026-08-01T10:00:01.000Z"
  },
  providerBreakdown: [{
    providerId,
    providerCategory,
    sourceZone: "general_web",
    searchMethod: "keyword_search",
    queriesExecuted: 1,
    resultsReturned: 0,
    errors: 0
  }],
  results: [],
  coverage: {
    searchedSourceZones: ["general_web"],
    skippedSourceZones: [],
    providersUsed: [providerId],
    providersUnavailable: behavior.mode === "partial-live" ? ["tavily_search:PROVIDER_RATE_LIMITED"] : [],
    manualReviewRecommended: [],
    confidenceLimitations: [live ? "Live snippets were not crawled." : "Fixture-only controlled test output."],
    nextBestSearches: []
  },
  warnings: [live ? "Live snippets were not crawled or deeply extracted." : "Fixture-only controlled test output; not live discovery."]
};
await writeFile(outputPath, JSON.stringify(artifact, null, 2) + "\\n", "utf8");
if (live && behavior.mode !== "telemetry-missing") {
  const telemetryPath = outputPath + ".provider-executions.v1.json";
  if (behavior.mode === "telemetry-invalid-json") {
    await writeFile(telemetryPath, "{not-json", "utf8");
  } else {
    const telemetry = {
      schemaVersion: "1.0",
      artifactKind: "live_provider_run_telemetry.v1",
      requestId: behavior.mode === "telemetry-wrong-request" ? "req_wrong" : request.requestId,
      providerMode: behavior.mode === "provider-mode-mismatch" ? "fixture_only" : "live_search",
      configurationFingerprint: "a".repeat(64),
      generatedAt: "2026-08-01T10:00:01.000Z",
      providerExecutions: [
        ...(behavior.mode === "partial-live" ? [{
          providerId: "tavily_search",
          queryId: "plan_test",
          sourceZone: "general_web",
          searchMethod: "keyword_search",
          operation: "search",
          startedAt: "2026-08-01T10:00:00.000Z",
          completedAt: "2026-08-01T10:00:01.000Z",
          durationMs: 1000,
          attempts: 1,
          statusCode: 429,
          resultsReceived: 0,
          resultsAccepted: 0,
          rateLimited: true,
          success: false,
          errorCode: "PROVIDER_RATE_LIMITED",
          safeErrorMessage: "tavily_search returned HTTP 429."
        }] : []),
        {
          providerId: "brave_web_search",
          queryId: "plan_test",
          sourceZone: "general_web",
          searchMethod: "keyword_search",
          operation: "search",
          startedAt: "2026-08-01T10:00:00.000Z",
          completedAt: "2026-08-01T10:00:01.000Z",
          durationMs: 1000,
          attempts: 1,
          statusCode: 200,
          resultsReceived: 0,
          resultsAccepted: 0,
          rateLimited: false,
          success: true,
          providerUsage: { braveRequests: 1 }
        }
      ],
      budget: {
        hacker_news_algolia: { used: 0, limit: 4 },
        hacker_news_firebase: { used: 0, limit: 8 },
        tavily_search: { used: behavior.mode === "partial-live" ? 1 : 0, limit: 3 },
        brave_web_search: { used: 1, limit: 3 }
      },
      usage: {
        tavilyRequests: behavior.mode === "partial-live" ? 1 : 0,
        tavilyCredits: 0,
        braveRequests: 1,
        hackerNewsAlgoliaRequests: 0,
        hackerNewsFirebaseRequests: 0
      },
      warnings: artifact.warnings
    };
    if (behavior.mode === "telemetry-schema-mismatch") delete telemetry.usage;
    await writeFile(telemetryPath, JSON.stringify(telemetry, null, 2) + "\\n", "utf8");
  }
}
if (live && behavior.mode !== "policy-trace-missing") {
  const tracePath = outputPath + ".provider-policy-trace.v1.json";
  if (behavior.mode === "policy-trace-invalid-json") {
    await writeFile(tracePath, "{not-json", "utf8");
  } else {
    const trace = {
      schemaVersion: "1.0",
      artifactKind: "provider_policy_trace.v1",
      requestId: behavior.mode === "policy-trace-wrong-request" ? "req_wrong" : request.requestId,
      providerPolicy: behavior.mode === "policy-trace-policy-mismatch" ? "free_only" : providerPolicy,
      queries: [{
        queryId: "plan_test",
        sourceZone: "general_web",
        searchMethod: "keyword_search",
        attempts: [
          ...(behavior.mode === "partial-live" ? [{
            providerId: "tavily_search",
            order: 1,
            attempted: true,
            outcome: "failed",
            acceptedResults: 0,
            uniqueDomains: 0,
            duplicateRatio: 0,
            paid: true,
            safeFailureCode: "PROVIDER_RATE_LIMITED"
          }] : []),
          {
            providerId: "brave_web_search",
            order: behavior.mode === "partial-live" ? 2 : 1,
            attempted: true,
            outcome: "success",
            acceptedResults: 0,
            uniqueDomains: 0,
            duplicateRatio: 0,
            paid: true
          }
        ],
        finalDecision: "paid_fallback_used",
        ...(providerPolicy === "balanced" ? { paidFallbackReason: "too few accepted results" } : {})
      }],
      paidProviderAttempted: true,
      paidFallbackUsed: providerPolicy === "balanced",
      warnings: artifact.warnings
    };
    if (behavior.mode === "policy-trace-schema-mismatch") delete trace.queries;
    await writeFile(tracePath, JSON.stringify(trace, null, 2) + "\\n", "utf8");
  }
}
`;

afterEach(async () => {
  await Promise.all(
    cleanupDirectories.splice(0).map((path) => rm(path, { recursive: true, force: true })),
  );
});

async function fakeProject(mode = "success", delayMs = 0) {
  const root = resolve(process.cwd(), ".cluvvi-test", randomUUID());
  const projectPath = resolve(root, "fake-discovery-engine");
  const runsDirectory = resolve(root, "runs");
  cleanupDirectories.push(root);
  await mkdir(projectPath, { recursive: true });
  await writeFile(
    resolve(projectPath, "package.json"),
    `${JSON.stringify({ private: true, type: "module", scripts: { discover: "node fake-cli.mjs" } }, null, 2)}\n`,
    "utf8",
  );
  await writeFile(resolve(projectPath, "fake-cli.mjs"), FAKE_CLI, "utf8");
  await writeFile(
    resolve(projectPath, "behavior.json"),
    `${JSON.stringify({ mode, delayMs })}\n`,
    "utf8",
  );
  return { root, projectPath, runsDirectory };
}

function bridgeRequest(runId: string): BridgeDiscoveryRequestV1 {
  const request = DiscoveryRequestV1Schema.parse({
    schemaVersion: "1.0",
    artifactKind: "discovery_request.v1",
    requestId: runId,
    goal: "customer_opportunities",
    description:
      "Find fixture companies with evidence of video editing workflow capacity problems.",
    answerRequirement: {
      outputType: "evidence_collection",
      completenessTarget: "balanced",
      evidenceRequirement: "multiple_sources",
      maximumResults: 20,
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
      name: "video editing",
      description: "Managed video editing",
    },
    buyerHypotheses: ["podcast agencies"],
    domainPackIds: ["content-production"],
    discoveryMode: "free_only",
    providerPreference: "fixture_only",
  });
  return request as BridgeDiscoveryRequestV1;
}

function runtime(input: {
  projectPath: string;
  runsDirectory: string;
  timeoutMs?: number;
  providerMode?: "fixture_only" | "live_search";
  providerPolicy?: "free_only" | "balanced" | "paid_deep";
  extractionMode?: "none" | "selected_public_pages";
  maximumExtractions?: number;
}) {
  return new LocalProcessDiscoveryRuntime({
    config: {
      projectPath: input.projectPath,
      command: "pnpm",
      timeoutMs: input.timeoutMs ?? 60_000,
      keepExchangeFiles: true,
      providerMode: input.providerMode ?? "fixture_only",
      providerPolicy: input.providerPolicy ?? "free_only",
      extractionMode: input.extractionMode ?? "none",
      maximumExtractions: input.maximumExtractions ?? 8,
      providerEnvironment: {},
    },
    runsDirectory: input.runsDirectory,
  });
}

async function setBehavior(projectPath: string, mode: string, delayMs = 0): Promise<void> {
  await writeFile(
    resolve(projectPath, "behavior.json"),
    `${JSON.stringify({ mode, delayMs })}\n`,
    "utf8",
  );
}

function failureCode(error: unknown): string | undefined {
  if (typeof error !== "object" || error === null || !("failure" in error)) return undefined;
  const failure = (error as { failure?: { code?: unknown } }).failure;
  return typeof failure?.code === "string" ? failure.code : undefined;
}

async function expectFailure(operation: Promise<unknown>, code: string): Promise<void> {
  try {
    await operation;
    throw new Error("Expected local discovery execution to fail.");
  } catch (error) {
    expect(failureCode(error)).toBe(code);
  }
}

describe("LocalProcessDiscoveryRuntime", () => {
  it("writes request files, safely invokes the CLI, captures logs, and validates fixture output", async () => {
    const { projectPath, runsDirectory } = await fakeProject();
    const runId = createOpaqueId("run");
    const artifact = await runtime({ projectPath, runsDirectory }).execute({
      runId,
      request: bridgeRequest(runId),
    });

    expect(SearchResultsArtifactV2Schema.parse(artifact)).toEqual(artifact);
    expect(artifact.requestId).toBe(runId);
    const exchange = resolve(runsDirectory, runId, "discovery-exchange");
    expect(await readFile(resolve(exchange, "discovery-stdout.log"), "utf8")).toContain(
      "fixture cli stdout",
    );
    expect(await readFile(resolve(exchange, "discovery-stderr.log"), "utf8")).toContain(
      "fixture cli stderr",
    );
    const execution = LocalDiscoveryExecutionRecordV1Schema.parse(
      JSON.parse(await readFile(resolve(exchange, "discovery-execution.json"), "utf8")),
    );
    expect(execution.success).toBe(true);
    expect(execution.extractionMode).toBe("none");
    expect(execution.maximumExtractions).toBe(8);
    expect(execution.frontierImported).toBe(false);
    expect(execution.extractedContentImported).toBe(false);
    expect(execution.extractionTelemetryImported).toBe(false);
    expect(execution.arguments).toEqual([
      "discover",
      resolve(exchange, "discovery-request.v1.json"),
      "--provider-mode",
      "fixture_only",
      "--extraction-mode",
      "none",
      "--structured-content-mode",
      "none",
      "--output",
      resolve(exchange, "search-results.v2.json"),
    ]);
    expect(execution.providerIds).toEqual(["fixture_test_provider"]);
  });

  it("records selected extraction configuration and sidecar paths on successful discovery", async () => {
    const { projectPath, runsDirectory } = await fakeProject();
    const runId = createOpaqueId("run");
    await runtime({
      projectPath,
      runsDirectory,
      extractionMode: "selected_public_pages",
      maximumExtractions: 3,
    }).execute({
      runId,
      request: bridgeRequest(runId),
    });

    const exchange = resolve(runsDirectory, runId, "discovery-exchange");
    const execution = LocalDiscoveryExecutionRecordV1Schema.parse(
      JSON.parse(await readFile(resolve(exchange, "discovery-execution.json"), "utf8")),
    );
    expect(execution.extractionMode).toBe("selected_public_pages");
    expect(execution.maximumExtractions).toBe(3);
    expect(execution.frontierPath).toBe(resolve(exchange, "crawl-frontier.v1.json"));
    expect(execution.extractedContentPath).toBe(resolve(exchange, "extracted-content.v1.json"));
    expect(execution.extractionTelemetryPath).toBe(
      resolve(exchange, "extraction-run-telemetry.v1.json"),
    );
    expect(execution.frontierImported).toBe(false);
    expect(execution.extractedContentImported).toBe(false);
    expect(execution.extractionTelemetryImported).toBe(false);
  });

  it("maps nonzero exit and missing output to explicit failures", async () => {
    const fixture = await fakeProject("nonzero");
    const runId = createOpaqueId("run");
    await expectFailure(
      runtime(fixture).execute({ runId, request: bridgeRequest(runId) }),
      "DISCOVERY_ENGINE_COMMAND_FAILED",
    );
    await setBehavior(fixture.projectPath, "missing");
    await expectFailure(
      runtime(fixture).execute({ runId, request: bridgeRequest(runId) }),
      "DISCOVERY_ENGINE_OUTPUT_MISSING",
    );
  }, 15_000);

  it("rejects malformed JSON, schema mismatch, wrong request IDs, and non-fixture providers", async () => {
    const fixture = await fakeProject("invalid-json");
    const runId = createOpaqueId("run");
    const testCase = async (mode: string, code: string) => {
      await setBehavior(fixture.projectPath, mode);
      await expectFailure(runtime(fixture).execute({ runId, request: bridgeRequest(runId) }), code);
    };
    await testCase("invalid-json", "DISCOVERY_ENGINE_OUTPUT_INVALID_JSON");
    await testCase("wrong-schema", "DISCOVERY_ENGINE_SCHEMA_MISMATCH");
    await testCase("wrong-request", "DISCOVERY_ENGINE_REQUEST_ID_MISMATCH");
    await testCase("unexpected-provider", "DISCOVERY_ENGINE_UNEXPECTED_PROVIDER");
  }, 30_000);

  it("terminates timed-out and aborted child processes", async () => {
    const fixture = await fakeProject("success", 4_000);
    const timedOutRunId = createOpaqueId("run");
    await expectFailure(
      runtime({ ...fixture, timeoutMs: 1_000 }).execute({
        runId: timedOutRunId,
        request: bridgeRequest(timedOutRunId),
      }),
      "DISCOVERY_ENGINE_TIMEOUT",
    );

    const cancelledRunId = createOpaqueId("run");
    const controller = new AbortController();
    const operation = runtime({ ...fixture, timeoutMs: 10_000 }).execute({
      runId: cancelledRunId,
      request: bridgeRequest(cancelledRunId),
      signal: controller.signal,
    });
    setTimeout(() => controller.abort(), 250);
    await expectFailure(operation, "DISCOVERY_ENGINE_CANCELLED");
  }, 20_000);

  it("archives failed exchange evidence before an explicit retry succeeds", async () => {
    const fixture = await fakeProject("invalid-json");
    const runId = createOpaqueId("run");
    await expectFailure(
      runtime(fixture).execute({ runId, request: bridgeRequest(runId) }),
      "DISCOVERY_ENGINE_OUTPUT_INVALID_JSON",
    );
    await setBehavior(fixture.projectPath, "success");
    await runtime(fixture).execute({ runId, request: bridgeRequest(runId) });
    const history = resolve(fixture.runsDirectory, runId, "discovery-exchange", "history");
    expect((await readdir(history)).length).toBeGreaterThan(0);
  }, 15_000);

  it("imports valid live provider telemetry and preserves bounded usage", async () => {
    const fixture = await fakeProject("success");
    const runId = createOpaqueId("run");
    const liveRuntime = runtime({
      ...fixture,
      providerMode: "live_search",
      providerPolicy: "paid_deep",
    });
    const artifact = await liveRuntime.execute({ runId, request: bridgeRequest(runId) });
    expect(artifact.summary.providersUsed).toEqual(["brave_web_search"]);
    const exchange = resolve(fixture.runsDirectory, runId, "discovery-exchange");
    const telemetry = LiveProviderRunTelemetryV1Schema.parse(
      JSON.parse(
        await readFile(
          resolve(exchange, "search-results.v2.json.provider-executions.v1.json"),
          "utf8",
        ),
      ),
    );
    expect(telemetry.usage.braveRequests).toBe(1);
    const execution = LocalDiscoveryExecutionRecordV1Schema.parse(
      JSON.parse(await readFile(resolve(exchange, "discovery-execution.json"), "utf8")),
    );
    expect(execution.providerMode).toBe("live_search");
    expect(execution.providerTelemetryImported).toBe(true);
    expect(execution.providerConfigurationFingerprint).toBe("a".repeat(64));
    expect(execution.providerUsage?.braveRequests).toBe(1);
  }, 15_000);

  it("rejects missing, malformed, mismatched, unsupported, and inconsistent live telemetry", async () => {
    const fixture = await fakeProject("telemetry-missing");
    const runId = createOpaqueId("run");
    const testCase = async (mode: string, code: string) => {
      await setBehavior(fixture.projectPath, mode);
      await expectFailure(
        runtime({ ...fixture, providerMode: "live_search", providerPolicy: "paid_deep" }).execute({
          runId,
          request: bridgeRequest(runId),
        }),
        code,
      );
    };
    await testCase("telemetry-missing", "DISCOVERY_ENGINE_TELEMETRY_MISSING");
    await testCase("telemetry-invalid-json", "DISCOVERY_ENGINE_TELEMETRY_INVALID_JSON");
    await testCase("telemetry-schema-mismatch", "DISCOVERY_ENGINE_TELEMETRY_SCHEMA_MISMATCH");
    await testCase("telemetry-wrong-request", "DISCOVERY_ENGINE_TELEMETRY_REQUEST_ID_MISMATCH");
    await testCase("provider-mode-mismatch", "DISCOVERY_ENGINE_PROVIDER_MODE_MISMATCH");
    await testCase("unexpected-provider", "DISCOVERY_ENGINE_UNEXPECTED_PROVIDER");
    await testCase("usage-mismatch", "DISCOVERY_ENGINE_USAGE_MISMATCH");
  }, 45_000);

  it("accepts honest partial live-provider coverage with warnings", async () => {
    const fixture = await fakeProject("partial-live");
    const runId = createOpaqueId("run");
    const artifact = await runtime({
      ...fixture,
      providerMode: "live_search",
      providerPolicy: "paid_deep",
    }).execute({
      runId,
      request: bridgeRequest(runId),
    });
    expect(artifact.coverage.providersUnavailable).toContain("tavily_search:PROVIDER_RATE_LIMITED");
    const record = LocalDiscoveryExecutionRecordV1Schema.parse(
      JSON.parse(
        await readFile(
          resolve(fixture.runsDirectory, runId, "discovery-exchange", "discovery-execution.json"),
          "utf8",
        ),
      ),
    );
    expect(record.providerWarnings?.join(" ")).toContain("not crawled");
    expect(record.providerUsage?.tavilyRequests).toBe(1);
  }, 15_000);
});
