import { CluvviEngine, LocalArtifactWriter, createDefaultStageRegistry } from "@cluvvi/engine";
import { SqliteCluvviStore } from "@cluvvi/storage";
import type { EngineEventSink } from "@cluvvi/engine";
import { localProjectPaths } from "./project";

export function createLocalRuntime(eventSink?: EngineEventSink) {
  const paths = localProjectPaths();
  const store = new SqliteCluvviStore({ databasePath: paths.databasePath });
  const artifactWriter = new LocalArtifactWriter(paths.runsDirectory);
  const engine = new CluvviEngine({
    store,
    stages: createDefaultStageRegistry(),
    artifactWriter,
    ...(eventSink === undefined ? {} : { eventSink }),
  });
  return { paths, store, engine };
}
