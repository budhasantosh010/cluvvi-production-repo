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
