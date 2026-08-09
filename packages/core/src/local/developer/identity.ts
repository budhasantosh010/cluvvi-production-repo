import {
  canonicalDigest,
  deterministicArtifactId,
  sha256Hex,
} from "../extraction/artifact-identity";
import type {
  CommentCollectionArtifactV1,
  ThreadArtifactV1,
} from "../community/universal-community";
import type {
  DeveloperCommentCollectionManifestArtifactV1,
  DeveloperCommentMetadataArtifactV1,
  DeveloperRepositoryCollectionArtifactV1,
  DeveloperSignalsArtifactV1,
  DeveloperSourcePlanArtifactV1,
  DeveloperSourceRunTelemetryArtifactV1,
  DeveloperThreadManifestArtifactV1,
  DeveloperThreadMetadataArtifactV1,
} from "./developer-artifacts";

function deterministicId<T extends { requestId: string; artifactKind: string }>(
  artifact: Omit<T, "artifactId">,
): string {
  return deterministicArtifactId(artifact.requestId, artifact.artifactKind, artifact);
}

export const developerArtifactDigest = canonicalDigest;

export const deterministicDeveloperSourcePlanId = (
  artifact: Omit<DeveloperSourcePlanArtifactV1, "artifactId">,
): string => deterministicId(artifact);
export const deterministicDeveloperRepositoryCollectionId = (
  artifact: Omit<DeveloperRepositoryCollectionArtifactV1, "artifactId">,
): string => deterministicId(artifact);
export const deterministicDeveloperThreadManifestId = (
  artifact: Omit<DeveloperThreadManifestArtifactV1, "artifactId">,
): string => deterministicId(artifact);
export const deterministicDeveloperThreadMetadataId = (
  artifact: Omit<DeveloperThreadMetadataArtifactV1, "artifactId">,
): string => deterministicId(artifact);
export const deterministicDeveloperCommentManifestId = (
  artifact: Omit<DeveloperCommentCollectionManifestArtifactV1, "artifactId">,
): string => deterministicId(artifact);
export const deterministicDeveloperCommentMetadataId = (
  artifact: Omit<DeveloperCommentMetadataArtifactV1, "artifactId">,
): string => deterministicId(artifact);
export const deterministicDeveloperSignalsId = (
  artifact: Omit<DeveloperSignalsArtifactV1, "artifactId">,
): string => deterministicId(artifact);
export const deterministicDeveloperTelemetryId = (
  artifact: Omit<DeveloperSourceRunTelemetryArtifactV1, "artifactId">,
): string => deterministicId(artifact);

export function deterministicDeveloperQueryId(input: {
  requestId: string;
  intent: string;
  query: string;
}): string {
  return `developer_query_${sha256Hex([input.requestId, input.intent, input.query.trim().toLowerCase()].join("\n"))}`;
}

export function deterministicDeveloperRepositoryTargetId(input: {
  requestId: string;
  fullName: string;
}): string {
  return `developer_repo_target_${sha256Hex([input.requestId, input.fullName.trim().toLowerCase()].join("\n"))}`;
}

export function deterministicDeveloperRepositoryId(fullName: string): string {
  return `developer_repo_${sha256Hex(`github:${fullName.trim().toLowerCase()}`)}`;
}

export function deterministicDeveloperThreadId(input: {
  requestId: string;
  repositoryFullName: string;
  kind: string;
  nativeNumber: number;
}): string {
  return `thread_${sha256Hex([input.requestId, "github", input.repositoryFullName.trim().toLowerCase(), input.kind, String(input.nativeNumber)].join("\n"))}`;
}

export function deterministicDeveloperCommentId(input: {
  threadArtifactId: string;
  commentKind: string;
  sourceNativeId?: string | undefined;
  canonicalUrl?: string | undefined;
  body: string;
}): string {
  return `comment_${sha256Hex(
    [
      input.threadArtifactId,
      input.commentKind,
      input.sourceNativeId ?? "",
      input.canonicalUrl ?? "",
      sha256Hex(input.body.trim().normalize("NFKC")),
    ].join("\n"),
  )}`;
}

export function deterministicDeveloperReleaseId(input: {
  repositoryId: string;
  sourceNativeId?: string | number;
  tagName: string;
}): string {
  return `developer_release_${sha256Hex([input.repositoryId, String(input.sourceNativeId ?? ""), input.tagName.trim().toLowerCase()].join("\n"))}`;
}

export function deterministicDeveloperSignalId(input: {
  requestId: string;
  type: string;
  ruleId: string;
  repositoryIds: string[];
  supportingThreadArtifactIds: string[];
  supportingCommentIds: string[];
}): string {
  return `developer_signal_${sha256Hex(
    [
      input.requestId,
      input.type,
      input.ruleId,
      [...new Set(input.repositoryIds)].sort().join(","),
      [...new Set(input.supportingThreadArtifactIds)].sort().join(","),
      [...new Set(input.supportingCommentIds)].sort().join(","),
    ].join("\n"),
  )}`;
}

export const developerThreadArtifactDigest = (artifact: ThreadArtifactV1): string =>
  canonicalDigest(artifact);
export const developerCommentCollectionArtifactDigest = (
  artifact: CommentCollectionArtifactV1,
): string => canonicalDigest(artifact);
