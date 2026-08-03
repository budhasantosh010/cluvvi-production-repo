import {
  LocalDiscoveryExecutionRecordV1Schema,
  MissionInputSchemaV1,
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
  readLiveProviderTelemetry,
} from "../src";

const projectPath = process.env["CLUVVI_DISCOVERY_ENGINE_PATH"]?.trim();
const integration =
  process.env["RUN_LIVE_DISCOVERY_INTEGRATION"] === "1" && projectPath ? describe : describe.skip;
const cleanupDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(
    cleanupDirectories.splice(0).map((path) => rm(path, { recursive: true, force: true })),
  );
});

integration("C1-H real Project A live bridge", () => {
  it("imports live search results and telemetry before completing the downstream pipeline", async () => {
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
        timeoutMs: 90_000,
        keepExchangeFiles: true,
        providerMode: "live_search",
        providerPolicy: "balanced",
        providerEnvironment: {
          DISCOVERY_BROAD_PROVIDER_STRATEGY: "fanout",
          DISCOVERY_LIVE_MAX_QUERIES: "3",
          DISCOVERY_MAX_RESULTS_PER_PROVIDER: "3",
          DISCOVERY_HN_ALGOLIA_MAX_REQUESTS_PER_RUN: "3",
          DISCOVERY_HN_FIREBASE_MAX_ITEMS_PER_RUN: "3",
          DISCOVERY_TAVILY_MAX_REQUESTS_PER_RUN: "2",
          DISCOVERY_BRAVE_MAX_REQUESTS_PER_RUN: "2",
          DISCOVERY_HTTP_TIMEOUT_MS: "20000",
          DISCOVERY_HTTP_MAX_ATTEMPTS: "2",
          DISCOVERY_HTTP_CONCURRENCY: "2",
          DISCOVERY_TAVILY_SEARCH_DEPTH: "basic",
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
          name: "Live video editing discovery",
          description:
            "Find public evidence that podcast agencies and creator businesses have video editing workflow, automation, integration, capacity, or turnaround problems.",
          customerOutcome: "Publish long-form content faster with less manual editing.",
          geographies: ["global"],
          desiredOpportunities: 12,
          exclusions: ["full internal team", "long-term vendor contract"],
          badCustomerExamples: [],
        }),
        sourceFile: "test://live-discovery-bridge",
      });
      expect(result.run.status).toBe("completed");
      expect(result.run.config.discoveryProviderMode).toBe("live_search");
      expect(result.artifacts.map((artifact) => artifact.artifactType)).toEqual(
        expect.arrayContaining([
          "search_results",
          "evidence_findings",
          "identity_enrichment",
          "ranked_opportunities",
          "buyer_map",
        ]),
      );
      const searchRecord = result.artifacts.find(
        (artifact) => artifact.artifactType === "search_results",
      );
      const search = SearchResultsArtifactV2Schema.parse(searchRecord?.data);
      expect(search.results.length).toBeGreaterThan(0);
      expect(search.summary.providersUsed).not.toContain("fixture_search_provider");
      expect(
        search.providerBreakdown.every((provider) => provider.providerCategory !== "fixture"),
      ).toBe(true);
      expect(search.results.every((entry) => !entry.url.includes(".invalid"))).toBe(true);

      const telemetry = await readLiveProviderTelemetry({ runsDirectory, runId: result.run.id });
      expect(telemetry).not.toBeNull();
      expect(telemetry?.requestId).toBe(result.run.id);
      expect(telemetry?.providerMode).toBe("live_search");
      expect(telemetry?.providerExecutions.length).toBeGreaterThan(0);
      expect(search.summary.paidCreditsUsed).toBe(telemetry?.usage.tavilyCredits);

      const execution = LocalDiscoveryExecutionRecordV1Schema.parse(
        JSON.parse(
          await readFile(
            resolve(runsDirectory, result.run.id, "discovery-exchange", "discovery-execution.json"),
            "utf8",
          ),
        ),
      );
      expect(execution.providerTelemetryImported).toBe(true);
      expect(execution.providerMode).toBe("live_search");
      expect(execution.providerIds).toEqual(expect.arrayContaining(search.summary.providersUsed));
    } finally {
      await store.close();
    }
  }, 120_000);
});
