import {
  ArtifactRecordSchema,
  CluvviError,
  DEFAULT_RUN_BUDGET,
  EMPTY_RUN_USAGE,
  LocalMissionSchema,
  LocalRunSchema,
  ORDERED_RUN_PHASES,
  LocalRunEventSchema,
  StageExecutionSchema,
  ToolCallRecordSchema,
  classifyError,
  createOpaqueId,
  fingerprint,
  type ArtifactRecord,
  type ArtifactType,
  type LocalMission,
  type LocalRun,
  type LocalRunPhase,
  type MissionInputV1,
  type RunBudget,
  type LocalRunEvent,
} from "@cluvvi/core";
import type { CluvviStore } from "@cluvvi/storage";
import { BudgetController } from "./budget-controller";
import type { LocalArtifactWriter } from "./artifact-writer";
import { createPlaceholderStages } from "./placeholder-stages";
import type { EngineStage, StageContext } from "./stage";
import { StageRegistry } from "./stage";

export const LOCAL_ENGINE_VERSION = "0.1.0-c0";

export interface RunResult {
  run: LocalRun;
  artifacts: ArtifactRecord[];
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

  constructor(input: {
    store: CluvviStore;
    stages: StageRegistry;
    artifactWriter: LocalArtifactWriter;
    budgetController?: BudgetController;
    eventSink?: EngineEventSink;
    now?: () => string;
  }) {
    this.#store = input.store;
    this.#stages = input.stages;
    this.#artifactWriter = input.artifactWriter;
    this.#budgetController = input.budgetController ?? new BudgetController();
    this.#eventSink = input.eventSink ?? { emit() {} };
    this.#now = input.now ?? (() => new Date().toISOString());
  }

  async start(input: {
    mission: MissionInputV1;
    sourceFile: string;
    budget?: RunBudget;
    failStage?: LocalRunPhase;
  }): Promise<RunResult> {
    await this.#store.initialize();
    const now = this.#now();
    const mission = LocalMissionSchema.parse({
      id: createOpaqueId("mission"),
      input: input.mission,
      sourceFile: input.sourceFile,
      createdAt: now,
    });
    const run = LocalRunSchema.parse({
      id: createOpaqueId("run"),
      missionId: mission.id,
      missionName: mission.input.name,
      status: "created",
      phase: "mission",
      config: { engineVersion: LOCAL_ENGINE_VERSION, fixtureMode: true },
      budget: input.budget ?? DEFAULT_RUN_BUDGET,
      usage: EMPTY_RUN_USAGE,
      startedAt: now,
      updatedAt: now,
    });
    const event = this.#event(run, "run_created", { sourceFile: input.sourceFile });
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

  async run(runId: string): Promise<RunResult> {
    return this.#execute(runId, { resumed: false });
  }

  async resume(runId: string): Promise<RunResult> {
    return this.#execute(runId, { resumed: true });
  }

  async #execute(
    runId: string,
    options: { resumed: boolean; failStage?: LocalRunPhase },
  ): Promise<RunResult> {
    await this.#store.initialize();
    let run = await this.#requireRun(runId);
    const mission = await this.#requireMission(runId);

    if (run.status === "completed") {
      return { run, artifacts: await this.#store.listArtifacts(run.id) };
    }

    const startTime = this.#now();
    run = LocalRunSchema.parse({
      ...run,
      status: "running",
      updatedAt: startTime,
      failure: undefined,
    });
    const startedEvent = this.#event(run, options.resumed ? "run_resumed" : "run_started", {});
    await this.#store.persistRunAndEvent(run, startedEvent);
    this.#eventSink.emit(startedEvent);

    for (const stage of this.#stages.stages) {
      this.#budgetController.assertRunCanContinue(run);
      const context = this.#context(run, mission, stage);
      const untrustedInput = await stage.loadInput(context);
      const validatedInput = stage.inputSchema.parse(untrustedInput);
      const inputFingerprint = fingerprint({
        stage: stage.name,
        stageVersion: stage.version,
        input: validatedInput,
        engineVersion: LOCAL_ENGINE_VERSION,
        providerConfiguration: "fixture-v1",
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
            message: `Simulated C0 failure at ${stage.name}.`,
            retryable: true,
            stage: stage.name,
          });
        }
        const output = await stage.execute(validatedInput, context);
        const validatedOutput = stage.outputSchema.parse(output);
        const previousArtifact = await this.#store.getLatestArtifact(run.id, stage.artifactType);
        const completedAt = this.#now();
        const artifact = await this.#artifactWriter.writeArtifact({
          run,
          artifactType: stage.artifactType,
          stage: stage.name,
          schemaVersion: "1.0",
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
        run = LocalRunSchema.parse({
          ...run,
          status: failure.category === "budget" ? "budget_exhausted" : "failed",
          phase: stage.name,
          failure,
          updatedAt: failedAt,
        });
        const failedEvent = this.#event(run, "stage_failed", {
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
  ): StageContext {
    return {
      run,
      mission,
      store: this.#store,
      now: this.#now,
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

export function createDefaultStageRegistry(): StageRegistry {
  const stages = createPlaceholderStages();
  const stageNames = new Set(stages.map((stage) => stage.name));
  if (stageNames.size !== ORDERED_RUN_PHASES.length) {
    throw new Error("Default stage registry must contain every run phase exactly once.");
  }
  return new StageRegistry(stages);
}
