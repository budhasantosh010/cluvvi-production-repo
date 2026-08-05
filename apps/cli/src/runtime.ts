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
    extractorVersion: discoveryRuntime.extractorVersion ?? "basic_public_html_extractor@1.0.0",
    frontierPolicyVersion: discoveryRuntime.frontierPolicyVersion ?? "frontier_policy@1.0.0",
    providerConfigurationFingerprint: discoveryRuntime.providerConfigurationFingerprint,
    extractionConfigurationFingerprint:
      discoveryRuntime.extractionConfigurationFingerprint ?? "fixture-no-extraction",
    ...(eventSink === undefined ? {} : { eventSink }),
  });
  return { paths, store, engine, discoveryConfig };
}
