import {
  canonicalDigest,
  deterministicArtifactId,
  sha256Hex,
} from "../extraction/artifact-identity";
import type { CommentCollectionArtifactV1, ThreadArtifactV1 } from "./universal-community";
import type {
  CommentCollectionManifestArtifactV1,
  CommunityCommentContextArtifactV1,
  CommunitySignalsArtifactV1,
  CommunitySourcePlanArtifactV1,
  CommunitySourceRunTelemetryArtifactV1,
  CommunityThreadContextArtifactV1,
  ThreadManifestArtifactV1,
} from "./community-artifacts";

export class CommunityArtifactValidationError extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "CommunityArtifactValidationError";
  }
}

function deterministicId<T extends { requestId: string; artifactKind: string }>(
  artifact: Omit<T, "artifactId">,
): string {
  return deterministicArtifactId(artifact.requestId, artifact.artifactKind, artifact);
}

export const communityArtifactDigest = canonicalDigest;

export function deterministicCommunitySourcePlanId(
  artifact: Omit<CommunitySourcePlanArtifactV1, "artifactId">,
): string {
  return deterministicId(artifact);
}
export function deterministicThreadManifestId(
  artifact: Omit<ThreadManifestArtifactV1, "artifactId">,
): string {
  return deterministicId(artifact);
}
export function deterministicCommunityThreadContextId(
  artifact: Omit<CommunityThreadContextArtifactV1, "artifactId">,
): string {
  return deterministicId(artifact);
}
export function deterministicCommentCollectionManifestId(
  artifact: Omit<CommentCollectionManifestArtifactV1, "artifactId">,
): string {
  return deterministicId(artifact);
}
export function deterministicCommunityCommentContextId(
  artifact: Omit<CommunityCommentContextArtifactV1, "artifactId">,
): string {
  return deterministicId(artifact);
}
export function deterministicCommunitySignalsId(
  artifact: Omit<CommunitySignalsArtifactV1, "artifactId">,
): string {
  return deterministicId(artifact);
}
export function deterministicCommunityTelemetryId(
  artifact: Omit<CommunitySourceRunTelemetryArtifactV1, "artifactId">,
): string {
  return deterministicId(artifact);
}

export function deterministicCommunityQueryId(input: {
  requestId: string;
  intent: string;
  query: string;
}): string {
  return `community_query_${sha256Hex([input.requestId, input.intent, input.query.trim().toLowerCase()].join("\n"))}`;
}

export function deterministicSubredditTargetId(input: {
  requestId: string;
  subreddit: string;
}): string {
  return `subreddit_target_${sha256Hex([input.requestId, input.subreddit.trim().toLowerCase()].join("\n"))}`;
}

export function deterministicRedditThreadId(input: {
  requestId: string;
  postId?: string;
  canonicalUrl: string;
}): string {
  return `thread_${sha256Hex([input.requestId, "reddit", input.postId?.toLowerCase() ?? input.canonicalUrl].join("\n"))}`;
}

export function deterministicRedditCommentId(input: {
  threadArtifactId: string;
  sourceNativeId?: string;
  parentCommentId?: string;
  author?: string;
  body: string;
  createdAt?: string;
}): string {
  if (input.sourceNativeId !== undefined && input.sourceNativeId.length > 0)
    return `comment_${sha256Hex([input.threadArtifactId, input.sourceNativeId].join("\n"))}`;
  return `comment_${sha256Hex(
    [
      input.threadArtifactId,
      input.parentCommentId ?? "",
      input.author?.trim().toLowerCase() ?? "",
      input.body.trim().normalize("NFKC"),
      input.createdAt ?? "",
    ].join("\n"),
  )}`;
}

export function deterministicCommunitySignalId(input: {
  requestId: string;
  type: string;
  ruleId: string;
  supportingThreadArtifactIds: string[];
  supportingCommentIds: string[];
}): string {
  return `community_signal_${sha256Hex(
    [
      input.requestId,
      input.type,
      input.ruleId,
      [...new Set(input.supportingThreadArtifactIds)].sort().join(","),
      [...new Set(input.supportingCommentIds)].sort().join(","),
    ].join("\n"),
  )}`;
}

export function threadArtifactDigest(artifact: ThreadArtifactV1): string {
  return canonicalDigest(artifact);
}
export function commentCollectionArtifactDigest(artifact: CommentCollectionArtifactV1): string {
  return canonicalDigest(artifact);
}
