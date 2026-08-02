import { z } from "zod";
import { DiscoveryProviderModeSchema, DiscoveryRuntimeModeSchema } from "./discovery-runtime";
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
