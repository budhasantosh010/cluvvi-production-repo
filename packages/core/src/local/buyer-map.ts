import { z } from "zod";
import { EvidenceSignalTypeSchema, EvidenceStrengthSchema } from "./evidence-findings";
import { IdentityConfidenceSchema, ManualContactRouteV1Schema } from "./identity-enrichment";
import { SourceZoneSchema } from "./search-results";

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
    score: z.number().int().min(-8).max(20),
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
      })
      .strict(),
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
    nextPhase: z.literal("C1-G compatibility bridge or approved live-provider research"),
  })
  .strict();
export type ProjectBFinalizationArtifactV1 = z.infer<typeof ProjectBFinalizationArtifactV1Schema>;
