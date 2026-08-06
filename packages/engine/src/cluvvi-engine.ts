import {
  ArtifactRecordSchema,
  CluvviError,
  LocalRunEventSchema,
  LocalRunSchema,
  ORDERED_RUN_PHASES,
  StageExecutionSchema,
  ToolCallRecordSchema,
  classifyError,
  createOpaqueId,
  fingerprint,
  type ArtifactRecord,
  type ArtifactType,
  type CluvviExtractionMode,
  type CluvviStructuredContentMode,
  type DiscoveryProviderMode,
  type DiscoveryProviderPolicy,
  type DiscoveryRuntimeMode,
  type LocalMission,
  type LocalRun,
  type LocalRunEvent,
  type LocalRunPhase,
  type MissionInputV1,
  type RunBudget,
} from "@cluvvi/core";
import type { CluvviStore } from "@cluvvi/storage";
import { setTimeout as delay } from "node:timers/promises";
import type { LocalArtifactWriter } from "./artifact-writer";
import { BudgetController } from "./budget-controller";
import { FixtureDiscoveryRuntime, type DiscoveryRuntime } from "./discovery-runtime";
import { createPlaceholderStages } from "./placeholder-stages";
import { createRunCreationRecords } from "./run-factory";
import type { EngineStage, StageContext } from "./stage";
import { StageRegistry } from "./stage";
import { LOCAL_ENGINE_VERSION } from "./version";

export interface RunResult {
  run: LocalRun;
  artifacts: ArtifactRecord[];
}

export interface RunExecutionOptions {
  shouldCancel?: () => Promise<boolean>;
  signal?: AbortSignal;
  failStage?: LocalRunPhase;
}

export class RunExecutionError extends Error {
  readonly runId: string;

  constructor(runId: string, cause: unknown) {
    super(`Run ${runId} failed. Resume with: pnpm cluvvi resume ${runId}`, { cause });
    this.name = "RunExecutionError";
    this.runId = runId;
  }
}

export interface EngineEventSink {
  emit(event: LocalRunEvent): void;
}

export class CluvviEngine {
  readonly #store: CluvviStore;
  readonly #stages: StageRegistry;
  readonly #artifactWriter: LocalArtifactWriter;
  readonly #budgetController: BudgetController;
  readonly #eventSink: EngineEventSink;
  readonly #now: () => string;
  readonly #stageDelayMs: number;
  readonly #discoveryRuntimeMode: DiscoveryRuntimeMode;
  readonly #discoveryProviderMode: DiscoveryProviderMode;
  readonly #discoveryProviderPolicy: DiscoveryProviderPolicy;
  readonly #discoveryExtractionMode: CluvviExtractionMode;
  readonly #discoveryMaximumExtractions: number;
  readonly #discoveryStructuredContentMode: CluvviStructuredContentMode;
  readonly #discoveryMaximumStructuredResources: number;
  readonly #discoveryMaximumDocumentResources: number;
  readonly #extractorVersion: string;
  readonly #frontierPolicyVersion: string;
  readonly #structuredParserPolicyVersion: string;
  readonly #anydocParserVersion: string;
  readonly #htmlMarkdownRendererVersion: string;
  readonly #extractionQualityEvaluatorVersion: string;
  readonly #providerConfigurationFingerprint: string;
  readonly #extractionConfigurationFingerprint: string;
  readonly #structuredConfigurationFingerprint: string;

  constructor(input: {
    store: CluvviStore;
    stages: StageRegistry;
    artifactWriter: LocalArtifactWriter;
    budgetController?: BudgetController;
    eventSink?: EngineEventSink;
    now?: () => string;
    stageDelayMs?: number;
    discoveryRuntimeMode?: DiscoveryRuntimeMode;
    discoveryProviderMode?: DiscoveryProviderMode;
    discoveryProviderPolicy?: DiscoveryProviderPolicy;
    discoveryExtractionMode?: CluvviExtractionMode;
    discoveryMaximumExtractions?: number;
    discoveryStructuredContentMode?: CluvviStructuredContentMode;
    discoveryMaximumStructuredResources?: number;
    discoveryMaximumDocumentResources?: number;
    extractorVersion?: string;
    frontierPolicyVersion?: string;
    structuredParserPolicyVersion?: string;
    anydocParserVersion?: string;
    htmlMarkdownRendererVersion?: string;
    extractionQualityEvaluatorVersion?: string;
    providerConfigurationFingerprint?: string;
    extractionConfigurationFingerprint?: string;
    structuredConfigurationFingerprint?: string;
  }) {
    this.#store = input.store;
    this.#stages = input.stages;
    this.#artifactWriter = input.artifactWriter;
    this.#budgetController = input.budgetController ?? new BudgetController();
    this.#eventSink = input.eventSink ?? { emit() {} };
    this.#now = input.now ?? (() => new Date().toISOString());
    this.#stageDelayMs = input.stageDelayMs ?? 0;
    this.#discoveryRuntimeMode = input.discoveryRuntimeMode ?? "fixture";
    this.#discoveryProviderMode = input.discoveryProviderMode ?? "fixture_only";
    this.#discoveryProviderPolicy = input.discoveryProviderPolicy ?? "free_only";
    this.#discoveryExtractionMode = input.discoveryExtractionMode ?? "none";
    this.#discoveryMaximumExtractions = input.discoveryMaximumExtractions ?? 8;
    this.#discoveryStructuredContentMode = input.discoveryStructuredContentMode ?? "none";
    this.#discoveryMaximumStructuredResources = input.discoveryMaximumStructuredResources ?? 8;
    this.#discoveryMaximumDocumentResources = input.discoveryMaximumDocumentResources ?? 4;
    this.#extractorVersion = input.extractorVersion ?? "basic_public_html_extractor@1.0.0";
    this.#frontierPolicyVersion = input.frontierPolicyVersion ?? "frontier_policy@1.0.0";
    this.#structuredParserPolicyVersion =
      input.structuredParserPolicyVersion ?? "structured_parser_policy@1.0.0";
    this.#anydocParserVersion = input.anydocParserVersion ?? "@firecrawl/anydoc@0.1.6";
    this.#htmlMarkdownRendererVersion =
      input.htmlMarkdownRendererVersion ?? "sanitized_html_to_gfm@1.0.0";
    this.#extractionQualityEvaluatorVersion =
      input.extractionQualityEvaluatorVersion ?? "extraction_quality@1.0.0";
    this.#providerConfigurationFingerprint =
      input.providerConfigurationFingerprint ?? "fixture-project-b-v2";
    this.#extractionConfigurationFingerprint =
      input.extractionConfigurationFingerprint ?? "fixture-no-extraction";
    this.#structuredConfigurationFingerprint =
      input.structuredConfigurationFingerprint ?? "fixture-no-structured-content";
  }

  async start(input: {
    mission: MissionInputV1;
    sourceFile: string;
    budget?: RunBudget;
    failStage?: LocalRunPhase;
  }): Promise<RunResult> {
    await this.#store.initialize();
    const { mission, run, event } = createRunCreationRecords({
      mission: input.mission,
      sourceFile: input.sourceFile,
      now: this.#now(),
      discoveryRuntimeMode: this.#discoveryRuntimeMode,
      discoveryProviderMode: this.#discoveryProviderMode,
      discoveryProviderPolicy: this.#discoveryProviderPolicy,
      discoveryExtractionMode: this.#discoveryExtractionMode,
      discoveryMaximumExtractions: this.#discoveryMaximumExtractions,
      discoveryStructuredContentMode: this.#discoveryStructuredContentMode,
      discoveryMaximumStructuredResources: this.#discoveryMaximumStructuredResources,
      discoveryMaximumDocumentResources: this.#discoveryMaximumDocumentResources,
      extractorVersion: this.#extractorVersion,
      frontierPolicyVersion: this.#frontierPolicyVersion,
      structuredParserPolicyVersion: this.#structuredParserPolicyVersion,
      anydocParserVersion: this.#anydocParserVersion,
      htmlMarkdownRendererVersion: this.#htmlMarkdownRendererVersion,
      extractionQualityEvaluatorVersion: this.#extractionQualityEvaluatorVersion,
      ...(input.budget === undefined ? {} : { budget: input.budget }),
    });
    await this.#artifactWriter.ensureRunDirectory(run.id);
    await this.#store.createRun(run, mission, event);
    this.#eventSink.emit(event);
    try {
      return await this.#execute(run.id, {
        resumed: false,
        ...(input.failStage === undefined ? {} : { failStage: input.failStage }),
      });
    } catch (error) {
      throw new RunExecutionError(run.id, error);
    }
  }

  async run(runId: string, options: RunExecutionOptions = {}): Promise<RunResult> {
    return this.#execute(runId, { resumed: false, ...options });
  }

  async resume(runId: string, options: RunExecutionOptions = {}): Promise<RunResult> {
    return this.#execute(runId, { resumed: true, ...options });
  }

  async #execute(
    runId: string,
    options: RunExecutionOptions & { resumed: boolean },
  ): Promise<RunResult> {
    await this.#store.initialize();
    let run = await this.#requireRun(runId);
    const mission = await this.#requireMission(runId);

    if (run.status === "completed" || run.status === "cancelled") {
      return { run, artifacts: await this.#store.listArtifacts(run.id) };
    }

    const startTime = this.#now();
    run = LocalRunSchema.parse({
      ...run,
      status: "running",
      updatedAt: startTime,
      completedAt: undefined,
      failure: undefined,
    });
    const startedEvent = this.#event(run, options.resumed ? "run_resumed" : "run_started", {});
    await this.#store.persistRunAndEvent(run, startedEvent);
    this.#eventSink.emit(startedEvent);

    for (const stage of this.#stages.stages) {
      if (options.shouldCancel !== undefined && (await options.shouldCancel())) {
        const cancelledAt = this.#now();
        run = LocalRunSchema.parse({
          ...run,
          status: "cancelled",
          updatedAt: cancelledAt,
          completedAt: cancelledAt,
          failure: undefined,
        });
        const cancelledEvent = this.#event(run, "run_cancelled", {});
        await this.#store.persistRunAndEvent(run, cancelledEvent);
        this.#eventSink.emit(cancelledEvent);
        return { run, artifacts: await this.#store.listArtifacts(run.id) };
      }

      this.#budgetController.assertRunCanContinue(run);
      const context = this.#context(run, mission, stage, options);
      if (stage.shouldRun !== undefined && !(await stage.shouldRun(context))) {
        const skippedAt = this.#now();
        run = LocalRunSchema.parse({ ...run, phase: stage.name, updatedAt: skippedAt });
        const inputFingerprint = fingerprint({
          stage: stage.name,
          stageVersion: stage.version,
          skipped: true,
          engineVersion: LOCAL_ENGINE_VERSION,
          discoveryRuntimeMode: run.config.discoveryRuntimeMode,
          discoveryProviderMode: run.config.discoveryProviderMode,
          discoveryProviderPolicy: run.config.discoveryProviderPolicy,
          extractionConfiguration: this.#extractionConfigurationFingerprint,
          ...(stage.name === "structured_parsing" || stage.name === "content_parse_telemetry"
            ? { structuredConfiguration: this.#structuredConfigurationFingerprint }
            : {}),
        });
        const previousSkipped = (await this.#store.listStageExecutions(run.id)).find(
          (execution) =>
            execution.stageName === stage.name &&
            execution.stageVersion === stage.version &&
            execution.inputFingerprint === inputFingerprint &&
            execution.status === "skipped",
        );
        if (previousSkipped !== undefined) {
          const reusedEvent = this.#event(run, "stage_reused", {
            executionId: previousSkipped.id,
            inputFingerprint,
            skipped: true,
          });
          await this.#store.persistRunAndEvent(run, reusedEvent);
          this.#eventSink.emit(reusedEvent);
          continue;
        }
        const execution = StageExecutionSchema.parse({
          id: createOpaqueId("stage"),
          runId: run.id,
          stageName: stage.name,
          stageVersion: stage.version,
          status: "skipped",
          inputFingerprint,
          attempt: await this.#store.getNextStageAttempt(run.id, stage.name),
          startedAt: skippedAt,
          completedAt: skippedAt,
        });
        const skippedEvent = this.#event(run, "stage_skipped", {
          executionId: execution.id,
          reason: "extraction_disabled",
        });
        await this.#store.skipStage({ run, execution, event: skippedEvent });
        this.#eventSink.emit(skippedEvent);
        continue;
      }
      const untrustedInput = await stage.loadInput(context);
      const validatedInput = stage.inputSchema.parse(untrustedInput);
      const inputFingerprint = fingerprint({
        stage: stage.name,
        stageVersion: stage.version,
        input: validatedInput,
        engineVersion: LOCAL_ENGINE_VERSION,
        discoveryRuntimeMode: run.config.discoveryRuntimeMode,
        discoveryProviderMode: run.config.discoveryProviderMode,
        discoveryProviderPolicy: run.config.discoveryProviderPolicy,
        providerConfiguration: this.#providerConfigurationFingerprint,
        ...(stage.name === "discovery"
          ? {}
          : { extractionConfiguration: this.#extractionConfigurationFingerprint }),
        ...(stage.name === "structured_parsing" || stage.name === "content_parse_telemetry"
          ? { structuredConfiguration: this.#structuredConfigurationFingerprint }
          : {}),
      });
      const previous = await this.#store.findCompletedStageExecution(
        run.id,
        stage.name,
        stage.version,
        inputFingerprint,
      );
      if (previous !== null) {
        run = LocalRunSchema.parse({ ...run, phase: stage.name, updatedAt: this.#now() });
        const reusedEvent = this.#event(run, "stage_reused", {
          executionId: previous.id,
          inputFingerprint,
        });
        await this.#store.persistRunAndEvent(run, reusedEvent);
        this.#eventSink.emit(reusedEvent);
        continue;
      }

      const stageStartedAt = this.#now();
      run = LocalRunSchema.parse({ ...run, phase: stage.name, updatedAt: stageStartedAt });
      const execution = StageExecutionSchema.parse({
        id: createOpaqueId("stage"),
        runId: run.id,
        stageName: stage.name,
        stageVersion: stage.version,
        status: "running",
        inputFingerprint,
        attempt: await this.#store.getNextStageAttempt(run.id, stage.name),
        startedAt: stageStartedAt,
      });
      const stageStartedEvent = this.#event(run, "stage_started", {
        executionId: execution.id,
        attempt: execution.attempt,
      });
      await this.#store.startStage({ run, execution, event: stageStartedEvent });
      this.#eventSink.emit(stageStartedEvent);

      try {
        if (options.failStage === stage.name) {
          throw new CluvviError({
            code: "SIMULATED_STAGE_FAILURE",
            category: "internal",
            message: `Simulated C0.5 fixture failure at ${stage.name}.`,
            retryable: true,
            stage: stage.name,
          });
        }
        if (this.#stageDelayMs > 0) {
          await delay(this.#stageDelayMs);
        }
        const output = await stage.execute(validatedInput, context);
        const validatedOutput = stage.outputSchema.parse(output);
        const previousArtifact = await this.#store.getLatestArtifact(run.id, stage.artifactType);
        const completedAt = this.#now();
        const artifact = await this.#artifactWriter.writeArtifact({
          run,
          artifactType: stage.artifactType,
          stage: stage.name,
          schemaVersion: stage.schemaVersion,
          version: (previousArtifact?.version ?? 0) + 1,
          data: validatedOutput,
          createdAt: completedAt,
        });
        ArtifactRecordSchema.parse(artifact);
        run = LocalRunSchema.parse({ ...run, phase: stage.name, updatedAt: completedAt });
        const completedEvent = this.#event(run, "stage_completed", {
          executionId: execution.id,
          artifactId: artifact.id,
          artifactType: artifact.artifactType,
        });
        await this.#store.completeStage({
          run,
          executionId: execution.id,
          completedAt,
          artifact,
          event: completedEvent,
        });
        this.#eventSink.emit(completedEvent);
      } catch (error) {
        const failedAt = this.#now();
        const failure = classifyError(error, stage.name);
        const cancelled = failure.code === "DISCOVERY_ENGINE_CANCELLED";
        run = LocalRunSchema.parse({
          ...run,
          status: cancelled
            ? "cancelled"
            : failure.category === "budget"
              ? "budget_exhausted"
              : "failed",
          phase: stage.name,
          failure,
          updatedAt: failedAt,
          ...(cancelled ? { completedAt: failedAt } : {}),
        });
        const failedEvent = this.#event(run, cancelled ? "run_cancelled" : "stage_failed", {
          executionId: execution.id,
          code: failure.code,
          retryable: failure.retryable,
        });
        await this.#store.failStage({
          run,
          executionId: execution.id,
          failedAt,
          event: failedEvent,
        });
        this.#eventSink.emit(failedEvent);
        await this.#artifactWriter.writeFailure(run);
        if (cancelled) {
          return { run, artifacts: await this.#store.listArtifacts(run.id) };
        }
        throw error;
      }
    }

    const completedAt = this.#now();
    run = LocalRunSchema.parse({
      ...run,
      status: "completed",
      phase: "finalization",
      updatedAt: completedAt,
      completedAt,
      failure: undefined,
    });
    const completedEvent = this.#event(run, "run_completed", {
      stages: ORDERED_RUN_PHASES.length,
    });
    await this.#store.persistRunAndEvent(run, completedEvent);
    this.#eventSink.emit(completedEvent);
    const artifacts = await this.#store.listArtifacts(run.id);
    const events = await this.#store.listRunEvents(run.id);
    const toolCalls = await this.#store.listToolCalls(run.id);
    await this.#artifactWriter.writeToolCalls(run.id, toolCalls);
    await this.#artifactWriter.writeRunReport({ run, events, artifacts, toolCalls });
    return { run, artifacts };
  }

  #context(
    run: LocalRun,
    mission: LocalMission,
    stage: EngineStage<unknown, unknown>,
    options: RunExecutionOptions,
  ): StageContext {
    return {
      run,
      mission,
      store: this.#store,
      now: this.#now,
      ...(options.signal === undefined ? {} : { signal: options.signal }),
      ...(options.shouldCancel === undefined ? {} : { shouldCancel: options.shouldCancel }),
      getLatestArtifact: (artifactType: ArtifactType) =>
        this.#store.getLatestArtifact(run.id, artifactType),
      recordFixtureToolCall: async ({ toolName, request, response }) => {
        const createdAt = this.#now();
        const record = ToolCallRecordSchema.parse({
          id: createOpaqueId("tool"),
          runId: run.id,
          stageName: stage.name,
          toolName,
          provider: "fixture",
          requestFingerprint: fingerprint({ toolName, request, stage: stage.name }),
          request,
          response,
          status: "completed",
          attempt: 1,
          costUsd: 0,
          inputTokens: 0,
          outputTokens: 0,
          latencyMs: 0,
          providerRequestId: `fixture:${run.id}:${stage.name}`,
          createdAt,
          completedAt: createdAt,
        });
        await this.#store.recordToolCall(record);
        return record;
      },
    };
  }

  #event(
    run: LocalRun,
    eventType: LocalRunEvent["eventType"],
    data: Record<string, unknown>,
  ): LocalRunEvent {
    return LocalRunEventSchema.parse({
      id: createOpaqueId("event"),
      runId: run.id,
      eventType,
      phase: run.phase,
      data,
      createdAt: this.#now(),
    });
  }

  async #requireRun(runId: string): Promise<LocalRun> {
    const run = await this.#store.getRun(runId);
    if (run === null) {
      throw new Error(`Run ${runId} was not found.`);
    }
    return run;
  }

  async #requireMission(runId: string): Promise<LocalMission> {
    const mission = await this.#store.getMission(runId);
    if (mission === null) {
      throw new Error(`Mission for run ${runId} was not found.`);
    }
    return mission;
  }
}

export function createDefaultStageRegistry(
  input: { discoveryRuntime?: DiscoveryRuntime } = {},
): StageRegistry {
  const discoveryRuntime = input.discoveryRuntime ?? new FixtureDiscoveryRuntime();
  const stages = createPlaceholderStages({ discoveryRuntime });
  const stageNames = new Set(stages.map((stage) => stage.name));
  if (stageNames.size !== ORDERED_RUN_PHASES.length) {
    throw new Error("Default stage registry must contain every run phase exactly once.");
  }
  return new StageRegistry(stages);
}
