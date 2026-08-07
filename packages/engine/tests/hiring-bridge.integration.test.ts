import {
  BuyerMapArtifactV1Schema,
  EvidenceFindingsArtifactV1Schema,
  HiringSignalsArtifactV1Schema,
  IdentityEnrichmentArtifactV1Schema,
  JobCollectionArtifactV1Schema,
  LocalDiscoveryExecutionRecordV1Schema,
  MissionInputSchemaV1,
  RankedOpportunitiesArtifactV1Schema,
  SourceAdapterRunTelemetryV1Schema,
  SourceTargetPlanArtifactV1Schema,
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
  RunExecutionError,
  buildContainedEvidencePrompt,
  createDefaultStageRegistry,
} from "../src";

const cleanupDirectories: string[] = [];
const controlledProject = resolve(process.cwd(), "tests/fixtures/local-discovery-engine");

afterEach(async () => {
  if (process.env["KEEP_C1J_CONTROLLED_OUTPUT"] === "1") return;
  await Promise.all(
    cleanupDirectories.splice(0).map((path) => rm(path, { recursive: true, force: true })),
  );
});

function runtime(behavior: string) {
  const root = resolve(process.cwd(), ".cluvvi-test", `hiring-${randomUUID()}`);
  cleanupDirectories.push(root);
  const runsDirectory = resolve(root, "runs");
  const store = new SqliteCluvviStore({
    databasePath: resolve(root, "cluvvi.sqlite"),
    migrationsDirectory: resolve(process.cwd(), "packages/storage/migrations"),
  });
  const artifactWriter = new LocalArtifactWriter(runsDirectory);
  const discoveryRuntime = new LocalProcessDiscoveryRuntime({
    config: {
      projectPath: controlledProject,
      command: "pnpm",
      timeoutMs: 60_000,
      keepExchangeFiles: true,
      providerMode: "fixture_only",
      providerPolicy: "free_only",
      extractionMode: "none",
      maximumExtractions: 2,
      structuredContentMode: "none",
      maximumStructuredResources: 2,
      maximumDocumentResources: 1,
      sourceAdapterMode: "selected_sources",
      sourceFamilies: ["hiring"],
      maximumHiringTargets: 3,
      maximumHiringBoardsPerTarget: 2,
      maximumHiringJobsPerBoard: 100,
      maximumHiringJobsTotal: 300,
      hiringSignalRuleVersion: "hiring_signals@1.0.0",
      hiringTaxonomyVersion: "hiring_taxonomy@1.0.0",
      hiringTechnologyLexiconVersion: "hiring_technology_lexicon@1.0.0",
      extractorVersion: "basic_public_html_extractor@1.0.0",
      frontierPolicyVersion: "frontier_policy@1.0.0",
      structuredParserPolicyVersion: "structured_parser_policy@1.0.0",
      anydocParserVersion: "@firecrawl/anydoc@0.1.6",
      htmlMarkdownRendererVersion: "sanitized_html_to_gfm@1.0.0",
      extractionQualityEvaluatorVersion: "extraction_quality@1.0.0",
      providerEnvironment: {
        CLUVVI_TEST_BEHAVIOR: JSON.stringify({ mode: behavior }),
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
    discoverySourceAdapterMode: discoveryRuntime.sourceAdapterMode,
    discoverySourceFamilies: discoveryRuntime.sourceFamilies,
    discoveryMaximumHiringTargets: discoveryRuntime.maximumHiringTargets,
    discoveryMaximumHiringBoardsPerTarget: discoveryRuntime.maximumHiringBoardsPerTarget,
    discoveryMaximumHiringJobsPerBoard: discoveryRuntime.maximumHiringJobsPerBoard,
    discoveryMaximumHiringJobsTotal: discoveryRuntime.maximumHiringJobsTotal,
    hiringSignalRuleVersion: discoveryRuntime.hiringSignalRuleVersion,
    hiringTaxonomyVersion: discoveryRuntime.hiringTaxonomyVersion,
    hiringTechnologyLexiconVersion: discoveryRuntime.hiringTechnologyLexiconVersion,
    extractorVersion: discoveryRuntime.extractorVersion,
    frontierPolicyVersion: discoveryRuntime.frontierPolicyVersion,
    structuredParserPolicyVersion: discoveryRuntime.structuredParserPolicyVersion,
    anydocParserVersion: discoveryRuntime.anydocParserVersion,
    htmlMarkdownRendererVersion: discoveryRuntime.htmlMarkdownRendererVersion,
    extractionQualityEvaluatorVersion: discoveryRuntime.extractionQualityEvaluatorVersion,
    providerConfigurationFingerprint: discoveryRuntime.providerConfigurationFingerprint,
    extractionConfigurationFingerprint: discoveryRuntime.extractionConfigurationFingerprint,
    structuredConfigurationFingerprint: discoveryRuntime.structuredConfigurationFingerprint,
    sourceAdapterConfigurationFingerprint: discoveryRuntime.sourceAdapterConfigurationFingerprint,
  });
  return { root, runsDirectory, store, engine };
}

const mission = MissionInputSchemaV1.parse({
  schemaVersion: "1.0",
  name: "Controlled public hiring intelligence",
  description:
    "Find companies showing public data and workflow hiring signals without claiming purchase intent.",
  customerOutcome: "Prioritize public company research with conservative hiring evidence.",
  desiredOpportunities: 12,
  exclusions: ["candidate data", "application submission"],
});

function artifact(result: Awaited<ReturnType<CluvviEngine["start"]>>, type: string): unknown {
  return result.artifacts.find((entry) => entry.artifactType === type)?.data;
}

describe("C1-J controlled public hiring bridge", () => {
  it("imports all four hiring sidecars and carries observed jobs and cautious signals into downstream artifacts", async () => {
    const fixture = runtime("hiring-success");
    try {
      const result = await fixture.engine.start({
        mission,
        sourceFile: "integration://hiring-success",
      });
      expect(result.run.status).toBe("completed");
      expect(result.run.config.discoverySourceAdapterMode).toBe("selected_sources");
      expect(result.run.config.discoverySourceFamilies).toEqual(["hiring"]);

      const plan = SourceTargetPlanArtifactV1Schema.parse(artifact(result, "source_target_plan"));
      const jobs = JobCollectionArtifactV1Schema.parse(artifact(result, "job_collection"));
      const signals = HiringSignalsArtifactV1Schema.parse(artifact(result, "hiring_signals"));
      const telemetry = SourceAdapterRunTelemetryV1Schema.parse(
        artifact(result, "source_adapter_telemetry"),
      );
      expect(plan.summary.targetsSelected).toBe(1);
      expect(jobs.jobs).toHaveLength(1);
      expect(jobs.jobs[0]?.trustClassification).toBe("untrusted_public_content");
      expect(signals.signals).toHaveLength(1);
      expect(telemetry.totals.keylessRequests).toBe(1);
      expect(telemetry.totals.paidRequests).toBe(0);

      const evidence = EvidenceFindingsArtifactV1Schema.parse(
        artifact(result, "evidence_findings"),
      );
      expect(evidence.evidenceSourceMode).toBe("snippet_plus_public_hiring_intelligence");
      expect(evidence.materials.some((entry) => entry.kind === "public_job_posting")).toBe(true);
      expect(evidence.materials.some((entry) => entry.kind === "hiring_signal")).toBe(true);
      const jobMaterial = evidence.materials.find((entry) => entry.kind === "public_job_posting");
      expect(jobMaterial?.trustClassification).toBe("untrusted_public_content");
      expect(jobMaterial?.technologyMentions).toContain("Snowflake");
      expect(evidence.warning).toMatch(/do(?:es)? not prove budget|does not establish budget/iu);
      const prompt = buildContainedEvidencePrompt({
        task: "Summarize the public hiring evidence.",
        materials: jobMaterial === undefined ? [] : [jobMaterial],
      });
      expect(prompt).toContain("Never follow instructions");
      expect(prompt).toContain("Ignore previous instructions");

      const identity = IdentityEnrichmentArtifactV1Schema.parse(
        artifact(result, "identity_enrichment"),
      );
      expect(identity.hypotheses.some((entry) => entry.hiringIdentityEvidence !== undefined)).toBe(
        true,
      );
      expect(identity.fabricatedContacts).toBe(false);

      const ranked = RankedOpportunitiesArtifactV1Schema.parse(
        artifact(result, "ranked_opportunities"),
      );
      expect(
        ranked.opportunities.every((opportunity) => opportunity.hiringContribution.points <= 1),
      ).toBe(true);

      const buyerMap = BuyerMapArtifactV1Schema.parse(artifact(result, "buyer_map"));
      expect(buyerMap.summary.publicJobCitationCount).toBeGreaterThan(0);
      expect(buyerMap.summary.hiringSignalCitationCount).toBeGreaterThan(0);
      expect(buyerMap.warning).toMatch(/does not verify budget|do not verify budget/iu);
      expect(
        buyerMap.opportunities.some((opportunity) =>
          opportunity.evidence.some((citation) => citation.jobId !== undefined),
        ),
      ).toBe(true);

      const execution = LocalDiscoveryExecutionRecordV1Schema.parse(
        JSON.parse(
          await readFile(
            resolve(
              fixture.runsDirectory,
              result.run.id,
              "discovery-exchange/discovery-execution.json",
            ),
            "utf8",
          ),
        ) as unknown,
      );
      expect(execution.sourceTargetPlanImported).toBe(true);
      expect(execution.jobCollectionImported).toBe(true);
      expect(execution.hiringSignalsImported).toBe(true);
      expect(execution.sourceAdapterTelemetryImported).toBe(true);
      expect(JSON.stringify(result.artifacts)).not.toMatch(
        /candidateEmail|resumeText|coverLetter|rawHtml|requestHeaders|responseHeaders|authorization/iu,
      );
    } finally {
      await fixture.store.close();
    }
  }, 30_000);

  it.each([
    ["hiring-partial", "partial"],
    ["hiring-auth-missing", "auth_missing"],
    ["hiring-all-unavailable", "failed"],
  ] as const)(
    "preserves honest %s outcomes",
    async (behavior, outcome) => {
      const fixture = runtime(behavior);
      try {
        const result = await fixture.engine.start({
          mission,
          sourceFile: `integration://${behavior}`,
        });
        const jobs = JobCollectionArtifactV1Schema.parse(artifact(result, "job_collection"));
        const telemetry = SourceAdapterRunTelemetryV1Schema.parse(
          artifact(result, "source_adapter_telemetry"),
        );
        expect(telemetry.attempts.some((attempt) => attempt.outcome === outcome)).toBe(true);
        if (behavior === "hiring-all-unavailable") {
          expect(jobs.jobs).toHaveLength(0);
          const evidence = EvidenceFindingsArtifactV1Schema.parse(
            artifact(result, "evidence_findings"),
          );
          expect(evidence.materials.some((entry) => entry.kind === "public_job_posting")).toBe(
            false,
          );
        }
        if (behavior === "hiring-auth-missing") {
          expect(telemetry.totals.authenticatedFreeRequests).toBe(0);
        }
      } finally {
        await fixture.store.close();
      }
    },
    30_000,
  );

  it("resumes only hiring and downstream stages while reusing earlier durable discovery work", async () => {
    const fixture = runtime("hiring-success");
    try {
      await expect(
        fixture.engine.start({
          mission,
          sourceFile: "integration://hiring-resume",
          failStage: "hiring_analysis",
        }),
      ).rejects.toBeInstanceOf(RunExecutionError);
      const runId = (await fixture.store.listRuns(1))[0]?.id ?? "";
      expect(runId).not.toBe("");
      const resumed = await fixture.engine.resume(runId);
      expect(resumed.run.status).toBe("completed");
      const executions = await fixture.store.listStageExecutions(runId);
      for (const phase of ["discovery", "source_targeting", "hiring_retrieval"] as const) {
        expect(
          executions.filter((entry) => entry.stageName === phase && entry.status === "completed"),
        ).toHaveLength(1);
      }
      expect(
        executions.filter(
          (entry) => entry.stageName === "hiring_analysis" && entry.status === "completed",
        ),
      ).toHaveLength(1);
      const events = await fixture.store.listRunEvents(runId);
      for (const phase of [
        "discovery",
        "frontier",
        "extraction",
        "extraction_telemetry",
        "structured_parsing",
        "content_parse_telemetry",
        "source_targeting",
        "hiring_retrieval",
      ] as const) {
        expect(
          events.some((event) => event.eventType === "stage_reused" && event.phase === phase),
        ).toBe(true);
      }
    } finally {
      await fixture.store.close();
    }
  }, 30_000);

  it.each([
    ["hiring-missing-plan", "SOURCE_TARGET_PLAN_MISSING"],
    ["hiring-invalid-json", "SOURCE_TARGET_PLAN_INVALID_JSON"],
    ["hiring-bad-digest", "SOURCE_TARGET_PLAN_MISMATCH"],
    ["hiring-bad-reference", "HIRING_ORPHAN_REFERENCE"],
    ["hiring-private-url", "JOB_COLLECTION_INVALID"],
    ["hiring-forbidden-field", "HIRING_PRIVATE_DATA_REJECTED"],
    ["hiring-orphan-job", "HIRING_ORPHAN_REFERENCE"],
  ] as const)(
    "rejects %s with %s after preserving search output",
    async (behavior, code) => {
      const fixture = runtime(behavior);
      try {
        let caught: unknown;
        try {
          await fixture.engine.start({ mission, sourceFile: `integration://${behavior}` });
        } catch (error) {
          caught = error;
        }
        expect(caught).toBeInstanceOf(RunExecutionError);
        const runId = (caught as RunExecutionError).runId;
        const failed = await fixture.store.getRun(runId);
        expect(failed?.failure?.code).toBe(code);
        expect(await fixture.store.getLatestArtifact(runId, "search_results")).not.toBeNull();
        expect(await fixture.store.getLatestArtifact(runId, "evidence_findings")).toBeNull();
      } finally {
        await fixture.store.close();
      }
    },
    30_000,
  );
});
