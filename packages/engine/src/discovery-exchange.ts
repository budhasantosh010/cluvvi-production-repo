import { resolve } from "node:path";

export const DISCOVERY_EXCHANGE_FILE_NAMES = [
  "discovery-request.v1.json",
  "search-results.v2.json",
  "search-results.v2.json.provider-executions.v1.json",
  "discovery-stdout.log",
  "discovery-stderr.log",
  "discovery-execution.json",
] as const;

export interface DiscoveryExchangePaths {
  directory: string;
  requestPath: string;
  outputPath: string;
  providerTelemetryPath: string;
  stdoutPath: string;
  stderrPath: string;
  executionPath: string;
}

export function discoveryExchangePaths(
  runsDirectory: string,
  runId: string,
): DiscoveryExchangePaths {
  const directory = resolve(runsDirectory, runId, "discovery-exchange");
  const outputPath = resolve(directory, "search-results.v2.json");
  return {
    directory,
    requestPath: resolve(directory, "discovery-request.v1.json"),
    outputPath,
    providerTelemetryPath: `${outputPath}.provider-executions.v1.json`,
    stdoutPath: resolve(directory, "discovery-stdout.log"),
    stderrPath: resolve(directory, "discovery-stderr.log"),
    executionPath: resolve(directory, "discovery-execution.json"),
  };
}
