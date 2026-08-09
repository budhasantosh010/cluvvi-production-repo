import "server-only";

import { LocalCluvviApplicationService } from "@cluvvi/application";
import { parseDiscoveryRuntimeConfig } from "@cluvvi/engine";
import { SqliteCluvviStore, resolveLocalCluvviPaths } from "@cluvvi/storage";

export interface WebLocalRuntime {
  paths: ReturnType<typeof resolveLocalCluvviPaths>;
  store: SqliteCluvviStore;
  service: LocalCluvviApplicationService;
}

const runtimeGlobal = globalThis as typeof globalThis & {
  __cluvviWebRuntime?: Promise<WebLocalRuntime>;
};

async function createRuntime(): Promise<WebLocalRuntime> {
  const paths = resolveLocalCluvviPaths();
  const discoveryConfig = parseDiscoveryRuntimeConfig();
  const store = new SqliteCluvviStore({ databasePath: paths.databasePath });
  await store.initialize();
  return {
    paths,
    store,
    service: new LocalCluvviApplicationService({
      store,
      paths,
      discoveryRuntimeMode: discoveryConfig.mode,
      discoveryProviderMode: discoveryConfig.providerMode,
      discoveryProviderPolicy: discoveryConfig.providerPolicy,
      discoveryExtractionMode: discoveryConfig.extractionMode,
      discoveryMaximumExtractions: discoveryConfig.maximumExtractions,
      discoveryStructuredContentMode: discoveryConfig.structuredContentMode,
      discoveryMaximumStructuredResources: discoveryConfig.maximumStructuredResources,
      discoveryMaximumDocumentResources: discoveryConfig.maximumDocumentResources,
      discoverySourceAdapterMode: discoveryConfig.sourceAdapterMode,
      discoverySourceFamilies: discoveryConfig.sourceFamilies,
      discoveryMaximumHiringTargets: discoveryConfig.maximumHiringTargets,
      discoveryMaximumHiringBoardsPerTarget: discoveryConfig.maximumHiringBoardsPerTarget,
      discoveryMaximumHiringJobsPerBoard: discoveryConfig.maximumHiringJobsPerBoard,
      discoveryMaximumHiringJobsTotal: discoveryConfig.maximumHiringJobsTotal,
      discoveryRedditDepth: discoveryConfig.redditDepth,
      discoveryMaximumRedditQueries: discoveryConfig.maximumRedditQueries,
      discoveryMaximumRedditSubreddits: discoveryConfig.maximumRedditSubreddits,
      discoveryMaximumRedditThreads: discoveryConfig.maximumRedditThreads,
      discoveryMaximumRedditThreadDrill: discoveryConfig.maximumRedditThreadDrill,
      discoveryGitHubDepth: discoveryConfig.githubDepth,
      discoveryMaximumGitHubQueries: discoveryConfig.maximumGitHubQueries,
      discoveryMaximumGitHubRepositories: discoveryConfig.maximumGitHubRepositories,
      discoveryMaximumGitHubThreadDrill: discoveryConfig.maximumGitHubThreadDrill,
      communitySignalRuleVersion: discoveryConfig.communitySignalRuleVersion,
      developerSignalRuleVersion: discoveryConfig.developerSignalRuleVersion,
      hiringSignalRuleVersion: discoveryConfig.hiringSignalRuleVersion,
      hiringTaxonomyVersion: discoveryConfig.hiringTaxonomyVersion,
      hiringTechnologyLexiconVersion: discoveryConfig.hiringTechnologyLexiconVersion,
      extractorVersion: discoveryConfig.extractorVersion,
      frontierPolicyVersion: discoveryConfig.frontierPolicyVersion,
      structuredParserPolicyVersion: discoveryConfig.structuredParserPolicyVersion,
      anydocParserVersion: discoveryConfig.anydocParserVersion,
      htmlMarkdownRendererVersion: discoveryConfig.htmlMarkdownRendererVersion,
      extractionQualityEvaluatorVersion: discoveryConfig.extractionQualityEvaluatorVersion,
    }),
  };
}

export function getWebLocalRuntime(): Promise<WebLocalRuntime> {
  runtimeGlobal.__cluvviWebRuntime ??= createRuntime();
  return runtimeGlobal.__cluvviWebRuntime;
}
