import { LocalRunner } from "@cluvvi/application";
import { RunPhaseSchema } from "@cluvvi/core";
import {
  CluvviEngine,
  LocalArtifactWriter,
  createDefaultStageRegistry,
  createDiscoveryRuntime,
  parseDiscoveryRuntimeConfig,
} from "@cluvvi/engine";
import { SqliteCluvviStore, resolveLocalCluvviPaths } from "@cluvvi/storage";
import { hostname } from "node:os";
import process from "node:process";

async function main(): Promise<void> {
  const mode = process.env["CLUVVI_ENGINE_MODE"] ?? "fixture";
  if (mode !== "fixture") {
    throw new Error(
      `Unsupported CLUVVI_ENGINE_MODE: ${mode}. The local Cluvvi engine remains fixture-safe.`,
    );
  }

  const paths = resolveLocalCluvviPaths();
  const store = new SqliteCluvviStore({ databasePath: paths.databasePath });
  const artifactWriter = new LocalArtifactWriter(paths.runsDirectory);
  const discoveryConfig = parseDiscoveryRuntimeConfig();
  const discoveryRuntime = createDiscoveryRuntime({ config: discoveryConfig, artifactWriter });
  const failStageValue = process.env["CLUVVI_FIXTURE_FAIL_STAGE"]?.trim();
  const failStage =
    failStageValue === undefined || failStageValue.length === 0
      ? undefined
      : RunPhaseSchema.parse(failStageValue);
  const runnerId = `runner_${hostname()}_${process.pid}`;
  const runner = new LocalRunner({
    store,
    artifactWriter,
    engine: new CluvviEngine({
      store,
      artifactWriter,
      stages: createDefaultStageRegistry({ discoveryRuntime }),
      discoveryRuntimeMode: discoveryRuntime.mode,
      discoveryProviderMode: discoveryRuntime.providerMode,
      discoveryProviderPolicy: discoveryRuntime.providerPolicy,
      discoveryExtractionMode: discoveryRuntime.extractionMode ?? "none",
      discoveryMaximumExtractions: discoveryRuntime.maximumExtractions ?? 8,
      discoveryStructuredContentMode: discoveryRuntime.structuredContentMode ?? "none",
      discoveryMaximumStructuredResources: discoveryRuntime.maximumStructuredResources ?? 8,
      discoveryMaximumDocumentResources: discoveryRuntime.maximumDocumentResources ?? 4,
      discoverySourceAdapterMode: discoveryRuntime.sourceAdapterMode ?? "none",
      discoverySourceFamilies: discoveryRuntime.sourceFamilies ?? [],
      discoveryMaximumHiringTargets: discoveryRuntime.maximumHiringTargets ?? 10,
      discoveryMaximumHiringBoardsPerTarget: discoveryRuntime.maximumHiringBoardsPerTarget ?? 4,
      discoveryMaximumHiringJobsPerBoard: discoveryRuntime.maximumHiringJobsPerBoard ?? 250,
      discoveryMaximumHiringJobsTotal: discoveryRuntime.maximumHiringJobsTotal ?? 2_000,
      discoveryRedditDepth: discoveryRuntime.redditDepth ?? "default",
      discoveryMaximumRedditQueries: discoveryRuntime.maximumRedditQueries ?? 8,
      discoveryMaximumRedditSubreddits: discoveryRuntime.maximumRedditSubreddits ?? 20,
      discoveryMaximumRedditThreads: discoveryRuntime.maximumRedditThreads ?? 100,
      discoveryMaximumRedditThreadDrill: discoveryRuntime.maximumRedditThreadDrill ?? 5,
      discoveryGitHubDepth: discoveryRuntime.githubDepth ?? "default",
      discoveryMaximumGitHubQueries: discoveryRuntime.maximumGitHubQueries ?? 4,
      discoveryMaximumGitHubRepositories: discoveryRuntime.maximumGitHubRepositories ?? 8,
      discoveryMaximumGitHubThreadDrill: discoveryRuntime.maximumGitHubThreadDrill ?? 5,
      communitySignalRuleVersion:
        discoveryRuntime.communitySignalRuleVersion ?? "community_signals@1.0.0",
      developerSignalRuleVersion:
        discoveryRuntime.developerSignalRuleVersion ?? "c1-j3.developer-signals.v1",
      hiringSignalRuleVersion: discoveryRuntime.hiringSignalRuleVersion ?? "hiring_signals@1.0.0",
      hiringTaxonomyVersion: discoveryRuntime.hiringTaxonomyVersion ?? "hiring_taxonomy@1.0.0",
      hiringTechnologyLexiconVersion:
        discoveryRuntime.hiringTechnologyLexiconVersion ?? "hiring_technology_lexicon@1.0.0",
      extractorVersion: discoveryRuntime.extractorVersion ?? "basic_public_html_extractor@1.0.0",
      frontierPolicyVersion: discoveryRuntime.frontierPolicyVersion ?? "frontier_policy@1.0.0",
      structuredParserPolicyVersion:
        discoveryRuntime.structuredParserPolicyVersion ?? "structured_parser_policy@1.0.0",
      anydocParserVersion: discoveryRuntime.anydocParserVersion ?? "@firecrawl/anydoc@0.1.6",
      htmlMarkdownRendererVersion:
        discoveryRuntime.htmlMarkdownRendererVersion ?? "sanitized_html_to_gfm@1.0.0",
      extractionQualityEvaluatorVersion:
        discoveryRuntime.extractionQualityEvaluatorVersion ?? "extraction_quality@1.0.0",
      providerConfigurationFingerprint: discoveryRuntime.providerConfigurationFingerprint,
      extractionConfigurationFingerprint:
        discoveryRuntime.extractionConfigurationFingerprint ?? "fixture-no-extraction",
      structuredConfigurationFingerprint:
        discoveryRuntime.structuredConfigurationFingerprint ?? "fixture-no-structured-content",
      sourceAdapterConfigurationFingerprint:
        discoveryRuntime.sourceAdapterConfigurationFingerprint ?? "fixture-no-source-adapters",
      communityConfigurationFingerprint:
        discoveryRuntime.communityConfigurationFingerprint ?? "fixture-no-community-sources",
      developerConfigurationFingerprint:
        discoveryRuntime.developerConfigurationFingerprint ?? "fixture-no-developer-sources",
      videoConfigurationFingerprint:
        discoveryRuntime.videoConfigurationFingerprint ?? "fixture-no-video-sources",
      specializedConfigurationFingerprint:
        discoveryRuntime.specializedConfigurationFingerprint ?? "fixture-no-specialized-sources",
      stageDelayMs: Number(process.env["CLUVVI_FIXTURE_STAGE_DELAY_MS"] ?? 120),
    }),
    runnerId,
    hostname: hostname(),
    processId: process.pid,
    discoveryRuntimeMode: discoveryRuntime.mode,
    discoveryProviderMode: discoveryRuntime.providerMode,
    discoveryProviderPolicy: discoveryRuntime.providerPolicy,
    pollIntervalMs: Number(process.env["CLUVVI_RUNNER_POLL_MS"] ?? 750),
    ...(failStage === undefined ? {} : { failStage }),
    onReady: async () => {
      console.log(
        [
          "Cluvvi local runner active",
          `Runner: ${runnerId}`,
          `SQLite: ${paths.databasePath}`,
          `Database instance: ${await store.getDatabaseInstanceId()}`,
          `Data mode: ${
            discoveryRuntime.providerMode === "live_search"
              ? "live search snippets with deterministic local downstream analysis"
              : "fixture-only"
          }`,
          `Discovery runtime: ${discoveryRuntime.mode}`,
          `Discovery providers: ${discoveryRuntime.providerMode}`,
          `Discovery policy: ${discoveryRuntime.providerPolicy}`,
        ].join("\n"),
      );
    },
  });
  const abortController = new AbortController();
  const stop = (signal: string) => {
    console.log(`Cluvvi local runner stopping after ${signal}.`);
    abortController.abort();
  };
  process.once("SIGINT", () => stop("SIGINT"));
  process.once("SIGTERM", () => stop("SIGTERM"));

  console.log(`Cluvvi local runner starting\nRunner: ${runnerId}\nSQLite: ${paths.databasePath}`);
  try {
    if (process.argv.includes("--once")) {
      await runner.startOnce();
      return;
    }
    await runner.start(abortController.signal);
  } finally {
    await store.close();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? (error.stack ?? error.message) : String(error));
  process.exitCode = 1;
});
