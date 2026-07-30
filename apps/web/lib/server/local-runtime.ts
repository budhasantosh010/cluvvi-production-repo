import "server-only";

import { LocalCluvviApplicationService } from "@cluvvi/application";
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
  const store = new SqliteCluvviStore({ databasePath: paths.databasePath });
  await store.initialize();
  return {
    paths,
    store,
    service: new LocalCluvviApplicationService({ store, paths }),
  };
}

export function getWebLocalRuntime(): Promise<WebLocalRuntime> {
  runtimeGlobal.__cluvviWebRuntime ??= createRuntime();
  return runtimeGlobal.__cluvviWebRuntime;
}
