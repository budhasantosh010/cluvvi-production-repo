import type {
  ArtifactRecord,
  LocalMission,
  LocalRun,
  LocalRunEvent,
  StageExecution,
  ToolCallRecord,
} from "@cluvvi/core";
import type { ArtifactType, LocalRunPhase } from "@cluvvi/core";

export interface StartStagePersistence {
  run: LocalRun;
  execution: StageExecution;
  event: LocalRunEvent;
}

export interface CompleteStagePersistence {
  run: LocalRun;
  executionId: string;
  completedAt: string;
  artifact: ArtifactRecord;
  event: LocalRunEvent;
}

export interface FailStagePersistence {
  run: LocalRun;
  executionId: string;
  failedAt: string;
  event: LocalRunEvent;
}

export interface CluvviStore {
  readonly databasePath: string;

  initialize(): Promise<void>;
  close(): Promise<void>;

  createRun(run: LocalRun, mission: LocalMission, event: LocalRunEvent): Promise<void>;
  getRun(runId: string): Promise<LocalRun | null>;
  getMission(runId: string): Promise<LocalMission | null>;
  listRuns(limit?: number): Promise<LocalRun[]>;
  persistRunAndEvent(run: LocalRun, event: LocalRunEvent): Promise<void>;

  findCompletedStageExecution(
    runId: string,
    stageName: LocalRunPhase,
    stageVersion: string,
    inputFingerprint: string,
  ): Promise<StageExecution | null>;
  getNextStageAttempt(runId: string, stageName: LocalRunPhase): Promise<number>;
  listStageExecutions(runId: string): Promise<StageExecution[]>;
  startStage(input: StartStagePersistence): Promise<void>;
  completeStage(input: CompleteStagePersistence): Promise<void>;
  failStage(input: FailStagePersistence): Promise<void>;

  getLatestArtifact(runId: string, artifactType: ArtifactType): Promise<ArtifactRecord | null>;
  listArtifacts(runId: string): Promise<ArtifactRecord[]>;

  recordToolCall(record: ToolCallRecord): Promise<void>;
  listToolCalls(runId: string): Promise<ToolCallRecord[]>;
  listRunEvents(runId: string): Promise<LocalRunEvent[]>;
}
