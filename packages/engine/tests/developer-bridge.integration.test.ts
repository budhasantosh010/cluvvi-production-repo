import {
  BuyerMapArtifactV1Schema,
  DeveloperCommentCollectionManifestArtifactV1Schema,
  DeveloperCommentMetadataArtifactV1Schema,
  DeveloperRepositoryCollectionArtifactV1Schema,
  DeveloperSignalsArtifactV1Schema,
  DeveloperSourcePlanArtifactV1Schema,
  DeveloperSourceRunTelemetryArtifactV1Schema,
  DeveloperThreadManifestArtifactV1Schema,
  DeveloperThreadMetadataArtifactV1Schema,
  EvidenceFindingsArtifactV1Schema,
  IdentityEnrichmentArtifactV1Schema,
  LocalDiscoveryExecutionRecordV1Schema,
  MissionInputSchemaV1,
  RankedOpportunitiesArtifactV1Schema,
  validateDeveloperArtifactSet,
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
  buildContainedEvidencePrompt,
  createDefaultStageRegistry,
} from "../src";

const cleanupDirectories: string[] = [];
const controlledProject = resolve(process.cwd(), "tests/fixtures/local-discovery-engine");

afterEach(async () => {
  if (process.env["KEEP_C1J3_CONTROLLED_OUTPUT"] === "1") return;
  await Promise.all(
    cleanupDirectories.splice(0).map((path) => rm(path, { recursive: true, force: true })),
  );
});

function runtime(
  behavior: string,
  options: {
    fullUpstream?: boolean;
    githubDepth?: "quick" | "default" | "deep";
    maximumGitHubThreadDrill?: number;
    providerEnvironment?: Record<string, string>;
  } = {},
) {
  const root = resolve(process.cwd(), ".cluvvi-test", `developer-${randomUUID()}`);
  cleanupDirectories.push(root);
  const runsDirectory = resolve(root, "runs");
  const store = new SqliteCluvviStore({
    databasePath: resolve(root, "cluvvi.sqlite"),
    migrationsDirectory: resolve(process.cwd(), "packages/storage/migrations"),
  });
  const artifactWriter = new LocalArtifactWriter(runsDirectory);
  const fullUpstream = options.fullUpstream === true;
  const discoveryRuntime = new LocalProcessDiscoveryRuntime({
    config: {
      projectPath: controlledProject,
      command: "pnpm",
      timeoutMs: 60_000,
      keepExchangeFiles: true,
      providerMode: "fixture_only",
      providerPolicy: "free_only",
      extractionMode: fullUpstream ? "selected_public_pages" : "none",
      maximumExtractions: 2,
      structuredContentMode: fullUpstream ? "selected_resources" : "none",
      maximumStructuredResources: 2,
      maximumDocumentResources: 1,
      sourceAdapterMode: "selected_sources",
      sourceFamilies: fullUpstream ? ["hiring", "community", "developer"] : ["developer"],
      maximumHiringTargets: 3,
      maximumHiringBoardsPerTarget: 2,
      maximumHiringJobsPerBoard: 100,
      maximumHiringJobsTotal: 300,
      redditDepth: "default",
      maximumRedditQueries: 4,
      maximumRedditSubreddits: 6,
      maximumRedditThreads: 20,
      maximumRedditThreadDrill: 5,
      githubDepth: options.githubDepth ?? "default",
      maximumGitHubQueries: 4,
      maximumGitHubRepositories: 8,
      maximumGitHubThreadDrill: options.maximumGitHubThreadDrill ?? 5,
      communitySignalRuleVersion: "community_signals@1.0.0",
      developerSignalRuleVersion: "c1-j3.developer-signals.v1",
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
        ...(options.providerEnvironment ?? {}),
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
  name: "Controlled public GitHub developer intelligence",
  description:
    "Research Fixture Frame Studio integration bugs, migration friction, dependency problems, and manual workarounds using bounded public GitHub evidence without inferring developer identity, buyer identity, representative demand, or purchase intent.",
  customerOutcome: "Prioritize cautious public research with bounded developer evidence.",
  desiredOpportunities: 12,
  exclusions: [
    "private GitHub",
    "repository cloning",
    "developer identity inference",
    "contact enrichment",
    "outreach",
  ],
});

function artifact(result: Awaited<ReturnType<CluvviEngine["start"]>>, type: string): unknown {
  return result.artifacts.find((entry) => entry.artifactType === type)?.data;
}

async function runFailure(behavior: string) {
  const fixture = runtime(behavior);
  try {
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
  } catch (error) {
    await fixture.store.close();
    throw error;
  }
}

describe("C1-J.3 controlled GitHub developer bridge", () => {
  it.each([
    ["developer-plan-missing", "DEVELOPER_SOURCE_PLAN_MISSING", "developer_planning"],
    ["developer-plan-invalid-json", "DEVELOPER_SOURCE_PLAN_INVALID_JSON", "developer_planning"],
    [
      "developer-repositories-missing",
      "DEVELOPER_REPOSITORY_COLLECTION_MISSING",
      "developer_repository_retrieval",
    ],
    [
      "developer-repositories-invalid-json",
      "DEVELOPER_REPOSITORY_COLLECTION_INVALID_JSON",
      "developer_repository_retrieval",
    ],
    [
      "developer-thread-manifest-missing",
      "DEVELOPER_THREAD_MANIFEST_MISSING",
      "developer_thread_retrieval",
    ],
    [
      "developer-thread-manifest-invalid-json",
      "DEVELOPER_THREAD_MANIFEST_INVALID_JSON",
      "developer_thread_retrieval",
    ],
    [
      "developer-thread-metadata-missing",
      "DEVELOPER_THREAD_METADATA_MISSING",
      "developer_thread_context",
    ],
    [
      "developer-thread-metadata-invalid-json",
      "DEVELOPER_THREAD_METADATA_INVALID_JSON",
      "developer_thread_context",
    ],
    [
      "developer-comment-manifest-missing",
      "DEVELOPER_COMMENT_MANIFEST_MISSING",
      "developer_comment_retrieval",
    ],
    [
      "developer-comment-manifest-invalid-json",
      "DEVELOPER_COMMENT_MANIFEST_INVALID_JSON",
      "developer_comment_retrieval",
    ],
    [
      "developer-comment-metadata-missing",
      "DEVELOPER_COMMENT_METADATA_MISSING",
      "developer_comment_context",
    ],
    [
      "developer-comment-metadata-invalid-json",
      "DEVELOPER_COMMENT_METADATA_INVALID_JSON",
      "developer_comment_context",
    ],
    ["developer-signals-missing", "DEVELOPER_SIGNALS_MISSING", "developer_analysis"],
    ["developer-signals-invalid-json", "DEVELOPER_SIGNALS_INVALID_JSON", "developer_analysis"],
    [
      "developer-telemetry-missing",
      "DEVELOPER_SOURCE_TELEMETRY_MISSING",
      "developer_source_telemetry",
    ],
    [
      "developer-telemetry-invalid-json",
      "DEVELOPER_SOURCE_TELEMETRY_INVALID_JSON",
      "developer_source_telemetry",
    ],
  ] as const)(
    "rejects %s at its exact durable stage",
    async (behavior, code, phase) => {
      const { fixture, run } = await runFailure(behavior);
      try {
        expect(run?.failure?.code).toBe(code);
        expect(run?.phase).toBe(phase);
        expect(
          await fixture.store.getLatestArtifact(run?.id ?? "", "search_results"),
        ).not.toBeNull();
        const executions = await fixture.store.listStageExecutions(run?.id ?? "");
        const developerStages = [
          "developer_planning",
          "developer_repository_retrieval",
          "developer_thread_retrieval",
          "developer_thread_context",
          "developer_comment_retrieval",
          "developer_comment_context",
          "developer_analysis",
          "developer_source_telemetry",
        ] as const;
        const failedIndex = developerStages.indexOf(phase);
        for (const earlier of developerStages.slice(0, Math.max(failedIndex, 0))) {
          expect(
            executions.some((entry) => entry.stageName === earlier && entry.status === "completed"),
          ).toBe(true);
        }
      } finally {
        await fixture.store.close();
      }
    },
    30_000,
  );

  it("imports the full developer artifact family and carries public repository/thread/comment/release/signal evidence downstream with a capped +1 contribution", async () => {
    const fixture = runtime("developer-success");
    try {
      const result = await fixture.engine.start({
        mission,
        sourceFile: "integration://developer-success",
      });
      expect(result.run.status).toBe("completed");
      expect(result.run.config.discoverySourceFamilies).toEqual(["developer"]);
      expect(result.run.config.discoveryGitHubDepth).toBe("default");

      const plan = DeveloperSourcePlanArtifactV1Schema.parse(
        artifact(result, "developer_source_plan"),
      );
      const repositories = DeveloperRepositoryCollectionArtifactV1Schema.parse(
        artifact(result, "developer_repository_collection"),
      );
      const threadManifest = DeveloperThreadManifestArtifactV1Schema.parse(
        artifact(result, "developer_thread_manifest"),
      );
      const threadMetadata = DeveloperThreadMetadataArtifactV1Schema.parse(
        artifact(result, "developer_thread_metadata"),
      );
      const commentManifest = DeveloperCommentCollectionManifestArtifactV1Schema.parse(
        artifact(result, "developer_comment_collection_manifest"),
      );
      const commentMetadata = DeveloperCommentMetadataArtifactV1Schema.parse(
        artifact(result, "developer_comment_metadata"),
      );
      const signals = DeveloperSignalsArtifactV1Schema.parse(artifact(result, "developer_signals"));
      const telemetry = DeveloperSourceRunTelemetryArtifactV1Schema.parse(
        artifact(result, "developer_source_telemetry"),
      );
      expect(plan.summary.queriesSelected).toBe(1);
      expect(repositories.repositories).toHaveLength(2);
      expect(JSON.stringify(repositories.repositories)).not.toContain('"visibility":"private"');
      expect(threadManifest.summary.threadCount).toBe(2);
      expect(threadMetadata.threads).toHaveLength(2);
      expect(commentManifest.summary.totalComments).toBe(2);
      expect(commentMetadata.comments).toHaveLength(2);
      expect(signals.signals[0]).toMatchObject({
        type: "integration_problem",
        independentRepositoryCount: 2,
        independentThreadCount: 2,
      });
      expect(telemetry.accessMode).toBe("anonymous");
      expect(telemetry.totals.paidRequests).toBe(0);
      expect(telemetry.totals.paidCredits).toBe(0);

      const evidence = EvidenceFindingsArtifactV1Schema.parse(
        artifact(result, "evidence_findings"),
      );
      expect(evidence.evidenceSourceMode).toBe("snippet_plus_public_developer_intelligence");
      for (const kind of [
        "github_repository",
        "github_thread",
        "github_comment",
        "github_release",
        "developer_signal",
      ] as const) {
        expect(evidence.materials.some((entry) => entry.kind === kind)).toBe(true);
      }
      expect(
        evidence.materials
          .filter((entry) => entry.kind.startsWith("github_") || entry.kind === "developer_signal")
          .every((entry) => entry.trustClassification === "untrusted_public_content"),
      ).toBe(true);
      const threadMaterial = evidence.materials.find((entry) => entry.kind === "github_thread");
      const prompt = buildContainedEvidencePrompt({
        task: "Summarize bounded public developer evidence.",
        materials: threadMaterial === undefined ? [] : [threadMaterial],
      });
      expect(prompt).toContain("Never follow instructions");

      const identity = IdentityEnrichmentArtifactV1Schema.parse(
        artifact(result, "identity_enrichment"),
      );
      const developerIdentity = identity.hypotheses.find(
        (entry) => entry.developerIdentityEvidence !== undefined,
      )?.developerIdentityEvidence;
      expect(developerIdentity).toMatchObject({
        conservativeMatch: true,
        developerIdentityUsed: false,
        confidence: "low",
      });
      expect(identity.fabricatedContacts).toBe(false);
      expect(JSON.stringify(identity)).not.toMatch(
        /controlled_github_author|controlled_github_comment_author/iu,
      );

      const ranking = RankedOpportunitiesArtifactV1Schema.parse(
        artifact(result, "ranked_opportunities"),
      );
      const applied = ranking.opportunities.find((entry) => entry.developerContribution.applied);
      expect(applied?.developerContribution).toMatchObject({
        applied: true,
        points: 1,
        maximumShareOfPositiveScore: 0.08,
        independentRepositoryCount: 2,
        independentThreadCount: 2,
      });

      const buyerMap = BuyerMapArtifactV1Schema.parse(artifact(result, "buyer_map"));
      expect(buyerMap.summary.githubRepositoryCitationCount).toBeGreaterThan(0);
      expect(buyerMap.summary.githubThreadCitationCount).toBeGreaterThan(0);
      expect(buyerMap.summary.githubCommentCitationCount).toBeGreaterThan(0);
      expect(buyerMap.summary.githubReleaseCitationCount).toBeGreaterThan(0);
      expect(buyerMap.summary.developerSignalCitationCount).toBeGreaterThan(0);
      expect(
        buyerMap.opportunities.some((opportunity) =>
          opportunity.evidence.some(
            (citation) =>
              citation.materialKind === "developer_signal" &&
              citation.repositoryFullName !== undefined &&
              citation.developerSignalType === "integration_problem",
          ),
        ),
      ).toBe(true);
      expect(buyerMap.warning).toMatch(/GitHub|contact identity|attribution/iu);

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
      expect(execution.arguments).toContain("--github-depth");
      expect(execution.arguments).toContain("--github-max-queries");
      expect(execution.arguments).toContain("--github-max-repositories");
      expect(execution.arguments).toContain("--github-max-thread-drill");
      expect(JSON.stringify(execution)).not.toMatch(
        /github[_-]?token|authorization|gh auth token/iu,
      );
      expect(execution.developerSourcePlanImported).toBe(true);
      expect(execution.developerSourceTelemetryImported).toBe(true);
    } finally {
      await fixture.store.close();
    }
  }, 30_000);

  it("gives single-repository developer evidence zero ranking points", async () => {
    const fixture = runtime("developer-single-repo");
    try {
      const result = await fixture.engine.start({
        mission,
        sourceFile: "integration://developer-single-repo",
      });
      const ranking = RankedOpportunitiesArtifactV1Schema.parse(
        artifact(result, "ranked_opportunities"),
      );
      expect(ranking.opportunities.every((entry) => entry.developerContribution.points === 0)).toBe(
        true,
      );
      expect(
        ranking.opportunities.every(
          (entry) => entry.developerContribution.independentRepositoryCount <= 1,
        ),
      ).toBe(true);
    } finally {
      await fixture.store.close();
    }
  }, 30_000);

  it("keeps ambiguous or unlinked developer evidence out of downstream entity evidence and ranking", async () => {
    const fixture = runtime("developer-ambiguous");
    try {
      const result = await fixture.engine.start({
        mission,
        sourceFile: "integration://developer-ambiguous",
      });
      const evidence = EvidenceFindingsArtifactV1Schema.parse(
        artifact(result, "evidence_findings"),
      );
      expect(
        evidence.materials.some(
          (entry) => entry.kind.startsWith("github_") || entry.kind === "developer_signal",
        ),
      ).toBe(false);
      const ranking = RankedOpportunitiesArtifactV1Schema.parse(
        artifact(result, "ranked_opportunities"),
      );
      expect(ranking.opportunities.every((entry) => entry.developerContribution.points === 0)).toBe(
        true,
      );
    } finally {
      await fixture.store.close();
    }
  }, 30_000);

  it("preserves useful developer evidence and completes in a degraded rate-limit state without fabricating missing coverage", async () => {
    const fixture = runtime("developer-rate-limited");
    try {
      const result = await fixture.engine.start({
        mission,
        sourceFile: "integration://developer-rate-limited",
      });
      const telemetry = DeveloperSourceRunTelemetryArtifactV1Schema.parse(
        artifact(result, "developer_source_telemetry"),
      );
      expect(telemetry.totals.rateLimitEvents).toBe(1);
      expect(telemetry.attempts.some((attempt) => attempt.outcome === "rate_limited")).toBe(true);
      expect(telemetry.warnings.join(" ")).toMatch(/rate limit|preserved/iu);
      const evidence = EvidenceFindingsArtifactV1Schema.parse(
        artifact(result, "evidence_findings"),
      );
      expect(evidence.materials.some((entry) => entry.kind === "developer_signal")).toBe(true);
      expect(telemetry.totals.paidRequests).toBe(0);
    } finally {
      await fixture.store.close();
    }
  }, 30_000);

  it("repairs invalid developer signals in place and resumes the same run while reusing all prior discovery/developer stages", async () => {
    const fixture = runtime("developer-signals-invalid-contract");
    try {
      let failed: RunExecutionError | undefined;
      try {
        await fixture.engine.start({
          mission,
          sourceFile: "integration://developer-signals-repair",
        });
      } catch (error) {
        expect(error).toBeInstanceOf(RunExecutionError);
        failed = error as RunExecutionError;
      }
      expect(failed).toBeDefined();
      const runId = failed!.runId;
      expect((await fixture.store.getRun(runId))?.failure?.code).toBe("DEVELOPER_SIGNALS_INVALID");

      const exchange = resolve(fixture.runsDirectory, runId, "discovery-exchange");
      const repair = (await import(
        pathToFileURL(resolve(controlledProject, "developer-repair.mjs")).href
      )) as {
        repairControlledDeveloperSignals(signalsPath: string, telemetryPath: string): Promise<void>;
      };
      await repair.repairControlledDeveloperSignals(
        resolve(exchange, "developer-signals.v1.json"),
        resolve(exchange, "developer-source-run-telemetry.v1.json"),
      );

      const resumed = await fixture.engine.resume(runId);
      expect(resumed.run.status).toBe("completed");
      const events = await fixture.store.listRunEvents(runId);
      for (const phase of [
        "discovery",
        "developer_planning",
        "developer_repository_retrieval",
        "developer_thread_retrieval",
        "developer_thread_context",
        "developer_comment_retrieval",
        "developer_comment_context",
      ] as const) {
        expect(
          events.some((event) => event.eventType === "stage_reused" && event.phase === phase),
        ).toBe(true);
      }
      expect(
        events.some(
          (event) => event.eventType === "stage_completed" && event.phase === "developer_analysis",
        ),
      ).toBe(true);
      const signals = DeveloperSignalsArtifactV1Schema.parse(
        artifact(resumed, "developer_signals"),
      );
      expect(signals.rulesVersion).toBe("c1-j3.developer-signals.v1");
    } finally {
      await fixture.store.close();
    }
  }, 30_000);

  it("rejects recursively forbidden private/secret developer fields at the import boundary", async () => {
    const fixture = runtime("developer-success");
    try {
      const result = await fixture.engine.start({
        mission,
        sourceFile: "integration://developer-security",
      });
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
      const exchange = resolve(fixture.runsDirectory, result.run.id, "discovery-exchange");
      const read = async (fileName: string) =>
        JSON.parse(await readFile(resolve(exchange, fileName), "utf8")) as unknown;
      const threads = await Promise.all(
        DeveloperThreadManifestArtifactV1Schema.parse(
          await read("developer-thread-manifest.v1.json"),
        ).threadArtifacts.map(async (entry) => read(entry.relativeArtifactPath)),
      );
      const comments = await Promise.all(
        DeveloperCommentCollectionManifestArtifactV1Schema.parse(
          await read("developer-comment-collection-manifest.v1.json"),
        ).collections.map(async (entry) => read(entry.relativeArtifactPath)),
      );
      const input = {
        plan: await read("developer-source-plan.v1.json"),
        repositoryCollection: await read("developer-repository-collection.v1.json"),
        threadManifest: await read("developer-thread-manifest.v1.json"),
        threadMetadata: await read("developer-thread-metadata.v1.json"),
        threads,
        commentManifest: await read("developer-comment-collection-manifest.v1.json"),
        commentMetadata: await read("developer-comment-metadata.v1.json"),
        commentCollections: comments,
        signals: await read("developer-signals.v1.json"),
        telemetry: await read("developer-source-run-telemetry.v1.json"),
        expectedRequestId: execution.requestId,
      };
      expect(() =>
        validateDeveloperArtifactSet({
          ...input,
          repositoryCollection: {
            ...(input.repositoryCollection as Record<string, unknown>),
            nested: { authorization: "Bearer forbidden-secret" },
          },
        }),
      ).toThrow(/Forbidden imported field|DEVELOPER_PRIVATE_DATA_REJECTED/iu);
    } finally {
      await fixture.store.close();
    }
  }, 30_000);
});
