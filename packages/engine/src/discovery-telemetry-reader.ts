import { LiveProviderRunTelemetryV1Schema, type LiveProviderRunTelemetryV1 } from "@cluvvi/core";
import { readFile } from "node:fs/promises";
import { discoveryExchangePaths } from "./discovery-exchange";

export async function readLiveProviderTelemetry(input: {
  runsDirectory: string;
  runId: string;
}): Promise<LiveProviderRunTelemetryV1 | null> {
  const path = discoveryExchangePaths(input.runsDirectory, input.runId).providerTelemetryPath;
  try {
    return LiveProviderRunTelemetryV1Schema.parse(
      JSON.parse(await readFile(path, "utf8")) as unknown,
    );
  } catch (error) {
    if (error !== null && typeof error === "object" && "code" in error && error.code === "ENOENT") {
      return null;
    }
    throw error;
  }
}
