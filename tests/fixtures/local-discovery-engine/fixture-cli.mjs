import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const args = process.argv.slice(2);
const requestPath = args[0];
const providerModeIndex = args.indexOf("--provider-mode");
const outputIndex = args.indexOf("--output");
const providerMode = providerModeIndex >= 0 ? args[providerModeIndex + 1] : "fixture_only";
const outputPath = outputIndex >= 0 ? args[outputIndex + 1] : undefined;
if (!requestPath || !outputPath || !["fixture_only", "live_search"].includes(providerMode)) {
  console.error(
    "Usage: pnpm discover <request.json> --provider-mode <fixture_only|live_search> --output <artifact.json>",
  );
  process.exit(2);
}

const behavior = JSON.parse(await readFile(resolve("behavior.json"), "utf8"));
if (behavior.mode === "nonzero") {
  console.error("Controlled local Discovery Engine failure.");
  process.exit(7);
}
if (behavior.mode === "invalid-json") {
  await writeFile(outputPath, "{invalid-json", "utf8");
  process.exit(0);
}
if (behavior.mode === "timeout") {
  await new Promise((resolveDelay) => setTimeout(resolveDelay, 120_000));
}

const request = JSON.parse(await readFile(requestPath, "utf8"));
const templatePath = resolve(
  process.cwd(),
  "../../../packages/engine/src/fixtures/video-editing-pipeline.search-results.v2.json",
);
const template = JSON.parse(await readFile(templatePath, "utf8"));

if (providerMode === "fixture_only") {
  const artifact = { ...template, requestId: request.requestId };
  await writeFile(outputPath, `${JSON.stringify(artifact, null, 2)}\n`, "utf8");
  console.log(`Wrote fixture search_results.v2 for ${request.requestId}.`);
  process.exit(0);
}

const providerId =
  behavior.mode === "unexpected-provider" ? "unknown_live_provider" : "brave_web_search";
const results = template.results.map((result, index) => ({
  ...result,
  providerId,
  providerCategory: "paid",
  url: `https://example.com/live-result-${index + 1}`,
  domain: "example.com",
  raw: undefined,
}));
const paidCreditsUsed = behavior.mode === "usage-mismatch" ? 1 : 0;
const artifact = {
  ...template,
  requestId: request.requestId,
  discoveryMode: "balanced",
  summary: {
    ...template.summary,
    providersUsed: [providerId],
    paidCreditsUsed,
    rawResults: results.length,
    dedupedResults: results.length,
  },
  providerBreakdown: [
    {
      providerId,
      providerCategory: "paid",
      sourceZone: "general_web",
      searchMethod: "keyword_search",
      queriesExecuted: 1,
      resultsReturned: results.length,
      errors: 0,
    },
  ],
  results,
  coverage: {
    ...template.coverage,
    searchedSourceZones: ["general_web"],
    providersUsed: [providerId],
    providersUnavailable:
      behavior.mode === "partial-live" ? ["tavily_search:PROVIDER_RATE_LIMITED"] : [],
  },
  warnings: [
    "Controlled live search snippets only; pages were not crawled or deeply extracted.",
    ...(behavior.mode === "partial-live"
      ? ["PROVIDER_RATE_LIMITED: tavily_search returned HTTP 429."]
      : []),
  ],
};
await writeFile(outputPath, `${JSON.stringify(artifact, null, 2)}\n`, "utf8");

const telemetryPath = `${outputPath}.provider-executions.v1.json`;
if (behavior.mode === "telemetry-missing") process.exit(0);
if (behavior.mode === "telemetry-invalid-json") {
  await writeFile(telemetryPath, "{invalid-json", "utf8");
  process.exit(0);
}

const now = new Date().toISOString();
const successfulExecution = {
  providerId: "brave_web_search",
  queryId: "plan_controlled_live",
  sourceZone: "general_web",
  searchMethod: "keyword_search",
  operation: "search",
  startedAt: now,
  completedAt: now,
  durationMs: 0,
  attempts: 1,
  statusCode: 200,
  resultsReceived: results.length,
  resultsAccepted: results.length,
  rateLimited: false,
  success: true,
  providerUsage: { braveRequests: 1 },
};
const providerExecutions = [
  successfulExecution,
  ...(behavior.mode === "partial-live"
    ? [
        {
          providerId: "tavily_search",
          queryId: "plan_controlled_live",
          sourceZone: "general_web",
          searchMethod: "keyword_search",
          operation: "search",
          startedAt: now,
          completedAt: now,
          durationMs: 0,
          attempts: 1,
          statusCode: 429,
          resultsReceived: 0,
          resultsAccepted: 0,
          rateLimited: true,
          success: false,
          errorCode: "PROVIDER_RATE_LIMITED",
          safeErrorMessage: "tavily_search returned HTTP 429.",
        },
      ]
    : []),
];
const telemetry = {
  schemaVersion: "1.0",
  artifactKind: "live_provider_run_telemetry.v1",
  requestId: behavior.mode === "telemetry-wrong-request" ? "run_wrong_request" : request.requestId,
  providerMode: behavior.mode === "provider-mode-mismatch" ? "fixture_only" : "live_search",
  configurationFingerprint: "a".repeat(64),
  generatedAt: now,
  providerExecutions,
  budget: {
    hacker_news_algolia: { used: 0, limit: 4 },
    hacker_news_firebase: { used: 0, limit: 8 },
    tavily_search: { used: behavior.mode === "partial-live" ? 1 : 0, limit: 3 },
    brave_web_search: { used: 1, limit: 3 },
  },
  usage: {
    tavilyRequests: behavior.mode === "partial-live" ? 1 : 0,
    tavilyCredits: 0,
    braveRequests: 1,
    hackerNewsAlgoliaRequests: 0,
    hackerNewsFirebaseRequests: 0,
  },
  warnings: artifact.warnings,
};
if (behavior.mode === "telemetry-schema-mismatch") delete telemetry.usage;
await writeFile(telemetryPath, `${JSON.stringify(telemetry, null, 2)}\n`, "utf8");
console.log(`Wrote live search_results.v2 and provider telemetry for ${request.requestId}.`);
