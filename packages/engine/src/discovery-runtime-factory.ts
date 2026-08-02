import type { LocalArtifactWriter } from "./artifact-writer";
import type { DiscoveryRuntimeConfig } from "./discovery-runtime-config";
import { FixtureDiscoveryRuntime, type DiscoveryRuntime } from "./discovery-runtime";
import { LocalProcessDiscoveryRuntime } from "./local-process-discovery-runtime";

export function createDiscoveryRuntime(input: {
  config: DiscoveryRuntimeConfig;
  artifactWriter: LocalArtifactWriter;
}): DiscoveryRuntime {
  if (input.config.mode === "fixture") return new FixtureDiscoveryRuntime();
  return new LocalProcessDiscoveryRuntime({
    config: input.config.local,
    runsDirectory: input.artifactWriter.runsDirectory,
  });
}
