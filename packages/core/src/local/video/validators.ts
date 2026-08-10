import {
  TranscriptArtifactV1Schema,
  TranscriptManifestArtifactV1Schema,
  VideoCollectionArtifactV1Schema,
  VideoCommentCollectionArtifactV1Schema,
  VideoCommentManifestArtifactV1Schema,
  VideoSignalsArtifactV1Schema,
  VideoSourcePlanArtifactV1Schema,
  VideoSourceRunTelemetryArtifactV1Schema,
  type TranscriptArtifactV1,
  type TranscriptManifestArtifactV1,
  type VideoCollectionArtifactV1,
  type VideoCommentCollectionArtifactV1,
  type VideoCommentManifestArtifactV1,
  type VideoSignalsArtifactV1,
  type VideoSourcePlanArtifactV1,
  type VideoSourceRunTelemetryArtifactV1,
} from "./video-artifacts";
import {
  deterministicTranscriptManifestId,
  deterministicVideoCollectionId,
  deterministicVideoCommentManifestId,
  deterministicVideoSignalsId,
  deterministicVideoSourcePlanId,
  deterministicVideoTelemetryId,
  videoArtifactDigest,
} from "./identity";

const FORBIDDEN_FIELD =
  /authorization|token|password|cookie|proxy|mediafile|audiofile|videofile|downloadedbinary|environment|emailaddress/iu;

export class VideoArtifactValidationError extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "VideoArtifactValidationError";
  }
}

function fail(code: string, message: string): never {
  throw new VideoArtifactValidationError(code, message);
}

function scanForbidden(value: unknown, path = "artifact"): void {
  if (Array.isArray(value)) {
    value.forEach((entry, index) => scanForbidden(entry, `${path}[${String(index)}]`));
    return;
  }
  if (value === null || typeof value !== "object") return;
  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    if (FORBIDDEN_FIELD.test(key)) {
      fail("VIDEO_FORBIDDEN_FIELD", `Forbidden imported field at ${path}.${key}.`);
    }
    scanForbidden(child, `${path}.${key}`);
  }
}

function withoutArtifactId<T extends { artifactId: string }>(value: T): Omit<T, "artifactId"> {
  return Object.fromEntries(Object.entries(value).filter(([key]) => key !== "artifactId")) as Omit<
    T,
    "artifactId"
  >;
}

function parseArtifact<T>(schema: { parse(value: unknown): T }, value: unknown, code: string): T {
  try {
    return schema.parse(value);
  } catch (error) {
    if (error instanceof VideoArtifactValidationError) throw error;
    fail(code, error instanceof Error ? error.message : "Video artifact validation failed.");
  }
}

function youtubeUrl(value: string): boolean {
  try {
    const url = new URL(value);
    const host = url.hostname.replace(/^www\./u, "").toLowerCase();
    return (
      url.protocol === "https:" &&
      ["youtube.com", "m.youtube.com", "music.youtube.com", "youtu.be"].includes(host)
    );
  } catch {
    return false;
  }
}

function assertRequestId(requestId: string, artifacts: Array<{ requestId: string }>): void {
  if (artifacts.some((artifact) => artifact.requestId !== requestId)) {
    fail("VIDEO_REQUEST_MISMATCH", "All imported video artifacts must belong to one request.");
  }
}

export interface ValidatedVideoPlanSet {
  plan: VideoSourcePlanArtifactV1;
}
export interface ValidatedVideoCollectionSet extends ValidatedVideoPlanSet {
  collection: VideoCollectionArtifactV1;
}
export interface ValidatedVideoTranscriptSet extends ValidatedVideoCollectionSet {
  transcriptManifest: TranscriptManifestArtifactV1;
  transcripts: TranscriptArtifactV1[];
}
export interface ValidatedVideoCommentSet extends ValidatedVideoTranscriptSet {
  commentManifest: VideoCommentManifestArtifactV1;
  commentCollections: VideoCommentCollectionArtifactV1[];
}
export interface ValidatedVideoAnalysisSet extends ValidatedVideoCommentSet {
  signals: VideoSignalsArtifactV1;
}
export interface ValidatedVideoArtifactSet extends ValidatedVideoAnalysisSet {
  telemetry: VideoSourceRunTelemetryArtifactV1;
}

export function validateVideoPlanArtifact(
  input: unknown,
  expectedRequestId?: string,
): ValidatedVideoPlanSet {
  scanForbidden(input);
  const plan = parseArtifact(VideoSourcePlanArtifactV1Schema, input, "VIDEO_SOURCE_PLAN_INVALID");
  if (expectedRequestId !== undefined && plan.requestId !== expectedRequestId) {
    fail("VIDEO_REQUEST_MISMATCH", "Video source plan request ID did not match the run request.");
  }
  if (plan.artifactId !== deterministicVideoSourcePlanId(withoutArtifactId(plan))) {
    fail("VIDEO_SOURCE_PLAN_INVALID", "Deterministic video source plan ID mismatch.");
  }
  return { plan };
}

export function validateVideoCollectionSet(input: {
  planSet: ValidatedVideoPlanSet;
  collection: unknown;
}): ValidatedVideoCollectionSet {
  scanForbidden(input.collection);
  const collection = parseArtifact(
    VideoCollectionArtifactV1Schema,
    input.collection,
    "VIDEO_COLLECTION_INVALID",
  );
  assertRequestId(input.planSet.plan.requestId, [collection]);
  if (collection.artifactId !== deterministicVideoCollectionId(withoutArtifactId(collection))) {
    fail("VIDEO_COLLECTION_INVALID", "Deterministic video collection ID mismatch.");
  }
  if (collection.videoSourcePlanArtifactId !== input.planSet.plan.artifactId) {
    fail("VIDEO_LINEAGE_INVALID", "Video collection references the wrong source plan.");
  }
  for (const video of collection.videos) {
    if (!youtubeUrl(video.url))
      fail("VIDEO_URL_INVALID", "Video URL must be public YouTube HTTPS.");
    if (video.channel?.url !== undefined && !youtubeUrl(video.channel.url)) {
      fail("VIDEO_URL_INVALID", "Video channel URL must be public YouTube HTTPS.");
    }
    if (
      (video.availability !== "public" || video.ageRestricted) &&
      (video.selectedForTranscript ||
        video.selectedForComments ||
        video.transcriptArtifactId !== undefined)
    ) {
      fail(
        "VIDEO_RESTRICTED_CONTENT_REJECTED",
        "Restricted or non-public video records may cross only as metadata-only candidates and cannot be selected for transcript/comment drill.",
      );
    }
  }
  return { ...input.planSet, collection };
}

export function validateVideoTranscriptSet(input: {
  collectionSet: ValidatedVideoCollectionSet;
  transcriptManifest: unknown;
  transcripts: unknown[];
}): ValidatedVideoTranscriptSet {
  scanForbidden({ transcriptManifest: input.transcriptManifest, transcripts: input.transcripts });
  const transcriptManifest = parseArtifact(
    TranscriptManifestArtifactV1Schema,
    input.transcriptManifest,
    "VIDEO_TRANSCRIPT_MANIFEST_INVALID",
  );
  const transcripts = input.transcripts.map((entry) =>
    parseArtifact(TranscriptArtifactV1Schema, entry, "VIDEO_TRANSCRIPT_INVALID"),
  );
  assertRequestId(input.collectionSet.plan.requestId, [transcriptManifest, ...transcripts]);
  if (
    transcriptManifest.artifactId !==
    deterministicTranscriptManifestId(withoutArtifactId(transcriptManifest))
  ) {
    fail("VIDEO_TRANSCRIPT_MANIFEST_INVALID", "Deterministic transcript manifest ID mismatch.");
  }
  if (transcriptManifest.videoCollectionArtifactId !== input.collectionSet.collection.artifactId) {
    fail("VIDEO_LINEAGE_INVALID", "Transcript manifest references the wrong video collection.");
  }
  const videosById = new Map(
    input.collectionSet.collection.videos.map((video) => [video.videoId, video] as const),
  );
  const transcriptsById = new Map(
    transcripts.map((transcript) => [transcript.artifactId, transcript]),
  );
  if (
    transcriptsById.size !== transcripts.length ||
    transcriptManifest.entries.length !== transcripts.length
  ) {
    fail(
      "VIDEO_TRANSCRIPT_MANIFEST_INVALID",
      "Transcript manifest and loaded transcript set differ.",
    );
  }
  for (const entry of transcriptManifest.entries) {
    const video = videosById.get(entry.videoId);
    if (video === undefined) fail("VIDEO_TRANSCRIPT_ORPHAN", "Unknown transcript video ID.");
    if (video.availability !== "public" || video.ageRestricted || !video.selectedForTranscript) {
      fail(
        "VIDEO_RESTRICTED_CONTENT_REJECTED",
        "Transcript manifest cannot reference a restricted, non-public, or non-selected video.",
      );
    }
    const transcript = transcriptsById.get(entry.transcriptArtifactId);
    if (transcript === undefined || transcript.sourceNativeId !== entry.videoId) {
      fail("VIDEO_TRANSCRIPT_ORPHAN", "Transcript manifest references a missing transcript.");
    }
    if (!youtubeUrl(transcript.mediaUrl)) {
      fail("VIDEO_URL_INVALID", "Transcript media URL must be public YouTube HTTPS.");
    }
    if (videoArtifactDigest(transcript) !== entry.contentDigest) {
      fail("VIDEO_TRANSCRIPT_DIGEST_INVALID", "Transcript manifest digest mismatch.");
    }
    if (
      transcript.segments.length !== entry.segmentCount ||
      transcript.segments.reduce((sum, segment) => sum + segment.text.length, 0) !==
        entry.characterCount
    ) {
      fail("VIDEO_TRANSCRIPT_INVALID", "Transcript manifest counts do not reconcile.");
    }
  }
  if (
    transcriptManifest.summary.transcripts !== transcriptManifest.entries.length ||
    transcriptManifest.summary.human !==
      transcriptManifest.entries.filter((entry) => entry.subtitleSource === "human").length ||
    transcriptManifest.summary.automatic !==
      transcriptManifest.entries.filter((entry) => entry.subtitleSource === "automatic").length
  ) {
    fail("VIDEO_TRANSCRIPT_TOTAL_INVALID", "Transcript manifest totals do not reconcile.");
  }
  return { ...input.collectionSet, transcriptManifest, transcripts };
}

export function validateVideoCommentSet(input: {
  transcriptSet: ValidatedVideoTranscriptSet;
  commentManifest: unknown;
  commentCollections: unknown[];
}): ValidatedVideoCommentSet {
  scanForbidden({
    commentManifest: input.commentManifest,
    commentCollections: input.commentCollections,
  });
  const commentManifest = parseArtifact(
    VideoCommentManifestArtifactV1Schema,
    input.commentManifest,
    "VIDEO_COMMENT_MANIFEST_INVALID",
  );
  const commentCollections = input.commentCollections.map((entry) =>
    parseArtifact(VideoCommentCollectionArtifactV1Schema, entry, "VIDEO_COMMENT_INVALID"),
  );
  assertRequestId(input.transcriptSet.plan.requestId, [commentManifest, ...commentCollections]);
  if (
    commentManifest.artifactId !==
    deterministicVideoCommentManifestId(withoutArtifactId(commentManifest))
  ) {
    fail("VIDEO_COMMENT_MANIFEST_INVALID", "Deterministic video comment manifest ID mismatch.");
  }
  if (commentManifest.videoCollectionArtifactId !== input.transcriptSet.collection.artifactId) {
    fail("VIDEO_LINEAGE_INVALID", "Video comment manifest references the wrong collection.");
  }
  const videosById = new Map(
    input.transcriptSet.collection.videos.map((video) => [video.videoId, video] as const),
  );
  const collectionsById = new Map(commentCollections.map((entry) => [entry.artifactId, entry]));
  if (
    collectionsById.size !== commentCollections.length ||
    commentManifest.entries.length !== commentCollections.length
  ) {
    fail("VIDEO_COMMENT_MANIFEST_INVALID", "Comment manifest and loaded collection set differ.");
  }
  let commentsCollected = 0;
  for (const entry of commentManifest.entries) {
    const collection = collectionsById.get(entry.commentCollectionArtifactId);
    const video = videosById.get(entry.videoId);
    if (collection === undefined || collection.videoId !== entry.videoId || video === undefined) {
      fail("VIDEO_COMMENT_ORPHAN", "Comment manifest references an unknown video/collection.");
    }
    if (video.availability !== "public" || video.ageRestricted || !video.selectedForComments) {
      fail(
        "VIDEO_RESTRICTED_CONTENT_REJECTED",
        "Video comments cannot reference a restricted, non-public, or non-selected video.",
      );
    }
    if (!youtubeUrl(collection.videoUrl)) {
      fail("VIDEO_URL_INVALID", "Comment collection video URL must be public YouTube HTTPS.");
    }
    if (videoArtifactDigest(collection) !== entry.contentDigest) {
      fail("VIDEO_COMMENT_DIGEST_INVALID", "Video comment manifest digest mismatch.");
    }
    if (entry.commentsCollected !== collection.comments.length) {
      fail("VIDEO_COMMENT_TOTAL_INVALID", "Comment entry count does not reconcile.");
    }
    commentsCollected += collection.comments.length;
  }
  if (
    commentManifest.summary.commentsCollected !== commentsCollected ||
    commentManifest.summary.videosWithComments !==
      commentCollections.filter((entry) => entry.comments.length > 0).length
  ) {
    fail("VIDEO_COMMENT_TOTAL_INVALID", "Video comment totals do not reconcile.");
  }
  return { ...input.transcriptSet, commentManifest, commentCollections };
}

export function validateVideoAnalysisSet(input: {
  commentSet: ValidatedVideoCommentSet;
  signals: unknown;
}): ValidatedVideoAnalysisSet {
  scanForbidden(input.signals);
  const signals = parseArtifact(
    VideoSignalsArtifactV1Schema,
    input.signals,
    "VIDEO_SIGNALS_INVALID",
  );
  assertRequestId(input.commentSet.plan.requestId, [signals]);
  if (signals.artifactId !== deterministicVideoSignalsId(withoutArtifactId(signals))) {
    fail("VIDEO_SIGNALS_INVALID", "Deterministic video signals ID mismatch.");
  }
  if (
    signals.videoCollectionArtifactId !== input.commentSet.collection.artifactId ||
    (signals.transcriptManifestArtifactId !== undefined &&
      signals.transcriptManifestArtifactId !== input.commentSet.transcriptManifest.artifactId) ||
    (signals.videoCommentManifestArtifactId !== undefined &&
      signals.videoCommentManifestArtifactId !== input.commentSet.commentManifest.artifactId)
  ) {
    fail("VIDEO_LINEAGE_INVALID", "Video signals reference the wrong companion artifacts.");
  }
  if (signals.summary.signalsGenerated !== signals.signals.length) {
    fail("VIDEO_SIGNAL_TOTAL_INVALID", "Video signal totals do not reconcile.");
  }
  const videosById = new Map(
    input.commentSet.collection.videos.map((video) => [video.videoId, video] as const),
  );
  const segmentIds = new Set(
    input.commentSet.transcripts.flatMap((transcript) =>
      transcript.segments.map((segment) => segment.segmentId),
    ),
  );
  const commentIds = new Set(
    input.commentSet.commentCollections.flatMap((collection) =>
      collection.comments.map((comment) => comment.commentId),
    ),
  );
  for (const signal of signals.signals) {
    if (signal.supportingVideoIds.some((id) => !videosById.has(id))) {
      fail("VIDEO_SIGNAL_REFERENCE_INVALID", "Video signal references an unknown video.");
    }
    if (
      signal.supportingVideoIds.some((id) => {
        const video = videosById.get(id);
        return video !== undefined && (video.availability !== "public" || video.ageRestricted);
      })
    ) {
      fail(
        "VIDEO_RESTRICTED_CONTENT_REJECTED",
        "Video signals cannot use restricted or non-public video records as supporting evidence.",
      );
    }
    if (signal.supportingTranscriptSegmentIds.some((id) => !segmentIds.has(id))) {
      fail(
        "VIDEO_SIGNAL_REFERENCE_INVALID",
        "Video signal references an unknown transcript segment.",
      );
    }
    if (signal.supportingCommentIds.some((id) => !commentIds.has(id))) {
      fail("VIDEO_SIGNAL_REFERENCE_INVALID", "Video signal references an unknown comment.");
    }
    if (signal.independentVideoCount > new Set(signal.supportingVideoIds).size) {
      fail("VIDEO_SIGNALS_INVALID", "Independent video count exceeds supporting videos.");
    }
  }
  return { ...input.commentSet, signals };
}

export function validateVideoArtifactSet(input: {
  requestId: string;
  plan: unknown;
  collection: unknown;
  transcriptManifest: unknown;
  transcripts: unknown[];
  commentManifest: unknown;
  commentCollections: unknown[];
  signals: unknown;
  telemetry: unknown;
}): ValidatedVideoArtifactSet {
  const planSet = validateVideoPlanArtifact(input.plan, input.requestId);
  const collectionSet = validateVideoCollectionSet({ planSet, collection: input.collection });
  const transcriptSet = validateVideoTranscriptSet({
    collectionSet,
    transcriptManifest: input.transcriptManifest,
    transcripts: input.transcripts,
  });
  const commentSet = validateVideoCommentSet({
    transcriptSet,
    commentManifest: input.commentManifest,
    commentCollections: input.commentCollections,
  });
  const analysisSet = validateVideoAnalysisSet({ commentSet, signals: input.signals });
  scanForbidden(input.telemetry);
  const telemetry = parseArtifact(
    VideoSourceRunTelemetryArtifactV1Schema,
    input.telemetry,
    "VIDEO_SOURCE_TELEMETRY_INVALID",
  );
  assertRequestId(analysisSet.plan.requestId, [telemetry]);
  if (telemetry.artifactId !== deterministicVideoTelemetryId(withoutArtifactId(telemetry))) {
    fail("VIDEO_SOURCE_TELEMETRY_INVALID", "Deterministic video telemetry ID mismatch.");
  }
  const comments = analysisSet.commentCollections.reduce(
    (sum, collection) => sum + collection.comments.length,
    0,
  );
  if (
    telemetry.signals !== analysisSet.signals.signals.length ||
    telemetry.commentsAccepted !== comments
  ) {
    fail("VIDEO_SOURCE_TELEMETRY_INVALID", "Video telemetry totals do not reconcile.");
  }
  return { ...analysisSet, telemetry };
}
