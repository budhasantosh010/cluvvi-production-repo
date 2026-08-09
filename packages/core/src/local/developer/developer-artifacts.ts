import { z } from "zod";
import { PublicHttpUrlSchema } from "../community/universal-community";

const ConfidenceSchema = z.number().min(0).max(1);
const LimitationListSchema = z.array(z.string().trim().min(1).max(1_000)).max(250);
const Sha256Schema = z.string().regex(/^[a-f0-9]{64}$/u);
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

export const GitHubDepthSchema = z.enum(["quick", "default", "deep"]);
export type GitHubDepth = z.infer<typeof GitHubDepthSchema>;

export const GitHubAccessModeSchema = z.enum([
  "auto",
  "anonymous_only",
  "authenticated_if_configured",
]);
export type GitHubAccessMode = z.infer<typeof GitHubAccessModeSchema>;

export const DeveloperQueryIntentV1Schema = z.enum([
  "general",
  "bug",
  "feature_demand",
  "integration_problem",
  "implementation_difficulty",
  "migration",
  "alternative_search",
  "performance",
  "security",
  "dependency_problem",
  "breaking_change",
  "release_activity",
  "technology_adoption",
]);
export type DeveloperQueryIntentV1 = z.infer<typeof DeveloperQueryIntentV1Schema>;

export const DeveloperQueryV1Schema = z.strictObject({
  queryId: z.string().min(1).max(200),
  plainTextQuery: z.string().trim().min(1).max(1_000),
  intent: DeveloperQueryIntentV1Schema,
  primaryEntity: z.string().trim().min(1).max(500).optional(),
  concepts: z.array(z.string().trim().min(1).max(300)).max(100),
  repositoryScope: z.array(z.string().trim().min(1).max(300)).max(50).optional(),
  temporalField: z.enum(["created", "updated"]),
  importance: ConfidenceSchema,
  selected: z.boolean(),
  selectionReasons: z.array(z.string().trim().min(1).max(1_000)).max(50),
  limitations: LimitationListSchema,
});
export type DeveloperQueryV1 = z.infer<typeof DeveloperQueryV1Schema>;

export const DeveloperRepositoryTargetV1Schema = z.strictObject({
  targetId: z.string().min(1).max(200),
  owner: z.string().trim().min(1).max(100),
  repository: z.string().trim().min(1).max(100),
  fullName: z.string().trim().min(3).max(201),
  source: z.enum([
    "explicit_github_url",
    "existing_search_result",
    "repository_search",
    "issue_search",
    "mission_entity",
  ]),
  explicit: z.boolean(),
  relevanceConfidence: ConfidenceSchema,
  evidenceReferences: z.array(z.string().min(1).max(1_000)).max(100),
  selected: z.boolean(),
  selectionReasons: z.array(z.string().min(1).max(1_000)).max(50),
  limitations: LimitationListSchema,
});
export type DeveloperRepositoryTargetV1 = z.infer<typeof DeveloperRepositoryTargetV1Schema>;

const DeveloperTemporalWindowV1Schema = z
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
        message: "Developer temporal end must not precede start.",
      });
    }
  });

export const DeveloperSourcePlanArtifactV1Schema = z
  .strictObject({
    schemaVersion: z.literal("1.0"),
    artifactKind: z.literal("developer_source_plan.v1"),
    artifactId: z.string().min(1).max(200),
    requestId: z.string().min(1).max(200),
    sourceFamily: z.literal("developer"),
    platform: z.literal("github"),
    temporalWindow: DeveloperTemporalWindowV1Schema,
    queries: z.array(DeveloperQueryV1Schema).max(8),
    repositoryTargets: z.array(DeveloperRepositoryTargetV1Schema).max(50),
    policy: z.strictObject({
      depth: GitHubDepthSchema,
      maximumQueries: z.number().int().min(1).max(8),
      maximumRepositoryTargets: z.number().int().min(1).max(15),
      maximumDiscoveryItems: z.number().int().min(1).max(60),
      maximumThreadsDrilled: z.number().int().min(1).max(8),
      maximumCommentsPerThread: z.number().int().min(1).max(20),
      maximumTotalComments: z.number().int().min(1).max(120),
      maximumReleasesPerRepository: z.number().int().min(1).max(5),
    }),
    summary: z.strictObject({
      queryCandidates: z.number().int().nonnegative(),
      queriesSelected: z.number().int().nonnegative(),
      repositoryCandidates: z.number().int().nonnegative(),
      repositoriesSelected: z.number().int().nonnegative(),
      explicitRepositories: z.number().int().nonnegative(),
      discoveredRepositories: z.number().int().nonnegative(),
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
          message: "Developer query IDs must be unique.",
        });
      queryIds.add(query.queryId);
    }
    const targetIds = new Set<string>();
    const fullNames = new Set<string>();
    for (const [index, target] of artifact.repositoryTargets.entries()) {
      const normalized = target.fullName.toLowerCase();
      if (targetIds.has(target.targetId) || fullNames.has(normalized))
        context.addIssue({
          code: "custom",
          path: ["repositoryTargets", index],
          message: "Developer repository targets must be unique.",
        });
      targetIds.add(target.targetId);
      fullNames.add(normalized);
      if (target.fullName.toLowerCase() !== `${target.owner}/${target.repository}`.toLowerCase())
        context.addIssue({
          code: "custom",
          path: ["repositoryTargets", index, "fullName"],
          message: "Repository fullName must equal owner/repository.",
        });
    }
    const selectedQueries = artifact.queries.filter((entry) => entry.selected).length;
    const selectedRepos = artifact.repositoryTargets.filter((entry) => entry.selected).length;
    if (
      artifact.summary.queryCandidates !== artifact.queries.length ||
      artifact.summary.queriesSelected !== selectedQueries
    )
      context.addIssue({
        code: "custom",
        path: ["summary"],
        message: "Developer query summary must reconcile.",
      });
    if (
      artifact.summary.repositoryCandidates !== artifact.repositoryTargets.length ||
      artifact.summary.repositoriesSelected !== selectedRepos
    )
      context.addIssue({
        code: "custom",
        path: ["summary"],
        message: "Developer repository summary must reconcile.",
      });
    if (
      selectedQueries > artifact.policy.maximumQueries ||
      selectedRepos > artifact.policy.maximumRepositoryTargets
    )
      context.addIssue({
        code: "custom",
        path: ["policy"],
        message: "Selected developer work exceeds policy budgets.",
      });
  });
export type DeveloperSourcePlanArtifactV1 = z.infer<typeof DeveloperSourcePlanArtifactV1Schema>;

export const DeveloperReleaseV1Schema = z.strictObject({
  releaseId: z.string().min(1).max(200),
  sourceNativeId: z.union([z.string().min(1).max(500), z.number().int().nonnegative()]).optional(),
  tagName: z.string().min(1).max(500),
  name: z.string().min(1).max(1_000).optional(),
  bodyExcerpt: z.string().max(10_000).optional(),
  draft: z.literal(false),
  prerelease: z.boolean(),
  createdAt: z.iso.datetime().optional(),
  publishedAt: z.iso.datetime().optional(),
  url: PublicHttpUrlSchema,
  assetCount: z.number().int().nonnegative().optional(),
  totalKnownDownloadCount: z.number().int().nonnegative().optional(),
  limitations: LimitationListSchema,
});
export type DeveloperReleaseV1 = z.infer<typeof DeveloperReleaseV1Schema>;

export const DeveloperRepositoryV1Schema = z.strictObject({
  repositoryId: z.string().min(1).max(200),
  sourceNativeId: z.union([z.string().min(1).max(500), z.number().int().nonnegative()]),
  owner: z.string().min(1).max(100),
  name: z.string().min(1).max(100),
  fullName: z.string().min(3).max(201),
  url: PublicHttpUrlSchema,
  description: z.string().max(10_000).optional(),
  homepage: PublicHttpUrlSchema.optional(),
  primaryLanguage: z.string().min(1).max(200).optional(),
  topics: z.array(z.string().min(1).max(200)).max(100),
  fork: z.boolean(),
  archived: z.boolean(),
  disabled: z.boolean(),
  visibility: z.literal("public"),
  stars: z.number().int().nonnegative().optional(),
  forks: z.number().int().nonnegative().optional(),
  subscribers: z.number().int().nonnegative().optional(),
  openIssues: z.number().int().nonnegative().optional(),
  createdAt: z.iso.datetime().optional(),
  updatedAt: z.iso.datetime().optional(),
  pushedAt: z.iso.datetime().optional(),
  hasIssues: z.boolean().optional(),
  hasDiscussions: z.boolean().optional(),
  releases: z.array(DeveloperReleaseV1Schema).max(5),
  trustClassification: z.literal("untrusted_public_content"),
  provenance: z.array(z.string().min(1).max(1_000)).max(100),
  limitations: LimitationListSchema,
});
export type DeveloperRepositoryV1 = z.infer<typeof DeveloperRepositoryV1Schema>;

export const DeveloperRepositoryCollectionArtifactV1Schema = z
  .strictObject({
    schemaVersion: z.literal("1.0"),
    artifactKind: z.literal("developer_repository_collection.v1"),
    artifactId: z.string().min(1).max(200),
    requestId: z.string().min(1).max(200),
    developerSourcePlanArtifactId: z.string().min(1).max(200),
    repositories: z.array(DeveloperRepositoryV1Schema).max(60),
    summary: z.strictObject({
      candidatesEvaluated: z.number().int().nonnegative(),
      repositoriesAccepted: z.number().int().nonnegative(),
      privateRepositoriesRejected: z.number().int().nonnegative(),
      forksIncluded: z.number().int().nonnegative(),
      archivedRepositories: z.number().int().nonnegative(),
    }),
    warnings: LimitationListSchema,
  })
  .superRefine((artifact, context) => {
    const ids = new Set<string>();
    const names = new Set<string>();
    for (const [index, repo] of artifact.repositories.entries()) {
      const name = repo.fullName.toLowerCase();
      if (ids.has(repo.repositoryId) || names.has(name))
        context.addIssue({
          code: "custom",
          path: ["repositories", index],
          message: "Developer repositories must be unique.",
        });
      ids.add(repo.repositoryId);
      names.add(name);
    }
    if (artifact.summary.repositoriesAccepted !== artifact.repositories.length)
      context.addIssue({
        code: "custom",
        path: ["summary", "repositoriesAccepted"],
        message: "repositoriesAccepted must equal repositories.length.",
      });
  });
export type DeveloperRepositoryCollectionArtifactV1 = z.infer<
  typeof DeveloperRepositoryCollectionArtifactV1Schema
>;

export const DeveloperThreadManifestArtifactV1Schema = z
  .strictObject({
    schemaVersion: z.literal("1.0"),
    artifactKind: z.literal("developer_thread_manifest.v1"),
    artifactId: z.string().min(1).max(200),
    requestId: z.string().min(1).max(200),
    sourceFamily: z.literal("developer"),
    sourceAdapterId: z.literal("github_issue_pr_search"),
    threadArtifacts: z
      .array(
        z.strictObject({
          threadArtifactId: z.string().min(1).max(200),
          contentDigest: Sha256Schema,
          relativeArtifactPath: RelativeArtifactPathSchema,
        }),
      )
      .max(60),
    summary: z.strictObject({ threadCount: z.number().int().nonnegative().max(60) }),
    warnings: LimitationListSchema,
  })
  .superRefine((artifact, context) => {
    const ids = new Set<string>();
    for (const [index, item] of artifact.threadArtifacts.entries()) {
      if (ids.has(item.threadArtifactId))
        context.addIssue({
          code: "custom",
          path: ["threadArtifacts", index, "threadArtifactId"],
          message: "Developer thread IDs must be unique.",
        });
      ids.add(item.threadArtifactId);
    }
    if (artifact.summary.threadCount !== artifact.threadArtifacts.length)
      context.addIssue({
        code: "custom",
        path: ["summary", "threadCount"],
        message: "threadCount must equal threadArtifacts.length.",
      });
  });
export type DeveloperThreadManifestArtifactV1 = z.infer<
  typeof DeveloperThreadManifestArtifactV1Schema
>;

const DeveloperThreadProvenanceV1Schema = z.strictObject({
  adapterId: z.string().min(1).max(100),
  method: z.enum([
    "global_issue_search",
    "global_pr_search",
    "repository_issue_search",
    "repository_pr_search",
    "repository_discussion",
    "existing_search_result",
  ]),
  queryId: z.string().min(1).max(200).optional(),
  observedAt: z.iso.datetime(),
});

export const DeveloperThreadMetadataArtifactV1Schema = z.strictObject({
  schemaVersion: z.literal("1.0"),
  artifactKind: z.literal("developer_thread_metadata.v1"),
  artifactId: z.string().min(1).max(200),
  requestId: z.string().min(1).max(200),
  developerSourcePlanArtifactId: z.string().min(1).max(200),
  repositoryCollectionArtifactId: z.string().min(1).max(200),
  threadManifestArtifactId: z.string().min(1).max(200),
  threads: z
    .array(
      z.strictObject({
        threadArtifactId: z.string().min(1).max(200),
        repositoryId: z.string().min(1).max(200),
        repositoryFullName: z.string().min(3).max(201),
        nativeNumber: z.number().int().positive(),
        threadKind: z.enum(["issue", "pull_request", "discussion"]),
        state: z.enum(["open", "closed", "merged", "unknown"]),
        labels: z.array(z.string().min(1).max(300)).max(100),
        authorAssociation: z.string().min(1).max(100).optional(),
        locked: z.boolean().optional(),
        draft: z.boolean().optional(),
        baseRepositoryFullName: z.string().min(3).max(201).optional(),
        headRepositoryFullName: z.string().min(3).max(201).optional(),
        createdAt: z.iso.datetime().optional(),
        updatedAt: z.iso.datetime().optional(),
        closedAt: z.iso.datetime().optional(),
        mergedAt: z.iso.datetime().optional(),
        relevanceScore: ConfidenceSchema,
        developerLocalScore: z.number().min(0).max(2),
        selectedForDrill: z.boolean(),
        selectionReasons: z.array(z.string().min(1).max(1_000)).max(50),
        provenance: z.array(DeveloperThreadProvenanceV1Schema).min(1).max(100),
        limitations: LimitationListSchema,
      }),
    )
    .max(60),
  warnings: LimitationListSchema,
});
export type DeveloperThreadMetadataArtifactV1 = z.infer<
  typeof DeveloperThreadMetadataArtifactV1Schema
>;

export const DeveloperCommentCollectionManifestArtifactV1Schema = z
  .strictObject({
    schemaVersion: z.literal("1.0"),
    artifactKind: z.literal("developer_comment_collection_manifest.v1"),
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
      .max(8),
    summary: z.strictObject({
      threadsWithComments: z.number().int().nonnegative().max(8),
      totalComments: z.number().int().nonnegative().max(120),
    }),
    warnings: LimitationListSchema,
  })
  .superRefine((artifact, context) => {
    const collections = new Set<string>();
    const threads = new Set<string>();
    for (const [index, item] of artifact.collections.entries()) {
      if (collections.has(item.commentCollectionArtifactId) || threads.has(item.threadArtifactId))
        context.addIssue({
          code: "custom",
          path: ["collections", index],
          message: "Each developer collection/thread may occur only once.",
        });
      collections.add(item.commentCollectionArtifactId);
      threads.add(item.threadArtifactId);
    }
    if (artifact.summary.threadsWithComments !== artifact.collections.length)
      context.addIssue({
        code: "custom",
        path: ["summary", "threadsWithComments"],
        message: "threadsWithComments must equal collections.length.",
      });
  });
export type DeveloperCommentCollectionManifestArtifactV1 = z.infer<
  typeof DeveloperCommentCollectionManifestArtifactV1Schema
>;

export const DeveloperCommentMetadataArtifactV1Schema = z.strictObject({
  schemaVersion: z.literal("1.0"),
  artifactKind: z.literal("developer_comment_metadata.v1"),
  artifactId: z.string().min(1).max(200),
  requestId: z.string().min(1).max(200),
  commentCollectionManifestArtifactId: z.string().min(1).max(200),
  comments: z
    .array(
      z.strictObject({
        threadArtifactId: z.string().min(1).max(200),
        commentId: z.string().min(1).max(500),
        commentKind: z.enum(["issue_comment", "review_comment", "review", "discussion_comment"]),
        permalink: PublicHttpUrlSchema.optional(),
        authorAssociation: z.string().min(1).max(100).optional(),
        path: z.string().min(1).max(2_000).optional(),
        line: z.number().int().positive().optional(),
        startLine: z.number().int().positive().optional(),
        inReplyToCommentId: z.string().min(1).max(500).optional(),
        limitations: LimitationListSchema,
      }),
    )
    .max(120),
  warnings: LimitationListSchema,
});
export type DeveloperCommentMetadataArtifactV1 = z.infer<
  typeof DeveloperCommentMetadataArtifactV1Schema
>;

export const DeveloperSignalTypeV1Schema = z.enum([
  "bug_pain",
  "feature_demand",
  "integration_problem",
  "implementation_difficulty",
  "migration_signal",
  "alternative_search",
  "performance_problem",
  "security_problem",
  "dependency_problem",
  "breaking_change",
  "maintenance_inactivity_possible",
  "release_activity",
  "technology_adoption_possible",
  "unknown",
]);
export type DeveloperSignalTypeV1 = z.infer<typeof DeveloperSignalTypeV1Schema>;

export const DeveloperSignalV1Schema = z.strictObject({
  signalId: z.string().min(1).max(200),
  type: DeveloperSignalTypeV1Schema,
  primaryConcept: z.string().min(1).max(500).optional(),
  repositoryIds: z.array(z.string().min(1).max(200)).min(1).max(60),
  supportingThreadArtifactIds: z.array(z.string().min(1).max(200)).max(60),
  supportingCommentIds: z.array(z.string().min(1).max(500)).max(120),
  independentThreadCount: z.number().int().nonnegative().max(60),
  independentRepositoryCount: z.number().int().positive().max(60),
  independentAuthorCount: z.number().int().nonnegative().max(10_000),
  observedFacts: z.array(z.string().min(1).max(1_000)).min(1).max(100),
  inference: z.string().min(1).max(2_000),
  confidence: ConfidenceSchema,
  missionRelevance: z.strictObject({
    relevant: z.boolean(),
    score: ConfidenceSchema,
    matchedConcepts: z.array(z.string().min(1).max(300)).max(100),
  }),
  ruleId: z.string().min(1).max(200),
  ruleVersion: z.string().min(1).max(100),
  limitations: LimitationListSchema,
});
export type DeveloperSignalV1 = z.infer<typeof DeveloperSignalV1Schema>;

export const DeveloperSignalsArtifactV1Schema = z
  .strictObject({
    schemaVersion: z.literal("1.0"),
    artifactKind: z.literal("developer_signals.v1"),
    artifactId: z.string().min(1).max(200),
    requestId: z.string().min(1).max(200),
    developerSourcePlanArtifactId: z.string().min(1).max(200),
    repositoryCollectionArtifactId: z.string().min(1).max(200),
    threadManifestArtifactId: z.string().min(1).max(200),
    commentCollectionManifestArtifactId: z.string().min(1).max(200).optional(),
    rulesVersion: z.string().min(1).max(100),
    signals: z.array(DeveloperSignalV1Schema).max(500),
    summary: z.strictObject({
      repositoriesAnalyzed: z.number().int().nonnegative(),
      threadsAnalyzed: z.number().int().nonnegative(),
      commentsAnalyzed: z.number().int().nonnegative(),
      bugPainSignals: z.number().int().nonnegative(),
      featureDemandSignals: z.number().int().nonnegative(),
      integrationProblemSignals: z.number().int().nonnegative(),
      implementationDifficultySignals: z.number().int().nonnegative(),
      migrationSignals: z.number().int().nonnegative(),
      alternativeSearchSignals: z.number().int().nonnegative(),
      performanceProblemSignals: z.number().int().nonnegative(),
      securityProblemSignals: z.number().int().nonnegative(),
      dependencyProblemSignals: z.number().int().nonnegative(),
      breakingChangeSignals: z.number().int().nonnegative(),
      maintenanceInactivitySignals: z.number().int().nonnegative(),
      releaseActivitySignals: z.number().int().nonnegative(),
      technologyAdoptionSignals: z.number().int().nonnegative(),
      independentRepositoryCount: z.number().int().nonnegative(),
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
          message: "Developer signal IDs must be unique.",
        });
      ids.add(signal.signalId);
      if (
        signal.independentThreadCount > new Set(signal.supportingThreadArtifactIds).size ||
        signal.independentRepositoryCount > new Set(signal.repositoryIds).size
      )
        context.addIssue({
          code: "custom",
          path: ["signals", index],
          message: "Developer signal independence counts cannot exceed unique support.",
        });
      if (
        /definitely|proves market demand|will buy|has budget|is a buyer|project is dying/iu.test(
          signal.inference,
        )
      )
        context.addIssue({
          code: "custom",
          path: ["signals", index, "inference"],
          message: "Developer signal inference contains prohibited definitive language.",
        });
    }
  });
export type DeveloperSignalsArtifactV1 = z.infer<typeof DeveloperSignalsArtifactV1Schema>;

export const GitHubRateLimitSnapshotV1Schema = z.strictObject({
  resource: z.enum(["core", "search", "graphql", "unknown"]),
  limit: z.number().int().nonnegative().optional(),
  remaining: z.number().int().nonnegative().optional(),
  used: z.number().int().nonnegative().optional(),
  resetAt: z.iso.datetime().optional(),
  observedAt: z.iso.datetime(),
});
export type GitHubRateLimitSnapshotV1 = z.infer<typeof GitHubRateLimitSnapshotV1Schema>;

export const DeveloperAdapterAttemptTelemetryV1Schema = z.strictObject({
  adapterId: z.string().min(1).max(100),
  queryId: z.string().min(1).max(200).optional(),
  repositoryId: z.string().min(1).max(200).optional(),
  threadArtifactId: z.string().min(1).max(200).optional(),
  accessCategory: z.enum(["keyless_free", "authenticated_free"]),
  attempted: z.boolean(),
  requests: z.number().int().nonnegative(),
  durationMs: z.number().int().nonnegative(),
  rawItems: z.number().int().nonnegative(),
  acceptedItems: z.number().int().nonnegative(),
  outcome: z.enum([
    "success",
    "partial",
    "zero_results",
    "failed",
    "auth_missing",
    "auth_failed",
    "rate_limited",
    "budget_exhausted",
    "private_resource_rejected",
    "schema_drift",
  ]),
  safeFailureCode: z.string().min(1).max(100).optional(),
  safeFailureMessage: z.string().min(1).max(1_000).optional(),
});
export type DeveloperAdapterAttemptTelemetryV1 = z.infer<
  typeof DeveloperAdapterAttemptTelemetryV1Schema
>;

export const DeveloperSourceRunTelemetryArtifactV1Schema = z.strictObject({
  schemaVersion: z.literal("1.0"),
  artifactKind: z.literal("developer_source_run_telemetry.v1"),
  artifactId: z.string().min(1).max(200),
  requestId: z.string().min(1).max(200),
  developerSourcePlanArtifactId: z.string().min(1).max(200),
  repositoryCollectionArtifactId: z.string().min(1).max(200),
  threadManifestArtifactId: z.string().min(1).max(200),
  commentCollectionManifestArtifactId: z.string().min(1).max(200).optional(),
  developerSignalsArtifactId: z.string().min(1).max(200),
  accessMode: z.enum(["anonymous", "authenticated_free"]),
  startedAt: z.iso.datetime(),
  completedAt: z.iso.datetime(),
  totalRuntimeMs: z.number().int().nonnegative(),
  rateLimits: z.array(GitHubRateLimitSnapshotV1Schema).max(5_000),
  attempts: z.array(DeveloperAdapterAttemptTelemetryV1Schema).max(10_000),
  totals: z.strictObject({
    repositorySearchRequests: z.number().int().nonnegative(),
    issueSearchRequests: z.number().int().nonnegative(),
    repositoryMetadataRequests: z.number().int().nonnegative(),
    issueDetailRequests: z.number().int().nonnegative(),
    pullRequestDetailRequests: z.number().int().nonnegative(),
    issueCommentRequests: z.number().int().nonnegative(),
    pullReviewCommentRequests: z.number().int().nonnegative(),
    pullReviewRequests: z.number().int().nonnegative(),
    releaseRequests: z.number().int().nonnegative(),
    graphqlDiscussionRequests: z.number().int().nonnegative(),
    repositoriesDiscovered: z.number().int().nonnegative(),
    repositoriesAccepted: z.number().int().nonnegative(),
    threadsDiscovered: z.number().int().nonnegative(),
    threadsAccepted: z.number().int().nonnegative(),
    duplicateThreadsRemoved: z.number().int().nonnegative(),
    threadsDrilled: z.number().int().nonnegative(),
    commentsAccepted: z.number().int().nonnegative(),
    duplicateCommentsRemoved: z.number().int().nonnegative(),
    releasesAccepted: z.number().int().nonnegative(),
    signalsGenerated: z.number().int().nonnegative(),
    rateLimitEvents: z.number().int().nonnegative(),
    privateResourcesRejected: z.number().int().nonnegative(),
    anonymousRequests: z.number().int().nonnegative(),
    authenticatedFreeRequests: z.number().int().nonnegative(),
    paidRequests: z.literal(0),
    paidCredits: z.literal(0),
  }),
  warnings: LimitationListSchema,
});
export type DeveloperSourceRunTelemetryArtifactV1 = z.infer<
  typeof DeveloperSourceRunTelemetryArtifactV1Schema
>;

export { RelativeArtifactPathSchema as DeveloperRelativeArtifactPathSchema };
