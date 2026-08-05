import { z } from "zod";

export const CrawlFrontierStatusSchema = z.enum([
  "selected",
  "skipped",
  "blocked",
  "manual_required",
]);
export type CrawlFrontierStatus = z.infer<typeof CrawlFrontierStatusSchema>;

const PriorityComponentsSchema = z
  .object({
    queryMatch: z.number().min(0).max(1),
    sourceCredibility: z.number().min(0).max(1),
    freshness: z.number().min(0).max(1),
    entitySpecificity: z.number().min(0).max(1),
    signalStrength: z.number().min(0).max(1),
    novelty: z.number().min(0).max(1),
    extractionCostPenalty: z.number().min(0).max(1),
    platformRiskPenalty: z.number().min(0).max(1),
    duplicationPenalty: z.number().min(0).max(1),
  })
  .strict();

export const CrawlFrontierItemV1Schema = z
  .object({
    frontierItemId: z.string().min(1),
    sourceResultId: z.string().min(1),
    originalUrl: z.string().min(1),
    canonicalUrl: z.url().optional(),
    domain: z.string().min(1).optional(),
    sourceZone: z.string().min(1),
    signalIntent: z.string().min(1),
    searchMethod: z.string().min(1),
    priority: z.number().min(0).max(1),
    priorityComponents: PriorityComponentsSchema,
    selectionReasons: z.array(z.string().min(1)),
    depth: z.literal(0),
    status: CrawlFrontierStatusSchema,
    skipOrBlockCode: z.string().min(1).optional(),
    riskLevel: z.enum(["low", "medium", "high"]),
    discoveredAt: z.iso.datetime(),
  })
  .strict();
export type CrawlFrontierItemV1 = z.infer<typeof CrawlFrontierItemV1Schema>;

export const CrawlFrontierArtifactV1Schema = z
  .object({
    schemaVersion: z.literal("1.0"),
    artifactKind: z.literal("crawl_frontier.v1"),
    artifactId: z.string().min(1),
    requestId: z.string().min(1),
    searchResultsDigest: z.string().regex(/^[a-f0-9]{64}$/),
    extractionMode: z.literal("selected_public_pages"),
    selectionPolicy: z
      .object({
        maximumUrls: z.number().int().positive(),
        maximumUrlsPerQuery: z.number().int().positive(),
        maximumUrlsPerDomain: z.number().int().positive(),
        minimumPriority: z.number().min(0).max(1),
        maximumDepth: z.literal(0),
      })
      .strict(),
    summary: z
      .object({
        candidatesEvaluated: z.number().int().nonnegative(),
        eligibleCandidates: z.number().int().nonnegative(),
        selected: z.number().int().nonnegative(),
        skipped: z.number().int().nonnegative(),
        blocked: z.number().int().nonnegative(),
      })
      .strict(),
    items: z.array(CrawlFrontierItemV1Schema),
    warnings: z.array(z.string().min(1)),
  })
  .strict()
  .superRefine((value, context) => {
    const ids = new Set<string>();
    for (const [index, item] of value.items.entries()) {
      if (ids.has(item.frontierItemId)) {
        context.addIssue({
          code: "custom",
          path: ["items", index, "frontierItemId"],
          message: "frontierItemId values must be unique",
        });
      }
      ids.add(item.frontierItemId);
    }
    const selected = value.items.filter((item) => item.status === "selected").length;
    const blocked = value.items.filter((item) => item.status === "blocked").length;
    const skipped = value.items.filter(
      (item) => item.status === "skipped" || item.status === "manual_required",
    ).length;
    if (value.summary.candidatesEvaluated !== value.items.length) {
      context.addIssue({
        code: "custom",
        path: ["summary", "candidatesEvaluated"],
        message: "candidatesEvaluated must equal items.length",
      });
    }
    if (value.summary.selected !== selected) {
      context.addIssue({
        code: "custom",
        path: ["summary", "selected"],
        message: "selected count mismatch",
      });
    }
    if (value.summary.blocked !== blocked) {
      context.addIssue({
        code: "custom",
        path: ["summary", "blocked"],
        message: "blocked count mismatch",
      });
    }
    if (value.summary.skipped !== skipped) {
      context.addIssue({
        code: "custom",
        path: ["summary", "skipped"],
        message: "skipped count mismatch",
      });
    }
  });
export type CrawlFrontierArtifactV1 = z.infer<typeof CrawlFrontierArtifactV1Schema>;
