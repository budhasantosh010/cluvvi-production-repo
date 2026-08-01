import {
  BuyerMapArtifactV1Schema,
  CluvviError,
  EvidenceFindingsArtifactV1Schema,
  IdentityEnrichmentArtifactV1Schema,
  MissionInputSchemaV1,
  RankedOpportunitiesArtifactV1Schema,
  SearchResultsArtifactV2Schema,
  type SearchResultsArtifactV2,
} from "@cluvvi/core";
import { SqliteCluvviStore } from "@cluvvi/storage";
import { randomUUID } from "node:crypto";
import { rm } from "node:fs/promises";
import { resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  CluvviEngine,
  LocalArtifactWriter,
  RunExecutionError,
  createDefaultStageRegistry,
  loadProjectBPipelineFixture,
  type DiscoveryRuntime,
  type DiscoveryRuntimeExecutionInput,
} from "../src";

const cleanupDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(
    cleanupDirectories.splice(0).map((path) => rm(path, { recursive: true, force: true })),
  );
});

const mission = MissionInputSchemaV1.parse({
  schemaVersion: "1.0",
  name: "Local Discovery Engine fixture bridge",
  description:
    "AI-assisted video editing software that creates rough cuts for long-form podcast and YouTube teams.",
  desiredOpportunities: 20,
});

class ControlledLocalRuntime implements DiscoveryRuntime {
  readonly mode = "local_discovery_engine" as const;
  readonly providerConfigurationFingerprint = "controlled-local-fixture-runtime";
  calls = 0;
  fail = false;

  async execute(input: DiscoveryRuntimeExecutionInput): Promise<SearchResultsArtifactV2> {
    this.calls += 1;
    if (this.fail) {
      throw new CluvviError({
        code: "DISCOVERY_ENGINE_COMMAND_FAILED",
        category: "provider",
        message: "Controlled local Discovery Engine failure.",
        retryable: true,
        stage: "discovery",
        context: { retrySafe: true, resumeSupported: true },
      });
    }
    return SearchResultsArtifactV2Schema.parse({
      ...loadProjectBPipelineFixture(),
      requestId: input.request.requestId,
    });
  }
}

function testRuntime(discoveryRuntime: ControlledLocalRuntime) {
  const root = resolve(process.cwd(), ".cluvvi-test", randomUUID());
  cleanupDirectories.push(root);
  const store = new SqliteCluvviStore({
    databasePath: resolve(root, "cluvvi.sqlite"),
    migrationsDirectory: resolve(process.cwd(), "packages/storage/migrations"),
  });
  const artifactWriter = new LocalArtifactWriter(resolve(root, "runs"));
  const engine = new CluvviEngine({
    store,
    artifactWriter,
    stages: createDefaultStageRegistry({ discoveryRuntime }),
    discoveryRuntimeMode: discoveryRuntime.mode,
    providerConfigurationFingerprint: discoveryRuntime.providerConfigurationFingerprint,
  });
  return { store, engine };
}

describe("Cluvvi local Discovery Engine pipeline", () => {
  it("stops before downstream stages on bridge failure and resumes from durable prior work", async () => {
    const discoveryRuntime = new ControlledLocalRuntime();
    discoveryRuntime.fail = true;
    const { store, engine } = testRuntime(discoveryRuntime);
    try {
      let runId = "";
      try {
        await engine.start({ mission, sourceFile: "test://local-discovery" });
      } catch (error) {
        expect(error).toBeInstanceOf(RunExecutionError);
        runId = (error as RunExecutionError).runId;
      }
      expect(runId).not.toBe("");
      expect(discoveryRuntime.calls).toBe(1);
      const failedRun = await store.getRun(runId);
      expect(failedRun?.status).toBe("failed");
      expect(failedRun?.failure?.code).toBe("DISCOVERY_ENGINE_COMMAND_FAILED");
      expect((await store.listArtifacts(runId)).map((artifact) => artifact.artifactType)).toEqual([
        "mission",
        "mission_understanding",
        "source_plan",
      ]);
      expect(
        (await store.listStageExecutions(runId)).some(
          (execution) =>
            execution.stageName === "normalization" || execution.stageName === "investigation",
        ),
      ).toBe(false);

      discoveryRuntime.fail = false;
      const resumed = await engine.resume(runId);
      expect(resumed.run.status).toBe("completed");
      expect(discoveryRuntime.calls).toBe(2);
      expect(
        EvidenceFindingsArtifactV1Schema.parse(
          resumed.artifacts.find((artifact) => artifact.artifactType === "evidence_findings")?.data,
        ).findings.length,
      ).toBeGreaterThan(0);
      expect(
        IdentityEnrichmentArtifactV1Schema.parse(
          resumed.artifacts.find((artifact) => artifact.artifactType === "identity_enrichment")
            ?.data,
        ).fabricatedContacts,
      ).toBe(false);
      expect(
        RankedOpportunitiesArtifactV1Schema.parse(
          resumed.artifacts.find((artifact) => artifact.artifactType === "ranked_opportunities")
            ?.data,
        ).opportunities.length,
      ).toBeGreaterThan(0);
      expect(
        BuyerMapArtifactV1Schema.parse(
          resumed.artifacts.find((artifact) => artifact.artifactType === "buyer_map")?.data,
        ).fixture,
      ).toBe(true);
    } finally {
      await store.close();
    }
  });

  it("reuses a valid imported discovery artifact after a later-stage failure", async () => {
    const discoveryRuntime = new ControlledLocalRuntime();
    const { store, engine } = testRuntime(discoveryRuntime);
    try {
      let runId = "";
      try {
        await engine.start({
          mission,
          sourceFile: "test://local-discovery",
          failStage: "investigation",
        });
      } catch (error) {
        expect(error).toBeInstanceOf(RunExecutionError);
        runId = (error as RunExecutionError).runId;
      }
      expect(discoveryRuntime.calls).toBe(1);
      expect(
        SearchResultsArtifactV2Schema.parse(
          (await store.getLatestArtifact(runId, "search_results"))?.data,
        ).requestId,
      ).toBe(runId);

      const completed = await engine.resume(runId);
      expect(completed.run.status).toBe("completed");
      expect(discoveryRuntime.calls).toBe(1);
      await engine.resume(runId);
      expect(discoveryRuntime.calls).toBe(1);
    } finally {
      await store.close();
    }
  });
});
