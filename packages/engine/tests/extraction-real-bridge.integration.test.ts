import {
  BuyerMapArtifactV1Schema,
  CrawlFrontierArtifactV1Schema,
  EvidenceFindingsArtifactV1Schema,
  ExtractedContentArtifactV1Schema,
  ExtractionRunTelemetryV1Schema,
  LocalDiscoveryExecutionRecordV1Schema,
  MissionInputSchemaV1,
  ProviderPolicyTraceV1Schema,
  SearchResultsArtifactV2Schema,
} from "@cluvvi/core";
import { SqliteCluvviStore } from "@cluvvi/storage";
import { randomUUID } from "node:crypto";
import { readFile, rm } from "node:fs/promises";
import { resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  CluvviEngine,
  LocalArtifactWriter,
  LocalProcessDiscoveryRuntime,
  createDefaultStageRegistry,
  discoveryExchangePaths,
  readLiveProviderTelemetry,
  readProviderPolicyTrace,
} from "../src";

const projectPath = process.env["CLUVVI_DISCOVERY_ENGINE_PATH"]?.trim();
const expectedProjectSha = process.env["CLUVVI_DISCOVERY_ENGINE_EXPECTED_SHA"]?.trim();
const integration =
  process.env["RUN_EXTRACTION_DISCOVERY_INTEGRATION"] === "1" && projectPath
    ? describe
    : describe.skip;
const cleanupDirectories: string[] = [];
const preservedRoot = process.env["C1I_REAL_INTEGRATION_ROOT"]?.trim();

afterEach(async () => {
  if (process.env["KEEP_C1I_REAL_INTEGRATION_OUTPUT"] === "1") return;
  await Promise.all(
    cleanupDirectories.splice(0).map((path) => rm(path, { recursive: true, force: true })),
  );
});

integration("C1-I real Project A extracted-evidence bridge", () => {
  it("imports real free-search extraction sidecars and carries public-page provenance downstream", async () => {
    const root =
      preservedRoot === undefined
        ? resolve(process.cwd(), ".cluvvi-test", randomUUID())
        : resolve(preservedRoot);
    await rm(root, { recursive: true, force: true });
    cleanupDirectories.push(root);
    if (process.env["KEEP_C1I_REAL_INTEGRATION_OUTPUT"] === "1") {
      console.info(`C1I_REAL_INTEGRATION_ROOT=${root}`);
    }
    const runsDirectory = resolve(root, "runs");
    const store = new SqliteCluvviStore({
      databasePath: resolve(root, "cluvvi.sqlite"),
      migrationsDirectory: resolve(process.cwd(), "packages/storage/migrations"),
    });
    const artifactWriter = new LocalArtifactWriter(runsDirectory);
    const discoveryRuntime = new LocalProcessDiscoveryRuntime({
      config: {
        projectPath: projectPath as string,
        command: process.env["CLUVVI_DISCOVERY_ENGINE_COMMAND"]?.trim() || "pnpm",
        timeoutMs: 180_000,
        keepExchangeFiles: true,
        providerMode: "live_search",
        providerPolicy: "free_only",
        extractionMode: "selected_public_pages",
        maximumExtractions: 3,
        extractorVersion: "basic_public_html_extractor@1.0.0",
        frontierPolicyVersion: "frontier_policy@1.0.0",
        providerEnvironment: {
          DISCOVERY_LIVE_PROVIDERS:
            "hacker_news_algolia,hacker_news_firebase,searxng_search,duckduckgo_html_search,startpage_html_search",
          DISCOVERY_LIVE_MAX_QUERIES: "3",
          DISCOVERY_MAX_RESULTS_PER_PROVIDER: "4",
          DISCOVERY_HN_ALGOLIA_MAX_REQUESTS_PER_RUN: "3",
          DISCOVERY_HN_FIREBASE_MAX_ITEMS_PER_RUN: "3",
          DISCOVERY_SEARXNG_MAX_REQUESTS_PER_RUN: "1",
          DISCOVERY_DDG_MAX_REQUESTS_PER_RUN: "2",
          DISCOVERY_STARTPAGE_MAX_REQUESTS_PER_RUN: "2",
          DISCOVERY_FREE_SEARCH_MIN_RESULTS: "3",
          DISCOVERY_FREE_SEARCH_MIN_UNIQUE_DOMAINS: "2",
          DISCOVERY_HTTP_TIMEOUT_MS: "20000",
          DISCOVERY_HTTP_MAX_ATTEMPTS: "1",
          DISCOVERY_HTTP_CONCURRENCY: "2",
          DISCOVERY_EXTRACTION_MAX_URLS_PER_QUERY: "3",
          DISCOVERY_EXTRACTION_MAX_URLS_PER_DOMAIN: "2",
          DISCOVERY_EXTRACTION_MIN_PRIORITY: "0",
          DISCOVERY_EXTRACTION_TIMEOUT_MS: "15000",
          DISCOVERY_EXTRACTION_MAX_ATTEMPTS: "1",
          DISCOVERY_EXTRACTION_MAX_CONCURRENCY: "2",
          DISCOVERY_EXTRACTION_MAX_DOMAIN_CONCURRENCY: "1",
          DISCOVERY_EXTRACTION_MIN_DOMAIN_DELAY_MS: "250",
          DISCOVERY_EXTRACTION_MAX_REDIRECTS: "5",
          DISCOVERY_EXTRACTION_MAX_HTML_BYTES: "3145728",
          DISCOVERY_EXTRACTION_MAX_TEXT_CHARACTERS: "50000",
          DISCOVERY_EXTRACTION_MIN_USEFUL_CHARACTERS: "120",
          DISCOVERY_EXTRACTION_RESPECT_ROBOTS: "true",
          DISCOVERY_EXTRACTION_ROBOTS_FAILURE_POLICY: "allow_with_warning",
          DISCOVERY_EXTRACTION_USER_AGENT: "CluvviC1IIntegration/1.0",
        },
      },
      runsDirectory,
    });
    const engine = new CluvviEngine({
      store,
      artifactWriter,
      stages: createDefaultStageRegistry({ discoveryRuntime }),
      discoveryRuntimeMode: discoveryRuntime.mode,
      discoveryProviderMode: discoveryRuntime.providerMode,
      discoveryProviderPolicy: discoveryRuntime.providerPolicy,
      discoveryExtractionMode: discoveryRuntime.extractionMode,
      discoveryMaximumExtractions: discoveryRuntime.maximumExtractions,
      extractorVersion: discoveryRuntime.extractorVersion,
      frontierPolicyVersion: discoveryRuntime.frontierPolicyVersion,
      providerConfigurationFingerprint: discoveryRuntime.providerConfigurationFingerprint,
      extractionConfigurationFingerprint: discoveryRuntime.extractionConfigurationFingerprint,
    });

    try {
      const result = await engine.start({
        mission: MissionInputSchemaV1.parse({
          schemaVersion: "1.0",
          name: "Real free public-page extraction",
          description:
            "Find public evidence that podcast agencies, creator businesses, and software teams have video editing workflow, automation, integration, capacity, or turnaround problems.",
          customerOutcome: "Publish long-form content faster with less manual editing.",
          geographies: ["global"],
          desiredOpportunities: 12,
          exclusions: ["full internal team", "long-term vendor contract"],
          badCustomerExamples: [],
        }),
        sourceFile: "integration://real-c1-i-project-a-bridge",
      });

      expect(result.run.status).toBe("completed");
      expect(result.run.config.discoveryProviderPolicy).toBe("free_only");
      expect(result.run.config.discoveryExtractionMode).toBe("selected_public_pages");
      expect(result.run.config.discoveryMaximumExtractions).toBe(3);

      const artifact = (artifactType: string) =>
        result.artifacts.find((entry) => entry.artifactType === artifactType)?.data;
      const search = SearchResultsArtifactV2Schema.parse(artifact("search_results"));
      const frontier = CrawlFrontierArtifactV1Schema.parse(artifact("crawl_frontier"));
      const extracted = ExtractedContentArtifactV1Schema.parse(artifact("extracted_content"));
      const extractionTelemetry = ExtractionRunTelemetryV1Schema.parse(
        artifact("extraction_telemetry"),
      );

      expect(search.results.length).toBeGreaterThan(0);
      expect(search.summary.providersUsed).not.toContain("fixture_search_provider");
      expect(search.summary.providersUsed).not.toContain("tavily_search");
      expect(search.summary.providersUsed).not.toContain("brave_web_search");
      expect(search.summary.paidCreditsUsed).toBe(0);
      expect(search.results.every((entry) => entry.providerCategory === "free")).toBe(true);
      expect(search.results.every((entry) => !entry.url.includes(".invalid"))).toBe(true);

      expect(frontier.requestId).toBe(search.requestId);
      expect(frontier.summary.selected).toBeGreaterThan(0);
      expect(frontier.summary.selected).toBeLessThanOrEqual(3);
      expect(extracted.requestId).toBe(search.requestId);
      expect(extracted.frontierArtifactId).toBe(frontier.artifactId);
      expect(extracted.summary.selectedUrls).toBe(frontier.summary.selected);
      expect(extractionTelemetry.requestId).toBe(search.requestId);
      expect(extractionTelemetry.extractedContentArtifactId).toBe(extracted.artifactId);
      expect(extractionTelemetry.totals.attemptedRequests).toBeGreaterThan(0);
      expect(
        extracted.summary.successfulExtractions + extracted.summary.partialExtractions,
      ).toBeGreaterThan(0);
      expect(extracted.items.length).toBe(frontier.summary.selected);

      const liveTelemetry = await readLiveProviderTelemetry({
        runsDirectory,
        runId: result.run.id,
      });
      expect(liveTelemetry).not.toBeNull();
      expect(liveTelemetry?.usage.tavilyRequests).toBe(0);
      expect(liveTelemetry?.usage.tavilyCredits).toBe(0);
      expect(liveTelemetry?.usage.braveRequests).toBe(0);
      const policyTrace = ProviderPolicyTraceV1Schema.parse(
        await readProviderPolicyTrace({ runsDirectory, runId: result.run.id }),
      );
      expect(policyTrace.providerPolicy).toBe("free_only");
      expect(policyTrace.paidProviderAttempted).toBe(false);
      expect(policyTrace.paidFallbackUsed).toBe(false);

      const evidence = EvidenceFindingsArtifactV1Schema.parse(artifact("evidence_findings"));
      expect(evidence.evidenceSourceMode).toBe("snippet_plus_extracted_public_pages");
      expect(
        evidence.materials.some(
          (material) =>
            material.kind === "extracted_page_text" &&
            material.trustClassification === "untrusted_public_content",
        ),
      ).toBe(true);
      const buyerMap = BuyerMapArtifactV1Schema.parse(artifact("buyer_map"));
      expect(buyerMap.evidenceSourceMode).toBe("snippet_plus_extracted_public_pages");
      expect(buyerMap.summary.extractedEvidenceCitationCount).toBeGreaterThan(0);
      expect(
        buyerMap.opportunities.some((opportunity) =>
          opportunity.evidence.some(
            (citation) =>
              citation.materialId !== undefined &&
              citation.extractionItemId !== undefined &&
              citation.trustClassification === "untrusted_public_content",
          ),
        ),
      ).toBe(true);

      const paths = discoveryExchangePaths(runsDirectory, result.run.id);
      const execution = LocalDiscoveryExecutionRecordV1Schema.parse(
        JSON.parse(await readFile(paths.executionPath, "utf8")) as unknown,
      );
      expect(execution.success).toBe(true);
      expect(execution.providerTelemetryImported).toBe(true);
      expect(execution.providerPolicyTraceImported).toBe(true);
      expect(execution.frontierImported).toBe(true);
      expect(execution.extractedContentImported).toBe(true);
      expect(execution.extractionTelemetryImported).toBe(true);
      expect(execution.extractionMode).toBe("selected_public_pages");
      expect(execution.maximumExtractions).toBe(3);
      expect(execution.arguments).toEqual(
        expect.arrayContaining([
          "--provider-mode",
          "live_search",
          "--provider-policy",
          "free_only",
          "--extraction-mode",
          "selected_public_pages",
          "--max-extractions",
          "3",
        ]),
      );
      expect(execution.projectCommitSha).toMatch(/^[a-f0-9]{40}$/u);
      if (expectedProjectSha !== undefined && expectedProjectSha.length > 0) {
        expect(execution.projectCommitSha).toBe(expectedProjectSha);
      }

      const serialized = JSON.stringify({
        search,
        frontier,
        extracted,
        extractionTelemetry,
        execution,
      });
      expect(serialized).not.toMatch(
        /rawHtml|raw_html|authorization|cookie|api[_-]?key|subscription[_-]?token|process\.env/u,
      );

      console.info(
        `C1I_REAL_PROJECT_A_BRIDGE=${JSON.stringify({
          projectCommitSha: execution.projectCommitSha,
          providersUsed: search.summary.providersUsed,
          pagesSelected: frontier.summary.selected,
          pagesAttempted: extractionTelemetry.totals.attemptedRequests,
          pagesSuccessful: extracted.summary.successfulExtractions,
          pagesPartial: extracted.summary.partialExtractions,
          pagesFailed: extracted.summary.failedExtractions,
          extractedEvidenceCitations: buyerMap.summary.extractedEvidenceCitationCount,
          tavilyRequests: liveTelemetry?.usage.tavilyRequests ?? 0,
          tavilyCredits: liveTelemetry?.usage.tavilyCredits ?? 0,
          braveRequests: liveTelemetry?.usage.braveRequests ?? 0,
          paidCreditsUsed: search.summary.paidCreditsUsed,
        })}`,
      );
    } finally {
      await store.close();
    }
  }, 210_000);
});
