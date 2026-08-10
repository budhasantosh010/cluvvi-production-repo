import {
  BuyerMapArtifactV1Schema,
  EvidenceFindingsArtifactV1Schema,
  IdentityEnrichmentArtifactV1Schema,
  MissionInputSchemaV1,
  RankedOpportunitiesArtifactV1Schema,
  SpecializedFindingsArtifactV1Schema,
  SpecializedSourcePlanArtifactV1Schema,
  SpecializedSourceRunTelemetryArtifactV1Schema,
  VideoCollectionArtifactV1Schema,
  VideoSourceRunTelemetryArtifactV1Schema,
} from "@cluvvi/core";
import { SqliteCluvviStore } from "@cluvvi/storage";
import { execFile } from "node:child_process";
import { randomUUID } from "node:crypto";
import { rm } from "node:fs/promises";
import { resolve } from "node:path";
import { promisify } from "node:util";
import { afterAll, describe, expect, it } from "vitest";
import {
  CluvviEngine,
  LocalArtifactWriter,
  LocalProcessDiscoveryRuntime,
  createDefaultStageRegistry,
} from "../src";

const execFileAsync = promisify(execFile);
const EXPECTED_PROJECT_A_SHA = "298446dcfa53b2c8c517c28e9d56a0816ed12480";
const projectAPath =
  process.env["CLUVVI_DISCOVERY_ENGINE_PATH"]?.trim() ||
  resolve(process.cwd(), "..", "Separate Discovery engine");
const runReal = process.env["RUN_VIDEO_SPECIALIZED_DISCOVERY_INTEGRATION"] === "1";
const integration = runReal ? describe.sequential : describe.skip;
const cleanup: string[] = [];
const stores: SqliteCluvviStore[] = [];

afterAll(async () => {
  await Promise.all(stores.splice(0).map((store) => store.close()));
  await Promise.all(cleanup.splice(0).map((path) => rm(path, { recursive: true, force: true })));
});

function system(input: {
  providerMode: "fixture_only" | "live_search";
  sourceFamilies: ("video" | "specialized")[];
}) {
  const root = resolve(process.cwd(), ".cluvvi-test", `j45-real-${randomUUID()}`);
  cleanup.push(root);
  const runsDirectory = resolve(root, "runs");
  const store = new SqliteCluvviStore({
    databasePath: resolve(root, "cluvvi.sqlite"),
    migrationsDirectory: resolve(process.cwd(), "packages/storage/migrations"),
  });
  stores.push(store);
  const artifactWriter = new LocalArtifactWriter(runsDirectory);
  const discoveryRuntime = new LocalProcessDiscoveryRuntime({
    config: {
      projectPath: projectAPath,
      command: "pnpm",
      timeoutMs: 180_000,
      keepExchangeFiles: true,
      providerMode: input.providerMode,
      providerPolicy: "free_only",
      extractionMode: "none",
      maximumExtractions: 2,
      structuredContentMode: "none",
      maximumStructuredResources: 2,
      maximumDocumentResources: 1,
      sourceAdapterMode: "selected_sources",
      sourceFamilies: input.sourceFamilies,
      maximumHiringTargets: 3,
      maximumHiringBoardsPerTarget: 2,
      maximumHiringJobsPerBoard: 50,
      maximumHiringJobsTotal: 100,
      redditDepth: "quick",
      maximumRedditQueries: 2,
      maximumRedditSubreddits: 3,
      maximumRedditThreads: 5,
      maximumRedditThreadDrill: 2,
      githubDepth: "quick",
      maximumGitHubQueries: 2,
      maximumGitHubRepositories: 3,
      maximumGitHubThreadDrill: 2,
      youtubeDepth: "quick",
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
      providerEnvironment: {
        DISCOVERY_YOUTUBE_ENABLED: "true",
        DISCOVERY_YOUTUBE_DEPTH: "quick",
        DISCOVERY_YOUTUBE_MAX_QUERIES: "2",
        DISCOVERY_YOUTUBE_TRANSCRIPT_DRILL_QUICK: "1",
        DISCOVERY_YOUTUBE_COMMENTS_ENABLED: "false",
        DISCOVERY_SPECIALIZED_ENABLED: "true",
        DISCOVERY_SPECIALIZED_MODE: "auto",
        DISCOVERY_SPECIALIZED_DYNAMIC_DISCOVERY: "true",
        DISCOVERY_SPECIALIZED_MAX_PACKS: "3",
        DISCOVERY_SPECIALIZED_MAX_DISCOVERY_QUERIES: "4",
        DISCOVERY_SPECIALIZED_MAX_CANDIDATES: "8",
        DISCOVERY_SPECIALIZED_MAX_SELECTED_SOURCES: "5",
        DISCOVERY_SPECIALIZED_COVERAGE_GAP_TRIGGER: "0.65",
        DISCOVERY_SPECIALIZED_ARXIV_ENABLED: "true",
        DISCOVERY_SPECIALIZED_ARXIV_MAX_RESULTS: "3",
        DISCOVERY_SPECIALIZED_ARXIV_MAX_TOTAL_RESULTS: "3",
        DISCOVERY_SPECIALIZED_TECHMEME_ENABLED: "true",
        DISCOVERY_SPECIALIZED_DIGG_ENABLED: "true",
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
    discoveryYoutubeDepth: discoveryRuntime.youtubeDepth,
    communitySignalRuleVersion: discoveryRuntime.communitySignalRuleVersion,
    developerSignalRuleVersion: discoveryRuntime.developerSignalRuleVersion,
    videoSignalRuleVersion: discoveryRuntime.videoSignalRuleVersion,
    specializedSignalRuleVersion: discoveryRuntime.specializedSignalRuleVersion,
    providerConfigurationFingerprint: discoveryRuntime.providerConfigurationFingerprint,
    extractionConfigurationFingerprint: discoveryRuntime.extractionConfigurationFingerprint,
    structuredConfigurationFingerprint: discoveryRuntime.structuredConfigurationFingerprint,
    sourceAdapterConfigurationFingerprint: discoveryRuntime.sourceAdapterConfigurationFingerprint,
    communityConfigurationFingerprint: discoveryRuntime.communityConfigurationFingerprint,
    developerConfigurationFingerprint: discoveryRuntime.developerConfigurationFingerprint,
    videoConfigurationFingerprint: discoveryRuntime.videoConfigurationFingerprint,
    specializedConfigurationFingerprint: discoveryRuntime.specializedConfigurationFingerprint,
  });
  return { engine };
}

function data(result: Awaited<ReturnType<CluvviEngine["start"]>>, type: string): unknown {
  return result.artifacts.find((artifact) => artifact.artifactType === type)?.data;
}

integration("C1-J.4/J.5 real Project A → Project B bridge", () => {
  it("pins Project A and imports real public YouTube plus Tech/AI specialized evidence with zero paid usage", async () => {
    const { stdout } = await execFileAsync("git", ["rev-parse", "HEAD"], {
      cwd: projectAPath,
      windowsHide: true,
    });
    expect(stdout.trim()).toBe(EXPECTED_PROJECT_A_SHA);
    const fixture = system({
      providerMode: "fixture_only",
      sourceFamilies: ["video", "specialized"],
    });
    const mission = MissionInputSchemaV1.parse({
      schemaVersion: "1.0",
      name: "C1-J.4/J.5 real Tech AI bridge",
      description:
        "Research Git and TypeScript developer workflow problems plus current AI software research using bounded public YouTube text and specialized technology sources such as arXiv and Techmeme. Do not infer creator, commenter, publisher, buyer, or contact identity.",
      customerOutcome: "Use public technology evidence cautiously.",
      desiredOpportunities: 10,
      exclusions: [
        "media download",
        "cookies",
        "private content",
        "contact enrichment",
        "outreach",
      ],
    });
    const result = await fixture.engine.start({
      mission,
      sourceFile: "integration://c1-j45-real-tech",
    });
    const videos = VideoCollectionArtifactV1Schema.parse(data(result, "video_collection"));
    const videoTelemetry = VideoSourceRunTelemetryArtifactV1Schema.parse(
      data(result, "video_source_telemetry"),
    );
    const specializedTelemetry = SpecializedSourceRunTelemetryArtifactV1Schema.parse(
      data(result, "specialized_source_telemetry"),
    );
    const specializedFindings = SpecializedFindingsArtifactV1Schema.parse(
      data(result, "specialized_findings"),
    );
    const evidence = EvidenceFindingsArtifactV1Schema.parse(data(result, "evidence_findings"));
    const identity = IdentityEnrichmentArtifactV1Schema.parse(data(result, "identity_enrichment"));
    const ranked = RankedOpportunitiesArtifactV1Schema.parse(data(result, "ranked_opportunities"));
    const buyerMap = BuyerMapArtifactV1Schema.parse(data(result, "buyer_map"));
    expect(videos.videos.length).toBeGreaterThan(0);
    expect(videos.videos.some((video) => video.availability === "public")).toBe(true);
    expect(videoTelemetry.queries).toBeGreaterThan(0);
    expect(
      videoTelemetry.searchProcessStarts + videoTelemetry.metadataProcessStarts,
    ).toBeGreaterThan(0);
    expect(videoTelemetry.paidRequests).toBe(0);
    expect(videoTelemetry.paidCredits).toBe(0);
    expect(specializedTelemetry.dedicatedAdapterAttempts).toBeGreaterThan(0);
    expect(specializedFindings.findings.length).toBeGreaterThan(0);
    expect(specializedTelemetry.paidRequests).toBe(0);
    expect(specializedTelemetry.paidCredits).toBe(0);
    expect(identity.fabricatedContacts).toBe(false);
    expect(
      ranked.opportunities.every(
        (item) => item.videoContribution.points <= 1 && item.specializedContribution.points <= 1,
      ),
    ).toBe(true);
    expect(buyerMap.summary.videoCitationCount).toBeGreaterThanOrEqual(0);
    expect(
      buyerMap.summary.specializedFindingCitationCount +
        buyerMap.summary.specializedSignalCitationCount,
    ).toBeGreaterThanOrEqual(0);
    expect(
      JSON.stringify({
        videoTelemetry,
        specializedTelemetry,
        specializedFindings,
        evidence,
        identity,
      }),
    ).not.toMatch(/"(?:authorization|cookie|api[_-]?key|token|accessToken|refreshToken)"\s*:/iu);
  }, 240_000);

  it("uses free-only provider routing for non-tech UK HR/compliance coverage-gap discovery and never forwards an executable registry path", async () => {
    const fixture = system({ providerMode: "live_search", sourceFamilies: ["specialized"] });
    const mission = MissionInputSchemaV1.parse({
      schemaVersion: "1.0",
      name: "C1-J.5 real non-tech dynamic bridge",
      description:
        "Research current United Kingdom human resources workplace compliance regulation, enforcement, professional-body guidance, and licensing or standards signals for employers. Use specialist public sources and fill coverage gaps dynamically.",
      customerOutcome: "Identify cautious UK HR compliance specialist-source evidence.",
      desiredOpportunities: 8,
      exclusions: [
        "paid search",
        "private sources",
        "arbitrary scripts",
        "contact enrichment",
        "outreach",
      ],
      geographies: ["United Kingdom"],
    });
    const result = await fixture.engine.start({
      mission,
      sourceFile: "integration://c1-j5-real-uk-hr",
    });
    const plan = SpecializedSourcePlanArtifactV1Schema.parse(
      data(result, "specialized_source_plan"),
    );
    const telemetry = SpecializedSourceRunTelemetryArtifactV1Schema.parse(
      data(result, "specialized_source_telemetry"),
    );
    expect(plan.dynamicDiscoveryTriggered).toBe(true);
    expect(plan.discoveryQueries.length).toBeGreaterThan(0);
    expect(telemetry.paidRequests).toBe(0);
    expect(telemetry.paidCredits).toBe(0);
    expect(telemetry.coverageAfter).toBeGreaterThanOrEqual(telemetry.coverageBefore);
    expect(JSON.stringify({ plan, telemetry })).not.toMatch(
      /DISCOVERY_SPECIALIZED_SOURCE_REGISTRY_PATH|scriptPath|binaryPath|commandPath/iu,
    );
  }, 240_000);
});
