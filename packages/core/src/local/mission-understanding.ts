import { z } from "zod";

export const MissionUnderstandingSalesMotionSchema = z.enum([
  "founder_led",
  "self_serve",
  "sales_led",
  "agency_service",
  "unknown",
]);
export type MissionUnderstandingSalesMotion = z.infer<typeof MissionUnderstandingSalesMotionSchema>;

export const MissionUnderstandingSourceTypeSchema = z.enum([
  "reddit",
  "hacker_news",
  "product_hunt",
  "job_posts",
  "reviews",
  "company_websites",
  "search_web",
  "linkedin_manual",
]);
export type MissionUnderstandingSourceType = z.infer<typeof MissionUnderstandingSourceTypeSchema>;

export const MissionUnderstandingPrioritySchema = z.enum(["high", "medium", "low"]);
export type MissionUnderstandingPriority = z.infer<typeof MissionUnderstandingPrioritySchema>;

const InputSummaryPriceSchema = z
  .object({
    minimum: z.number().finite().nonnegative().optional(),
    maximum: z.number().finite().nonnegative().optional(),
    currency: z.string().trim().length(3).optional(),
    billingPeriod: z.string().trim().min(1).optional(),
  })
  .strict();

const BuyerHypothesisSchema = z
  .object({
    id: z.string().trim().min(1).max(80),
    label: z.string().trim().min(1).max(180),
    whyTheyMightNeedIt: z.string().trim().min(1).max(1_000),
    likelyBuyerTitles: z.array(z.string().trim().min(1).max(120)).min(1).max(12),
    likelyUserTitles: z.array(z.string().trim().min(1).max(120)).min(1).max(12),
    confidence: z.number().finite().min(0).max(1),
    searchModifiers: z.array(z.string().trim().min(1).max(160)).min(1).max(20),
  })
  .strict();

const IntentSignalSchema = z
  .object({
    label: z.string().trim().min(1).max(120),
    description: z.string().trim().min(1).max(1_000),
    examplePhrases: z.array(z.string().trim().min(1).max(240)).min(1).max(12),
    scoreWeight: z.number().int().min(1).max(5),
  })
  .strict();

const SourcePlanEntrySchema = z
  .object({
    sourceType: MissionUnderstandingSourceTypeSchema,
    priority: MissionUnderstandingPrioritySchema,
    reason: z.string().trim().min(1).max(1_000),
  })
  .strict();

const SearchQuerySchema = z
  .object({
    id: z.string().trim().min(1).max(80),
    query: z.string().trim().min(1).max(500),
    sourceType: MissionUnderstandingSourceTypeSchema,
    buyerHypothesisId: z.string().trim().min(1).max(80).optional(),
    intentSignal: z.string().trim().min(1).max(120).optional(),
    priority: MissionUnderstandingPrioritySchema,
  })
  .strict();

const REQUIRED_SOURCE_TYPES: readonly MissionUnderstandingSourceType[] = [
  "reddit",
  "job_posts",
  "search_web",
  "company_websites",
];

export const MissionUnderstandingArtifactV1Schema = z
  .object({
    schemaVersion: z.literal("1.0"),
    artifactKind: z.literal("mission_understanding.v1"),
    inputSummary: z
      .object({
        description: z.string().trim().min(20).max(20_000),
        website: z.url({ protocol: /^https?$/ }).optional(),
        geographies: z.array(z.string().trim().min(1).max(120)).min(1).max(50),
        desiredOpportunities: z.number().int().min(1).max(100),
        price: InputSummaryPriceSchema.optional(),
      })
      .strict(),
    productUnderstanding: z
      .object({
        productCategory: z.string().trim().min(1).max(240),
        conciseValueProposition: z.string().trim().min(1).max(1_000),
        customerOutcome: z.string().trim().min(1).max(2_000).optional(),
        likelySalesMotion: MissionUnderstandingSalesMotionSchema,
        confidence: z.number().finite().min(0).max(1),
      })
      .strict(),
    buyerHypotheses: z.array(BuyerHypothesisSchema).min(3).max(8),
    painKeywords: z.array(z.string().trim().min(1).max(180)).min(5).max(50),
    intentSignals: z.array(IntentSignalSchema).min(8).max(20),
    competitorOrWorkaroundKeywords: z.array(z.string().trim().min(1).max(180)).min(3).max(50),
    exclusionKeywords: z.array(z.string().trim().min(1).max(300)).max(100),
    sourcePlan: z.array(SourcePlanEntrySchema).min(4).max(20),
    searchQueries: z.array(SearchQuerySchema).min(25).max(60),
    risksAndUnknowns: z.array(z.string().trim().min(1).max(1_000)).min(1).max(30),
    nextSteps: z.array(z.string().trim().min(1).max(1_000)).min(1).max(20),
  })
  .strict()
  .superRefine((artifact, context) => {
    const normalizedQueries = artifact.searchQueries.map((entry) => entry.query.toLowerCase());
    if (new Set(normalizedQueries).size !== normalizedQueries.length) {
      context.addIssue({
        code: "custom",
        path: ["searchQueries"],
        message: "Search query strings must be unique after case normalization.",
      });
    }

    const sourceTypes = new Set(artifact.sourcePlan.map((entry) => entry.sourceType));
    for (const requiredSourceType of REQUIRED_SOURCE_TYPES) {
      if (!sourceTypes.has(requiredSourceType)) {
        context.addIssue({
          code: "custom",
          path: ["sourcePlan"],
          message: `Source plan must include ${requiredSourceType}.`,
        });
      }
    }
  });

export type MissionUnderstandingArtifactV1 = z.infer<typeof MissionUnderstandingArtifactV1Schema>;
