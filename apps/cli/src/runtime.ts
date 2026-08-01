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
    providerConfigurationFingerprint: discoveryRuntime.providerConfigurationFingerprint,
    ...(eventSink === undefined ? {} : { eventSink }),
  });
  return { paths, store, engine, discoveryConfig };
}
