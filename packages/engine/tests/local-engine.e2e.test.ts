import {
  BuyerMapArtifactV1Schema,
  EvidenceFindingsArtifactV1Schema,
  FixtureArtifactEnvelopeSchema,
  IdentityEnrichmentArtifactV1Schema,
  MissionInputSchemaV1,
  MissionUnderstandingArtifactV1Schema,
  ProjectBFinalizationArtifactV1Schema,
  RankedOpportunitiesArtifactV1Schema,
  SearchResultsArtifactV2Schema,
  type LocalRunPhase,
} from "@cluvvi/core";
import { SqliteCluvviStore } from "@cluvvi/storage";
import { existsSync } from "node:fs";
import { readFile, rm } from "node:fs/promises";
import { resolve } from "node:path";
import { randomUUID } from "node:crypto";
import { afterEach, describe, expect, it } from "vitest";
import {
  CluvviEngine,
  LocalArtifactWriter,
  RunExecutionError,
  createDefaultStageRegistry,
} from "../src";

const cleanupDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(
    cleanupDirectories
      .splice(0)
      .map((directory) => rm(directory, { force: true, recursive: true })),
  );
});

function testRuntime() {
  const root = resolve(process.cwd(), ".cluvvi-test", randomUUID());
  cleanupDirectories.push(root);
  const store = new SqliteCluvviStore({
    databasePath: resolve(root, "cluvvi.sqlite"),
    migrationsDirectory: resolve(process.cwd(), "packages/storage/migrations"),
  });
  const writer = new LocalArtifactWriter(resolve(root, "runs"));
  const engine = new CluvviEngine({
    store,
    stages: createDefaultStageRegistry(),
    artifactWriter: writer,
  });
  return { root, store, writer, engine };
}

const mission = MissionInputSchemaV1.parse({
  schemaVersion: "1.0",
  name: "Video editing SaaS customer discovery",
  description:
    "AI-assisted video editing software that creates rough cuts for long-form talking-head videos.",
  customerOutcome: "Publish long-form videos faster with less manual editing work.",
  desiredOpportunities: 20,
});

describe("CluvviEngine Project B fixture flow", () => {
  it("completes every stage, writes typed artifacts, and reuses completed fingerprints", async () => {
    const { root, store, engine } = testRuntime();
    try {
      const result = await engine.start({
        mission,
        sourceFile: "examples/video-editing-saas.json",
      });
      expect(result.run.status).toBe("completed");
      expect(result.artifacts).toHaveLength(11);
      const executionsBefore = await store.listStageExecutions(result.run.id);
      const toolCallsBefore = await store.listToolCalls(result.run.id);
      expect(executionsBefore.filter((execution) => execution.status === "completed")).toHaveLength(
        11,
      );
      expect(executionsBefore.filter((execution) => execution.status === "skipped")).toHaveLength(
        5,
      );
      expect(toolCallsBefore).toHaveLength(11);
      expect(existsSync(resolve(root, "runs", result.run.id, "run-report.md"))).toBe(true);

      const understandingEnvelope = FixtureArtifactEnvelopeSchema.parse(
        JSON.parse(
          await readFile(
            resolve(root, "runs", result.run.id, "01-mission-understanding.json"),
            "utf8",
          ),
        ),
      );
      const understanding = MissionUnderstandingArtifactV1Schema.parse(understandingEnvelope.data);
      expect(understanding.productUnderstanding.productCategory).toMatch(/video|editing/i);
      expect(understanding.searchQueries.length).toBeGreaterThanOrEqual(25);

      const searchArtifactRecord = result.artifacts.find(
        (artifact) => artifact.artifactType === "search_results",
      );
      expect(searchArtifactRecord?.schemaVersion).toBe("2.0");
      const searchArtifact = SearchResultsArtifactV2Schema.parse(searchArtifactRecord?.data);
      expect(searchArtifact.results).toHaveLength(9);
      expect(searchArtifact.results.every((item) => item.providerCategory === "fixture")).toBe(
        true,
      );

      const evidence = EvidenceFindingsArtifactV1Schema.parse(
        result.artifacts.find((artifact) => artifact.artifactType === "evidence_findings")?.data,
      );
      const identity = IdentityEnrichmentArtifactV1Schema.parse(
        result.artifacts.find((artifact) => artifact.artifactType === "identity_enrichment")?.data,
      );
      const ranked = RankedOpportunitiesArtifactV1Schema.parse(
        result.artifacts.find((artifact) => artifact.artifactType === "ranked_opportunities")?.data,
      );
      const buyerMap = BuyerMapArtifactV1Schema.parse(
        result.artifacts.find((artifact) => artifact.artifactType === "buyer_map")?.data,
      );
      expect(evidence.findings.some((finding) => !finding.positive)).toBe(true);
      expect(identity.fabricatedContacts).toBe(false);
      expect(ranked.opportunities).toHaveLength(3);
      expect(buyerMap.coverageGaps).toHaveLength(1);

      const finalArtifact = ProjectBFinalizationArtifactV1Schema.parse(
        JSON.parse(
          await readFile(resolve(root, "runs", result.run.id, "13-finalization.json"), "utf8"),
        ),
      );
      expect(finalArtifact.fixture).toBe(true);
      expect(finalArtifact.warning).toMatch(/not live discovery data/);
      expect(finalArtifact.realOpportunitiesProduced).toBe(0);

      await engine.resume(result.run.id);
      expect(await store.listStageExecutions(result.run.id)).toHaveLength(executionsBefore.length);
      expect(await store.listArtifacts(result.run.id)).toHaveLength(11);
      expect(await store.listToolCalls(result.run.id)).toHaveLength(toolCallsBefore.length);
    } finally {
      await store.close();
    }
  });

  it("resumes a simulated failed stage without repeating completed stage results", async () => {
    const { store, engine } = testRuntime();
    let runId = "";
    const failStage: LocalRunPhase = "investigation";
    try {
      let caught: unknown;
      try {
        await engine.start({
          mission,
          sourceFile: "examples/video-editing-saas.json",
          failStage,
        });
      } catch (error) {
        caught = error;
      }
      expect(caught).toBeInstanceOf(RunExecutionError);
      runId = (caught as RunExecutionError).runId;

      const failedRun = await store.getRun(runId);
      expect(failedRun?.status).toBe("failed");
      expect(failedRun?.failure?.code).toBe("SIMULATED_STAGE_FAILURE");
      const beforeResume = await store.listStageExecutions(runId);
      expect(beforeResume.filter((execution) => execution.status === "completed")).toHaveLength(5);
      expect(beforeResume.filter((execution) => execution.status === "failed")).toHaveLength(1);

      const resumed = await engine.resume(runId);
      expect(resumed.run.status).toBe("completed");
      const afterResume = await store.listStageExecutions(runId);
      expect(afterResume.filter((execution) => execution.status === "completed")).toHaveLength(11);
      expect(afterResume.filter((execution) => execution.status === "skipped")).toHaveLength(5);
      expect(afterResume.filter((execution) => execution.status === "failed")).toHaveLength(1);
      expect(await store.listArtifacts(runId)).toHaveLength(11);

      await engine.resume(runId);
      expect(await store.listStageExecutions(runId)).toHaveLength(afterResume.length);
    } finally {
      await store.close();
    }
  });
});
