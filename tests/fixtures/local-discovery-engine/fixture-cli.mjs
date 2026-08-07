import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { writeControlledExtractionSidecars } from "./extraction-sidecars.mjs";
import { writeControlledHiringSidecars } from "./hiring-sidecars.mjs";
import { writeControlledStructuredSidecars } from "./structured-sidecars.mjs";

const args = process.argv.slice(2);
const requestPath = args[0];
const providerModeIndex = args.indexOf("--provider-mode");
const providerPolicyIndex = args.indexOf("--provider-policy");
const extractionModeIndex = args.indexOf("--extraction-mode");
const maximumExtractionsIndex = args.indexOf("--max-extractions");
const structuredContentModeIndex = args.indexOf("--structured-content-mode");
const maximumStructuredResourcesIndex = args.indexOf("--max-structured-resources");
const maximumDocumentResourcesIndex = args.indexOf("--max-document-resources");
const sourceAdapterModeIndex = args.indexOf("--source-adapter-mode");
const sourceFamiliesIndex = args.indexOf("--source-families");
const maximumHiringTargetsIndex = args.indexOf("--max-hiring-targets");
const maximumHiringBoardsPerTargetIndex = args.indexOf("--max-hiring-boards-per-target");
const maximumHiringJobsPerBoardIndex = args.indexOf("--max-hiring-jobs-per-board");
const outputIndex = args.indexOf("--output");
const providerMode = providerModeIndex >= 0 ? args[providerModeIndex + 1] : "fixture_only";
const providerPolicy = providerPolicyIndex >= 0 ? args[providerPolicyIndex + 1] : "free_only";
const extractionMode = extractionModeIndex >= 0 ? args[extractionModeIndex + 1] : "none";
const maximumExtractions =
  maximumExtractionsIndex >= 0 ? Number(args[maximumExtractionsIndex + 1]) : 8;
const structuredContentMode =
  structuredContentModeIndex >= 0 ? args[structuredContentModeIndex + 1] : "none";
const maximumStructuredResources =
  maximumStructuredResourcesIndex >= 0 ? Number(args[maximumStructuredResourcesIndex + 1]) : 8;
const maximumDocumentResources =
  maximumDocumentResourcesIndex >= 0 ? Number(args[maximumDocumentResourcesIndex + 1]) : 4;
const sourceAdapterMode = sourceAdapterModeIndex >= 0 ? args[sourceAdapterModeIndex + 1] : "none";
const sourceFamilies =
  sourceFamiliesIndex >= 0
    ? args[sourceFamiliesIndex + 1]
        .split(",")
        .map((entry) => entry.trim())
        .filter(Boolean)
    : [];
const maximumHiringTargets =
  maximumHiringTargetsIndex >= 0 ? Number(args[maximumHiringTargetsIndex + 1]) : 10;
const maximumHiringBoardsPerTarget =
  maximumHiringBoardsPerTargetIndex >= 0 ? Number(args[maximumHiringBoardsPerTargetIndex + 1]) : 4;
const maximumHiringJobsPerBoard =
  maximumHiringJobsPerBoardIndex >= 0 ? Number(args[maximumHiringJobsPerBoardIndex + 1]) : 250;
const outputPath = outputIndex >= 0 ? args[outputIndex + 1] : undefined;
if (
  !requestPath ||
  !outputPath ||
  !["fixture_only", "live_search"].includes(providerMode) ||
  !["free_only", "balanced", "paid_deep"].includes(providerPolicy) ||
  !["none", "selected_public_pages"].includes(extractionMode) ||
  !["none", "selected_resources"].includes(structuredContentMode) ||
  !Number.isInteger(maximumExtractions) ||
  maximumExtractions < 1 ||
  maximumExtractions > 100 ||
  !Number.isInteger(maximumStructuredResources) ||
  maximumStructuredResources < 1 ||
  maximumStructuredResources > 100 ||
  !Number.isInteger(maximumDocumentResources) ||
  maximumDocumentResources < 1 ||
  maximumDocumentResources > maximumStructuredResources ||
  !["none", "selected_sources"].includes(sourceAdapterMode) ||
  sourceFamilies.some((family) => family !== "hiring") ||
  (sourceAdapterMode === "selected_sources" && !sourceFamilies.includes("hiring")) ||
  !Number.isInteger(maximumHiringTargets) ||
  maximumHiringTargets < 1 ||
  maximumHiringTargets > 100 ||
  !Number.isInteger(maximumHiringBoardsPerTarget) ||
  maximumHiringBoardsPerTarget < 1 ||
  maximumHiringBoardsPerTarget > 20 ||
  !Number.isInteger(maximumHiringJobsPerBoard) ||
  maximumHiringJobsPerBoard < 1 ||
  maximumHiringJobsPerBoard > 1000 ||
  (structuredContentMode === "selected_resources" && extractionMode !== "selected_public_pages")
) {
  console.error(
    "Usage: pnpm discover <request.json> --provider-mode <fixture_only|live_search> [--provider-policy <free_only|balanced|paid_deep>] --extraction-mode <none|selected_public_pages> [--max-extractions <1-100>] --structured-content-mode <none|selected_resources> [--max-structured-resources <1-100>] [--max-document-resources <1-total>] --output <artifact.json>",
  );
  process.exit(2);
}

const behavior =
  process.env.CLUVVI_TEST_BEHAVIOR === undefined
    ? JSON.parse(await readFile(resolve("behavior.json"), "utf8"))
    : JSON.parse(process.env.CLUVVI_TEST_BEHAVIOR);
if (behavior.mode === "nonzero" || behavior.mode === "all-free-fail") {
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
  await writeControlledExtractionSidecars({
    outputPath,
    searchResults: artifact,
    behavior,
    extractionMode,
    maximumExtractions,
  });
  await writeControlledStructuredSidecars({
    outputPath,
    searchResults: artifact,
    behavior,
    structuredContentMode,
    maximumStructuredResources,
    maximumDocumentResources,
  });
  await writeControlledHiringSidecars({
    outputPath,
    searchResults: artifact,
    behavior,
    sourceAdapterMode,
    sourceFamilies,
    maximumHiringTargets,
    maximumHiringBoardsPerTarget,
    maximumHiringJobsPerBoard,
  });
  console.log(`Wrote fixture search_results.v2 for ${request.requestId}.`);
  process.exit(0);
}

const freeOnly = providerPolicy === "free_only";
const freeDuckSuccess = freeOnly && behavior.mode === "free-ddg-success";
const freeDuckInsufficient = freeOnly && behavior.mode === "free-ddg-insufficient";
const balancedFallback =
  providerPolicy === "balanced" &&
  ["balanced-fallback", "balanced-no-reason", "balanced-paid-first"].includes(behavior.mode);
const balancedFreeSuccess = providerPolicy === "balanced" && !balancedFallback;
const policyViolation = behavior.mode === "policy-violation";
const providerId = policyViolation
  ? "tavily_search"
  : freeOnly
    ? freeDuckSuccess
      ? "duckduckgo_html_search"
      : "startpage_html_search"
    : balancedFallback
      ? "brave_web_search"
      : balancedFreeSuccess
        ? "duckduckgo_html_search"
        : "brave_web_search";
const providerCategory = (freeOnly || balancedFreeSuccess) && !policyViolation ? "free" : "paid";
const results = template.results.map((result, index) => ({
  ...result,
  providerId,
  providerCategory,
  url: `https://example.com/live-result-${index + 1}`,
  domain: "example.com",
  raw: undefined,
}));
const paidCreditsUsed =
  behavior.mode === "usage-mismatch" || providerId === "tavily_search" ? 1 : 0;
const artifact = {
  ...template,
  requestId: request.requestId,
  discoveryMode: providerPolicy,
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
      providerCategory,
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
    providersUnavailable: freeOnly
      ? freeDuckSuccess || freeDuckInsufficient
        ? ["searxng_search:PROVIDER_UNCONFIGURED"]
        : ["searxng_search:PROVIDER_UNCONFIGURED", "duckduckgo_html_search:DDG_CHALLENGE_DETECTED"]
      : behavior.mode === "partial-live"
        ? ["duckduckgo_html_search:DDG_CHALLENGE_DETECTED"]
        : [],
  },
  warnings: [
    "Controlled live search snippets only; full pages were not opened or extracted.",
    ...(freeOnly ? ["Free-only policy blocked Tavily and Brave before provider execution."] : []),
    ...(behavior.mode === "partial-live"
      ? ["DDG_CHALLENGE_DETECTED: DuckDuckGo returned a challenge page."]
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
  providerId,
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
  providerUsage:
    providerId === "brave_web_search"
      ? { braveRequests: 1 }
      : providerId === "tavily_search"
        ? { tavilyCredits: 1 }
        : { freeRequests: 1 },
};
const freeFailures =
  freeOnly && !freeDuckSuccess && !freeDuckInsufficient
    ? [
        {
          providerId: "duckduckgo_html_search",
          queryId: "plan_controlled_live",
          sourceZone: "general_web",
          searchMethod: "keyword_search",
          operation: "search",
          startedAt: now,
          completedAt: now,
          durationMs: 0,
          attempts: 1,
          statusCode: 200,
          resultsReceived: 0,
          resultsAccepted: 0,
          rateLimited: false,
          success: false,
          errorCode: "DDG_CHALLENGE_DETECTED",
          safeErrorMessage: "DuckDuckGo returned a challenge page.",
        },
      ]
    : [];
const insufficientDuckExecution = freeDuckInsufficient
  ? [
      {
        providerId: "duckduckgo_html_search",
        queryId: "plan_controlled_live",
        sourceZone: "general_web",
        searchMethod: "keyword_search",
        operation: "search",
        startedAt: now,
        completedAt: now,
        durationMs: 0,
        attempts: 1,
        statusCode: 200,
        resultsReceived: 1,
        resultsAccepted: 1,
        rateLimited: false,
        success: true,
        providerUsage: { freeRequests: 1 },
      },
    ]
  : [];
const providerExecutions = [...freeFailures, ...insufficientDuckExecution, successfulExecution];
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
    searxng_search: { used: 0, limit: 4 },
    duckduckgo_html_search: {
      used: freeOnly || balancedFreeSuccess ? 1 : 0,
      limit: 3,
    },
    startpage_html_search: { used: providerId === "startpage_html_search" ? 1 : 0, limit: 3 },
    tavily_search: { used: providerId === "tavily_search" ? 1 : 0, limit: 3 },
    brave_web_search: { used: providerId === "brave_web_search" ? 1 : 0, limit: 3 },
  },
  usage: {
    tavilyRequests: providerId === "tavily_search" ? 1 : 0,
    tavilyCredits: providerId === "tavily_search" ? 1 : 0,
    braveRequests: providerId === "brave_web_search" ? 1 : 0,
    hackerNewsAlgoliaRequests: 0,
    hackerNewsFirebaseRequests: 0,
    searxngRequests: 0,
    duckDuckGoRequests: freeOnly || balancedFreeSuccess ? 1 : 0,
    startpageRequests: providerId === "startpage_html_search" ? 1 : 0,
  },
  warnings: artifact.warnings,
};
if (behavior.mode === "telemetry-schema-mismatch") delete telemetry.usage;
await writeFile(telemetryPath, `${JSON.stringify(telemetry, null, 2)}\n`, "utf8");

const tracePath = `${outputPath}.provider-policy-trace.v1.json`;
if (behavior.mode === "policy-trace-missing") process.exit(0);
if (behavior.mode === "policy-trace-invalid-json") {
  await writeFile(tracePath, "{invalid-json", "utf8");
  process.exit(0);
}
const freeAttempts = freeOnly
  ? freeDuckSuccess
    ? [
        {
          providerId: "searxng_search",
          order: 1,
          attempted: false,
          skippedReason: "SearXNG is unconfigured.",
          outcome: "failed",
          acceptedResults: 0,
          uniqueDomains: 0,
          duplicateRatio: 0,
          paid: false,
          safeFailureCode: "PROVIDER_UNCONFIGURED",
        },
        {
          providerId: "duckduckgo_html_search",
          order: 2,
          attempted: true,
          outcome: "success",
          acceptedResults: results.length,
          uniqueDomains: 1,
          duplicateRatio: 0,
          paid: false,
        },
        {
          providerId: "startpage_html_search",
          order: 3,
          attempted: false,
          skippedReason: "Free coverage was sufficient after DuckDuckGo.",
          outcome: "success",
          acceptedResults: 0,
          uniqueDomains: 0,
          duplicateRatio: 0,
          paid: false,
        },
      ]
    : freeDuckInsufficient
      ? [
          {
            providerId: "searxng_search",
            order: 1,
            attempted: false,
            skippedReason: "SearXNG is unconfigured.",
            outcome: "failed",
            acceptedResults: 0,
            uniqueDomains: 0,
            duplicateRatio: 0,
            paid: false,
            safeFailureCode: "PROVIDER_UNCONFIGURED",
          },
          {
            providerId: "duckduckgo_html_search",
            order: 2,
            attempted: true,
            outcome: "insufficient_coverage",
            acceptedResults: 1,
            uniqueDomains: 1,
            duplicateRatio: 0,
            paid: false,
          },
          {
            providerId: "startpage_html_search",
            order: 3,
            attempted: true,
            outcome: "success",
            acceptedResults: results.length,
            uniqueDomains: 1,
            duplicateRatio: 0,
            paid: false,
          },
        ]
      : [
          {
            providerId: "searxng_search",
            order: 1,
            attempted: false,
            skippedReason: "SearXNG is unconfigured.",
            outcome: "failed",
            acceptedResults: 0,
            uniqueDomains: 0,
            duplicateRatio: 0,
            paid: false,
            safeFailureCode: "PROVIDER_UNCONFIGURED",
          },
          {
            providerId: "duckduckgo_html_search",
            order: 2,
            attempted: true,
            outcome: "failed",
            acceptedResults: 0,
            uniqueDomains: 0,
            duplicateRatio: 0,
            paid: false,
            safeFailureCode: "DDG_CHALLENGE_DETECTED",
          },
          {
            providerId: "startpage_html_search",
            order: 3,
            attempted: true,
            outcome: "success",
            acceptedResults: results.length,
            uniqueDomains: 1,
            duplicateRatio: 0,
            paid: false,
          },
        ]
  : balancedFallback
    ? behavior.mode === "balanced-paid-first"
      ? [
          {
            providerId: "brave_web_search",
            order: 1,
            attempted: true,
            outcome: "success",
            acceptedResults: results.length,
            uniqueDomains: 1,
            duplicateRatio: 0,
            paid: true,
          },
          {
            providerId: "startpage_html_search",
            order: 2,
            attempted: true,
            outcome: "insufficient_coverage",
            acceptedResults: 1,
            uniqueDomains: 1,
            duplicateRatio: 0,
            paid: false,
          },
        ]
      : [
          {
            providerId: "startpage_html_search",
            order: 1,
            attempted: true,
            outcome: "insufficient_coverage",
            acceptedResults: 1,
            uniqueDomains: 1,
            duplicateRatio: 0,
            paid: false,
          },
          {
            providerId: "brave_web_search",
            order: 2,
            attempted: true,
            outcome: "success",
            acceptedResults: results.length,
            uniqueDomains: 1,
            duplicateRatio: 0,
            paid: true,
          },
        ]
    : [
        {
          providerId,
          order: 1,
          attempted: true,
          outcome: "success",
          acceptedResults: results.length,
          uniqueDomains: 1,
          duplicateRatio: 0,
          paid: providerCategory === "paid",
        },
      ];
const trace = {
  schemaVersion: "1.0",
  artifactKind: "provider_policy_trace.v1",
  requestId: behavior.mode === "policy-trace-wrong-request" ? "wrong_request" : request.requestId,
  providerPolicy: behavior.mode === "policy-mismatch" ? "paid_deep" : providerPolicy,
  queries: [
    {
      queryId: "plan_controlled_live",
      sourceZone: "general_web",
      searchMethod: "keyword_search",
      attempts: freeAttempts,
      finalDecision: balancedFallback
        ? "paid_fallback_used"
        : freeOnly || balancedFreeSuccess
          ? "sufficient_free_coverage"
          : "paid_fallback_used",
      ...(balancedFallback && behavior.mode !== "balanced-no-reason"
        ? { paidFallbackReason: "Accepted results 1 are below 5." }
        : providerPolicy === "paid_deep"
          ? { paidFallbackReason: "paid_deep permits immediate paid-provider execution." }
          : {}),
    },
  ],
  paidProviderAttempted: policyViolation || balancedFallback || providerPolicy === "paid_deep",
  paidFallbackUsed: balancedFallback,
  warnings: artifact.warnings,
};
if (behavior.mode === "policy-trace-schema-mismatch") delete trace.queries;
await writeFile(tracePath, `${JSON.stringify(trace, null, 2)}\n`, "utf8");
await writeControlledExtractionSidecars({
  outputPath,
  searchResults: artifact,
  behavior,
  extractionMode,
  maximumExtractions,
});
await writeControlledStructuredSidecars({
  outputPath,
  searchResults: artifact,
  behavior,
  structuredContentMode,
  maximumStructuredResources,
  maximumDocumentResources,
});
console.log(
  `Wrote live search_results.v2, provider telemetry, and provider policy trace for ${request.requestId}.`,
);
