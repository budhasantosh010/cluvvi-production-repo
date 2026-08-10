import { z } from "zod";
import { IdentityConfidenceSchema, ManualContactRouteV1Schema } from "./identity-enrichment";

export const RankingComponentKeySchema = z.enum([
  "clear_pain",
  "recent_signal",
  "related_hiring",
  "competitor_or_workaround",
  "clear_company",
  "decision_maker_route",
  "exclusion_conflict",
  "weak_or_stale_signal",
]);
export type RankingComponentKey = z.infer<typeof RankingComponentKeySchema>;

export const RankingScoreComponentV1Schema = z
  .object({
    key: RankingComponentKeySchema,
    applied: z.boolean(),
    points: z.number().int().min(-5).max(5),
    reason: z.string().min(1),
  })
  .strict();
export type RankingScoreComponentV1 = z.infer<typeof RankingScoreComponentV1Schema>;

export const RankedOpportunityV1Schema = z
  .object({
    id: z.string().min(1),
    rank: z.number().int().positive(),
    entityKey: z.string().min(1),
    companyName: z.string().min(1),
    companyDomain: z.string().min(1).optional(),
    score: z.number().int().min(-8).max(23),
    confidence: IdentityConfidenceSchema,
    scoreComponents: z.array(RankingScoreComponentV1Schema).length(8),
    communityContribution: z
      .object({
        applied: z.boolean(),
        points: z.number().int().min(0).max(1),
        maximumShareOfPositiveScore: z.literal(0.08),
        rationale: z.string().min(1),
        independentThreadCount: z.number().int().nonnegative(),
      })
      .strict(),
    developerContribution: z
      .object({
        applied: z.boolean(),
        points: z.number().int().min(0).max(1),
        maximumShareOfPositiveScore: z.literal(0.08),
        rationale: z.string().min(1),
        independentRepositoryCount: z.number().int().nonnegative(),
        independentThreadCount: z.number().int().nonnegative(),
      })
      .strict(),
    videoContribution: z
      .object({
        applied: z.boolean(),
        points: z.number().int().min(0).max(1),
        maximumShareOfPositiveScore: z.literal(0.08),
        rationale: z.string().min(1),
        independentVideoCount: z.number().int().nonnegative(),
        independentChannelCount: z.number().int().nonnegative(),
      })
      .strict(),
    specializedContribution: z
      .object({
        applied: z.boolean(),
        points: z.number().int().min(0).max(1),
        maximumShareOfPositiveScore: z.literal(0.08),
        rationale: z.string().min(1),
        independentSourceCount: z.number().int().nonnegative(),
      })
      .strict(),
    hiringContribution: z
      .object({
        applied: z.boolean(),
        points: z.number().int().min(0).max(1),
        maximumShareOfPositiveScore: z.literal(0.08),
        rationale: z.string().min(1),
      })
      .strict(),
    evidenceSummary: z.string().min(1),
    positiveEvidenceFindingIds: z.array(z.string().min(1)),
    negativeEvidenceFindingIds: z.array(z.string().min(1)),
    identityHypothesisId: z.string().min(1),
    manualContactRoute: ManualContactRouteV1Schema,
    risks: z.array(z.string().min(1)),
    limitations: z.array(z.string().min(1)),
  })
  .strict();
export type RankedOpportunityV1 = z.infer<typeof RankedOpportunityV1Schema>;

export const RankedOpportunitiesArtifactV1Schema = z
  .object({
    schemaVersion: z.literal("1.0"),
    artifactKind: z.literal("ranked_opportunities.v1"),
    fixture: z.literal(true),
    warning: z.string().min(1),
    generatedAt: z.iso.datetime(),
    scoringVersion: z.literal("project-b-scorecard.v1"),
    opportunities: z.array(RankedOpportunityV1Schema),
    warnings: z.array(z.string().min(1)),
  })
  .strict();
export type RankedOpportunitiesArtifactV1 = z.infer<typeof RankedOpportunitiesArtifactV1Schema>;
