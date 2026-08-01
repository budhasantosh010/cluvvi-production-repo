import { z } from "zod";

export const PROJECT_B_FIXTURE_WARNING =
  "Fixture example only. This is not live discovery data and does not represent real customers or complete market coverage.";

export const DiscoveryModeSchema = z.enum(["free_only", "balanced", "paid_deep"]);
export type DiscoveryMode = z.infer<typeof DiscoveryModeSchema>;

export const DiscoveryProviderCategorySchema = z.enum(["free", "paid", "manual", "fixture"]);
export type DiscoveryProviderCategory = z.infer<typeof DiscoveryProviderCategorySchema>;

export const DiscoverySourceTypeV1Schema = z.enum([
  "search_web",
  "reddit",
  "hacker_news",
  "product_hunt",
  "job_posts",
  "reviews",
  "company_websites",
  "linkedin_manual",
]);
export type DiscoverySourceTypeV1 = z.infer<typeof DiscoverySourceTypeV1Schema>;

const CustomValueSchema = z.string().regex(/^custom:.+$/, "Custom values must use custom:<value>.");

export const SourceZoneSchema = z.union([
  z.enum([
    "general_web",
    "search_results",
    "company_websites",
    "forums_communities",
    "social_posts",
    "deep_comments",
    "job_boards",
    "freelance_marketplaces",
    "review_sites",
    "app_marketplaces",
    "business_directories",
    "maps_local",
    "events_associations",
    "industry_publications",
    "news_media",
    "procurement_tenders",
    "rfp_award_databases",
    "public_records",
    "permits_licenses_inspections",
    "regulatory_compliance",
    "legal_court_records",
    "funding_grants_budgets",
    "research_patents_trials",
    "academic_lab_pages",
    "standards_bodies",
    "certification_databases",
    "supply_chain_vendor",
    "equipment_marketplaces",
    "import_export_trade_data",
    "developer_ecosystem",
    "datasets_databases",
    "satellite_geospatial_sources",
    "private_manual_sources",
  ]),
  CustomValueSchema,
]);
export type SourceZone = z.infer<typeof SourceZoneSchema>;

export const SearchMethodSchema = z.union([
  z.enum([
    "keyword_search",
    "site_search",
    "structured_filter",
    "public_api",
    "website_fetch",
    "directory_lookup",
    "manual_review",
  ]),
  CustomValueSchema,
]);
export type SearchMethod = z.infer<typeof SearchMethodSchema>;

export const SignalIntentSchema = z.union([
  z.enum([
    "direct_purchase",
    "hiring",
    "procurement",
    "complaint",
    "recommendation_request",
    "competitor_switching",
    "manual_workaround",
    "expansion",
    "negative_evidence",
    "general_relevance",
  ]),
  CustomValueSchema,
]);
export type SignalIntent = z.infer<typeof SignalIntentSchema>;

export const NormalizedDiscoveryResultV1Schema = z
  .object({
    id: z.string().min(1),
    queryId: z.string().min(1),
    query: z.string().min(1),
    providerId: z.string().min(1),
    providerCategory: DiscoveryProviderCategorySchema,
    sourceType: DiscoverySourceTypeV1Schema,
    title: z.string().min(1),
    snippet: z.string().min(1),
    url: z.url(),
    authorOrCompany: z.string().min(1).optional(),
    domain: z.string().min(1).optional(),
    publishedAt: z.iso.datetime().optional(),
    discoveredAt: z.iso.datetime(),
    language: z.string().min(1).optional(),
    country: z.string().min(1).optional(),
    raw: z.unknown().optional(),
  })
  .strict();
export type NormalizedDiscoveryResultV1 = z.infer<typeof NormalizedDiscoveryResultV1Schema>;

const SearchSummarySchema = z
  .object({
    queriesPlanned: z.number().int().nonnegative(),
    queriesExecuted: z.number().int().nonnegative(),
    providersUsed: z.array(z.string().min(1)),
    rawResults: z.number().int().nonnegative(),
    dedupedResults: z.number().int().nonnegative(),
    paidCreditsUsed: z.number().nonnegative(),
    startedAt: z.iso.datetime(),
    completedAt: z.iso.datetime(),
  })
  .strict();

export const SearchResultsArtifactV1Schema = z
  .object({
    schemaVersion: z.literal("1.0"),
    artifactKind: z.literal("search_results.v1"),
    discoveryMode: DiscoveryModeSchema,
    summary: SearchSummarySchema,
    providerBreakdown: z.array(
      z
        .object({
          providerId: z.string().min(1),
          providerCategory: DiscoveryProviderCategorySchema,
          sourceType: DiscoverySourceTypeV1Schema,
          queriesExecuted: z.number().int().nonnegative(),
          resultsReturned: z.number().int().nonnegative(),
          errors: z.number().int().nonnegative(),
        })
        .strict(),
    ),
    results: z.array(NormalizedDiscoveryResultV1Schema),
    warnings: z.array(z.string().min(1)),
  })
  .strict()
  .superRefine((value, context) => {
    if (value.summary.queriesExecuted > value.summary.queriesPlanned) {
      context.addIssue({
        code: "custom",
        path: ["summary", "queriesExecuted"],
        message: "queriesExecuted cannot exceed queriesPlanned.",
      });
    }
    if (value.summary.dedupedResults !== value.results.length) {
      context.addIssue({
        code: "custom",
        path: ["summary", "dedupedResults"],
        message: "dedupedResults must equal results.length.",
      });
    }
  });
export type SearchResultsArtifactV1 = z.infer<typeof SearchResultsArtifactV1Schema>;

export const NormalizedDiscoveryResultV2Schema = z
  .object({
    id: z.string().min(1),
    queryId: z.string().min(1),
    query: z.string().min(1),
    providerId: z.string().min(1),
    providerCategory: DiscoveryProviderCategorySchema,
    discoveryGoal: z.string().min(1),
    searchMethod: SearchMethodSchema,
    sourceZone: SourceZoneSchema,
    signalIntent: SignalIntentSchema,
    title: z.string().min(1),
    snippet: z.string().min(1),
    url: z.url(),
    domain: z.string().min(1).optional(),
    authorOrCompany: z.string().min(1).optional(),
    publishedAt: z.iso.datetime().optional(),
    discoveredAt: z.iso.datetime(),
    language: z.string().min(1).optional(),
    country: z.string().min(1).optional(),
    region: z.string().min(1).optional(),
    city: z.string().min(1).optional(),
    credibility: z.enum(["low", "medium", "high", "official"]).optional(),
    riskLevel: z.enum(["low", "medium", "high"]).optional(),
    raw: z.unknown().optional(),
  })
  .strict();
export type NormalizedDiscoveryResultV2 = z.infer<typeof NormalizedDiscoveryResultV2Schema>;

export const CoverageReportV2Schema = z
  .object({
    searchedSourceZones: z.array(SourceZoneSchema),
    skippedSourceZones: z.array(
      z
        .object({
          sourceZone: SourceZoneSchema,
          reason: z.string().min(1),
        })
        .strict(),
    ),
    providersUsed: z.array(z.string().min(1)),
    providersUnavailable: z.array(z.string().min(1)),
    manualReviewRecommended: z.array(
      z
        .object({
          sourceZone: SourceZoneSchema,
          reason: z.string().min(1),
          suggestedAction: z.string().min(1),
        })
        .strict(),
    ),
    confidenceLimitations: z.array(z.string().min(1)),
    nextBestSearches: z.array(z.string().min(1)),
  })
  .strict();
export type CoverageReportV2 = z.infer<typeof CoverageReportV2Schema>;

export const ProviderBreakdownV2Schema = z
  .object({
    providerId: z.string().min(1),
    providerCategory: DiscoveryProviderCategorySchema,
    sourceZone: SourceZoneSchema,
    searchMethod: SearchMethodSchema,
    queriesExecuted: z.number().int().nonnegative(),
    resultsReturned: z.number().int().nonnegative(),
    errors: z.number().int().nonnegative(),
  })
  .strict();
export type ProviderBreakdownV2 = z.infer<typeof ProviderBreakdownV2Schema>;

export const SearchResultsArtifactV2Schema = z
  .object({
    schemaVersion: z.literal("2.0"),
    artifactKind: z.literal("search_results.v2"),
    requestId: z.string().min(1),
    discoveryGoal: z.string().min(1),
    discoveryMode: DiscoveryModeSchema,
    domainPackIds: z.array(z.string().min(1)),
    summary: SearchSummarySchema,
    providerBreakdown: z.array(ProviderBreakdownV2Schema),
    results: z.array(NormalizedDiscoveryResultV2Schema),
    coverage: CoverageReportV2Schema,
    warnings: z.array(z.string().min(1)),
  })
  .strict()
  .superRefine((value, context) => {
    if (value.summary.queriesExecuted > value.summary.queriesPlanned) {
      context.addIssue({
        code: "custom",
        path: ["summary", "queriesExecuted"],
        message: "queriesExecuted cannot exceed queriesPlanned.",
      });
    }
    if (value.summary.dedupedResults !== value.results.length) {
      context.addIssue({
        code: "custom",
        path: ["summary", "dedupedResults"],
        message: "dedupedResults must equal results.length.",
      });
    }
  });
export type SearchResultsArtifactV2 = z.infer<typeof SearchResultsArtifactV2Schema>;
