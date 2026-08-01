import { z } from "zod";
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
    findings: z.array(EvidenceFindingV1Schema),
    entities: z.array(EvidenceEntitySummaryV1Schema),
    coverage: CoverageReportV2Schema,
    warnings: z.array(z.string().min(1)),
  })
  .strict();
export type EvidenceFindingsArtifactV1 = z.infer<typeof EvidenceFindingsArtifactV1Schema>;
