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
  "source-target-plan.v1.json",
  "job-collection.v1.json",
  "hiring-signals.v1.json",
  "source-adapter-run-telemetry.v1.json",
  "community-source-plan.v1.json",
  "thread-manifest.v1.json",
  "community-thread-context.v1.json",
  "comment-collection-manifest.v1.json",
  "community-comment-context.v1.json",
  "community-signals.v1.json",
  "community-source-run-telemetry.v1.json",
  "developer-source-plan.v1.json",
  "developer-repository-collection.v1.json",
  "developer-thread-manifest.v1.json",
  "developer-thread-metadata.v1.json",
  "developer-comment-collection-manifest.v1.json",
  "developer-comment-metadata.v1.json",
  "developer-signals.v1.json",
  "developer-source-run-telemetry.v1.json",
  "video-source-plan.v1.json",
  "video-collection.v1.json",
  "transcript-manifest.v1.json",
  "video-comment-manifest.v1.json",
  "video-signals.v1.json",
  "video-source-run-telemetry.v1.json",
  "specialized-source-context.v1.json",
  "specialized-source-candidates.v1.json",
  "specialized-source-plan.v1.json",
  "specialized-findings.v1.json",
  "specialized-signals.v1.json",
  "specialized-source-run-telemetry.v1.json",
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
  sourceTargetPlanPath: string;
  jobCollectionPath: string;
  hiringSignalsPath: string;
  sourceAdapterTelemetryPath: string;
  communitySourcePlanPath: string;
  threadManifestPath: string;
  communityThreadContextPath: string;
  commentCollectionManifestPath: string;
  communityCommentContextPath: string;
  communitySignalsPath: string;
  communitySourceTelemetryPath: string;
  communityThreadsDirectory: string;
  communityCommentsDirectory: string;
  developerSourcePlanPath: string;
  developerRepositoryCollectionPath: string;
  developerThreadManifestPath: string;
  developerThreadMetadataPath: string;
  developerCommentCollectionManifestPath: string;
  developerCommentMetadataPath: string;
  developerSignalsPath: string;
  developerSourceTelemetryPath: string;
  developerThreadsDirectory: string;
  developerCommentsDirectory: string;
  videoSourcePlanPath: string;
  videoCollectionPath: string;
  transcriptManifestPath: string;
  videoCommentManifestPath: string;
  videoSignalsPath: string;
  videoSourceTelemetryPath: string;
  videoTranscriptsDirectory: string;
  videoCommentsDirectory: string;
  specializedSourceContextPath: string;
  specializedSourceCandidatesPath: string;
  specializedSourcePlanPath: string;
  specializedFindingsPath: string;
  specializedSignalsPath: string;
  specializedSourceTelemetryPath: string;
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
    sourceTargetPlanPath: resolve(directory, "source-target-plan.v1.json"),
    jobCollectionPath: resolve(directory, "job-collection.v1.json"),
    hiringSignalsPath: resolve(directory, "hiring-signals.v1.json"),
    sourceAdapterTelemetryPath: resolve(directory, "source-adapter-run-telemetry.v1.json"),
    communitySourcePlanPath: resolve(directory, "community-source-plan.v1.json"),
    threadManifestPath: resolve(directory, "thread-manifest.v1.json"),
    communityThreadContextPath: resolve(directory, "community-thread-context.v1.json"),
    commentCollectionManifestPath: resolve(directory, "comment-collection-manifest.v1.json"),
    communityCommentContextPath: resolve(directory, "community-comment-context.v1.json"),
    communitySignalsPath: resolve(directory, "community-signals.v1.json"),
    communitySourceTelemetryPath: resolve(directory, "community-source-run-telemetry.v1.json"),
    communityThreadsDirectory: resolve(directory, "community", "threads"),
    communityCommentsDirectory: resolve(directory, "community", "comments"),
    developerSourcePlanPath: resolve(directory, "developer-source-plan.v1.json"),
    developerRepositoryCollectionPath: resolve(
      directory,
      "developer-repository-collection.v1.json",
    ),
    developerThreadManifestPath: resolve(directory, "developer-thread-manifest.v1.json"),
    developerThreadMetadataPath: resolve(directory, "developer-thread-metadata.v1.json"),
    developerCommentCollectionManifestPath: resolve(
      directory,
      "developer-comment-collection-manifest.v1.json",
    ),
    developerCommentMetadataPath: resolve(directory, "developer-comment-metadata.v1.json"),
    developerSignalsPath: resolve(directory, "developer-signals.v1.json"),
    developerSourceTelemetryPath: resolve(directory, "developer-source-run-telemetry.v1.json"),
    developerThreadsDirectory: resolve(directory, "developer", "threads"),
    developerCommentsDirectory: resolve(directory, "developer", "comments"),
    videoSourcePlanPath: resolve(directory, "video-source-plan.v1.json"),
    videoCollectionPath: resolve(directory, "video-collection.v1.json"),
    transcriptManifestPath: resolve(directory, "transcript-manifest.v1.json"),
    videoCommentManifestPath: resolve(directory, "video-comment-manifest.v1.json"),
    videoSignalsPath: resolve(directory, "video-signals.v1.json"),
    videoSourceTelemetryPath: resolve(directory, "video-source-run-telemetry.v1.json"),
    videoTranscriptsDirectory: resolve(directory, "video", "transcripts"),
    videoCommentsDirectory: resolve(directory, "video", "comments"),
    specializedSourceContextPath: resolve(directory, "specialized-source-context.v1.json"),
    specializedSourceCandidatesPath: resolve(directory, "specialized-source-candidates.v1.json"),
    specializedSourcePlanPath: resolve(directory, "specialized-source-plan.v1.json"),
    specializedFindingsPath: resolve(directory, "specialized-findings.v1.json"),
    specializedSignalsPath: resolve(directory, "specialized-signals.v1.json"),
    specializedSourceTelemetryPath: resolve(directory, "specialized-source-run-telemetry.v1.json"),
    stdoutPath: resolve(directory, "discovery-stdout.log"),
    stderrPath: resolve(directory, "discovery-stderr.log"),
    executionPath: resolve(directory, "discovery-execution.json"),
  };
}
