import type { EngineEventSink } from "@cluvvi/engine";
import {
  CluvviEngine,
  LocalArtifactWriter,
  createDefaultStageRegistry,
  createDiscoveryRuntime,
  parseDiscoveryRuntimeConfig,
} from "@cluvvi/engine";
import { SqliteCluvviStore } from "@cluvvi/storage";
import { localProjectPaths } from "./project";

export function createLocalRuntime(eventSink?: EngineEventSink) {
  const paths = localProjectPaths();
  const store = new SqliteCluvviStore({ databasePath: paths.databasePath });
  const artifactWriter = new LocalArtifactWriter(paths.runsDirectory);
  const discoveryConfig = parseDiscoveryRuntimeConfig();
  const discoveryRuntime = createDiscoveryRuntime({ config: discoveryConfig, artifactWriter });
  const engine = new CluvviEngine({
    store,
    stages: createDefaultStageRegistry({ discoveryRuntime }),
    artifactWriter,
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
    ...(eventSink === undefined ? {} : { eventSink }),
  });
  return { paths, store, engine, discoveryConfig };
}
