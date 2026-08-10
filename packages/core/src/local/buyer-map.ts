import { z } from "zod";
import { EvidenceSignalTypeSchema, EvidenceStrengthSchema } from "./evidence-findings";
import {
  HiringProviderIdV1Schema,
  RoleFamilyV1Schema,
  SeniorityLevelV1Schema,
  SourceAccessCategoryV1Schema,
} from "./hiring/hiring-artifacts";
import { IdentityConfidenceSchema, ManualContactRouteV1Schema } from "./identity-enrichment";
import { SourceZoneSchema } from "./search-results";
import {
  SourceAuthorityClassV1Schema,
  SpecializedFindingTypeV1Schema,
  SpecializedSignalTypeV1Schema,
  SpecializedSourceTypeV1Schema,
} from "./specialized/specialized-artifacts";
import { VideoSignalTypeV1Schema } from "./video/video-artifacts";

export const BuyerMapCitationV1Schema = z
  .object({
    evidenceFindingId: z.string().min(1),
    searchResultId: z.string().min(1),
    signalType: EvidenceSignalTypeSchema,
    positive: z.boolean(),
    strength: EvidenceStrengthSchema,
    summary: z.string().min(1),
    sourceUrl: z.url(),
    sourceZone: SourceZoneSchema,
    publishedAt: z.iso.datetime().optional(),
    discoveredAt: z.iso.datetime(),
    materialId: z.string().min(1).optional(),
    materialKind: z
      .enum([
        "search_snippet",
        "extracted_page_text",
        "extracted_metadata",
        "extracted_json_ld",
        "structured_section",
        "structured_table",
        "structured_metadata",
        "structured_footnote",
        "public_job_posting",
        "hiring_signal",
        "reddit_thread",
        "reddit_comment",
        "community_signal",
        "github_repository",
        "github_thread",
        "github_comment",
        "github_release",
        "developer_signal",
        "youtube_video",
        "youtube_transcript_segment",
        "youtube_comment",
        "video_signal",
        "specialized_finding",
        "specialized_signal",
      ])
      .optional(),
    extractionItemId: z.string().min(1).optional(),
    frontierItemId: z.string().min(1).optional(),
    structuredContentItemId: z.string().min(1).optional(),
    sectionId: z.string().min(1).optional(),
    tableId: z.string().min(1).optional(),
    footnoteId: z.string().min(1).optional(),
    parserProviderId: z.string().min(1).optional(),
    parserVersion: z.string().min(1).optional(),
    resourceKind: z.string().min(1).optional(),
    structuredContentHash: z
      .string()
      .regex(/^[a-f0-9]{64}$/)
      .optional(),
    contentCompleteness: z.enum(["complete", "partial", "truncated", "unavailable"]).optional(),
    headingPath: z.array(z.string().min(1)).optional(),
    extractedContentHash: z
      .string()
      .regex(/^[a-f0-9]{64}$/)
      .optional(),
    trustClassification: z.enum(["provider_snippet", "untrusted_public_content"]).optional(),
    targetId: z.string().min(1).optional(),
    boardId: z.string().min(1).optional(),
    jobId: z.string().min(1).optional(),
    hiringSignalId: z.string().min(1).optional(),
    hiringProviderId: HiringProviderIdV1Schema.optional(),
    accessCategory: SourceAccessCategoryV1Schema.optional(),
    companyName: z.string().min(1).optional(),
    companyDomain: z.string().min(1).optional(),
    roleFamily: RoleFamilyV1Schema.optional(),
    seniority: SeniorityLevelV1Schema.optional(),
    workplaceType: z.enum(["remote", "hybrid", "on_site", "unspecified"]).optional(),
    department: z.string().min(1).optional(),
    technologyMentions: z.array(z.string().min(1)).max(100).optional(),
    confidence: z.number().min(0).max(1).optional(),
    threadArtifactId: z.string().min(1).optional(),
    commentCollectionArtifactId: z.string().min(1).optional(),
    commentId: z.string().min(1).optional(),
    communitySignalId: z.string().min(1).optional(),
    communitySignalType: z.string().min(1).optional(),
    subreddit: z.string().min(2).max(21).optional(),
    communityQueryIds: z.array(z.string().min(1)).max(20).optional(),
    communityQueryIntents: z.array(z.string().min(1)).max(20).optional(),
    relevanceScore: z.number().min(0).max(1).optional(),
    redditLocalScore: z.number().min(0).max(2).optional(),
    engagementSource: z
      .enum(["reddit_live_listing", "reddit_live_comments", "arctic_shift_archive"])
      .optional(),
    engagementObservationSource: z
      .enum(["reddit_live_listing", "reddit_live_comments", "arctic_shift_archive"])
      .optional(),
    engagementStalePossible: z.boolean().optional(),
    independentThreadCount: z.number().int().nonnegative().optional(),
    repositoryId: z.string().min(1).optional(),
    repositoryFullName: z.string().min(3).optional(),
    developerThreadKind: z.enum(["issue", "pull_request", "discussion"]).optional(),
    developerThreadNumber: z.number().int().positive().optional(),
    developerCommentKind: z
      .enum(["issue_comment", "review_comment", "review", "discussion_comment"])
      .optional(),
    developerSignalId: z.string().min(1).optional(),
    developerSignalType: z.string().min(1).optional(),
    developerQueryIds: z.array(z.string().min(1)).max(20).optional(),
    developerQueryIntents: z.array(z.string().min(1)).max(20).optional(),
    developerLocalScore: z.number().min(0).max(2).optional(),
    independentRepositoryCount: z.number().int().nonnegative().optional(),
    authorAssociation: z.string().min(1).optional(),
    releaseId: z.string().min(1).optional(),
    releaseTagName: z.string().min(1).optional(),
    releasePrerelease: z.boolean().optional(),
    videoId: z.string().min(1).optional(),
    channelId: z.string().min(1).optional(),
    channelName: z.string().min(1).optional(),
    videoSignalId: z.string().min(1).optional(),
    videoSignalType: VideoSignalTypeV1Schema.optional(),
    videoQueryIds: z.array(z.string().min(1)).max(20).optional(),
    videoLocalScore: z.number().min(0).max(2).optional(),
    independentVideoCount: z.number().int().nonnegative().optional(),
    independentChannelCount: z.number().int().nonnegative().optional(),
    transcriptArtifactId: z.string().min(1).optional(),
    transcriptSegmentId: z.string().min(1).optional(),
    subtitleSource: z.enum(["human", "automatic"]).optional(),
    subtitleLanguage: z.string().min(1).optional(),
    specializedFindingId: z.string().min(1).optional(),
    specializedSignalId: z.string().min(1).optional(),
    specializedSignalType: SpecializedSignalTypeV1Schema.optional(),
    specializedFindingType: SpecializedFindingTypeV1Schema.optional(),
    specializedSourceId: z.string().min(1).optional(),
    specializedCandidateId: z.string().min(1).optional(),
    sourceDomain: z.string().min(1).optional(),
    specializedSourceType: SpecializedSourceTypeV1Schema.optional(),
    sourceAuthorityClass: SourceAuthorityClassV1Schema.optional(),
    specializedRoute: z
      .enum(["dedicated_adapter", "generic_site_search", "generic_feed", "generic_page_extraction"])
      .optional(),
    independentSourceCount: z.number().int().nonnegative().optional(),
  })
  .strict();
export type BuyerMapCitationV1 = z.infer<typeof BuyerMapCitationV1Schema>;

export const BuyerMapOpportunityV1Schema = z
  .object({
    rankedOpportunityId: z.string().min(1),
    rank: z.number().int().positive(),
    entityKey: z.string().min(1),
    companyName: z.string().min(1),
    companyDomain: z.string().min(1).optional(),
    score: z.number().int().min(-8).max(23),
    confidence: IdentityConfidenceSchema,
    whyItMayBeWorthContacting: z.string().min(1),
    likelyDecisionMakerTitles: z.array(z.string().min(1)).min(1),
    likelyDepartment: z.string().min(1),
    manualContactRoute: ManualContactRouteV1Schema,
    evidence: z.array(BuyerMapCitationV1Schema).min(1),
    risks: z.array(z.string().min(1)),
    limitations: z.array(z.string().min(1)),
  })
  .strict();
export type BuyerMapOpportunityV1 = z.infer<typeof BuyerMapOpportunityV1Schema>;

export const BuyerMapCoverageGapV1Schema = z
  .object({
    sourceZone: SourceZoneSchema,
    reason: z.string().min(1),
    suggestedAction: z.string().min(1),
  })
  .strict();
export type BuyerMapCoverageGapV1 = z.infer<typeof BuyerMapCoverageGapV1Schema>;

export const BuyerMapArtifactV1Schema = z
  .object({
    schemaVersion: z.literal("1.0"),
    artifactKind: z.literal("buyer_map.v1"),
    fixture: z.literal(true),
    warning: z.string().min(1),
    generatedAt: z.iso.datetime(),
    summary: z
      .object({
        rankedOpportunityCount: z.number().int().nonnegative(),
        positiveEvidenceCount: z.number().int().nonnegative(),
        negativeEvidenceCount: z.number().int().nonnegative(),
        coverageGapCount: z.number().int().nonnegative(),
        extractedEvidenceCitationCount: z.number().int().nonnegative().default(0),
        structuredEvidenceCitationCount: z.number().int().nonnegative().default(0),
        publicJobCitationCount: z.number().int().nonnegative().default(0),
        hiringSignalCitationCount: z.number().int().nonnegative().default(0),
        redditThreadCitationCount: z.number().int().nonnegative().default(0),
        redditCommentCitationCount: z.number().int().nonnegative().default(0),
        communitySignalCitationCount: z.number().int().nonnegative().default(0),
        githubRepositoryCitationCount: z.number().int().nonnegative().default(0),
        githubThreadCitationCount: z.number().int().nonnegative().default(0),
        githubCommentCitationCount: z.number().int().nonnegative().default(0),
        githubReleaseCitationCount: z.number().int().nonnegative().default(0),
        developerSignalCitationCount: z.number().int().nonnegative().default(0),
        videoCitationCount: z.number().int().nonnegative().default(0),
        videoSignalCitationCount: z.number().int().nonnegative().default(0),
        specializedFindingCitationCount: z.number().int().nonnegative().default(0),
        specializedSignalCitationCount: z.number().int().nonnegative().default(0),
      })
      .strict(),
    evidenceSourceMode: z
      .enum([
        "snippet_only",
        "snippet_plus_extracted_public_pages",
        "snippet_plus_structured_public_content",
        "snippet_plus_public_hiring_intelligence",
        "snippet_plus_extracted_and_hiring_intelligence",
        "snippet_plus_structured_and_hiring_intelligence",
        "snippet_plus_public_community_intelligence",
        "snippet_plus_hiring_and_community_intelligence",
        "snippet_plus_structured_hiring_and_community_intelligence",
        "snippet_plus_public_developer_intelligence",
        "snippet_plus_hiring_and_developer_intelligence",
        "snippet_plus_community_and_developer_intelligence",
        "snippet_plus_hiring_community_and_developer_intelligence",
        "snippet_plus_extracted_and_developer_intelligence",
        "snippet_plus_structured_and_developer_intelligence",
        "snippet_plus_structured_hiring_and_developer_intelligence",
        "snippet_plus_structured_community_and_developer_intelligence",
        "snippet_plus_structured_hiring_community_and_developer_intelligence",
        "snippet_plus_public_video_intelligence",
        "snippet_plus_public_specialized_intelligence",
        "snippet_plus_video_and_specialized_intelligence",
        "snippet_plus_multi_source_intelligence",
      ])
      .default("snippet_only"),
    opportunities: z.array(BuyerMapOpportunityV1Schema),
    coverageGaps: z.array(BuyerMapCoverageGapV1Schema),
    confidenceLimitations: z.array(z.string().min(1)),
    warnings: z.array(z.string().min(1)),
  })
  .strict();
export type BuyerMapArtifactV1 = z.infer<typeof BuyerMapArtifactV1Schema>;

export const ProjectBFinalizationArtifactV1Schema = z
  .object({
    schemaVersion: z.literal("1.0"),
    artifactKind: z.literal("project_b_finalization.v1"),
    fixture: z.literal(true),
    warning: z.string().min(1),
    runId: z.string().min(1),
    generatedAt: z.iso.datetime(),
    outcome: z.literal("fixture_buyer_map_completed"),
    rankedOpportunityCount: z.number().int().nonnegative(),
    evidenceFindingCount: z.number().int().nonnegative(),
    identityHypothesisCount: z.number().int().nonnegative(),
    coverageGapCount: z.number().int().nonnegative(),
    realOpportunitiesProduced: z.literal(0),
    nextPhase: z.literal("C1-H researched live-provider integration path"),
  })
  .strict();
export type ProjectBFinalizationArtifactV1 = z.infer<typeof ProjectBFinalizationArtifactV1Schema>;
