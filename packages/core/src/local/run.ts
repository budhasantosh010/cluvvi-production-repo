import { z } from "zod";
import {
  CluvviExtractionModeSchema,
  CluvviSourceAdapterModeSchema,
  CluvviSourceFamilySchema,
  CluvviStructuredContentModeSchema,
  DiscoveryProviderModeSchema,
  DiscoveryProviderPolicySchema,
  DiscoveryRuntimeModeSchema,
} from "./discovery-runtime";
import { OpaqueIdSchema } from "./ids";

export const LocalRunStatusSchema = z.enum([
  "created",
  "running",
  "paused",
  "failed",
  "budget_exhausted",
  "cancelled",
  "completed",
]);
export type LocalRunStatus = z.infer<typeof LocalRunStatusSchema>;

export const RunPhaseSchema = z.enum([
  "mission",
  "compilation",
  "source_planning",
  "discovery",
  "frontier",
  "extraction",
  "extraction_telemetry",
  "structured_parsing",
  "content_parse_telemetry",
  "source_targeting",
  "hiring_retrieval",
  "hiring_analysis",
  "source_adapter_telemetry",
  "community_planning",
  "community_retrieval",
  "community_thread_context",
  "community_comment_retrieval",
  "community_comment_context",
  "community_analysis",
  "community_source_telemetry",
  "developer_planning",
  "developer_repository_retrieval",
  "developer_thread_retrieval",
  "developer_thread_context",
  "developer_comment_retrieval",
  "developer_comment_context",
  "developer_analysis",
  "developer_source_telemetry",
  "normalization",
  "investigation",
  "buyer_identification",
  "enrichment",
  "ranking",
  "review",
  "finalization",
]);
export type LocalRunPhase = z.infer<typeof RunPhaseSchema>;

export const ORDERED_RUN_PHASES: readonly LocalRunPhase[] = RunPhaseSchema.options;

export const StageExecutionStatusSchema = z.enum([
  "pending",
  "running",
  "completed",
  "failed",
  "skipped",
]);
export type StageExecutionStatus = z.infer<typeof StageExecutionStatusSchema>;

export const RunBudgetSchema = z
  .object({
    maximumCostUsd: z.number().finite().nonnegative(),
    maximumLlmInputTokens: z.number().int().nonnegative(),
    maximumLlmOutputTokens: z.number().int().nonnegative(),
    maximumSearchCalls: z.number().int().nonnegative(),
    maximumFetchCalls: z.number().int().nonnegative(),
    maximumEnrichmentCalls: z.number().int().nonnegative(),
    maximumCandidates: z.number().int().positive(),
    maximumInvestigations: z.number().int().positive(),
    maximumRuntimeMinutes: z.number().int().positive(),
  })
  .strict();
export type RunBudget = z.infer<typeof RunBudgetSchema>;

export const DEFAULT_RUN_BUDGET: RunBudget = {
  maximumCostUsd: 15,
  maximumLlmInputTokens: 400_000,
  maximumLlmOutputTokens: 120_000,
  maximumSearchCalls: 40,
  maximumFetchCalls: 300,
  maximumEnrichmentCalls: 40,
  maximumCandidates: 500,
  maximumInvestigations: 80,
  maximumRuntimeMinutes: 120,
};

export const RunUsageSchema = z
  .object({
    costUsd: z.number().finite().nonnegative(),
    llmInputTokens: z.number().int().nonnegative(),
    llmOutputTokens: z.number().int().nonnegative(),
    searchCalls: z.number().int().nonnegative(),
    fetchCalls: z.number().int().nonnegative(),
    enrichmentCalls: z.number().int().nonnegative(),
  })
  .strict();
export type RunUsage = z.infer<typeof RunUsageSchema>;

export const EMPTY_RUN_USAGE: RunUsage = {
  costUsd: 0,
  llmInputTokens: 0,
  llmOutputTokens: 0,
  searchCalls: 0,
  fetchCalls: 0,
  enrichmentCalls: 0,
};

export const RunFailureSchema = z
  .object({
    code: z.string().min(1),
    category: z.enum([
      "configuration",
      "validation",
      "provider",
      "network",
      "rate_limit",
      "timeout",
      "budget",
      "storage",
      "security",
      "model_output",
      "unsupported",
      "internal",
    ]),
    message: z.string().min(1),
    retryable: z.boolean(),
    stage: RunPhaseSchema.optional(),
    provider: z.string().min(1).optional(),
    context: z.record(z.string(), z.unknown()).optional(),
    cause: z.string().min(1).optional(),
  })
  .strict();
export type RunFailure = z.infer<typeof RunFailureSchema>;

export const LocalRunSchema = z
  .object({
    id: OpaqueIdSchema,
    missionId: OpaqueIdSchema,
    missionName: z.string().min(1),
    status: LocalRunStatusSchema,
    phase: RunPhaseSchema,
    config: z
      .object({
        engineVersion: z.string().min(1),
        fixtureMode: z.literal(true),
        discoveryRuntimeMode: DiscoveryRuntimeModeSchema.default("fixture"),
        discoveryProviderMode: DiscoveryProviderModeSchema.default("fixture_only"),
        discoveryProviderPolicy: DiscoveryProviderPolicySchema.default("free_only"),
        discoveryExtractionMode: CluvviExtractionModeSchema.default("none"),
        discoveryMaximumExtractions: z.number().int().min(1).max(100).default(8),
        discoveryStructuredContentMode: CluvviStructuredContentModeSchema.default("none"),
        discoveryMaximumStructuredResources: z.number().int().min(1).max(100).default(8),
        discoveryMaximumDocumentResources: z.number().int().min(1).max(100).default(4),
        discoverySourceAdapterMode: CluvviSourceAdapterModeSchema.default("none"),
        discoverySourceFamilies: z.array(CluvviSourceFamilySchema).max(3).default([]),
        discoveryMaximumHiringTargets: z.number().int().min(1).max(100).default(10),
        discoveryMaximumHiringBoardsPerTarget: z.number().int().min(1).max(20).default(4),
        discoveryMaximumHiringJobsPerBoard: z.number().int().min(1).max(1000).default(250),
        discoveryMaximumHiringJobsTotal: z.number().int().min(1).max(10000).default(2000),
        discoveryRedditDepth: z.enum(["quick", "default", "deep"]).default("default"),
        discoveryMaximumRedditQueries: z.number().int().min(1).max(8).default(8),
        discoveryMaximumRedditSubreddits: z.number().int().min(1).max(20).default(20),
        discoveryMaximumRedditThreads: z.number().int().min(1).max(200).default(100),
        discoveryMaximumRedditThreadDrill: z.number().int().min(1).max(20).default(5),
        discoveryGitHubDepth: z.enum(["quick", "default", "deep"]).default("default"),
        discoveryMaximumGitHubQueries: z.number().int().min(1).max(8).default(4),
        discoveryMaximumGitHubRepositories: z.number().int().min(1).max(15).default(8),
        discoveryMaximumGitHubThreadDrill: z.number().int().min(1).max(8).default(5),
        communitySignalRuleVersion: z.string().min(1).default("community_signals@1.0.0"),
        developerSignalRuleVersion: z.string().min(1).default("c1-j3.developer-signals.v1"),
        hiringSignalRuleVersion: z.string().min(1).default("hiring_signals@1.0.0"),
        hiringTaxonomyVersion: z.string().min(1).default("hiring_taxonomy@1.0.0"),
        hiringTechnologyLexiconVersion: z
          .string()
          .min(1)
          .default("hiring_technology_lexicon@1.0.0"),
        extractorVersion: z.string().min(1).default("basic_public_html_extractor@1.0.0"),
        frontierPolicyVersion: z.string().min(1).default("frontier_policy@1.0.0"),
        structuredParserPolicyVersion: z.string().min(1).default("structured_parser_policy@1.0.0"),
        anydocParserVersion: z.string().min(1).default("@firecrawl/anydoc@0.1.6"),
        htmlMarkdownRendererVersion: z.string().min(1).default("sanitized_html_to_gfm@1.0.0"),
        extractionQualityEvaluatorVersion: z.string().min(1).default("extraction_quality@1.0.0"),
      })
      .strict(),
    budget: RunBudgetSchema,
    usage: RunUsageSchema,
    startedAt: z.iso.datetime({ offset: true }),
    updatedAt: z.iso.datetime({ offset: true }),
    completedAt: z.iso.datetime({ offset: true }).optional(),
    failure: RunFailureSchema.optional(),
  })
  .strict();
export type LocalRun = z.infer<typeof LocalRunSchema>;

export const LocalRunEventSchema = z
  .object({
    id: OpaqueIdSchema,
    runId: OpaqueIdSchema,
    eventType: z.enum([
      "run_created",
      "run_started",
      "run_resumed",
      "stage_started",
      "stage_reused",
      "stage_skipped",
      "stage_completed",
      "stage_failed",
      "run_completed",
      "run_cancelled",
      "run_failed",
      "budget_warning",
      "budget_exhausted",
    ]),
    phase: RunPhaseSchema,
    data: z.record(z.string(), z.unknown()),
    createdAt: z.iso.datetime({ offset: true }),
  })
  .strict();
export type LocalRunEvent = z.infer<typeof LocalRunEventSchema>;

export const StageExecutionSchema = z
  .object({
    id: OpaqueIdSchema,
    runId: OpaqueIdSchema,
    stageName: RunPhaseSchema,
    stageVersion: z.string().min(1),
    status: StageExecutionStatusSchema,
    inputFingerprint: z.string().regex(/^[a-f0-9]{64}$/),
    attempt: z.number().int().positive(),
    startedAt: z.iso.datetime({ offset: true }),
    completedAt: z.iso.datetime({ offset: true }).optional(),
    failure: RunFailureSchema.optional(),
  })
  .strict();
export type StageExecution = z.infer<typeof StageExecutionSchema>;

export const ToolCallRecordSchema = z
  .object({
    id: OpaqueIdSchema,
    runId: OpaqueIdSchema,
    stageName: RunPhaseSchema,
    toolName: z.string().min(1),
    provider: z.string().min(1),
    requestFingerprint: z.string().regex(/^[a-f0-9]{64}$/),
    request: z.record(z.string(), z.unknown()),
    response: z.record(z.string(), z.unknown()).optional(),
    status: z.enum(["running", "completed", "failed"]),
    attempt: z.number().int().positive(),
    costUsd: z.number().finite().nonnegative(),
    inputTokens: z.number().int().nonnegative(),
    outputTokens: z.number().int().nonnegative(),
    latencyMs: z.number().int().nonnegative().optional(),
    providerRequestId: z.string().min(1).optional(),
    error: RunFailureSchema.optional(),
    createdAt: z.iso.datetime({ offset: true }),
    completedAt: z.iso.datetime({ offset: true }).optional(),
  })
  .strict();
export type ToolCallRecord = z.infer<typeof ToolCallRecordSchema>;
