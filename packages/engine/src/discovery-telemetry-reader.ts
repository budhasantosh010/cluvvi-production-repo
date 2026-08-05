import {
  LiveProviderRunTelemetryV1Schema,
  ProviderPolicyTraceV1Schema,
  type LiveProviderRunTelemetryV1,
  type ProviderPolicyTraceV1,
} from "@cluvvi/core";
import { readFile } from "node:fs/promises";
import { discoveryExchangePaths } from "./discovery-exchange";

function isNotFound(error: unknown): boolean {
  return error !== null && typeof error === "object" && "code" in error && error.code === "ENOENT";
}

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
    if (isNotFound(error)) return null;
    throw error;
  }
}

export async function readProviderPolicyTrace(input: {
  runsDirectory: string;
  runId: string;
}): Promise<ProviderPolicyTraceV1 | null> {
  const path = discoveryExchangePaths(input.runsDirectory, input.runId).providerPolicyTracePath;
  try {
    return ProviderPolicyTraceV1Schema.parse(JSON.parse(await readFile(path, "utf8")) as unknown);
  } catch (error) {
    if (isNotFound(error)) return null;
    throw error;
  }
}
