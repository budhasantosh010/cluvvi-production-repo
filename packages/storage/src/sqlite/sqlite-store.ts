import {
  ArtifactRecordSchema,
  LocalMissionSchema,
  LocalRunSchema,
  LocalRunEventSchema,
  StageExecutionSchema,
  ToolCallRecordSchema,
  type ArtifactRecord,
  type ArtifactType,
  type LocalMission,
  type LocalRun,
  type LocalRunPhase,
  type LocalRunEvent,
  type StageExecution,
  type ToolCallRecord,
} from "@cluvvi/core";
import type { DatabaseSync } from "node:sqlite";
import type {
  CluvviStore,
  CompleteStagePersistence,
  FailStagePersistence,
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

export class SqliteCluvviStore implements CluvviStore {
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
  }

  async close(): Promise<void> {
    this.#database?.close();
    this.#database = null;
  }

  async createRun(run: LocalRun, mission: LocalMission, event: LocalRunEvent): Promise<void> {
    const database = this.#getDatabase();
    sqliteTransaction(database, () => {
      database
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
      this.#insertEvent(event);
    });
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
