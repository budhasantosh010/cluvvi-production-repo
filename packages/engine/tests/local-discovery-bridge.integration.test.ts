import {
  BuyerMapArtifactV1Schema,
  EvidenceFindingsArtifactV1Schema,
  IdentityEnrichmentArtifactV1Schema,
  MissionInputSchemaV1,
  RankedOpportunitiesArtifactV1Schema,
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
} from "../src";

const projectPath = process.env["CLUVVI_DISCOVERY_ENGINE_PATH"]?.trim();
const integration =
  projectPath === undefined || projectPath.length === 0 ? describe.skip : describe;
const cleanupDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(
    cleanupDirectories.splice(0).map((path) => rm(path, { recursive: true, force: true })),
  );
});

integration("C1-G real Project A bridge", () => {
  it("runs the standalone fixture CLI and completes Evidence, Identity, Ranking, and Buyer Map", async () => {
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
        timeoutMs: 60_000,
        keepExchangeFiles: true,
        providerMode: "fixture_only",
        providerEnvironment: {},
      },
      runsDirectory,
    });
    const engine = new CluvviEngine({
      store,
      artifactWriter,
      stages: createDefaultStageRegistry({ discoveryRuntime }),
      discoveryRuntimeMode: discoveryRuntime.mode,
      discoveryProviderMode: discoveryRuntime.providerMode,
      providerConfigurationFingerprint: discoveryRuntime.providerConfigurationFingerprint,
    });

    try {
      const result = await engine.start({
        mission: MissionInputSchemaV1.parse({
          schemaVersion: "1.0",
          name: "Cross-project video editing discovery",
          description:
            "Find podcast agencies and creator businesses showing evidence of video editing capacity problems for managed long-form video editing software.",
          customerOutcome: "Publish long-form content faster with less manual editing.",
          desiredOpportunities: 20,
          exclusions: ["full internal team", "long-term vendor"],
        }),
        sourceFile: "integration://project-a-fixture-cli",
      });

      expect(result.run.status).toBe("completed");
      expect(result.run.config.discoveryRuntimeMode).toBe("local_discovery_engine");
      const searchRecord = result.artifacts.find(
        (artifact) => artifact.artifactType === "search_results",
      );
      const searchResults = SearchResultsArtifactV2Schema.parse(searchRecord?.data);
      expect(searchResults.requestId).toBe(result.run.id);
      expect(searchResults.summary.providersUsed).toContain("fixture_search_provider");
      expect(searchResults.summary.paidCreditsUsed).toBe(0);
      expect(
        searchResults.providerBreakdown.every(
          (provider) => provider.providerCategory === "fixture",
        ),
      ).toBe(true);

      const exchangeDirectory = resolve(runsDirectory, result.run.id, "discovery-exchange");
      const exactStandaloneOutput = await readFile(
        resolve(exchangeDirectory, "search-results.v2.json"),
      );
      expect(
        SearchResultsArtifactV2Schema.parse(JSON.parse(exactStandaloneOutput.toString("utf8"))),
      ).toEqual(searchResults);
      const request = JSON.parse(
        await readFile(resolve(exchangeDirectory, "discovery-request.v1.json"), "utf8"),
      ) as { requestId?: unknown; providerPreference?: unknown };
      expect(request.requestId).toBe(result.run.id);
      expect(request.providerPreference).toBe("fixture_only");

      expect(
        EvidenceFindingsArtifactV1Schema.parse(
          result.artifacts.find((artifact) => artifact.artifactType === "evidence_findings")?.data,
        ).findings.length,
      ).toBeGreaterThan(0);
      expect(
        IdentityEnrichmentArtifactV1Schema.parse(
          result.artifacts.find((artifact) => artifact.artifactType === "identity_enrichment")
            ?.data,
        ).fabricatedContacts,
      ).toBe(false);
      expect(
        RankedOpportunitiesArtifactV1Schema.parse(
          result.artifacts.find((artifact) => artifact.artifactType === "ranked_opportunities")
            ?.data,
        ).opportunities.length,
      ).toBeGreaterThan(0);
      const buyerMap = BuyerMapArtifactV1Schema.parse(
        result.artifacts.find((artifact) => artifact.artifactType === "buyer_map")?.data,
      );
      expect(buyerMap.fixture).toBe(true);
      expect(buyerMap.opportunities.length).toBeGreaterThan(0);
      expect(JSON.stringify(buyerMap)).not.toContain('"raw"');
    } finally {
      await store.close();
    }
  }, 90_000);
});
