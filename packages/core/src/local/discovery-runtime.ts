import { z } from "zod";
import { OpaqueIdSchema } from "./ids";
import { SearchMethodSchema, SourceZoneSchema } from "./search-results";

export const DiscoveryRuntimeModeSchema = z.enum(["fixture", "local_discovery_engine"]);
export type DiscoveryRuntimeMode = z.infer<typeof DiscoveryRuntimeModeSchema>;

export const DiscoveryProviderModeSchema = z.enum(["fixture_only", "live_search"]);
export type DiscoveryProviderMode = z.infer<typeof DiscoveryProviderModeSchema>;

export const DiscoveryProviderPolicySchema = z.enum(["free_only", "balanced", "paid_deep"]);
export type DiscoveryProviderPolicy = z.infer<typeof DiscoveryProviderPolicySchema>;

export const CluvviExtractionModeSchema = z.enum(["none", "selected_public_pages"]);
export type CluvviExtractionMode = z.infer<typeof CluvviExtractionModeSchema>;

export const LIVE_DISCOVERY_PROVIDER_IDS = [
  "hacker_news_algolia",
  "hacker_news_firebase",
  "searxng_search",
  "duckduckgo_html_search",
  "startpage_html_search",
  "tavily_search",
  "brave_web_search",
] as const;
export const LiveDiscoveryProviderIdSchema = z.enum(LIVE_DISCOVERY_PROVIDER_IDS);
export type LiveDiscoveryProviderId = z.infer<typeof LiveDiscoveryProviderIdSchema>;

export const LiveProviderExecutionRecordV1Schema = z
  .object({
    providerId: LiveDiscoveryProviderIdSchema,
    queryId: z.string().min(1),
    sourceZone: SourceZoneSchema,
    searchMethod: SearchMethodSchema,
    operation: z.enum(["search", "item_enrichment", "health"]),
    startedAt: z.iso.datetime(),
    completedAt: z.iso.datetime(),
    durationMs: z.number().int().nonnegative(),
    attempts: z.number().int().nonnegative(),
    statusCode: z.number().int().positive().optional(),
    resultsReceived: z.number().int().nonnegative(),
    resultsAccepted: z.number().int().nonnegative(),
    rateLimited: z.boolean(),
    success: z.boolean(),
    providerUsage: z
      .object({
        tavilyCredits: z.number().nonnegative().optional(),
        braveRequests: z.number().int().nonnegative().optional(),
        hnRequests: z.number().int().nonnegative().optional(),
        freeRequests: z.number().int().nonnegative().optional(),
      })
      .strict()
      .optional(),
    errorCode: z.string().min(1).optional(),
    safeErrorMessage: z.string().min(1).optional(),
  })
  .strict();
export type LiveProviderExecutionRecordV1 = z.infer<typeof LiveProviderExecutionRecordV1Schema>;

const LiveProviderBudgetEntrySchema = z
  .object({
    used: z.number().int().nonnegative(),
    limit: z.number().int().positive(),
  })
  .strict();

export const LiveProviderUsageV1Schema = z
  .object({
    tavilyRequests: z.number().int().nonnegative(),
    tavilyCredits: z.number().nonnegative(),
    braveRequests: z.number().int().nonnegative(),
    hackerNewsAlgoliaRequests: z.number().int().nonnegative(),
    hackerNewsFirebaseRequests: z.number().int().nonnegative(),
    searxngRequests: z.number().int().nonnegative().optional(),
    duckDuckGoRequests: z.number().int().nonnegative().optional(),
    startpageRequests: z.number().int().nonnegative().optional(),
  })
  .strict();
export type LiveProviderUsageV1 = z.infer<typeof LiveProviderUsageV1Schema>;

export const LiveProviderRunTelemetryV1Schema = z
  .object({
    schemaVersion: z.literal("1.0"),
    artifactKind: z.literal("live_provider_run_telemetry.v1"),
    requestId: z.string().min(1),
    providerMode: DiscoveryProviderModeSchema,
    configurationFingerprint: z.string().regex(/^[a-f0-9]{64}$/),
    generatedAt: z.iso.datetime(),
    providerExecutions: z.array(LiveProviderExecutionRecordV1Schema),
    budget: z
      .object({
        hacker_news_algolia: LiveProviderBudgetEntrySchema,
        hacker_news_firebase: LiveProviderBudgetEntrySchema,
        tavily_search: LiveProviderBudgetEntrySchema,
        brave_web_search: LiveProviderBudgetEntrySchema,
        searxng_search: LiveProviderBudgetEntrySchema.optional(),
        duckduckgo_html_search: LiveProviderBudgetEntrySchema.optional(),
        startpage_html_search: LiveProviderBudgetEntrySchema.optional(),
      })
      .strict(),
    usage: LiveProviderUsageV1Schema,
    warnings: z.array(z.string().min(1)),
  })
  .strict();
export type LiveProviderRunTelemetryV1 = z.infer<typeof LiveProviderRunTelemetryV1Schema>;

export const ProviderPolicyAttemptV1Schema = z
  .object({
    providerId: z.string().min(1),
    order: z.number().int().positive(),
    attempted: z.boolean(),
    skippedReason: z.string().min(1).optional(),
    outcome: z.enum([
      "success",
      "zero_results",
      "insufficient_coverage",
      "failed",
      "blocked_by_policy",
      "budget_exhausted",
    ]),
    acceptedResults: z.number().int().nonnegative(),
    uniqueDomains: z.number().int().nonnegative(),
    duplicateRatio: z.number().min(0).max(1),
    paid: z.boolean(),
    safeFailureCode: z.string().min(1).optional(),
  })
  .strict();

export const ProviderPolicyQueryTraceV1Schema = z
  .object({
    queryId: z.string().min(1),
    sourceZone: SourceZoneSchema,
    searchMethod: SearchMethodSchema,
    attempts: z.array(ProviderPolicyAttemptV1Schema),
    finalDecision: z.enum([
      "sufficient_free_coverage",
      "incomplete_free_coverage",
      "paid_fallback_used",
      "all_providers_failed",
    ]),
    paidFallbackReason: z.string().min(1).optional(),
  })
  .strict();

export const ProviderPolicyTraceV1Schema = z
  .object({
    schemaVersion: z.literal("1.0"),
    artifactKind: z.literal("provider_policy_trace.v1"),
    requestId: z.string().min(1),
    providerPolicy: DiscoveryProviderPolicySchema,
    queries: z.array(ProviderPolicyQueryTraceV1Schema),
    paidProviderAttempted: z.boolean(),
    paidFallbackUsed: z.boolean(),
    warnings: z.array(z.string().min(1)),
  })
  .strict();
export type ProviderPolicyTraceV1 = z.infer<typeof ProviderPolicyTraceV1Schema>;

export const LocalDiscoveryExecutionRecordV1Schema = z
  .object({
    schemaVersion: z.literal("1.0"),
    artifactKind: z.literal("local_discovery_execution.v1"),
    runId: OpaqueIdSchema,
    requestId: z.string().min(1),
    projectPath: z.string().min(1),
    projectCommitSha: z
      .string()
      .regex(/^[a-f0-9]{40}$/)
      .optional(),
    command: z.string().min(1),
    arguments: z.array(z.string()),
    providerMode: DiscoveryProviderModeSchema.default("fixture_only"),
    providerPolicy: DiscoveryProviderPolicySchema.default("free_only"),
    extractionMode: CluvviExtractionModeSchema.default("none"),
    maximumExtractions: z.number().int().min(1).max(100).default(8),
    startedAt: z.iso.datetime({ offset: true }),
    completedAt: z.iso.datetime({ offset: true }).optional(),
    durationMs: z.number().int().nonnegative().optional(),
    exitCode: z.number().int().optional(),
    timedOut: z.boolean(),
    cancelled: z.boolean(),
    requestPath: z.string().min(1),
    outputPath: z.string().min(1),
    stdoutPath: z.string().min(1),
    stderrPath: z.string().min(1),
    providerTelemetryPath: z.string().min(1).optional(),
    providerTelemetryImported: z.boolean().default(false),
    providerPolicyTracePath: z.string().min(1).optional(),
    providerPolicyTraceImported: z.boolean().default(false),
    frontierPath: z.string().min(1).optional(),
    frontierImported: z.boolean().default(false),
    extractedContentPath: z.string().min(1).optional(),
    extractedContentImported: z.boolean().default(false),
    extractionTelemetryPath: z.string().min(1).optional(),
    extractionTelemetryImported: z.boolean().default(false),
    providerConfigurationFingerprint: z
      .string()
      .regex(/^[a-f0-9]{64}$/)
      .optional(),
    providerUsage: LiveProviderUsageV1Schema.optional(),
    providerWarnings: z.array(z.string().min(1)).optional(),
    providerIds: z.array(z.string().min(1)).optional(),
    success: z.boolean(),
    errorCode: z.string().min(1).optional(),
    errorMessage: z.string().min(1).optional(),
  })
  .strict();
export type LocalDiscoveryExecutionRecordV1 = z.infer<typeof LocalDiscoveryExecutionRecordV1Schema>;
