import { z } from "zod";

export const IdentityConfidenceSchema = z.enum(["low", "medium", "high"]);
export type IdentityConfidence = z.infer<typeof IdentityConfidenceSchema>;

export const ManualContactRouteV1Schema = z
  .object({
    type: z.enum(["company_website", "public_directory", "manual_research"]),
    label: z.string().min(1),
    url: z
      .url()
      .refine((value) => /^https?:\/\//.test(value), "Only public HTTP(S) URLs are allowed.")
      .optional(),
    instructions: z.string().min(1),
  })
  .strict();
export type ManualContactRouteV1 = z.infer<typeof ManualContactRouteV1Schema>;

export const BuyerHypothesisV1Schema = z
  .object({
    id: z.string().min(1),
    entityKey: z.string().min(1),
    companyName: z.string().min(1),
    companyDomain: z.string().min(1).optional(),
    likelyDepartment: z.string().min(1),
    likelyDecisionMakerTitles: z.array(z.string().min(1)).min(1),
    confidence: IdentityConfidenceSchema,
    rationale: z.string().min(1),
    sourceResultIds: z.array(z.string().min(1)).min(1),
    evidenceFindingIds: z.array(z.string().min(1)).min(1),
    developerIdentityEvidence: z
      .object({
        observedRepositoryFindingIds: z.array(z.string().min(1)),
        observedThreadFindingIds: z.array(z.string().min(1)),
        observedCommentFindingIds: z.array(z.string().min(1)),
        observedReleaseFindingIds: z.array(z.string().min(1)),
        inferredSignalFindingIds: z.array(z.string().min(1)),
        confidence: z.enum(["low", "medium", "high"]),
        conservativeMatch: z.literal(true),
        developerIdentityUsed: z.literal(false),
        limitations: z.array(z.string().min(1)).min(1),
      })
      .strict()
      .optional(),
    videoIdentityEvidence: z
      .object({
        observedVideoFindingIds: z.array(z.string().min(1)),
        observedTranscriptFindingIds: z.array(z.string().min(1)),
        observedCommentFindingIds: z.array(z.string().min(1)),
        inferredSignalFindingIds: z.array(z.string().min(1)),
        confidence: z.enum(["low", "medium", "high"]),
        conservativeMatch: z.literal(true),
        creatorIdentityUsed: z.literal(false),
        commentAuthorIdentityUsed: z.literal(false),
        limitations: z.array(z.string().min(1)).min(1),
      })
      .strict()
      .optional(),
    specializedIdentityEvidence: z
      .object({
        observedFindingIds: z.array(z.string().min(1)),
        inferredSignalFindingIds: z.array(z.string().min(1)),
        observedSourceDomains: z.array(z.string().min(1)),
        confidence: z.enum(["low", "medium", "high"]),
        conservativeMatch: z.literal(true),
        publisherIdentityUsed: z.literal(false),
        limitations: z.array(z.string().min(1)).min(1),
      })
      .strict()
      .optional(),
    communityIdentityEvidence: z
      .object({
        observedThreadFindingIds: z.array(z.string().min(1)),
        observedCommentFindingIds: z.array(z.string().min(1)),
        inferredSignalFindingIds: z.array(z.string().min(1)),
        confidence: z.enum(["low", "medium", "high"]),
        conservativeMatch: z.literal(true),
        userIdentityUsed: z.literal(false),
        limitations: z.array(z.string().min(1)).min(1),
      })
      .strict()
      .optional(),
    hiringIdentityEvidence: z
      .object({
        observedJobFindingIds: z.array(z.string().min(1)),
        inferredSignalFindingIds: z.array(z.string().min(1)),
        companyName: z.string().min(1).optional(),
        companyDomain: z.string().min(1).optional(),
        confidence: z.enum(["low", "medium", "high"]),
        conservativeMatch: z.literal(true),
        limitations: z.array(z.string().min(1)).min(1),
      })
      .strict()
      .optional(),
  })
  .strict();
export type BuyerHypothesisV1 = z.infer<typeof BuyerHypothesisV1Schema>;

export const BuyerHypothesesArtifactV1Schema = z
  .object({
    schemaVersion: z.literal("1.0"),
    artifactKind: z.literal("buyer_hypotheses.v1"),
    fixture: z.literal(true),
    warning: z.string().min(1),
    generatedAt: z.iso.datetime(),
    sourceArtifactKind: z.literal("evidence_findings.v1"),
    hypotheses: z.array(BuyerHypothesisV1Schema),
    warnings: z.array(z.string().min(1)),
  })
  .strict();
export type BuyerHypothesesArtifactV1 = z.infer<typeof BuyerHypothesesArtifactV1Schema>;

export const IdentityHypothesisV1Schema = BuyerHypothesisV1Schema.extend({
  manualContactRoute: ManualContactRouteV1Schema,
}).strict();
export type IdentityHypothesisV1 = z.infer<typeof IdentityHypothesisV1Schema>;

export const IdentityEnrichmentArtifactV1Schema = z
  .object({
    schemaVersion: z.literal("1.0"),
    artifactKind: z.literal("identity_enrichment.v1"),
    fixture: z.literal(true),
    warning: z.string().min(1),
    generatedAt: z.iso.datetime(),
    sourceArtifactKind: z.literal("buyer_hypotheses.v1"),
    hypotheses: z.array(IdentityHypothesisV1Schema),
    fabricatedContacts: z.literal(false),
    publicManualRoutesOnly: z.literal(true),
    warnings: z.array(z.string().min(1)),
  })
  .strict();
export type IdentityEnrichmentArtifactV1 = z.infer<typeof IdentityEnrichmentArtifactV1Schema>;
