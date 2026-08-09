import { z } from "zod";
import {
  CommunityQueryIntentV1Schema,
  CommunitySignalTypeV1Schema,
} from "./community/community-artifacts";
import {
  DeveloperQueryIntentV1Schema,
  DeveloperSignalTypeV1Schema,
} from "./developer/developer-artifacts";
import {
  HiringProviderIdV1Schema,
  RoleFamilyV1Schema,
  SeniorityLevelV1Schema,
  SourceAccessCategoryV1Schema,
} from "./hiring/hiring-artifacts";
import {
  CoverageReportV2Schema,
  DiscoveryProviderCategorySchema,
  NormalizedDiscoveryResultV2Schema,
  SearchMethodSchema,
  SignalIntentSchema,
  SourceZoneSchema,
} from "./search-results";

export const EvidenceSignalTypeSchema = z.enum([
  "problem_signal",
  "timing_signal",
  "buyer_fit_signal",
  "company_fit_signal",
  "hiring_signal",
  "community_signal",
  "developer_signal",
  "procurement_signal",
  "budget_signal",
  "competitor_signal",
  "workaround_signal",
  "manual_process_signal",
  "negative_signal",
  "risk_signal",
]);
export type EvidenceSignalType = z.infer<typeof EvidenceSignalTypeSchema>;

export const EvidenceStrengthSchema = z.enum(["weak", "moderate", "strong"]);
export type EvidenceStrength = z.infer<typeof EvidenceStrengthSchema>;

export const EvidenceMaterialKindV1Schema = z.enum([
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
]);
export type EvidenceMaterialKindV1 = z.infer<typeof EvidenceMaterialKindV1Schema>;

export const EvidenceMaterialV1Schema = z
  .object({
    id: z.string().min(1),
    kind: EvidenceMaterialKindV1Schema,
    searchResultId: z.string().min(1),
    entityKey: z.string().min(1),
    sourceUrl: z.url(),
    content: z.string().min(1).max(20_000),
    contentHash: z.string().regex(/^[a-f0-9]{64}$/),
    trustClassification: z.enum(["provider_snippet", "untrusted_public_content"]),
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
    communitySignalType: CommunitySignalTypeV1Schema.optional(),
    subreddit: z.string().min(2).max(21).optional(),
    communityQueryIds: z.array(z.string().min(1)).max(20).optional(),
    communityQueryIntents: z.array(CommunityQueryIntentV1Schema).max(20).optional(),
    relevanceScore: z.number().min(0).max(1).optional(),
    redditLocalScore: z.number().min(0).max(2).optional(),
    engagementSource: z
      .enum(["reddit_live_listing", "reddit_live_comments", "arctic_shift_archive"])
      .optional(),
    engagementObservationSource: z
      .enum(["reddit_live_listing", "reddit_live_comments", "arctic_shift_archive"])
      .optional(),
    engagementState: z.enum(["unknown", "live", "archived"]).optional(),
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
    developerSignalType: DeveloperSignalTypeV1Schema.optional(),
    developerQueryIds: z.array(z.string().min(1)).max(20).optional(),
    developerQueryIntents: z.array(DeveloperQueryIntentV1Schema).max(20).optional(),
    developerLocalScore: z.number().min(0).max(2).optional(),
    independentRepositoryCount: z.number().int().nonnegative().optional(),
    authorAssociation: z.string().min(1).optional(),
    releaseId: z.string().min(1).optional(),
    releaseTagName: z.string().min(1).optional(),
    releasePrerelease: z.boolean().optional(),
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
    chunkIndex: z.number().int().nonnegative().optional(),
    characterStart: z.number().int().nonnegative().optional(),
    characterEnd: z.number().int().positive().optional(),
    title: z.string().min(1).optional(),
    publishedAt: z.iso.datetime().optional(),
    limitations: z.array(z.string().min(1)),
  })
  .strict()
  .superRefine((value, context) => {
    if (
      value.characterStart !== undefined &&
      value.characterEnd !== undefined &&
      value.characterEnd <= value.characterStart
    ) {
      context.addIssue({
        code: "custom",
        path: ["characterEnd"],
        message: "characterEnd must be greater than characterStart",
      });
    }
  });
export type EvidenceMaterialV1 = z.infer<typeof EvidenceMaterialV1Schema>;

export const EvidenceProvenanceV1Schema = z
  .object({
    searchResultId: z.string().min(1),
    queryId: z.string().min(1),
    query: z.string().min(1),
    sourceUrl: z.url(),
    providerId: z.string().min(1),
    providerCategory: DiscoveryProviderCategorySchema,
    sourceZone: SourceZoneSchema,
    searchMethod: SearchMethodSchema,
    signalIntent: SignalIntentSchema,
    publishedAt: z.iso.datetime().optional(),
    discoveredAt: z.iso.datetime(),
    credibility: z.enum(["low", "medium", "high", "official"]).optional(),
    riskLevel: z.enum(["low", "medium", "high"]).optional(),
    materialId: z.string().min(1).optional(),
    materialKind: EvidenceMaterialKindV1Schema.optional(),
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
    characterStart: z.number().int().nonnegative().optional(),
    characterEnd: z.number().int().positive().optional(),
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
    communitySignalType: CommunitySignalTypeV1Schema.optional(),
    subreddit: z.string().min(2).max(21).optional(),
    communityQueryIds: z.array(z.string().min(1)).max(20).optional(),
    communityQueryIntents: z.array(CommunityQueryIntentV1Schema).max(20).optional(),
    relevanceScore: z.number().min(0).max(1).optional(),
    redditLocalScore: z.number().min(0).max(2).optional(),
    engagementSource: z
      .enum(["reddit_live_listing", "reddit_live_comments", "arctic_shift_archive"])
      .optional(),
    engagementObservationSource: z
      .enum(["reddit_live_listing", "reddit_live_comments", "arctic_shift_archive"])
      .optional(),
    engagementState: z.enum(["unknown", "live", "archived"]).optional(),
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
    developerSignalType: DeveloperSignalTypeV1Schema.optional(),
    developerQueryIds: z.array(z.string().min(1)).max(20).optional(),
    developerQueryIntents: z.array(DeveloperQueryIntentV1Schema).max(20).optional(),
    developerLocalScore: z.number().min(0).max(2).optional(),
    independentRepositoryCount: z.number().int().nonnegative().optional(),
    authorAssociation: z.string().min(1).optional(),
    releaseId: z.string().min(1).optional(),
    releaseTagName: z.string().min(1).optional(),
    releasePrerelease: z.boolean().optional(),
  })
  .strict();
export type EvidenceProvenanceV1 = z.infer<typeof EvidenceProvenanceV1Schema>;

export const EvidenceFindingV1Schema = z
  .object({
    id: z.string().min(1),
    searchResultId: z.string().min(1),
    entityKey: z.string().min(1),
    signalType: EvidenceSignalTypeSchema,
    positive: z.boolean(),
    strength: EvidenceStrengthSchema,
    summary: z.string().min(1),
    supportingText: z.string().min(1),
    sourceUrl: z.url(),
    providerId: z.string().min(1),
    sourceZone: SourceZoneSchema,
    stale: z.boolean(),
    materialId: z.string().min(1).optional(),
    materialKind: EvidenceMaterialKindV1Schema.default("search_snippet"),
    provenance: EvidenceProvenanceV1Schema,
  })
  .strict();
export type EvidenceFindingV1 = z.infer<typeof EvidenceFindingV1Schema>;

export const DiscoveryCandidateEntityV1Schema = z
  .object({
    entityKey: z.string().min(1),
    displayName: z.string().min(1),
    domain: z.string().min(1).optional(),
    resultIds: z.array(z.string().min(1)).min(1),
    resultCount: z.number().int().positive(),
  })
  .strict();
export type DiscoveryCandidateEntityV1 = z.infer<typeof DiscoveryCandidateEntityV1Schema>;

const SourceArtifactReferenceSchema = z
  .object({
    requestId: z.string().min(1),
    schemaVersion: z.literal("2.0"),
    artifactKind: z.literal("search_results.v2"),
  })
  .strict();

export const DiscoveryCandidatesArtifactV1Schema = z
  .object({
    schemaVersion: z.literal("1.0"),
    artifactKind: z.literal("discovery_candidates.v1"),
    fixture: z.literal(true),
    warning: z.string().min(1),
    generatedAt: z.iso.datetime(),
    sourceArtifact: SourceArtifactReferenceSchema,
    results: z.array(NormalizedDiscoveryResultV2Schema),
    entities: z.array(DiscoveryCandidateEntityV1Schema),
    duplicatesRemoved: z.number().int().nonnegative(),
    coverage: CoverageReportV2Schema,
    warnings: z.array(z.string().min(1)),
  })
  .strict();
export type DiscoveryCandidatesArtifactV1 = z.infer<typeof DiscoveryCandidatesArtifactV1Schema>;

export const EvidenceEntitySummaryV1Schema = z
  .object({
    entityKey: z.string().min(1),
    displayName: z.string().min(1),
    domain: z.string().min(1).optional(),
    findingIds: z.array(z.string().min(1)).min(1),
    positiveFindingCount: z.number().int().nonnegative(),
    negativeFindingCount: z.number().int().nonnegative(),
    strongestPositiveStrength: EvidenceStrengthSchema.optional(),
    strongestNegativeStrength: EvidenceStrengthSchema.optional(),
  })
  .strict();
export type EvidenceEntitySummaryV1 = z.infer<typeof EvidenceEntitySummaryV1Schema>;

export const EvidenceFindingsArtifactV1Schema = z
  .object({
    schemaVersion: z.literal("1.0"),
    artifactKind: z.literal("evidence_findings.v1"),
    fixture: z.literal(true),
    warning: z.string().min(1),
    generatedAt: z.iso.datetime(),
    sourceArtifact: SourceArtifactReferenceSchema,
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
      ])
      .default("snippet_only"),
    materials: z.array(EvidenceMaterialV1Schema).default([]),
    extractionSummary: z
      .object({
        selectedPages: z.number().int().nonnegative(),
        successfulPages: z.number().int().nonnegative(),
        partialPages: z.number().int().nonnegative(),
        failedPages: z.number().int().nonnegative(),
        blockedPages: z.number().int().nonnegative(),
        structuredResources: z.number().int().nonnegative().default(0),
        structuredSections: z.number().int().nonnegative().default(0),
        structuredTables: z.number().int().nonnegative().default(0),
        structuredFootnotes: z.number().int().nonnegative().default(0),
        materialCount: z.number().int().nonnegative(),
      })
      .strict()
      .default({
        selectedPages: 0,
        successfulPages: 0,
        partialPages: 0,
        failedPages: 0,
        blockedPages: 0,
        structuredResources: 0,
        structuredSections: 0,
        structuredTables: 0,
        structuredFootnotes: 0,
        materialCount: 0,
      }),
    findings: z.array(EvidenceFindingV1Schema),
    entities: z.array(EvidenceEntitySummaryV1Schema),
    coverage: CoverageReportV2Schema,
    warnings: z.array(z.string().min(1)),
  })
  .strict();
export type EvidenceFindingsArtifactV1 = z.infer<typeof EvidenceFindingsArtifactV1Schema>;
