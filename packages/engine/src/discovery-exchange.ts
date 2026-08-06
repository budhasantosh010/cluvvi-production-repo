import { resolve } from "node:path";

export const DISCOVERY_EXCHANGE_FILE_NAMES = [
  "discovery-request.v1.json",
  "search-results.v2.json",
  "search-results.v2.json.provider-executions.v1.json",
  "search-results.v2.json.provider-policy-trace.v1.json",
  "crawl-frontier.v1.json",
  "extracted-content.v1.json",
  "extraction-run-telemetry.v1.json",
  "structured-content.v1.json",
  "content-parse-telemetry.v1.json",
  "discovery-stdout.log",
  "discovery-stderr.log",
  "discovery-execution.json",
] as const;

export interface DiscoveryExchangePaths {
  directory: string;
  requestPath: string;
  outputPath: string;
  providerTelemetryPath: string;
  providerPolicyTracePath: string;
  frontierPath: string;
  extractedContentPath: string;
  extractionTelemetryPath: string;
  structuredContentPath: string;
  contentParseTelemetryPath: string;
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
    providerPolicyTracePath: `${outputPath}.provider-policy-trace.v1.json`,
    frontierPath: resolve(directory, "crawl-frontier.v1.json"),
    extractedContentPath: resolve(directory, "extracted-content.v1.json"),
    extractionTelemetryPath: resolve(directory, "extraction-run-telemetry.v1.json"),
    structuredContentPath: resolve(directory, "structured-content.v1.json"),
    contentParseTelemetryPath: resolve(directory, "content-parse-telemetry.v1.json"),
    stdoutPath: resolve(directory, "discovery-stdout.log"),
    stderrPath: resolve(directory, "discovery-stderr.log"),
    executionPath: resolve(directory, "discovery-execution.json"),
  };
}
