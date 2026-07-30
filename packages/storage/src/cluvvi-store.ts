import type {
  ArtifactRecord,
  ArtifactType,
  LocalMission,
  LocalRun,
  LocalRunEvent,
  LocalRunPhase,
  RunFailure,
  RunRequest,
  RunnerHeartbeat,
  StageExecution,
  ToolCallRecord,
} from "@cluvvi/core";

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

export interface CreateQueuedRunPersistence {
  run: LocalRun;
  mission: LocalMission;
  event: LocalRunEvent;
  request: RunRequest;
}

export interface ClaimRunRequestInput {
  runnerId: string;
  now: string;
  leaseExpiresAt: string;
}

export interface AcquireRunnerLeadershipInput {
  runnerId: string;
  now: string;
  leaseExpiresAt: string;
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

export interface RunRequestRepository {
  createQueuedRun(input: CreateQueuedRunPersistence): Promise<{
    run: LocalRun;
    request: RunRequest;
    created: boolean;
  }>;
  enqueueRunRequest(request: RunRequest): Promise<RunRequest>;
  getRunRequestByIdempotencyKey(idempotencyKey: string): Promise<RunRequest | null>;
  listRunRequests(runId: string): Promise<RunRequest[]>;
  claimNextRunRequest(input: ClaimRunRequestInput): Promise<RunRequest | null>;
  renewRunRequestLease(
    requestId: string,
    runnerId: string,
    now: string,
    leaseExpiresAt: string,
  ): Promise<boolean>;
  completeRunRequest(requestId: string, runnerId: string, completedAt: string): Promise<void>;
  failRunRequest(
    requestId: string,
    runnerId: string,
    failure: RunFailure,
    failedAt: string,
  ): Promise<void>;
  hasPendingCancellation(runId: string): Promise<boolean>;
}

export interface RunnerLeadershipRepository {
  acquireRunnerLeadership(input: AcquireRunnerLeadershipInput): Promise<boolean>;
  renewRunnerLeadership(input: AcquireRunnerLeadershipInput): Promise<boolean>;
  releaseRunnerLeadership(runnerId: string): Promise<void>;
}

export interface RunnerHeartbeatRepository {
  upsertRunnerHeartbeat(heartbeat: RunnerHeartbeat): Promise<void>;
  removeRunnerHeartbeat(runnerId: string): Promise<void>;
  getLatestRunnerHeartbeat(): Promise<RunnerHeartbeat | null>;
  getMigrationVersion(): Promise<string | null>;
  getDatabaseInstanceId(): Promise<string>;
}

export type LocalRuntimeStore = CluvviStore &
  RunRequestRepository &
  RunnerLeadershipRepository &
  RunnerHeartbeatRepository;
