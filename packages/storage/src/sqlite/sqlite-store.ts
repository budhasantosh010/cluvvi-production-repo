import {
  ArtifactRecordSchema,
  LocalMissionSchema,
  LocalRunEventSchema,
  LocalRunSchema,
  RunRequestSchema,
  RunnerHeartbeatSchema,
  StageExecutionSchema,
  ToolCallRecordSchema,
  type ArtifactRecord,
  type ArtifactType,
  type LocalMission,
  type LocalRun,
  type LocalRunEvent,
  type LocalRunPhase,
  type RunFailure,
  type RunRequest,
  type RunnerHeartbeat,
  type StageExecution,
  type ToolCallRecord,
} from "@cluvvi/core";
import { randomUUID } from "node:crypto";
import type { DatabaseSync } from "node:sqlite";
import type {
  AcquireRunnerLeadershipInput,
  ClaimRunRequestInput,
  CluvviStore,
  CompleteStagePersistence,
  CreateQueuedRunPersistence,
  FailStagePersistence,
  RunRequestRepository,
  RunnerHeartbeatRepository,
  RunnerLeadershipRepository,
  StartStagePersistence,
} from "../cluvvi-store";
import { openSqliteDatabase } from "./connection";
import { applySqliteMigrations } from "./migrations";
import { sqliteTransaction } from "./transactions";

interface RunRow {
  id: string;
  mission_id: string;
  mission_name: string;
  status: string;
  phase: string;
  input_json: string;
  source_file: string;
  config_json: string;
  budget_json: string;
  usage_json: string;
  failure_json: string | null;
  started_at: string;
  updated_at: string;
  completed_at: string | null;
}

interface EventRow {
  id: string;
  run_id: string;
  event_type: string;
  phase: string;
  data_json: string;
  created_at: string;
}

interface StageRow {
  id: string;
  run_id: string;
  stage_name: string;
  stage_version: string;
  status: string;
  input_fingerprint: string;
  attempt: number;
  started_at: string;
  completed_at: string | null;
  failure_json: string | null;
}

interface ArtifactRow {
  id: string;
  run_id: string;
  artifact_type: string;
  schema_version: string;
  version: number;
  stage_name: string;
  content_hash: string;
  file_name: string;
  data_json: string;
  created_at: string;
}

interface RunRequestRow {
  id: string;
  run_id: string;
  action: string;
  status: string;
  idempotency_key: string;
  claimed_by: string | null;
  claimed_at: string | null;
  lease_expires_at: string | null;
  attempt: number;
  failure_json: string | null;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
}

interface RunnerHeartbeatRow {
  runner_id: string;
  hostname: string;
  process_id: number;
  started_at: string;
  last_seen_at: string;
  metadata_json: string;
}

interface ToolCallRow {
  id: string;
  run_id: string;
  stage_name: string;
  tool_name: string;
  provider: string;
  request_fingerprint: string;
  request_json: string;
  response_json: string | null;
  status: string;
  attempt: number;
  cost_usd: number;
  input_tokens: number;
  output_tokens: number;
  latency_ms: number | null;
  provider_request_id: string | null;
  error_json: string | null;
  created_at: string;
  completed_at: string | null;
}

function parseJson(value: string): unknown {
  return JSON.parse(value) as unknown;
}

function serialize(value: unknown): string {
  return JSON.stringify(value);
}

function runFromRow(row: RunRow): LocalRun {
  return LocalRunSchema.parse({
    id: row.id,
    missionId: row.mission_id,
    missionName: row.mission_name,
    status: row.status,
    phase: row.phase,
    config: parseJson(row.config_json),
    budget: parseJson(row.budget_json),
    usage: parseJson(row.usage_json),
    startedAt: row.started_at,
    updatedAt: row.updated_at,
    ...(row.completed_at === null ? {} : { completedAt: row.completed_at }),
    ...(row.failure_json === null ? {} : { failure: parseJson(row.failure_json) }),
  });
}

function eventFromRow(row: EventRow): LocalRunEvent {
  return LocalRunEventSchema.parse({
    id: row.id,
    runId: row.run_id,
    eventType: row.event_type,
    phase: row.phase,
    data: parseJson(row.data_json),
    createdAt: row.created_at,
  });
}

function stageFromRow(row: StageRow): StageExecution {
  return StageExecutionSchema.parse({
    id: row.id,
    runId: row.run_id,
    stageName: row.stage_name,
    stageVersion: row.stage_version,
    status: row.status,
    inputFingerprint: row.input_fingerprint,
    attempt: row.attempt,
    startedAt: row.started_at,
    ...(row.completed_at === null ? {} : { completedAt: row.completed_at }),
    ...(row.failure_json === null ? {} : { failure: parseJson(row.failure_json) }),
  });
}

function artifactFromRow(row: ArtifactRow): ArtifactRecord {
  return ArtifactRecordSchema.parse({
    id: row.id,
    runId: row.run_id,
    artifactType: row.artifact_type,
    schemaVersion: row.schema_version,
    version: row.version,
    stage: row.stage_name,
    contentHash: row.content_hash,
    fileName: row.file_name,
    data: parseJson(row.data_json),
    createdAt: row.created_at,
  });
}

function runRequestFromRow(row: RunRequestRow): RunRequest {
  return RunRequestSchema.parse({
    id: row.id,
    runId: row.run_id,
    action: row.action,
    status: row.status,
    idempotencyKey: row.idempotency_key,
    ...(row.claimed_by === null ? {} : { claimedBy: row.claimed_by }),
    ...(row.claimed_at === null ? {} : { claimedAt: row.claimed_at }),
    ...(row.lease_expires_at === null ? {} : { leaseExpiresAt: row.lease_expires_at }),
    attempt: row.attempt,
    ...(row.failure_json === null ? {} : { failure: parseJson(row.failure_json) }),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    ...(row.completed_at === null ? {} : { completedAt: row.completed_at }),
  });
}

function heartbeatFromRow(row: RunnerHeartbeatRow): RunnerHeartbeat {
  return RunnerHeartbeatSchema.parse({
    runnerId: row.runner_id,
    hostname: row.hostname,
    processId: row.process_id,
    startedAt: row.started_at,
    lastSeenAt: row.last_seen_at,
    metadata: parseJson(row.metadata_json),
  });
}

function toolCallFromRow(row: ToolCallRow): ToolCallRecord {
  return ToolCallRecordSchema.parse({
    id: row.id,
    runId: row.run_id,
    stageName: row.stage_name,
    toolName: row.tool_name,
    provider: row.provider,
    requestFingerprint: row.request_fingerprint,
    request: parseJson(row.request_json),
    ...(row.response_json === null ? {} : { response: parseJson(row.response_json) }),
    status: row.status,
    attempt: row.attempt,
    costUsd: row.cost_usd,
    inputTokens: row.input_tokens,
    outputTokens: row.output_tokens,
    ...(row.latency_ms === null ? {} : { latencyMs: row.latency_ms }),
    ...(row.provider_request_id === null ? {} : { providerRequestId: row.provider_request_id }),
    ...(row.error_json === null ? {} : { error: parseJson(row.error_json) }),
    createdAt: row.created_at,
    ...(row.completed_at === null ? {} : { completedAt: row.completed_at }),
  });
}

export class SqliteCluvviStore
  implements
    CluvviStore,
    RunRequestRepository,
    RunnerLeadershipRepository,
    RunnerHeartbeatRepository
{
  readonly databasePath: string;
  readonly #migrationsDirectory: string | undefined;
  #database: DatabaseSync | null = null;

  constructor(input: { databasePath: string; migrationsDirectory?: string }) {
    this.databasePath = input.databasePath;
    this.#migrationsDirectory = input.migrationsDirectory;
  }

  async initialize(): Promise<void> {
    if (this.#database !== null) {
      return;
    }
    this.#database = openSqliteDatabase(this.databasePath);
    applySqliteMigrations(this.#database, this.#migrationsDirectory);
    this.#database
      .prepare(
        `
        INSERT INTO local_runtime_metadata(key, value, updated_at)
        VALUES ('database_instance_id', ?, ?)
        ON CONFLICT(key) DO NOTHING
      `,
      )
      .run(randomUUID(), new Date().toISOString());
  }

  async close(): Promise<void> {
    this.#database?.close();
    this.#database = null;
  }

  async createRun(run: LocalRun, mission: LocalMission, event: LocalRunEvent): Promise<void> {
    const database = this.#getDatabase();
    sqliteTransaction(database, () => {
      this.#insertRun(run, mission);
      this.#insertEvent(event);
    });
  }

  async createQueuedRun(input: CreateQueuedRunPersistence): Promise<{
    run: LocalRun;
    request: RunRequest;
    created: boolean;
  }> {
    const database = this.#getDatabase();
    return sqliteTransaction(database, () => {
      const existingRequestRow = database
        .prepare("SELECT * FROM run_requests WHERE idempotency_key = ?")
        .get(input.request.idempotencyKey) as RunRequestRow | undefined;
      if (existingRequestRow !== undefined) {
        const existingRunRow = database
          .prepare("SELECT * FROM runs WHERE id = ?")
          .get(existingRequestRow.run_id) as RunRow | undefined;
        if (existingRunRow === undefined) {
          throw new Error(`Run ${existingRequestRow.run_id} referenced by request was not found.`);
        }
        return {
          run: runFromRow(existingRunRow),
          request: runRequestFromRow(existingRequestRow),
          created: false,
        };
      }

      this.#insertRun(input.run, input.mission);
      this.#insertEvent(input.event);
      this.#insertRunRequest(input.request);
      return { run: input.run, request: input.request, created: true };
    });
  }

  async enqueueRunRequest(request: RunRequest): Promise<RunRequest> {
    const database = this.#getDatabase();
    return sqliteTransaction(database, () => {
      const existing = database
        .prepare("SELECT * FROM run_requests WHERE idempotency_key = ?")
        .get(request.idempotencyKey) as RunRequestRow | undefined;
      if (existing !== undefined) {
        return runRequestFromRow(existing);
      }
      this.#insertRunRequest(request);
      return request;
    });
  }

  async getRunRequestByIdempotencyKey(idempotencyKey: string): Promise<RunRequest | null> {
    const row = this.#getDatabase()
      .prepare("SELECT * FROM run_requests WHERE idempotency_key = ?")
      .get(idempotencyKey) as RunRequestRow | undefined;
    return row === undefined ? null : runRequestFromRow(row);
  }

  async listRunRequests(runId: string): Promise<RunRequest[]> {
    const rows = this.#getDatabase()
      .prepare("SELECT * FROM run_requests WHERE run_id = ? ORDER BY created_at, id")
      .all(runId) as unknown as RunRequestRow[];
    return rows.map(runRequestFromRow);
  }

  async claimNextRunRequest(input: ClaimRunRequestInput): Promise<RunRequest | null> {
    const database = this.#getDatabase();
    return sqliteTransaction(database, () => {
      const candidate = database
        .prepare(
          `
          SELECT * FROM run_requests
          WHERE status = 'pending'
             OR (status = 'claimed' AND lease_expires_at IS NOT NULL AND lease_expires_at <= ?)
          ORDER BY created_at, id
          LIMIT 1
        `,
        )
        .get(input.now) as RunRequestRow | undefined;
      if (candidate === undefined) {
        return null;
      }

      const result = database
        .prepare(
          `
          UPDATE run_requests
          SET status = 'claimed', claimed_by = ?, claimed_at = ?, lease_expires_at = ?,
              attempt = attempt + 1, failure_json = NULL, updated_at = ?
          WHERE id = ?
            AND (status = 'pending'
              OR (status = 'claimed' AND lease_expires_at IS NOT NULL AND lease_expires_at <= ?))
        `,
        )
        .run(input.runnerId, input.now, input.leaseExpiresAt, input.now, candidate.id, input.now);
      if (Number(result.changes) !== 1) {
        return null;
      }
      const claimed = database
        .prepare("SELECT * FROM run_requests WHERE id = ?")
        .get(candidate.id) as unknown as RunRequestRow;
      return runRequestFromRow(claimed);
    });
  }

  async renewRunRequestLease(
    requestId: string,
    runnerId: string,
    now: string,
    leaseExpiresAt: string,
  ): Promise<boolean> {
    const result = this.#getDatabase()
      .prepare(
        `
        UPDATE run_requests SET lease_expires_at = ?, updated_at = ?
        WHERE id = ? AND status = 'claimed' AND claimed_by = ?
      `,
      )
      .run(leaseExpiresAt, now, requestId, runnerId);
    return Number(result.changes) === 1;
  }

  async completeRunRequest(
    requestId: string,
    runnerId: string,
    completedAt: string,
  ): Promise<void> {
    const result = this.#getDatabase()
      .prepare(
        `
        UPDATE run_requests
        SET status = 'completed', lease_expires_at = NULL, updated_at = ?, completed_at = ?
        WHERE id = ? AND status = 'claimed' AND claimed_by = ?
      `,
      )
      .run(completedAt, completedAt, requestId, runnerId);
    if (Number(result.changes) !== 1) {
      throw new Error(`Run request ${requestId} is not actively claimed by ${runnerId}.`);
    }
  }

  async failRunRequest(
    requestId: string,
    runnerId: string,
    failure: RunFailure,
    failedAt: string,
  ): Promise<void> {
    const result = this.#getDatabase()
      .prepare(
        `
        UPDATE run_requests
        SET status = 'failed', lease_expires_at = NULL, failure_json = ?,
            updated_at = ?, completed_at = ?
        WHERE id = ? AND status = 'claimed' AND claimed_by = ?
      `,
      )
      .run(serialize(failure), failedAt, failedAt, requestId, runnerId);
    if (Number(result.changes) !== 1) {
      throw new Error(`Run request ${requestId} is not actively claimed by ${runnerId}.`);
    }
  }

  async hasPendingCancellation(runId: string): Promise<boolean> {
    const row = this.#getDatabase()
      .prepare(
        `
        SELECT id FROM run_requests
        WHERE run_id = ? AND action = 'cancel' AND status IN ('pending', 'claimed')
        LIMIT 1
      `,
      )
      .get(runId) as { id: string } | undefined;
    return row !== undefined;
  }

  async acquireRunnerLeadership(input: AcquireRunnerLeadershipInput): Promise<boolean> {
    const result = this.#getDatabase()
      .prepare(
        `
        INSERT INTO runner_leadership(
          singleton_id, runner_id, acquired_at, lease_expires_at, updated_at
        ) VALUES (1, ?, ?, ?, ?)
        ON CONFLICT(singleton_id) DO UPDATE SET
          runner_id = excluded.runner_id,
          acquired_at = CASE
            WHEN runner_leadership.runner_id = excluded.runner_id
              THEN runner_leadership.acquired_at
            ELSE excluded.acquired_at
          END,
          lease_expires_at = excluded.lease_expires_at,
          updated_at = excluded.updated_at
        WHERE runner_leadership.runner_id = excluded.runner_id
           OR runner_leadership.lease_expires_at <= excluded.updated_at
      `,
      )
      .run(input.runnerId, input.now, input.leaseExpiresAt, input.now);
    return Number(result.changes) === 1;
  }

  async renewRunnerLeadership(input: AcquireRunnerLeadershipInput): Promise<boolean> {
    const result = this.#getDatabase()
      .prepare(
        `
        UPDATE runner_leadership
        SET lease_expires_at = ?, updated_at = ?
        WHERE singleton_id = 1
          AND runner_id = ?
          AND lease_expires_at > ?
      `,
      )
      .run(input.leaseExpiresAt, input.now, input.runnerId, input.now);
    return Number(result.changes) === 1;
  }

  async releaseRunnerLeadership(runnerId: string): Promise<void> {
    this.#getDatabase()
      .prepare("DELETE FROM runner_leadership WHERE singleton_id = 1 AND runner_id = ?")
      .run(runnerId);
  }

  async upsertRunnerHeartbeat(heartbeat: RunnerHeartbeat): Promise<void> {
    this.#getDatabase()
      .prepare(
        `
        INSERT INTO runner_heartbeats(
          runner_id, hostname, process_id, started_at, last_seen_at, metadata_json
        ) VALUES (?, ?, ?, ?, ?, ?)
        ON CONFLICT(runner_id) DO UPDATE SET
          hostname = excluded.hostname,
          process_id = excluded.process_id,
          started_at = excluded.started_at,
          last_seen_at = excluded.last_seen_at,
          metadata_json = excluded.metadata_json
      `,
      )
      .run(
        heartbeat.runnerId,
        heartbeat.hostname,
        heartbeat.processId,
        heartbeat.startedAt,
        heartbeat.lastSeenAt,
        serialize(heartbeat.metadata),
      );
  }

  async removeRunnerHeartbeat(runnerId: string): Promise<void> {
    this.#getDatabase().prepare("DELETE FROM runner_heartbeats WHERE runner_id = ?").run(runnerId);
  }

  async getLatestRunnerHeartbeat(): Promise<RunnerHeartbeat | null> {
    const row = this.#getDatabase()
      .prepare("SELECT * FROM runner_heartbeats ORDER BY last_seen_at DESC LIMIT 1")
      .get() as RunnerHeartbeatRow | undefined;
    return row === undefined ? null : heartbeatFromRow(row);
  }

  async getMigrationVersion(): Promise<string | null> {
    const row = this.#getDatabase()
      .prepare("SELECT id FROM schema_migrations ORDER BY id DESC LIMIT 1")
      .get() as { id: string } | undefined;
    return row?.id ?? null;
  }

  async getDatabaseInstanceId(): Promise<string> {
    const row = this.#getDatabase()
      .prepare("SELECT value FROM local_runtime_metadata WHERE key = 'database_instance_id'")
      .get() as { value: string } | undefined;
    if (row === undefined) {
      throw new Error("SQLite database instance identifier is missing.");
    }
    return row.value;
  }

  async getRun(runId: string): Promise<LocalRun | null> {
    const row = this.#getDatabase().prepare("SELECT * FROM runs WHERE id = ?").get(runId) as
      RunRow | undefined;
    return row === undefined ? null : runFromRow(row);
  }

  async getMission(runId: string): Promise<LocalMission | null> {
    const row = this.#getDatabase()
      .prepare("SELECT mission_id, input_json, source_file, started_at FROM runs WHERE id = ?")
      .get(runId) as
      | { mission_id: string; input_json: string; source_file: string; started_at: string }
      | undefined;
    if (row === undefined) {
      return null;
    }
    return LocalMissionSchema.parse({
      id: row.mission_id,
      input: parseJson(row.input_json),
      sourceFile: row.source_file,
      createdAt: row.started_at,
    });
  }

  async listRuns(limit = 20): Promise<LocalRun[]> {
    const rows = this.#getDatabase()
      .prepare("SELECT * FROM runs ORDER BY started_at DESC LIMIT ?")
      .all(limit) as unknown as RunRow[];
    return rows.map(runFromRow);
  }

  async persistRunAndEvent(run: LocalRun, event: LocalRunEvent): Promise<void> {
    const database = this.#getDatabase();
    sqliteTransaction(database, () => {
      this.#updateRun(run);
      this.#insertEvent(event);
    });
  }

  async findCompletedStageExecution(
    runId: string,
    stageName: LocalRunPhase,
    stageVersion: string,
    inputFingerprint: string,
  ): Promise<StageExecution | null> {
    const row = this.#getDatabase()
      .prepare(
        `
        SELECT * FROM stage_executions
        WHERE run_id = ? AND stage_name = ? AND stage_version = ?
          AND input_fingerprint = ? AND status = 'completed'
        ORDER BY attempt DESC LIMIT 1
      `,
      )
      .get(runId, stageName, stageVersion, inputFingerprint) as StageRow | undefined;
    return row === undefined ? null : stageFromRow(row);
  }

  async getNextStageAttempt(runId: string, stageName: LocalRunPhase): Promise<number> {
    const row = this.#getDatabase()
      .prepare(
        "SELECT MAX(attempt) AS maximum FROM stage_executions WHERE run_id = ? AND stage_name = ?",
      )
      .get(runId, stageName) as { maximum: number | null };
    return (row.maximum ?? 0) + 1;
  }

  async listStageExecutions(runId: string): Promise<StageExecution[]> {
    const rows = this.#getDatabase()
      .prepare("SELECT * FROM stage_executions WHERE run_id = ? ORDER BY started_at, attempt")
      .all(runId) as unknown as StageRow[];
    return rows.map(stageFromRow);
  }

  async startStage(input: StartStagePersistence): Promise<void> {
    const database = this.#getDatabase();
    sqliteTransaction(database, () => {
      this.#updateRun(input.run);
      database
        .prepare(
          `
          INSERT INTO stage_executions(
            id, run_id, stage_name, stage_version, status, input_fingerprint,
            attempt, started_at, completed_at, failure_json
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL, NULL)
        `,
        )
        .run(
          input.execution.id,
          input.execution.runId,
          input.execution.stageName,
          input.execution.stageVersion,
          input.execution.status,
          input.execution.inputFingerprint,
          input.execution.attempt,
          input.execution.startedAt,
        );
      this.#insertEvent(input.event);
    });
  }

  async completeStage(input: CompleteStagePersistence): Promise<void> {
    const database = this.#getDatabase();
    sqliteTransaction(database, () => {
      const result = database
        .prepare(
          `
          UPDATE stage_executions
          SET status = 'completed', completed_at = ?, failure_json = NULL
          WHERE id = ? AND status = 'running'
        `,
        )
        .run(input.completedAt, input.executionId);
      if (Number(result.changes) !== 1) {
        throw new Error(`Stage execution ${input.executionId} was not running.`);
      }
      database
        .prepare(
          `
          INSERT INTO artifacts(
            id, run_id, artifact_type, schema_version, version, stage_name,
            content_hash, file_name, data_json, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
        )
        .run(
          input.artifact.id,
          input.artifact.runId,
          input.artifact.artifactType,
          input.artifact.schemaVersion,
          input.artifact.version,
          input.artifact.stage,
          input.artifact.contentHash,
          input.artifact.fileName,
          serialize(input.artifact.data),
          input.artifact.createdAt,
        );
      this.#updateRun(input.run);
      this.#insertEvent(input.event);
    });
  }

  async failStage(input: FailStagePersistence): Promise<void> {
    const database = this.#getDatabase();
    sqliteTransaction(database, () => {
      database
        .prepare(
          `
          UPDATE stage_executions
          SET status = 'failed', completed_at = ?, failure_json = ?
          WHERE id = ? AND status = 'running'
        `,
        )
        .run(input.failedAt, serialize(input.run.failure), input.executionId);
      this.#updateRun(input.run);
      this.#insertEvent(input.event);
    });
  }

  async getLatestArtifact(
    runId: string,
    artifactType: ArtifactType,
  ): Promise<ArtifactRecord | null> {
    const row = this.#getDatabase()
      .prepare(
        `
        SELECT * FROM artifacts
        WHERE run_id = ? AND artifact_type = ?
        ORDER BY version DESC LIMIT 1
      `,
      )
      .get(runId, artifactType) as ArtifactRow | undefined;
    return row === undefined ? null : artifactFromRow(row);
  }

  async listArtifacts(runId: string): Promise<ArtifactRecord[]> {
    const rows = this.#getDatabase()
      .prepare("SELECT * FROM artifacts WHERE run_id = ? ORDER BY created_at, version")
      .all(runId) as unknown as ArtifactRow[];
    return rows.map(artifactFromRow);
  }

  async recordToolCall(record: ToolCallRecord): Promise<void> {
    this.#getDatabase()
      .prepare(
        `
        INSERT INTO tool_calls(
          id, run_id, stage_name, tool_name, provider, request_fingerprint,
          request_json, response_json, status, attempt, cost_usd,
          input_tokens, output_tokens, latency_ms, provider_request_id,
          error_json, created_at, completed_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      )
      .run(
        record.id,
        record.runId,
        record.stageName,
        record.toolName,
        record.provider,
        record.requestFingerprint,
        serialize(record.request),
        record.response === undefined ? null : serialize(record.response),
        record.status,
        record.attempt,
        record.costUsd,
        record.inputTokens,
        record.outputTokens,
        record.latencyMs ?? null,
        record.providerRequestId ?? null,
        record.error === undefined ? null : serialize(record.error),
        record.createdAt,
        record.completedAt ?? null,
      );
  }

  async listToolCalls(runId: string): Promise<ToolCallRecord[]> {
    const rows = this.#getDatabase()
      .prepare("SELECT * FROM tool_calls WHERE run_id = ? ORDER BY created_at, id")
      .all(runId) as unknown as ToolCallRow[];
    return rows.map(toolCallFromRow);
  }

  async listRunEvents(runId: string): Promise<LocalRunEvent[]> {
    const rows = this.#getDatabase()
      .prepare("SELECT * FROM run_events WHERE run_id = ? ORDER BY created_at, id")
      .all(runId) as unknown as EventRow[];
    return rows.map(eventFromRow);
  }

  #getDatabase(): DatabaseSync {
    if (this.#database === null) {
      throw new Error("SQLite store has not been initialized.");
    }
    return this.#database;
  }

  #insertRun(run: LocalRun, mission: LocalMission): void {
    this.#getDatabase()
      .prepare(
        `
        INSERT INTO runs(
          id, mission_id, mission_name, status, phase, input_json, source_file,
          config_json, budget_json, usage_json, failure_json,
          started_at, updated_at, completed_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      )
      .run(
        run.id,
        run.missionId,
        run.missionName,
        run.status,
        run.phase,
        serialize(mission.input),
        mission.sourceFile,
        serialize(run.config),
        serialize(run.budget),
        serialize(run.usage),
        run.failure === undefined ? null : serialize(run.failure),
        run.startedAt,
        run.updatedAt,
        run.completedAt ?? null,
      );
  }

  #insertRunRequest(request: RunRequest): void {
    this.#getDatabase()
      .prepare(
        `
        INSERT INTO run_requests(
          id, run_id, action, status, idempotency_key, claimed_by, claimed_at,
          lease_expires_at, attempt, failure_json, created_at, updated_at, completed_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      )
      .run(
        request.id,
        request.runId,
        request.action,
        request.status,
        request.idempotencyKey,
        request.claimedBy ?? null,
        request.claimedAt ?? null,
        request.leaseExpiresAt ?? null,
        request.attempt,
        request.failure === undefined ? null : serialize(request.failure),
        request.createdAt,
        request.updatedAt,
        request.completedAt ?? null,
      );
  }

  #updateRun(run: LocalRun): void {
    this.#getDatabase()
      .prepare(
        `
        UPDATE runs SET
          status = ?, phase = ?, config_json = ?, budget_json = ?, usage_json = ?,
          failure_json = ?, updated_at = ?, completed_at = ?
        WHERE id = ?
      `,
      )
      .run(
        run.status,
        run.phase,
        serialize(run.config),
        serialize(run.budget),
        serialize(run.usage),
        run.failure === undefined ? null : serialize(run.failure),
        run.updatedAt,
        run.completedAt ?? null,
        run.id,
      );
  }

  #insertEvent(event: LocalRunEvent): void {
    this.#getDatabase()
      .prepare(
        `
        INSERT INTO run_events(id, run_id, event_type, phase, data_json, created_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `,
      )
      .run(
        event.id,
        event.runId,
        event.eventType,
        event.phase,
        serialize(event.data),
        event.createdAt,
      );
  }
}
