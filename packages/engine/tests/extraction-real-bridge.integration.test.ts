import {
  BuyerMapArtifactV1Schema,
  ContentParseTelemetryV1Schema,
  CrawlFrontierArtifactV1Schema,
  EvidenceFindingsArtifactV1Schema,
  ExtractedContentArtifactV1Schema,
  ExtractionRunTelemetryV1Schema,
  LocalDiscoveryExecutionRecordV1Schema,
  MissionInputSchemaV1,
  ProviderPolicyTraceV1Schema,
  SearchResultsArtifactV2Schema,
  StructuredContentArtifactV1Schema,
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
        structuredContentMode: "selected_resources",
        maximumStructuredResources: 3,
        maximumDocumentResources: 1,
        extractorVersion: "basic_public_html_extractor@1.0.0",
        frontierPolicyVersion: "frontier_policy@1.0.0",
        structuredParserPolicyVersion: "structured_parser_policy@1.0.0",
        anydocParserVersion: "@firecrawl/anydoc@0.1.6",
        htmlMarkdownRendererVersion: "sanitized_html_to_gfm@1.0.0",
        extractionQualityEvaluatorVersion: "extraction_quality@1.0.0",
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
          DISCOVERY_EXTRACTION_USER_AGENT: "CluvviC1I5Integration/1.0",
          DISCOVERY_STRUCTURED_MAX_RESOURCES: "3",
          DISCOVERY_STRUCTURED_MAX_DOCUMENT_RESOURCES: "1",
          DISCOVERY_DOCUMENT_MAX_BYTES: "10485760",
          DISCOVERY_DOCUMENT_PARSE_TIMEOUT_MS: "30000",
          DISCOVERY_DOCUMENT_WORKER_MAX_ATTEMPTS: "1",
          DISCOVERY_MARKDOWN_MAX_CHARACTERS: "200000",
          DISCOVERY_SECTIONS_MAX_PER_RESOURCE: "500",
          DISCOVERY_TABLES_MAX_PER_RESOURCE: "100",
          DISCOVERY_LINKS_MAX_PER_RESOURCE: "1000",
          DISCOVERY_FOOTNOTES_MAX_PER_RESOURCE: "200",
          DISCOVERY_ASSETS_MAX_PER_RESOURCE: "200",
          DISCOVERY_ANYDOC_ENABLED: "true",
          DISCOVERY_HTML_MARKDOWN_ENABLED: "true",
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
      discoveryStructuredContentMode: discoveryRuntime.structuredContentMode,
      discoveryMaximumStructuredResources: discoveryRuntime.maximumStructuredResources,
      discoveryMaximumDocumentResources: discoveryRuntime.maximumDocumentResources,
      extractorVersion: discoveryRuntime.extractorVersion,
      frontierPolicyVersion: discoveryRuntime.frontierPolicyVersion,
      structuredParserPolicyVersion: discoveryRuntime.structuredParserPolicyVersion,
      anydocParserVersion: discoveryRuntime.anydocParserVersion,
      htmlMarkdownRendererVersion: discoveryRuntime.htmlMarkdownRendererVersion,
      extractionQualityEvaluatorVersion: discoveryRuntime.extractionQualityEvaluatorVersion,
      providerConfigurationFingerprint: discoveryRuntime.providerConfigurationFingerprint,
      extractionConfigurationFingerprint: discoveryRuntime.extractionConfigurationFingerprint,
      structuredConfigurationFingerprint: discoveryRuntime.structuredConfigurationFingerprint,
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
      expect(result.run.config.discoveryStructuredContentMode).toBe("selected_resources");
      expect(result.run.config.discoveryMaximumStructuredResources).toBe(3);
      expect(result.run.config.discoveryMaximumDocumentResources).toBe(1);

      const artifact = (artifactType: string) =>
        result.artifacts.find((entry) => entry.artifactType === artifactType)?.data;
      const search = SearchResultsArtifactV2Schema.parse(artifact("search_results"));
      const frontier = CrawlFrontierArtifactV1Schema.parse(artifact("crawl_frontier"));
      const extracted = ExtractedContentArtifactV1Schema.parse(artifact("extracted_content"));
      const extractionTelemetry = ExtractionRunTelemetryV1Schema.parse(
        artifact("extraction_telemetry"),
      );
      const structured = StructuredContentArtifactV1Schema.parse(artifact("structured_content"));
      const parseTelemetry = ContentParseTelemetryV1Schema.parse(
        artifact("content_parse_telemetry"),
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
      expect(structured.requestId).toBe(search.requestId);
      expect(structured.frontierArtifactId).toBe(frontier.artifactId);
      expect(structured.extractedContentArtifactId).toBe(extracted.artifactId);
      expect(structured.summary.selectedResources).toBeGreaterThan(0);
      expect(structured.summary.selectedResources).toBeLessThanOrEqual(3);
      expect(
        structured.summary.successfulParses + structured.summary.partialParses,
      ).toBeGreaterThan(0);
      expect(structured.summary.totalSections).toBeGreaterThan(0);
      expect(parseTelemetry.structuredContentArtifactId).toBe(structured.artifactId);
      expect(parseTelemetry.totals.resourcesAttempted).toBeGreaterThan(0);

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
      expect(evidence.evidenceSourceMode).toBe("snippet_plus_structured_public_content");
      expect(
        evidence.materials.some(
          (material) =>
            material.kind === "structured_section" &&
            material.trustClassification === "untrusted_public_content" &&
            material.structuredContentItemId !== undefined,
        ),
      ).toBe(true);
      const buyerMap = BuyerMapArtifactV1Schema.parse(artifact("buyer_map"));
      expect(buyerMap.evidenceSourceMode).toBe("snippet_plus_structured_public_content");
      expect(buyerMap.summary.extractedEvidenceCitationCount).toBeGreaterThan(0);
      expect(buyerMap.summary.structuredEvidenceCitationCount).toBeGreaterThan(0);
      expect(
        buyerMap.opportunities.some((opportunity) =>
          opportunity.evidence.some(
            (citation) =>
              citation.materialId !== undefined &&
              citation.structuredContentItemId !== undefined &&
              citation.sectionId !== undefined &&
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
      expect(execution.structuredContentImported).toBe(true);
      expect(execution.contentParseTelemetryImported).toBe(true);
      expect(execution.extractionMode).toBe("selected_public_pages");
      expect(execution.maximumExtractions).toBe(3);
      expect(execution.structuredContentMode).toBe("selected_resources");
      expect(execution.maximumStructuredResources).toBe(3);
      expect(execution.maximumDocumentResources).toBe(1);
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
          "--structured-content-mode",
          "selected_resources",
          "--max-structured-resources",
          "3",
          "--max-document-resources",
          "1",
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
        structured,
        parseTelemetry,
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
