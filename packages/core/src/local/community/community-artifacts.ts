import { z } from "zod";
import { PublicHttpUrlSchema } from "./universal-community";

const Sha256Schema = z.string().regex(/^[a-f0-9]{64}$/u);
const ConfidenceSchema = z.number().min(0).max(1);
const LimitationListSchema = z.array(z.string().min(1).max(1_000)).max(200);
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

export const CommunityRedditDepthSchema = z.enum(["quick", "default", "deep"]);
export type CommunityRedditDepth = z.infer<typeof CommunityRedditDepthSchema>;

export const CommunityQueryIntentV1Schema = z.enum([
  "general_discussion",
  "pain",
  "workflow_friction",
  "alternatives",
  "switching",
  "recommendation",
  "implementation",
  "pricing",
  "support",
  "feature_demand",
]);
export type CommunityQueryIntentV1 = z.infer<typeof CommunityQueryIntentV1Schema>;

export const CommunityQueryV1Schema = z.strictObject({
  queryId: z.string().min(1).max(200),
  query: z.string().trim().min(1).max(1_000),
  intent: CommunityQueryIntentV1Schema,
  sourceConcepts: z.array(z.string().trim().min(1).max(300)).max(100),
  primaryEntity: z.string().trim().min(1).max(300).optional(),
  importance: ConfidenceSchema,
  fromDate: z.iso.datetime().optional(),
  toDate: z.iso.datetime().optional(),
  selected: z.boolean(),
  selectionReasons: z.array(z.string().min(1).max(1_000)).max(50),
  limitations: LimitationListSchema,
});
export type CommunityQueryV1 = z.infer<typeof CommunityQueryV1Schema>;

export const SubredditTargetV1Schema = z.strictObject({
  targetId: z.string().min(1).max(200),
  subreddit: z.string().regex(/^[A-Za-z0-9_]{2,21}$/u),
  type: z.enum(["explicit", "dedicated_entity_home", "broad_category", "discovered"]),
  source: z.enum(["user_input", "mission", "rss_results", "search_results", "existing_artifact"]),
  confidence: ConfidenceSchema,
  dedicated: z.boolean(),
  selectionReasons: z.array(z.string().min(1).max(1_000)).max(50),
  limitations: LimitationListSchema,
});
export type SubredditTargetV1 = z.infer<typeof SubredditTargetV1Schema>;

const CommunityTemporalWindowV1Schema = z
  .strictObject({
    from: z.iso.datetime().optional(),
    to: z.iso.datetime().optional(),
    preset: z
      .enum([
        "last_24_hours",
        "last_7_days",
        "last_30_days",
        "last_90_days",
        "custom",
        "historical",
      ])
      .optional(),
  })
  .superRefine((value, context) => {
    if (
      value.from !== undefined &&
      value.to !== undefined &&
      Date.parse(value.from) > Date.parse(value.to)
    ) {
      context.addIssue({
        code: "custom",
        path: ["to"],
        message: "Community temporal end must not precede start.",
      });
    }
  });

export const CommunitySourcePlanArtifactV1Schema = z
  .strictObject({
    schemaVersion: z.literal("1.0"),
    artifactKind: z.literal("community_source_plan.v1"),
    artifactId: z.string().min(1).max(200),
    requestId: z.string().min(1).max(200),
    sourceFamily: z.literal("community"),
    platform: z.literal("reddit"),
    temporalWindow: CommunityTemporalWindowV1Schema,
    queries: z.array(CommunityQueryV1Schema).max(100),
    subredditTargets: z.array(SubredditTargetV1Schema).max(100),
    policy: z.strictObject({
      depth: CommunityRedditDepthSchema,
      maximumQueries: z.number().int().min(1).max(8),
      maximumDiscoveredSubreddits: z.number().int().min(1).max(50),
      maximumSelectedSubreddits: z.number().int().min(1).max(20),
      maximumThreads: z.number().int().min(1).max(200),
      maximumThreadsDrilled: z.number().int().min(1).max(20),
      maximumCommentsPerThread: z.number().int().min(1).max(25),
      maximumTotalComments: z.number().int().min(1).max(150),
    }),
    summary: z.strictObject({
      queryCandidates: z.number().int().nonnegative(),
      queriesSelected: z.number().int().nonnegative(),
      subredditCandidates: z.number().int().nonnegative(),
      subredditsSelected: z.number().int().nonnegative(),
      dedicatedSubreddits: z.number().int().nonnegative(),
      broadSubreddits: z.number().int().nonnegative(),
    }),
    warnings: LimitationListSchema,
  })
  .superRefine((artifact, context) => {
    const queryIds = new Set<string>();
    for (const [index, query] of artifact.queries.entries()) {
      if (queryIds.has(query.queryId))
        context.addIssue({
          code: "custom",
          path: ["queries", index, "queryId"],
          message: "Query IDs must be unique.",
        });
      queryIds.add(query.queryId);
    }
    const targetIds = new Set<string>();
    const subredditNames = new Set<string>();
    for (const [index, target] of artifact.subredditTargets.entries()) {
      if (targetIds.has(target.targetId))
        context.addIssue({
          code: "custom",
          path: ["subredditTargets", index, "targetId"],
          message: "Target IDs must be unique.",
        });
      targetIds.add(target.targetId);
      const normalized = target.subreddit.toLowerCase();
      if (subredditNames.has(normalized))
        context.addIssue({
          code: "custom",
          path: ["subredditTargets", index, "subreddit"],
          message: "Subreddit targets must be unique case-insensitively.",
        });
      subredditNames.add(normalized);
    }
    const selectedQueries = artifact.queries.filter((query) => query.selected).length;
    const selectedTargets = artifact.subredditTargets.length;
    const dedicated = artifact.subredditTargets.filter((target) => target.dedicated).length;
    if (
      selectedQueries !== artifact.summary.queriesSelected ||
      artifact.queries.length !== artifact.summary.queryCandidates
    )
      context.addIssue({
        code: "custom",
        path: ["summary"],
        message: "Community query summary must reconcile.",
      });
    if (
      selectedTargets !== artifact.summary.subredditsSelected ||
      dedicated !== artifact.summary.dedicatedSubreddits ||
      selectedTargets - dedicated !== artifact.summary.broadSubreddits
    )
      context.addIssue({
        code: "custom",
        path: ["summary"],
        message: "Community subreddit summary must reconcile.",
      });
    if (
      selectedQueries > artifact.policy.maximumQueries ||
      selectedTargets > artifact.policy.maximumSelectedSubreddits
    )
      context.addIssue({
        code: "custom",
        path: ["policy"],
        message: "Selected community work exceeds configured policy budgets.",
      });
  });
export type CommunitySourcePlanArtifactV1 = z.infer<typeof CommunitySourcePlanArtifactV1Schema>;

export const ThreadManifestArtifactV1Schema = z
  .strictObject({
    schemaVersion: z.literal("1.0"),
    artifactKind: z.literal("thread_manifest.v1"),
    artifactId: z.string().min(1).max(200),
    requestId: z.string().min(1).max(200),
    sourceFamily: z.literal("community"),
    sourceAdapterId: z.literal("reddit_keyless"),
    threadArtifacts: z
      .array(
        z.strictObject({
          threadArtifactId: z.string().min(1).max(200),
          contentDigest: Sha256Schema,
          relativeArtifactPath: RelativeArtifactPathSchema,
        }),
      )
      .max(200),
    summary: z.strictObject({ threadCount: z.number().int().nonnegative().max(200) }),
    warnings: LimitationListSchema,
  })
  .superRefine((artifact, context) => {
    const ids = new Set<string>();
    for (const [index, entry] of artifact.threadArtifacts.entries()) {
      if (ids.has(entry.threadArtifactId))
        context.addIssue({
          code: "custom",
          path: ["threadArtifacts", index, "threadArtifactId"],
          message: "Thread manifest IDs must be unique.",
        });
      ids.add(entry.threadArtifactId);
    }
    if (artifact.summary.threadCount !== artifact.threadArtifacts.length)
      context.addIssue({
        code: "custom",
        path: ["summary", "threadCount"],
        message: "threadCount must equal threadArtifacts.length.",
      });
  });
export type ThreadManifestArtifactV1 = z.infer<typeof ThreadManifestArtifactV1Schema>;

export const CommunityEngagementObservationV1Schema = z.strictObject({
  observedAt: z.iso.datetime(),
  source: z.enum(["reddit_live_listing", "reddit_live_comments", "arctic_shift_archive"]),
  upvotes: z.number().int().nonnegative().optional(),
  comments: z.number().int().nonnegative().optional(),
  confidence: ConfidenceSchema,
  stalePossible: z.boolean(),
  limitations: LimitationListSchema,
});
export type CommunityEngagementObservationV1 = z.infer<
  typeof CommunityEngagementObservationV1Schema
>;

const CommunityThreadProvenanceV1Schema = z.strictObject({
  adapterId: z.string().min(1).max(100),
  method: z.enum([
    "global_rss",
    "subreddit_rss",
    "subreddit_listing",
    "dedicated_listing",
    "archive_backfill",
  ]),
  observedAt: z.iso.datetime(),
  sourceUrl: PublicHttpUrlSchema,
});

export const CommunityThreadContextArtifactV1Schema = z
  .strictObject({
    schemaVersion: z.literal("1.0"),
    artifactKind: z.literal("community_thread_context.v1"),
    artifactId: z.string().min(1).max(200),
    requestId: z.string().min(1).max(200),
    communitySourcePlanArtifactId: z.string().min(1).max(200),
    threadManifestArtifactId: z.string().min(1).max(200),
    threads: z
      .array(
        z.strictObject({
          threadArtifactId: z.string().min(1).max(200),
          subreddit: z.string().regex(/^[A-Za-z0-9_]{2,21}$/u),
          queryIds: z.array(z.string().min(1).max(200)).max(20),
          queryIntents: z.array(CommunityQueryIntentV1Schema).max(20),
          dedicated: z.boolean(),
          dedicatedRelationshipConfidence: ConfidenceSchema,
          dateConfidence: ConfidenceSchema,
          relevanceScore: ConfidenceSchema,
          redditLocalScore: z.number().min(0).max(2),
          selectedForDrill: z.boolean(),
          selectionReasons: z.array(z.string().min(1).max(1_000)).max(50),
          contentSafety: z.strictObject({
            excluded: z.boolean(),
            sourceIndicator: z.string().min(1).max(100).optional(),
          }),
          provenance: z.array(CommunityThreadProvenanceV1Schema).min(1).max(50),
          engagementObservations: z.array(CommunityEngagementObservationV1Schema).max(50),
          limitations: LimitationListSchema,
        }),
      )
      .max(200),
    warnings: LimitationListSchema,
  })
  .superRefine((artifact, context) => {
    const ids = new Set<string>();
    for (const [index, thread] of artifact.threads.entries()) {
      if (ids.has(thread.threadArtifactId))
        context.addIssue({
          code: "custom",
          path: ["threads", index, "threadArtifactId"],
          message: "Thread context IDs must be unique.",
        });
      ids.add(thread.threadArtifactId);
    }
  });
export type CommunityThreadContextArtifactV1 = z.infer<
  typeof CommunityThreadContextArtifactV1Schema
>;

export const CommentCollectionManifestArtifactV1Schema = z
  .strictObject({
    schemaVersion: z.literal("1.0"),
    artifactKind: z.literal("comment_collection_manifest.v1"),
    artifactId: z.string().min(1).max(200),
    requestId: z.string().min(1).max(200),
    threadManifestArtifactId: z.string().min(1).max(200),
    collections: z
      .array(
        z.strictObject({
          commentCollectionArtifactId: z.string().min(1).max(200),
          threadArtifactId: z.string().min(1).max(200),
          contentDigest: Sha256Schema,
          relativeArtifactPath: RelativeArtifactPathSchema,
        }),
      )
      .max(20),
    summary: z.strictObject({
      threadsWithComments: z.number().int().nonnegative().max(20),
      totalComments: z.number().int().nonnegative().max(150),
    }),
    warnings: LimitationListSchema,
  })
  .superRefine((artifact, context) => {
    const collectionIds = new Set<string>();
    const threadIds = new Set<string>();
    for (const [index, entry] of artifact.collections.entries()) {
      if (
        collectionIds.has(entry.commentCollectionArtifactId) ||
        threadIds.has(entry.threadArtifactId)
      )
        context.addIssue({
          code: "custom",
          path: ["collections", index],
          message: "Each comment collection and thread may appear only once.",
        });
      collectionIds.add(entry.commentCollectionArtifactId);
      threadIds.add(entry.threadArtifactId);
    }
    if (artifact.summary.threadsWithComments !== artifact.collections.length)
      context.addIssue({
        code: "custom",
        path: ["summary", "threadsWithComments"],
        message: "threadsWithComments must equal collections.length.",
      });
  });
export type CommentCollectionManifestArtifactV1 = z.infer<
  typeof CommentCollectionManifestArtifactV1Schema
>;

export const CommunityCommentContextArtifactV1Schema = z.strictObject({
  schemaVersion: z.literal("1.0"),
  artifactKind: z.literal("community_comment_context.v1"),
  artifactId: z.string().min(1).max(200),
  requestId: z.string().min(1).max(200),
  commentCollectionManifestArtifactId: z.string().min(1).max(200),
  comments: z
    .array(
      z.strictObject({
        threadArtifactId: z.string().min(1).max(200),
        commentId: z.string().min(1).max(500),
        permalink: PublicHttpUrlSchema.optional(),
        limitations: LimitationListSchema,
      }),
    )
    .max(150),
  threadTotals: z
    .array(
      z.strictObject({
        threadArtifactId: z.string().min(1).max(200),
        totalKnownComments: z.number().int().nonnegative().optional(),
        observation: CommunityEngagementObservationV1Schema.optional(),
      }),
    )
    .max(20),
  warnings: LimitationListSchema,
});
export type CommunityCommentContextArtifactV1 = z.infer<
  typeof CommunityCommentContextArtifactV1Schema
>;

export const CommunitySignalTypeV1Schema = z.enum([
  "pain",
  "complaint",
  "workflow_friction",
  "switching_intent",
  "alternative_search",
  "recommendation_request",
  "competitor_dissatisfaction",
  "feature_request",
  "implementation_difficulty",
  "pricing_concern",
  "support_problem",
  "manual_workaround",
  "unknown",
]);
export type CommunitySignalTypeV1 = z.infer<typeof CommunitySignalTypeV1Schema>;

export const CommunitySignalV1Schema = z.strictObject({
  signalId: z.string().min(1).max(200),
  type: CommunitySignalTypeV1Schema,
  primaryConcept: z.string().min(1).max(500).optional(),
  supportingThreadArtifactIds: z.array(z.string().min(1).max(200)).min(1).max(200),
  supportingCommentIds: z.array(z.string().min(1).max(500)).max(500),
  independentThreadCount: z.number().int().positive().max(200),
  independentAuthorCount: z.number().int().nonnegative().max(10_000),
  observedFacts: z.array(z.string().min(1).max(1_000)).min(1).max(100),
  inference: z.string().min(1).max(2_000),
  confidence: ConfidenceSchema,
  engagementSummary: z
    .strictObject({
      threadsWithKnownEngagement: z.number().int().nonnegative(),
      maximumKnownUpvotes: z.number().int().nonnegative().optional(),
      maximumKnownComments: z.number().int().nonnegative().optional(),
      totalKnownUpvotes: z.number().int().nonnegative().optional(),
      totalKnownComments: z.number().int().nonnegative().optional(),
      limitations: LimitationListSchema,
    })
    .optional(),
  missionRelevance: z.strictObject({
    relevant: z.boolean(),
    score: ConfidenceSchema,
    matchedConcepts: z.array(z.string().min(1).max(300)).max(100),
  }),
  ruleId: z.string().min(1).max(200),
  ruleVersion: z.string().min(1).max(100),
  limitations: LimitationListSchema,
});
export type CommunitySignalV1 = z.infer<typeof CommunitySignalV1Schema>;

export const CommunitySignalsArtifactV1Schema = z
  .strictObject({
    schemaVersion: z.literal("1.0"),
    artifactKind: z.literal("community_signals.v1"),
    artifactId: z.string().min(1).max(200),
    requestId: z.string().min(1).max(200),
    platform: z.literal("reddit"),
    communitySourcePlanArtifactId: z.string().min(1).max(200),
    threadManifestArtifactId: z.string().min(1).max(200),
    commentCollectionManifestArtifactId: z.string().min(1).max(200).optional(),
    rulesVersion: z.string().min(1).max(100),
    signals: z.array(CommunitySignalV1Schema).max(500),
    summary: z.strictObject({
      threadsAnalyzed: z.number().int().nonnegative(),
      commentsAnalyzed: z.number().int().nonnegative(),
      uniqueAuthorsObserved: z.number().int().nonnegative(),
      painSignals: z.number().int().nonnegative(),
      complaintSignals: z.number().int().nonnegative(),
      workflowFrictionSignals: z.number().int().nonnegative(),
      switchingSignals: z.number().int().nonnegative(),
      alternativeSearchSignals: z.number().int().nonnegative(),
      recommendationSignals: z.number().int().nonnegative(),
      competitorDissatisfactionSignals: z.number().int().nonnegative(),
      featureRequestSignals: z.number().int().nonnegative(),
      implementationDifficultySignals: z.number().int().nonnegative(),
      pricingConcernSignals: z.number().int().nonnegative(),
      supportProblemSignals: z.number().int().nonnegative(),
      manualWorkaroundSignals: z.number().int().nonnegative(),
      independentThreadCount: z.number().int().nonnegative(),
    }),
    limitations: LimitationListSchema,
    warnings: LimitationListSchema,
  })
  .superRefine((artifact, context) => {
    const ids = new Set<string>();
    for (const [index, signal] of artifact.signals.entries()) {
      if (ids.has(signal.signalId))
        context.addIssue({
          code: "custom",
          path: ["signals", index, "signalId"],
          message: "Signal IDs must be unique.",
        });
      ids.add(signal.signalId);
      if (signal.independentThreadCount > new Set(signal.supportingThreadArtifactIds).size)
        context.addIssue({
          code: "custom",
          path: ["signals", index, "independentThreadCount"],
          message: "independentThreadCount cannot exceed unique supporting threads.",
        });
      if (
        /definitely|proves demand|everyone hates|will buy|has budget|is a buyer/iu.test(
          signal.inference,
        )
      )
        context.addIssue({
          code: "custom",
          path: ["signals", index, "inference"],
          message: "Community signal inference contains prohibited definitive language.",
        });
    }
  });
export type CommunitySignalsArtifactV1 = z.infer<typeof CommunitySignalsArtifactV1Schema>;

export const CommunityAdapterAttemptTelemetryV1Schema = z.strictObject({
  adapterId: z.string().min(1).max(100),
  queryId: z.string().min(1).max(200).optional(),
  subreddit: z
    .string()
    .regex(/^[A-Za-z0-9_]{2,21}$/u)
    .optional(),
  threadArtifactId: z.string().min(1).max(200).optional(),
  attempted: z.boolean(),
  requestCount: z.number().int().nonnegative(),
  durationMs: z.number().int().nonnegative(),
  rawItems: z.number().int().nonnegative(),
  acceptedItems: z.number().int().nonnegative(),
  outcome: z.enum([
    "success",
    "partial",
    "zero_results",
    "failed",
    "rate_limited",
    "challenge_detected",
    "schema_drift",
    "budget_exhausted",
    "content_safety_excluded",
  ]),
  safeFailureCode: z.string().min(1).max(100).optional(),
  safeFailureMessage: z.string().min(1).max(1_000).optional(),
});
export type CommunityAdapterAttemptTelemetryV1 = z.infer<
  typeof CommunityAdapterAttemptTelemetryV1Schema
>;

export const CommunitySourceRunTelemetryArtifactV1Schema = z.strictObject({
  schemaVersion: z.literal("1.0"),
  artifactKind: z.literal("community_source_run_telemetry.v1"),
  artifactId: z.string().min(1).max(200),
  requestId: z.string().min(1).max(200),
  platform: z.literal("reddit"),
  communitySourcePlanArtifactId: z.string().min(1).max(200),
  threadManifestArtifactId: z.string().min(1).max(200),
  commentCollectionManifestArtifactId: z.string().min(1).max(200).optional(),
  communitySignalsArtifactId: z.string().min(1).max(200),
  startedAt: z.iso.datetime(),
  completedAt: z.iso.datetime(),
  totalRuntimeMs: z.number().int().nonnegative(),
  attempts: z.array(CommunityAdapterAttemptTelemetryV1Schema).max(10_000),
  totals: z.strictObject({
    queries: z.number().int().nonnegative(),
    redditRssRequests: z.number().int().nonnegative(),
    redditListingRequests: z.number().int().nonnegative(),
    redditCommentRequests: z.number().int().nonnegative(),
    arcticShiftRequests: z.number().int().nonnegative(),
    rssThreads: z.number().int().nonnegative(),
    listingThreads: z.number().int().nonnegative(),
    mergedThreads: z.number().int().nonnegative(),
    duplicateThreadsRemoved: z.number().int().nonnegative(),
    threadsDrilled: z.number().int().nonnegative(),
    commentsAccepted: z.number().int().nonnegative(),
    duplicateCommentsRemoved: z.number().int().nonnegative(),
    liveEngagementObservations: z.number().int().nonnegative(),
    archiveEngagementObservations: z.number().int().nonnegative(),
    signalsGenerated: z.number().int().nonnegative(),
    challengesDetected: z.number().int().nonnegative(),
    rateLimits: z.number().int().nonnegative(),
    schemaDrifts: z.number().int().nonnegative(),
    paidRequests: z.literal(0),
    paidCredits: z.literal(0),
  }),
  warnings: LimitationListSchema,
});
export type CommunitySourceRunTelemetryArtifactV1 = z.infer<
  typeof CommunitySourceRunTelemetryArtifactV1Schema
>;

export { RelativeArtifactPathSchema };
