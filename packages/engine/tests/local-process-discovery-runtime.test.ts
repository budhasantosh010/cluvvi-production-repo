import {
  DiscoveryRequestV1Schema,
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
const [inputPath, outputFlag, outputPath] = process.argv.slice(2);
const behavior = JSON.parse(await readFile(resolve("behavior.json"), "utf8"));
console.log("fixture cli stdout");
console.error("fixture cli stderr");
if (behavior.delayMs) await new Promise((resolveDelay) => setTimeout(resolveDelay, behavior.delayMs));
if (behavior.mode === "nonzero") process.exit(7);
if (behavior.mode === "missing") process.exit(0);
if (outputFlag !== "--output" || !inputPath || !outputPath) process.exit(9);
if (behavior.mode === "invalid-json") {
  await writeFile(outputPath, "{not-json", "utf8");
  process.exit(0);
}
const request = JSON.parse(await readFile(inputPath, "utf8"));
const providerCategory = behavior.mode === "unexpected-provider" ? "paid" : "fixture";
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
    providersUsed: ["fixture_test_provider"],
    rawResults: 0,
    dedupedResults: 0,
    paidCreditsUsed: behavior.mode === "unexpected-provider" ? 1 : 0,
    startedAt: "2026-08-01T10:00:00.000Z",
    completedAt: "2026-08-01T10:00:01.000Z"
  },
  providerBreakdown: [{
    providerId: "fixture_test_provider",
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
    providersUsed: ["fixture_test_provider"],
    providersUnavailable: [],
    manualReviewRecommended: [],
    confidenceLimitations: ["Fixture-only controlled test output."],
    nextBestSearches: []
  },
  warnings: ["Fixture-only controlled test output; not live discovery."]
};
await writeFile(outputPath, JSON.stringify(artifact, null, 2) + "\\n", "utf8");
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

function runtime(input: { projectPath: string; runsDirectory: string; timeoutMs?: number }) {
  return new LocalProcessDiscoveryRuntime({
    config: {
      projectPath: input.projectPath,
      command: "pnpm",
      timeoutMs: input.timeoutMs ?? 60_000,
      keepExchangeFiles: true,
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
    expect(execution.arguments).toEqual([
      "discover",
      resolve(exchange, "discovery-request.v1.json"),
      "--output",
      resolve(exchange, "search-results.v2.json"),
    ]);
    expect(execution.providerIds).toEqual(["fixture_test_provider"]);
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
});
