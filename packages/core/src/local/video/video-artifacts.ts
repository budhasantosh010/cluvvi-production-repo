import { z } from "zod";
import { EngagementSignalsV1Schema, PublicHttpUrlSchema } from "../community/universal-community";

const ConfidenceSchema = z.number().min(0).max(1);
const Sha256Schema = z.string().regex(/^[a-f0-9]{64}$/u);
const LimitationsSchema = z.array(z.string().trim().min(1).max(1_000)).max(250);
const RelativeArtifactPathSchema = z
  .string()
  .min(1)
  .max(1_000)
  .refine(
    (value) => !/^(?:[A-Za-z]:[\\/]|[\\/]{1,2})/u.test(value),
    "Artifact path must be run-relative.",
  )
  .refine(
    (value) => !value.split(/[\\/]/u).includes(".."),
    "Artifact path may not traverse upward.",
  );

export const VideoDepthSchema = z.enum(["quick", "default", "deep"]);
export type VideoDepth = z.infer<typeof VideoDepthSchema>;

export const VideoQueryIntentV1Schema = z.enum([
  "general",
  "review",
  "comparison",
  "complaint",
  "switching",
  "alternative",
  "implementation",
  "tutorial",
  "migration",
  "pricing",
  "case_study",
  "expert_interview",
]);
export type VideoQueryIntentV1 = z.infer<typeof VideoQueryIntentV1Schema>;

export const VideoQueryV1Schema = z.strictObject({
  queryId: z.string().min(1).max(200),
  query: z.string().trim().min(1).max(1_000),
  intent: VideoQueryIntentV1Schema,
  concepts: z.array(z.string().trim().min(1).max(300)).max(100),
  primaryEntity: z.string().trim().min(1).max(500).optional(),
  importance: ConfidenceSchema,
  selected: z.boolean(),
  selectionReasons: z.array(z.string().trim().min(1).max(1_000)).max(50),
  limitations: LimitationsSchema,
});
export type VideoQueryV1 = z.infer<typeof VideoQueryV1Schema>;

export const VideoSourcePlanArtifactV1Schema = z
  .strictObject({
    schemaVersion: z.literal("1.0"),
    artifactKind: z.literal("video_source_plan.v1"),
    artifactId: z.string().min(1).max(200),
    requestId: z.string().min(1).max(200),
    sourceFamily: z.literal("video"),
    platform: z.literal("youtube"),
    temporalWindow: z.strictObject({
      from: z.iso.datetime().optional(),
      to: z.iso.datetime().optional(),
    }),
    queries: z.array(VideoQueryV1Schema).max(8),
    policy: z.strictObject({
      depth: VideoDepthSchema,
      maximumQueries: z.number().int().min(1).max(8),
      maximumSearchResults: z.number().int().min(1).max(100),
      maximumMetadataDetails: z.number().int().min(1).max(50),
      maximumTranscriptDrill: z.number().int().min(0).max(20),
      maximumCommentVideos: z.number().int().min(0).max(20),
      maximumCommentsPerVideo: z.number().int().min(0).max(100),
    }),
    summary: z.strictObject({
      queryCandidates: z.number().int().nonnegative(),
      queriesSelected: z.number().int().nonnegative(),
    }),
    warnings: LimitationsSchema,
  })
  .superRefine((artifact, context) => {
    if (
      artifact.temporalWindow.from !== undefined &&
      artifact.temporalWindow.to !== undefined &&
      Date.parse(artifact.temporalWindow.from) > Date.parse(artifact.temporalWindow.to)
    ) {
      context.addIssue({
        code: "custom",
        path: ["temporalWindow", "to"],
        message: "Video temporal end cannot precede start.",
      });
    }
    const ids = new Set<string>();
    for (const [index, query] of artifact.queries.entries()) {
      if (ids.has(query.queryId)) {
        context.addIssue({
          code: "custom",
          path: ["queries", index, "queryId"],
          message: "Video query IDs must be unique.",
        });
      }
      ids.add(query.queryId);
    }
    const selected = artifact.queries.filter((query) => query.selected).length;
    if (
      artifact.summary.queryCandidates !== artifact.queries.length ||
      artifact.summary.queriesSelected !== selected
    ) {
      context.addIssue({
        code: "custom",
        path: ["summary"],
        message: "Video query summary must reconcile.",
      });
    }
    if (selected > artifact.policy.maximumQueries) {
      context.addIssue({
        code: "custom",
        path: ["policy", "maximumQueries"],
        message: "Selected video queries exceed policy.",
      });
    }
  });
export type VideoSourcePlanArtifactV1 = z.infer<typeof VideoSourcePlanArtifactV1Schema>;

export const SubtitleAvailabilityV1Schema = z.strictObject({
  language: z.string().trim().min(1).max(100),
  source: z.enum(["human", "automatic"]),
  formats: z.array(z.string().trim().min(1).max(50)).max(30),
});
export type SubtitleAvailabilityV1 = z.infer<typeof SubtitleAvailabilityV1Schema>;

export const VideoProvenanceV1Schema = z.strictObject({
  adapterId: z.string().min(1).max(100),
  method: z.enum(["youtube_search", "youtube_metadata"]),
  observedAt: z.iso.datetime(),
  queryId: z.string().min(1).max(200).optional(),
});
export type VideoProvenanceV1 = z.infer<typeof VideoProvenanceV1Schema>;

export const NormalizedVideoV1Schema = z.strictObject({
  videoId: z.string().regex(/^[A-Za-z0-9_-]{6,32}$/u),
  sourceNativeId: z.string().min(1).max(100),
  url: PublicHttpUrlSchema,
  title: z.string().trim().min(1).max(10_000),
  description: z.string().max(25_000).optional(),
  channel: z
    .strictObject({
      channelId: z.string().min(1).max(200).optional(),
      name: z.string().min(1).max(1_000).optional(),
      url: PublicHttpUrlSchema.optional(),
    })
    .optional(),
  uploadDate: z.iso.datetime().optional(),
  durationSeconds: z.number().nonnegative().optional(),
  engagement: EngagementSignalsV1Schema.optional(),
  tags: z.array(z.string().trim().min(1).max(500)).max(500),
  categories: z.array(z.string().trim().min(1).max(500)).max(100),
  liveStatus: z.enum(["not_live", "is_live", "was_live", "is_upcoming", "unknown"]),
  availability: z.enum([
    "public",
    "unavailable",
    "private",
    "premium",
    "subscriber_only",
    "unknown",
  ]),
  ageRestricted: z.boolean(),
  subtitles: z.array(SubtitleAvailabilityV1Schema).max(500),
  transcriptArtifactId: z.string().min(1).max(200).optional(),
  relevance: ConfidenceSchema,
  temporalConfidence: ConfidenceSchema,
  localScore: ConfidenceSchema,
  selectedForTranscript: z.boolean(),
  selectedForComments: z.boolean(),
  trustClassification: z.literal("untrusted_public_content"),
  provenance: z.array(VideoProvenanceV1Schema).min(1).max(100),
  limitations: LimitationsSchema,
});
export type NormalizedVideoV1 = z.infer<typeof NormalizedVideoV1Schema>;

export const VideoCollectionArtifactV1Schema = z
  .strictObject({
    schemaVersion: z.literal("1.0"),
    artifactKind: z.literal("video_collection.v1"),
    artifactId: z.string().min(1).max(200),
    requestId: z.string().min(1).max(200),
    videoSourcePlanArtifactId: z.string().min(1).max(200),
    videos: z.array(NormalizedVideoV1Schema).max(500),
    summary: z.strictObject({
      searchCandidates: z.number().int().nonnegative(),
      videosAccepted: z.number().int().nonnegative(),
      duplicatesRemoved: z.number().int().nonnegative(),
      metadataDetailsFetched: z.number().int().nonnegative(),
      videosWithHumanSubtitles: z.number().int().nonnegative(),
      videosWithAutomaticCaptions: z.number().int().nonnegative(),
      videosWithKnownViews: z.number().int().nonnegative(),
      videosWithKnownLikes: z.number().int().nonnegative(),
    }),
    warnings: LimitationsSchema,
    limitations: LimitationsSchema,
  })
  .superRefine((artifact, context) => {
    const ids = new Set<string>();
    for (const [index, video] of artifact.videos.entries()) {
      if (ids.has(video.videoId)) {
        context.addIssue({
          code: "custom",
          path: ["videos", index, "videoId"],
          message: "Video IDs must be unique.",
        });
      }
      ids.add(video.videoId);
    }
    if (artifact.summary.videosAccepted !== artifact.videos.length) {
      context.addIssue({
        code: "custom",
        path: ["summary", "videosAccepted"],
        message: "videosAccepted must equal videos.length.",
      });
    }
  });
export type VideoCollectionArtifactV1 = z.infer<typeof VideoCollectionArtifactV1Schema>;

export const TranscriptSegmentV1Schema = z
  .strictObject({
    segmentId: z.string().min(1).max(500),
    sequence: z.number().int().nonnegative(),
    startSeconds: z.number().nonnegative().optional(),
    endSeconds: z.number().nonnegative().optional(),
    speaker: z.string().min(1).max(500).optional(),
    text: z.string().min(1).max(200_000),
    contentHash: Sha256Schema,
  })
  .superRefine((segment, context) => {
    if (
      segment.startSeconds !== undefined &&
      segment.endSeconds !== undefined &&
      segment.endSeconds < segment.startSeconds
    ) {
      context.addIssue({
        code: "custom",
        path: ["endSeconds"],
        message: "endSeconds cannot precede startSeconds.",
      });
    }
  });

export const TranscriptArtifactV1Schema = z
  .strictObject({
    schemaVersion: z.literal("1.0"),
    artifactKind: z.literal("transcript.v1"),
    artifactId: z.string().min(1).max(200),
    requestId: z.string().min(1).max(200),
    sourceAdapterId: z.string().min(1).max(100),
    sourceNativeId: z.string().min(1).max(500).optional(),
    mediaUrl: PublicHttpUrlSchema,
    title: z.string().min(1).max(10_000).optional(),
    language: z.string().min(1).max(100).optional(),
    autoGenerated: z.boolean().optional(),
    durationSeconds: z.number().nonnegative().optional(),
    segments: z.array(TranscriptSegmentV1Schema).max(100_000),
    trustClassification: z.literal("untrusted_public_content"),
    limitations: z.array(z.string().min(1).max(1_000)).max(100),
  })
  .superRefine((artifact, context) => {
    const ids = new Set<string>();
    for (const [index, segment] of artifact.segments.entries()) {
      if (ids.has(segment.segmentId)) {
        context.addIssue({
          code: "custom",
          path: ["segments", index, "segmentId"],
          message: "Segment IDs must be unique.",
        });
      }
      ids.add(segment.segmentId);
      if (segment.sequence !== index) {
        context.addIssue({
          code: "custom",
          path: ["segments", index, "sequence"],
          message: "Transcript segment sequence must be contiguous and ordered.",
        });
      }
      if (
        artifact.durationSeconds !== undefined &&
        segment.endSeconds !== undefined &&
        segment.endSeconds > artifact.durationSeconds
      ) {
        context.addIssue({
          code: "custom",
          path: ["segments", index, "endSeconds"],
          message: "Segment time exceeds the declared duration.",
        });
      }
    }
  });
export type TranscriptArtifactV1 = z.infer<typeof TranscriptArtifactV1Schema>;

export const TranscriptManifestEntryV1Schema = z.strictObject({
  videoId: z.string().min(1).max(100),
  transcriptArtifactId: z.string().min(1).max(200),
  contentDigest: Sha256Schema,
  relativeArtifactPath: RelativeArtifactPathSchema,
  subtitleSource: z.enum(["human", "automatic"]),
  language: z.string().min(1).max(100),
  segmentCount: z.number().int().nonnegative(),
  characterCount: z.number().int().nonnegative(),
  durationCoverage: ConfidenceSchema.optional(),
  truncated: z.boolean(),
  limitations: LimitationsSchema,
});
export type TranscriptManifestEntryV1 = z.infer<typeof TranscriptManifestEntryV1Schema>;

export const TranscriptManifestArtifactV1Schema = z.strictObject({
  schemaVersion: z.literal("1.0"),
  artifactKind: z.literal("transcript_manifest.v1"),
  artifactId: z.string().min(1).max(200),
  requestId: z.string().min(1).max(200),
  videoCollectionArtifactId: z.string().min(1).max(200),
  entries: z.array(TranscriptManifestEntryV1Schema).max(50),
  summary: z.strictObject({
    transcripts: z.number().int().nonnegative(),
    human: z.number().int().nonnegative(),
    automatic: z.number().int().nonnegative(),
    unavailable: z.number().int().nonnegative(),
  }),
  limitations: LimitationsSchema,
});
export type TranscriptManifestArtifactV1 = z.infer<typeof TranscriptManifestArtifactV1Schema>;

const VideoCommentAuthorV1Schema = z.strictObject({
  displayName: z.string().min(1).max(500).optional(),
  handle: z.string().min(1).max(500).optional(),
});

export const VideoCommentV1Schema = z.strictObject({
  commentId: z.string().min(1).max(500),
  sourceNativeId: z.string().min(1).max(500).optional(),
  parentCommentId: z.string().min(1).max(500).optional(),
  author: VideoCommentAuthorV1Schema.optional(),
  body: z.string().trim().min(1).max(50_000),
  likeCount: z.number().int().nonnegative().optional(),
  createdAt: z.iso.datetime().optional(),
  sourceUrl: PublicHttpUrlSchema.optional(),
  sequence: z.number().int().nonnegative(),
  trustClassification: z.literal("untrusted_public_content"),
  limitations: LimitationsSchema,
});
export type VideoCommentV1 = z.infer<typeof VideoCommentV1Schema>;

export const VideoCommentCollectionArtifactV1Schema = z
  .strictObject({
    schemaVersion: z.literal("1.0"),
    artifactKind: z.literal("video_comment_collection.v1"),
    artifactId: z.string().min(1).max(200),
    requestId: z.string().min(1).max(200),
    videoId: z.string().min(1).max(100),
    videoUrl: PublicHttpUrlSchema,
    comments: z.array(VideoCommentV1Schema).max(100),
    summary: z.strictObject({
      commentsCollected: z.number().int().nonnegative(),
      truncated: z.boolean(),
    }),
    limitations: LimitationsSchema,
  })
  .superRefine((artifact, context) => {
    const ids = new Set<string>();
    for (const [index, comment] of artifact.comments.entries()) {
      if (comment.sequence !== index) {
        context.addIssue({
          code: "custom",
          path: ["comments", index, "sequence"],
          message: "Video comment sequence must be contiguous.",
        });
      }
      if (ids.has(comment.commentId)) {
        context.addIssue({
          code: "custom",
          path: ["comments", index, "commentId"],
          message: "Video comment IDs must be unique.",
        });
      }
      ids.add(comment.commentId);
    }
    if (artifact.summary.commentsCollected !== artifact.comments.length) {
      context.addIssue({
        code: "custom",
        path: ["summary", "commentsCollected"],
        message: "commentsCollected must equal comments.length.",
      });
    }
  });
export type VideoCommentCollectionArtifactV1 = z.infer<
  typeof VideoCommentCollectionArtifactV1Schema
>;

export const VideoCommentManifestArtifactV1Schema = z.strictObject({
  schemaVersion: z.literal("1.0"),
  artifactKind: z.literal("video_comment_manifest.v1"),
  artifactId: z.string().min(1).max(200),
  requestId: z.string().min(1).max(200),
  videoCollectionArtifactId: z.string().min(1).max(200),
  entries: z
    .array(
      z.strictObject({
        videoId: z.string().min(1).max(100),
        commentCollectionArtifactId: z.string().min(1).max(200),
        contentDigest: Sha256Schema,
        relativeArtifactPath: RelativeArtifactPathSchema,
        commentsCollected: z.number().int().nonnegative(),
        truncated: z.boolean(),
      }),
    )
    .max(50),
  summary: z.strictObject({
    videosAttempted: z.number().int().nonnegative(),
    videosWithComments: z.number().int().nonnegative(),
    commentsCollected: z.number().int().nonnegative(),
  }),
  limitations: LimitationsSchema,
});
export type VideoCommentManifestArtifactV1 = z.infer<typeof VideoCommentManifestArtifactV1Schema>;

export const VideoSignalTypeV1Schema = z.enum([
  "pain",
  "complaint",
  "workflow_friction",
  "switching_intent",
  "alternative_search",
  "comparison",
  "recommendation",
  "implementation_difficulty",
  "pricing_concern",
  "support_problem",
  "feature_demand",
  "migration_signal",
  "technology_adoption_possible",
  "case_study_result",
]);
export type VideoSignalTypeV1 = z.infer<typeof VideoSignalTypeV1Schema>;

export const VideoSignalV1Schema = z.strictObject({
  signalId: z.string().min(1).max(200),
  type: VideoSignalTypeV1Schema,
  supportingVideoIds: z.array(z.string().min(1).max(100)).min(1).max(50),
  supportingTranscriptSegmentIds: z.array(z.string().min(1).max(500)).max(500),
  supportingCommentIds: z.array(z.string().min(1).max(500)).max(500),
  independentVideoCount: z.number().int().positive(),
  independentChannelCount: z.number().int().nonnegative(),
  observedFacts: z.array(z.string().min(1).max(2_000)).min(1).max(50),
  inference: z.string().min(1).max(2_000),
  confidence: ConfidenceSchema,
  missionRelevance: z.strictObject({
    relevant: z.boolean(),
    score: ConfidenceSchema,
    matchedConcepts: z.array(z.string().min(1).max(300)).max(100),
  }),
  ruleId: z.string().min(1).max(200),
  ruleVersion: z.string().min(1).max(100),
  limitations: LimitationsSchema,
});
export type VideoSignalV1 = z.infer<typeof VideoSignalV1Schema>;

export const VideoSignalsArtifactV1Schema = z.strictObject({
  schemaVersion: z.literal("1.0"),
  artifactKind: z.literal("video_signals.v1"),
  artifactId: z.string().min(1).max(200),
  requestId: z.string().min(1).max(200),
  videoCollectionArtifactId: z.string().min(1).max(200),
  transcriptManifestArtifactId: z.string().min(1).max(200).optional(),
  videoCommentManifestArtifactId: z.string().min(1).max(200).optional(),
  rulesVersion: z.string().min(1).max(100),
  signals: z.array(VideoSignalV1Schema).max(500),
  summary: z.strictObject({
    videosAnalyzed: z.number().int().nonnegative(),
    transcriptsAnalyzed: z.number().int().nonnegative(),
    commentsAnalyzed: z.number().int().nonnegative(),
    signalsGenerated: z.number().int().nonnegative(),
  }),
  warnings: LimitationsSchema,
  limitations: LimitationsSchema,
});
export type VideoSignalsArtifactV1 = z.infer<typeof VideoSignalsArtifactV1Schema>;

export const VideoSourceRunTelemetryArtifactV1Schema = z.strictObject({
  schemaVersion: z.literal("1.0"),
  artifactKind: z.literal("video_source_run_telemetry.v1"),
  artifactId: z.string().min(1).max(200),
  requestId: z.string().min(1).max(200),
  observedAt: z.iso.datetime(),
  ytDlpVersion: z.string().min(1).max(100).optional(),
  queries: z.number().int().nonnegative(),
  searchProcessStarts: z.number().int().nonnegative(),
  metadataProcessStarts: z.number().int().nonnegative(),
  subtitleAttempts: z.number().int().nonnegative(),
  humanTranscripts: z.number().int().nonnegative(),
  automaticTranscripts: z.number().int().nonnegative(),
  noTranscriptVideos: z.number().int().nonnegative(),
  commentAttempts: z.number().int().nonnegative(),
  commentsAccepted: z.number().int().nonnegative(),
  timeouts: z.number().int().nonnegative(),
  rateLimits: z.number().int().nonnegative(),
  challenges: z.number().int().nonnegative(),
  signals: z.number().int().nonnegative(),
  processFailures: z.number().int().nonnegative(),
  paidRequests: z.literal(0),
  paidCredits: z.literal(0),
  limitations: LimitationsSchema,
});
export type VideoSourceRunTelemetryArtifactV1 = z.infer<
  typeof VideoSourceRunTelemetryArtifactV1Schema
>;
