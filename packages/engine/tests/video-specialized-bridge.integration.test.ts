import {
  BuyerMapArtifactV1Schema,
  EvidenceFindingsArtifactV1Schema,
  IdentityEnrichmentArtifactV1Schema,
  LocalDiscoveryExecutionRecordV1Schema,
  MissionInputSchemaV1,
  RankedOpportunitiesArtifactV1Schema,
  SpecializedFindingsArtifactV1Schema,
  SpecializedSignalsArtifactV1Schema,
  SpecializedSourceRunTelemetryArtifactV1Schema,
  VideoCollectionArtifactV1Schema,
  VideoSignalsArtifactV1Schema,
  VideoSourceRunTelemetryArtifactV1Schema,
} from "@cluvvi/core";
import { SqliteCluvviStore } from "@cluvvi/storage";
import { randomUUID } from "node:crypto";
import { readFile, rm } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import {
  CluvviEngine,
  LocalArtifactWriter,
  LocalProcessDiscoveryRuntime,
  RunExecutionError,
  createDefaultStageRegistry,
} from "../src";

const cleanupDirectories: string[] = [];
const controlledProject = resolve(process.cwd(), "tests/fixtures/local-discovery-engine");

afterEach(async () => {
  await Promise.all(
    cleanupDirectories.splice(0).map((path) => rm(path, { recursive: true, force: true })),
  );
});

function runtime(
  behavior: string,
  sourceFamilies: ("video" | "specialized")[] = ["video", "specialized"],
) {
  const root = resolve(process.cwd(), ".cluvvi-test", `j45-${randomUUID()}`);
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
      sourceFamilies,
      maximumHiringTargets: 3,
      maximumHiringBoardsPerTarget: 2,
      maximumHiringJobsPerBoard: 100,
      maximumHiringJobsTotal: 300,
      redditDepth: "default",
      maximumRedditQueries: 4,
      maximumRedditSubreddits: 6,
      maximumRedditThreads: 20,
      maximumRedditThreadDrill: 5,
      githubDepth: "default",
      maximumGitHubQueries: 4,
      maximumGitHubRepositories: 8,
      maximumGitHubThreadDrill: 5,
      youtubeDepth: "default",
      communitySignalRuleVersion: "community_signals@1.0.0",
      developerSignalRuleVersion: "c1-j3.developer-signals.v1",
      videoSignalRuleVersion: "c1-j4.video-signals.v1",
      specializedSignalRuleVersion: "c1-j5.specialized-signals.v1",
      hiringSignalRuleVersion: "hiring_signals@1.0.0",
      hiringTaxonomyVersion: "hiring_taxonomy@1.0.0",
      hiringTechnologyLexiconVersion: "hiring_technology_lexicon@1.0.0",
      extractorVersion: "basic_public_html_extractor@1.0.0",
      frontierPolicyVersion: "frontier_policy@1.0.0",
      structuredParserPolicyVersion: "structured_parser_policy@1.0.0",
      anydocParserVersion: "@firecrawl/anydoc@0.1.6",
      htmlMarkdownRendererVersion: "sanitized_html_to_gfm@1.0.0",
      extractionQualityEvaluatorVersion: "extraction_quality@1.0.0",
      providerEnvironment: { CLUVVI_TEST_BEHAVIOR: JSON.stringify({ mode: behavior }) },
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
    discoveryRedditDepth: discoveryRuntime.redditDepth,
    discoveryMaximumRedditQueries: discoveryRuntime.maximumRedditQueries,
    discoveryMaximumRedditSubreddits: discoveryRuntime.maximumRedditSubreddits,
    discoveryMaximumRedditThreads: discoveryRuntime.maximumRedditThreads,
    discoveryMaximumRedditThreadDrill: discoveryRuntime.maximumRedditThreadDrill,
    discoveryGitHubDepth: discoveryRuntime.githubDepth,
    discoveryMaximumGitHubQueries: discoveryRuntime.maximumGitHubQueries,
    discoveryMaximumGitHubRepositories: discoveryRuntime.maximumGitHubRepositories,
    discoveryMaximumGitHubThreadDrill: discoveryRuntime.maximumGitHubThreadDrill,
    communitySignalRuleVersion: discoveryRuntime.communitySignalRuleVersion,
    developerSignalRuleVersion: discoveryRuntime.developerSignalRuleVersion,
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
    communityConfigurationFingerprint: discoveryRuntime.communityConfigurationFingerprint,
    developerConfigurationFingerprint: discoveryRuntime.developerConfigurationFingerprint,
  });
  return { root, runsDirectory, store, engine, discoveryRuntime };
}

const mission = MissionInputSchemaV1.parse({
  schemaVersion: "1.0",
  name: "Controlled J4 J5 intelligence",
  description:
    "Research Fixture Frame Studio workflow friction, migration problems, and regulatory workflow changes using bounded public YouTube and specialized public sources without inferring creator, commenter, publisher, buyer, or contact identity.",
  customerOutcome: "Prioritize cautious bounded public evidence.",
  desiredOpportunities: 12,
  exclusions: ["private content", "creator identity inference", "contact enrichment", "outreach"],
});

function artifact(result: Awaited<ReturnType<CluvviEngine["start"]>>, type: string): unknown {
  return result.artifacts.find((entry) => entry.artifactType === type)?.data;
}

async function runFailure(behavior: string, sourceFamilies?: ("video" | "specialized")[]) {
  const fixture = runtime(behavior, sourceFamilies);
  let caught: unknown;
  try {
    await fixture.engine.start({ mission, sourceFile: `integration://${behavior}` });
  } catch (error) {
    caught = error;
  }
  expect(caught).toBeInstanceOf(RunExecutionError);
  const failure = caught as RunExecutionError;
  const run = await fixture.store.getRun(failure.runId);
  return { fixture, failure, run };
}

describe("C1-J.4/J.5 controlled bridge", () => {
  it.each([
    ["video-plan-missing", "VIDEO_SOURCE_PLAN_MISSING", "video_planning", ["video"]],
    ["video-plan-invalid-json", "VIDEO_SOURCE_PLAN_INVALID_JSON", "video_planning", ["video"]],
    ["video-collection-missing", "VIDEO_COLLECTION_MISSING", "video_retrieval", ["video"]],
    [
      "video-collection-invalid-json",
      "VIDEO_COLLECTION_INVALID_JSON",
      "video_retrieval",
      ["video"],
    ],
    [
      "video-transcript-manifest-missing",
      "VIDEO_TRANSCRIPT_MANIFEST_MISSING",
      "video_transcript_retrieval",
      ["video"],
    ],
    [
      "video-transcript-manifest-invalid-json",
      "VIDEO_TRANSCRIPT_MANIFEST_INVALID_JSON",
      "video_transcript_retrieval",
      ["video"],
    ],
    [
      "video-comment-manifest-missing",
      "VIDEO_COMMENT_MANIFEST_MISSING",
      "video_comment_retrieval",
      ["video"],
    ],
    [
      "video-comment-manifest-invalid-json",
      "VIDEO_COMMENT_MANIFEST_INVALID_JSON",
      "video_comment_retrieval",
      ["video"],
    ],
    ["video-signals-missing", "VIDEO_SIGNALS_MISSING", "video_analysis", ["video"]],
    ["video-signals-invalid-json", "VIDEO_SIGNALS_INVALID_JSON", "video_analysis", ["video"]],
    [
      "video-telemetry-missing",
      "VIDEO_SOURCE_TELEMETRY_MISSING",
      "video_source_telemetry",
      ["video"],
    ],
    [
      "video-telemetry-invalid-json",
      "VIDEO_SOURCE_TELEMETRY_INVALID_JSON",
      "video_source_telemetry",
      ["video"],
    ],
    [
      "specialized-context-missing",
      "SPECIALIZED_SOURCE_CONTEXT_MISSING",
      "specialized_context",
      ["specialized"],
    ],
    [
      "specialized-context-invalid-json",
      "SPECIALIZED_SOURCE_CONTEXT_INVALID_JSON",
      "specialized_context",
      ["specialized"],
    ],
    [
      "specialized-candidates-missing",
      "SPECIALIZED_SOURCE_CANDIDATES_MISSING",
      "specialized_candidate_discovery",
      ["specialized"],
    ],
    [
      "specialized-candidates-invalid-json",
      "SPECIALIZED_SOURCE_CANDIDATES_INVALID_JSON",
      "specialized_candidate_discovery",
      ["specialized"],
    ],
    [
      "specialized-plan-missing",
      "SPECIALIZED_SOURCE_PLAN_MISSING",
      "specialized_planning",
      ["specialized"],
    ],
    [
      "specialized-plan-invalid-json",
      "SPECIALIZED_SOURCE_PLAN_INVALID_JSON",
      "specialized_planning",
      ["specialized"],
    ],
    [
      "specialized-findings-missing",
      "SPECIALIZED_FINDINGS_MISSING",
      "specialized_retrieval",
      ["specialized"],
    ],
    [
      "specialized-findings-invalid-json",
      "SPECIALIZED_FINDINGS_INVALID_JSON",
      "specialized_retrieval",
      ["specialized"],
    ],
    [
      "specialized-signals-missing",
      "SPECIALIZED_SIGNALS_MISSING",
      "specialized_analysis",
      ["specialized"],
    ],
    [
      "specialized-signals-invalid-json",
      "SPECIALIZED_SIGNALS_INVALID_JSON",
      "specialized_analysis",
      ["specialized"],
    ],
    [
      "specialized-telemetry-missing",
      "SPECIALIZED_SOURCE_TELEMETRY_MISSING",
      "specialized_source_telemetry",
      ["specialized"],
    ],
    [
      "specialized-telemetry-invalid-json",
      "SPECIALIZED_SOURCE_TELEMETRY_INVALID_JSON",
      "specialized_source_telemetry",
      ["specialized"],
    ],
  ] as const)(
    "rejects %s at its exact durable stage",
    async (behavior, code, phase, families) => {
      const { fixture, run } = await runFailure(behavior, [...families]);
      try {
        expect(run?.failure?.code).toBe(code);
        expect(run?.phase).toBe(phase);
        const executions = await fixture.store.listStageExecutions(run?.id ?? "");
        expect(
          executions.some((entry) => entry.stageName === phase && entry.status === "failed"),
        ).toBe(true);
      } finally {
        await fixture.store.close();
      }
    },
    30_000,
  );

  it("imports both families, preserves attribution-only identity, and applies at most +1 per family", async () => {
    const fixture = runtime("j45-success");
    try {
      const result = await fixture.engine.start({
        mission,
        sourceFile: "integration://j45-success",
      });
      expect(result.run.status).toBe("completed");
      expect(result.run.config.discoverySourceFamilies).toEqual(["video", "specialized"]);

      const videos = VideoCollectionArtifactV1Schema.parse(artifact(result, "video_collection"));
      const videoSignals = VideoSignalsArtifactV1Schema.parse(artifact(result, "video_signals"));
      const videoTelemetry = VideoSourceRunTelemetryArtifactV1Schema.parse(
        artifact(result, "video_source_telemetry"),
      );
      expect(videos.videos).toHaveLength(2);
      expect(videoSignals.signals[0]).toMatchObject({
        type: "workflow_friction",
        independentVideoCount: 2,
        independentChannelCount: 2,
      });
      expect(videoTelemetry.paidRequests).toBe(0);
      expect(videoTelemetry.paidCredits).toBe(0);

      const specializedFindings = SpecializedFindingsArtifactV1Schema.parse(
        artifact(result, "specialized_findings"),
      );
      const specializedSignals = SpecializedSignalsArtifactV1Schema.parse(
        artifact(result, "specialized_signals"),
      );
      const specializedTelemetry = SpecializedSourceRunTelemetryArtifactV1Schema.parse(
        artifact(result, "specialized_source_telemetry"),
      );
      expect(specializedFindings.findings).toHaveLength(2);
      expect(specializedSignals.signals[0]).toMatchObject({
        type: "regulatory_change",
        independentSourceCount: 2,
      });
      expect(specializedTelemetry.paidRequests).toBe(0);
      expect(specializedTelemetry.paidCredits).toBe(0);

      const evidence = EvidenceFindingsArtifactV1Schema.parse(
        artifact(result, "evidence_findings"),
      );
      expect(evidence.evidenceSourceMode).toBe("snippet_plus_video_and_specialized_intelligence");
      for (const kind of [
        "youtube_video",
        "youtube_transcript_segment",
        "youtube_comment",
        "video_signal",
        "specialized_finding",
        "specialized_signal",
      ] as const) {
        expect(evidence.materials.some((entry) => entry.kind === kind)).toBe(true);
      }

      const identity = IdentityEnrichmentArtifactV1Schema.parse(
        artifact(result, "identity_enrichment"),
      );
      const hypothesis = identity.hypotheses.find(
        (entry) =>
          entry.videoIdentityEvidence !== undefined ||
          entry.specializedIdentityEvidence !== undefined,
      );
      expect(hypothesis?.videoIdentityEvidence).toMatchObject({
        conservativeMatch: true,
        creatorIdentityUsed: false,
        commentAuthorIdentityUsed: false,
      });
      expect(hypothesis?.specializedIdentityEvidence).toMatchObject({
        conservativeMatch: true,
        publisherIdentityUsed: false,
      });
      expect(JSON.stringify(identity)).not.toMatch(/Controlled commenter|@fixture/iu);

      const ranking = RankedOpportunitiesArtifactV1Schema.parse(
        artifact(result, "ranked_opportunities"),
      );
      const applied = ranking.opportunities.find(
        (entry) => entry.videoContribution.applied && entry.specializedContribution.applied,
      );
      expect(applied?.videoContribution).toMatchObject({
        points: 1,
        independentVideoCount: 2,
        independentChannelCount: 2,
      });
      expect(applied?.specializedContribution).toMatchObject({
        points: 1,
        independentSourceCount: 2,
      });
      expect(ranking.opportunities.every((entry) => entry.videoContribution.points <= 1)).toBe(
        true,
      );
      expect(
        ranking.opportunities.every((entry) => entry.specializedContribution.points <= 1),
      ).toBe(true);

      const buyerMap = BuyerMapArtifactV1Schema.parse(artifact(result, "buyer_map"));
      expect(buyerMap.summary.videoCitationCount).toBeGreaterThan(0);
      expect(buyerMap.summary.videoSignalCitationCount).toBeGreaterThan(0);
      expect(buyerMap.summary.specializedFindingCitationCount).toBeGreaterThan(0);
      expect(buyerMap.summary.specializedSignalCitationCount).toBeGreaterThan(0);
      expect(buyerMap.warning).toMatch(/video|specialized|attribution/iu);

      const execution = LocalDiscoveryExecutionRecordV1Schema.parse(
        JSON.parse(
          await readFile(
            resolve(
              fixture.runsDirectory,
              result.run.id,
              "discovery-exchange",
              "discovery-execution.json",
            ),
            "utf8",
          ),
        ) as unknown,
      );
      expect(execution.arguments).toContain("--youtube-depth");
      expect(execution.arguments).not.toContain("--research-family");
      expect(execution.videoSourcePlanImported).toBe(true);
      expect(execution.videoSourceTelemetryImported).toBe(true);
      expect(execution.specializedSourceContextImported).toBe(true);
      expect(execution.specializedSourceTelemetryImported).toBe(true);
      expect(JSON.stringify(execution)).not.toMatch(/cookie|authorization|password|token/iu);
    } finally {
      await fixture.store.close();
    }
  }, 30_000);

  it("repairs a missing video signal sidecar and resumes the same run while reusing earlier stages", async () => {
    const fixture = runtime("video-signals-missing", ["video"]);
    try {
      let failed: RunExecutionError | undefined;
      try {
        await fixture.engine.start({ mission, sourceFile: "integration://video-repair" });
      } catch (error) {
        if (error instanceof RunExecutionError) failed = error;
        else throw error;
      }
      expect(failed).toBeDefined();
      const runId = failed?.runId ?? "";
      const searchResults = await fixture.store.getLatestArtifact(runId, "search_results");
      if (searchResults === null) throw new Error("Expected durable search results.");
      const sidecarModule = (await import(
        pathToFileURL(resolve(controlledProject, "video-specialized-sidecars.mjs")).href
      )) as {
        writeControlledVideoSidecars(input: Record<string, unknown>): Promise<void>;
      };
      await sidecarModule.writeControlledVideoSidecars({
        outputPath: resolve(
          fixture.runsDirectory,
          runId,
          "discovery-exchange",
          "search-results.v2.json",
        ),
        searchResults: searchResults.data,
        behavior: { mode: "video-success" },
        sourceAdapterMode: "selected_sources",
        sourceFamilies: ["video"],
        youtubeDepth: "default",
      });

      const resumed = await fixture.engine.resume(runId);
      expect(resumed.run.status).toBe("completed");
      const executions = await fixture.store.listStageExecutions(runId);
      for (const stage of [
        "discovery",
        "video_planning",
        "video_retrieval",
        "video_transcript_retrieval",
        "video_comment_retrieval",
      ] as const) {
        expect(
          executions.some((entry) => entry.stageName === stage && entry.status === "completed"),
        ).toBe(true);
      }
      const events = await fixture.store.listRunEvents(runId);
      expect(
        events.filter((event) => event.eventType === "stage_reused").length,
      ).toBeGreaterThanOrEqual(5);
    } finally {
      await fixture.store.close();
    }
  }, 30_000);
});
