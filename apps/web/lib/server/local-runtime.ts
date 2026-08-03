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
    }),
  };
}

export function getWebLocalRuntime(): Promise<WebLocalRuntime> {
  runtimeGlobal.__cluvviWebRuntime ??= createRuntime();
  return runtimeGlobal.__cluvviWebRuntime;
}
