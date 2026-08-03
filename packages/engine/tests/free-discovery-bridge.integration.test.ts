import {
  BuyerMapArtifactV1Schema,
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
const integration =
  process.env["RUN_FREE_DISCOVERY_INTEGRATION"] === "1" && projectPath ? describe : describe.skip;
const cleanupDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(
    cleanupDirectories.splice(0).map((path) => rm(path, { recursive: true, force: true })),
  );
});

integration("C1-HF real Project A free-only bridge", () => {
  it("completes HN and free broad search with zero paid requests before downstream Buyer Map", async () => {
    const root = resolve(process.cwd(), ".cluvvi-test", randomUUID());
    cleanupDirectories.push(root);
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
        timeoutMs: 120_000,
        keepExchangeFiles: true,
        providerMode: "live_search",
        providerPolicy: "free_only",
        providerEnvironment: {
          DISCOVERY_LIVE_PROVIDERS:
            "hacker_news_algolia,hacker_news_firebase,searxng_search,duckduckgo_html_search,startpage_html_search",
          DISCOVERY_LIVE_MAX_QUERIES: "3",
          DISCOVERY_MAX_RESULTS_PER_PROVIDER: "4",
          DISCOVERY_HN_ALGOLIA_MAX_REQUESTS_PER_RUN: "3",
          DISCOVERY_HN_FIREBASE_MAX_ITEMS_PER_RUN: "3",
          DISCOVERY_SEARXNG_MAX_REQUESTS_PER_RUN: "2",
          DISCOVERY_DDG_MAX_REQUESTS_PER_RUN: "2",
          DISCOVERY_STARTPAGE_MAX_REQUESTS_PER_RUN: "2",
          DISCOVERY_FREE_SEARCH_MIN_RESULTS: "3",
          DISCOVERY_FREE_SEARCH_MIN_UNIQUE_DOMAINS: "2",
          DISCOVERY_HTTP_TIMEOUT_MS: "20000",
          DISCOVERY_HTTP_MAX_ATTEMPTS: "2",
          DISCOVERY_HTTP_CONCURRENCY: "2",
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
      providerConfigurationFingerprint: discoveryRuntime.providerConfigurationFingerprint,
    });

    try {
      const result = await engine.start({
        mission: MissionInputSchemaV1.parse({
          schemaVersion: "1.0",
          name: "Free-only video editing discovery",
          description:
            "Find public evidence that podcast agencies, creator businesses, and software teams have video editing workflow, automation, integration, capacity, or turnaround problems.",
          customerOutcome: "Publish long-form content faster with less manual editing.",
          geographies: ["global"],
          desiredOpportunities: 12,
          exclusions: ["full internal team", "long-term vendor contract"],
          badCustomerExamples: [],
        }),
        sourceFile: "test://free-discovery-bridge",
      });

      expect(result.run.status).toBe("completed");
      expect(result.run.config.discoveryProviderPolicy).toBe("free_only");
      const search = SearchResultsArtifactV2Schema.parse(
        result.artifacts.find((artifact) => artifact.artifactType === "search_results")?.data,
      );
      expect(search.results.length).toBeGreaterThan(0);
      expect(search.summary.providersUsed).not.toContain("fixture_search_provider");
      expect(search.summary.providersUsed).not.toContain("tavily_search");
      expect(search.summary.providersUsed).not.toContain("brave_web_search");
      expect(search.summary.paidCreditsUsed).toBe(0);
      expect(search.results.every((result) => result.providerCategory === "free")).toBe(true);
      expect(search.results.every((result) => !result.url.includes(".invalid"))).toBe(true);

      const telemetry = await readLiveProviderTelemetry({ runsDirectory, runId: result.run.id });
      expect(telemetry).not.toBeNull();
      expect(telemetry?.usage.tavilyRequests).toBe(0);
      expect(telemetry?.usage.tavilyCredits).toBe(0);
      expect(telemetry?.usage.braveRequests).toBe(0);
      expect(telemetry?.usage.hackerNewsAlgoliaRequests).toBeGreaterThan(0);
      expect(
        telemetry?.providerExecutions.some((execution) =>
          ["searxng_search", "duckduckgo_html_search", "startpage_html_search"].includes(
            execution.providerId,
          ),
        ),
      ).toBe(true);

      const trace = await readProviderPolicyTrace({ runsDirectory, runId: result.run.id });
      console.info(
        `C1HF_REAL_FREE_USAGE=${JSON.stringify({
          searxngRequests: telemetry?.usage.searxngRequests ?? 0,
          duckDuckGoRequests: telemetry?.usage.duckDuckGoRequests ?? 0,
          startpageRequests: telemetry?.usage.startpageRequests ?? 0,
          hackerNewsAlgoliaRequests: telemetry?.usage.hackerNewsAlgoliaRequests ?? 0,
          hackerNewsFirebaseRequests: telemetry?.usage.hackerNewsFirebaseRequests ?? 0,
          tavilyRequests: telemetry?.usage.tavilyRequests ?? 0,
          tavilyCredits: telemetry?.usage.tavilyCredits ?? 0,
          braveRequests: telemetry?.usage.braveRequests ?? 0,
          paidCreditsUsed: search.summary.paidCreditsUsed,
        })}`,
      );
      expect(ProviderPolicyTraceV1Schema.parse(trace).providerPolicy).toBe("free_only");
      expect(trace?.paidProviderAttempted).toBe(false);
      expect(trace?.paidFallbackUsed).toBe(false);
      expect(
        trace?.queries.flatMap((query) => query.attempts).some((attempt) => attempt.paid),
      ).toBe(false);

      const paths = discoveryExchangePaths(runsDirectory, result.run.id);
      const execution = LocalDiscoveryExecutionRecordV1Schema.parse(
        JSON.parse(await readFile(paths.executionPath, "utf8")) as unknown,
      );
      expect(execution.providerPolicy).toBe("free_only");
      expect(execution.providerTelemetryImported).toBe(true);
      expect(execution.providerPolicyTraceImported).toBe(true);
      expect(JSON.stringify(execution)).not.toMatch(
        /api[_-]?key|authorization|subscription[_-]?token/i,
      );

      expect(
        BuyerMapArtifactV1Schema.parse(
          result.artifacts.find((artifact) => artifact.artifactType === "buyer_map")?.data,
        ).opportunities.length,
      ).toBeGreaterThan(0);
    } finally {
      await store.close();
    }
  }, 150_000);
});
