import { z } from "zod";

export const DiscoveryGoalSchema = z.enum([
  "customer_opportunities",
  "procurement_discovery",
  "evidence_collection",
  "source_mapping",
  "factual_research",
  "monitoring",
]);
export type DiscoveryGoal = z.infer<typeof DiscoveryGoalSchema>;

export const DiscoveryRequestModeSchema = z.enum(["free_only", "balanced", "paid_deep"]);
export type DiscoveryRequestMode = z.infer<typeof DiscoveryRequestModeSchema>;

export const ProviderPreferenceSchema = z.enum([
  "free_first",
  "paid_allowed",
  "paid_only",
  "manual_only",
  "fixture_only",
]);
export type ProviderPreference = z.infer<typeof ProviderPreferenceSchema>;

export const AnswerRequirementSchema = z.object({
  outputType: z.enum([
    "ranked_entities",
    "evidence_collection",
    "exhaustive_list",
    "source_map",
    "factual_answer",
    "comparison",
    "timeline",
    "trend",
    "monitoring_feed",
  ]),
  completenessTarget: z.enum(["best_effort", "high_recall", "high_precision", "balanced"]),
  evidenceRequirement: z.enum([
    "single_source",
    "multiple_sources",
    "official_source",
    "cross_verified",
  ]),
  maximumResults: z.number().int().positive().max(1000).optional(),
});
export type AnswerRequirement = z.infer<typeof AnswerRequirementSchema>;

const PrioritySchema = z.number().min(0).max(1);
export const RetrievalObjectiveSchema = z.object({
  recallPriority: PrioritySchema,
  precisionPriority: PrioritySchema,
  freshnessPriority: PrioritySchema,
  authorityPriority: PrioritySchema,
  diversityPriority: PrioritySchema,
});
export type RetrievalObjective = z.infer<typeof RetrievalObjectiveSchema>;

export const DiscoveryRequestV1Schema = z
  .object({
    schemaVersion: z.literal("1.0"),
    artifactKind: z.literal("discovery_request.v1"),
    requestId: z.string().min(1).optional(),
    goal: DiscoveryGoalSchema,
    description: z.string().trim().min(1),
    answerRequirement: AnswerRequirementSchema,
    retrievalObjective: RetrievalObjectiveSchema,
    subject: z.object({
      type: z.string().trim().min(1),
      name: z.string().trim().min(1).optional(),
      description: z.string().trim().min(1),
    }),
    targetEntityTypes: z.array(z.string().trim().min(1)).optional(),
    buyerHypotheses: z.array(z.string().trim().min(1)).optional(),
    geography: z
      .object({
        country: z.string().trim().min(1).optional(),
        region: z.string().trim().min(1).optional(),
        city: z.string().trim().min(1).optional(),
        road: z.string().trim().min(1).optional(),
        latitude: z.number().min(-90).max(90).optional(),
        longitude: z.number().min(-180).max(180).optional(),
        radiusKm: z.number().positive().max(20_000).optional(),
      })
      .optional(),
    temporal: z
      .object({
        intent: z.enum([
          "current",
          "historical",
          "change_detection",
          "timeline",
          "forecast_input",
          "monitoring",
        ]),
        startDate: z.iso.datetime().optional(),
        endDate: z.iso.datetime().optional(),
        maxAgeDays: z.number().int().positive().optional(),
      })
      .optional(),
    languages: z.array(z.string().trim().min(1)).optional(),
    exclusions: z.array(z.string().trim().min(1)).optional(),
    domainPackIds: z.array(z.string().trim().min(1)).optional(),
    discoveryMode: DiscoveryRequestModeSchema,
    providerPreference: ProviderPreferenceSchema,
  })
  .superRefine((value, context) => {
    const start = value.temporal?.startDate;
    const end = value.temporal?.endDate;
    if (start && end && Date.parse(start) > Date.parse(end)) {
      context.addIssue({
        code: "custom",
        path: ["temporal", "endDate"],
        message: "endDate must be on or after startDate",
      });
    }
  });

export type DiscoveryRequestV1 = z.infer<typeof DiscoveryRequestV1Schema>;
