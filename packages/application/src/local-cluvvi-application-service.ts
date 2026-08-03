import {
  ArtifactTypeSchema,
  LocalRunEventSchema,
  MissionInputSchemaV1,
  OpaqueIdSchema,
  ORDERED_RUN_PHASES,
  RunRequestSchema,
  createOpaqueId,
  type ArtifactRecord,
  type ArtifactType,
  type DiscoveryProviderMode,
  type DiscoveryProviderPolicy,
  type DiscoveryRuntimeMode,
  type LocalRun,
  type LocalRunEvent,
  type MissionInputV1,
  type RunRequest,
} from "@cluvvi/core";
import {
  LOCAL_ENGINE_VERSION,
  createRunCreationRecords,
  readLiveProviderTelemetry,
  readProviderPolicyTrace,
} from "@cluvvi/engine";
import type { LocalCluvviPaths, LocalRuntimeStore } from "@cluvvi/storage";
import type {
  CapabilityReport,
  CluvviApplicationService,
  CreateRunResult,
  LocalDiagnostics,
  RunStageView,
  RunView,
} from "./contracts";

const FIXTURE_WARNING =
  "The current workflow processes a version-controlled search_results.v2 fixture through Evidence, Identity, Ranking, and Buyer Map. It does not contain live market discovery.";
const LOCAL_DISCOVERY_WARNING =
  "This run uses the standalone local Discovery Engine with fixture providers. It does not represent live customer discovery.";
const LIVE_DISCOVERY_WARNING =
  "This run uses provider-policy-controlled search snippets through the local Discovery Engine. Full pages are not crawled or deeply extracted, and identity or contact details are not verified.";

export class ApplicationServiceError extends Error {
  readonly code: string;
  readonly status: number;
  readonly retryable: boolean;

  constructor(input: { code: string; message: string; status: number; retryable?: boolean }) {
    super(input.message);
    this.name = "ApplicationServiceError";
    this.code = input.code;
    this.status = input.status;
    this.retryable = input.retryable ?? false;
  }
}

export class LocalCluvviApplicationService implements CluvviApplicationService {
  readonly #store: LocalRuntimeStore;
  readonly #paths: LocalCluvviPaths;
  readonly #discoveryRuntimeMode: DiscoveryRuntimeMode;
  readonly #discoveryProviderMode: DiscoveryProviderMode;
  readonly #discoveryProviderPolicy: DiscoveryProviderPolicy;
  readonly #now: () => string;

  constructor(input: {
    store: LocalRuntimeStore;
    paths: LocalCluvviPaths;
    discoveryRuntimeMode?: DiscoveryRuntimeMode;
    discoveryProviderMode?: DiscoveryProviderMode;
    discoveryProviderPolicy?: DiscoveryProviderPolicy;
    now?: () => string;
  }) {
    this.#store = input.store;
    this.#paths = input.paths;
    this.#discoveryRuntimeMode = input.discoveryRuntimeMode ?? "fixture";
    this.#discoveryProviderMode = input.discoveryProviderMode ?? "fixture_only";
    this.#discoveryProviderPolicy = input.discoveryProviderPolicy ?? "free_only";
    this.#now = input.now ?? (() => new Date().toISOString());
  }

  async createRun(input: MissionInputV1, idempotencyKey: string): Promise<CreateRunResult> {
    const missionInput = MissionInputSchemaV1.parse(input);
    const normalizedKey = idempotencyKey.trim();
    if (normalizedKey.length < 8 || normalizedKey.length > 200) {
      throw new ApplicationServiceError({
        code: "IDEMPOTENCY_KEY_INVALID",
        message: "Idempotency-Key must contain between 8 and 200 characters.",
        status: 400,
      });
    }

    await this.#store.initialize();
    const now = this.#now();
    const records = createRunCreationRecords({
      mission: missionInput,
      sourceFile: "browser://mission-form",
      now,
      discoveryRuntimeMode: this.#discoveryRuntimeMode,
      discoveryProviderMode: this.#discoveryProviderMode,
      discoveryProviderPolicy: this.#discoveryProviderPolicy,
    });
    const request = RunRequestSchema.parse({
      id: createOpaqueId("request"),
      runId: records.run.id,
      action: "start",
      status: "pending",
      idempotencyKey: normalizedKey,
      attempt: 0,
      createdAt: now,
      updatedAt: now,
    });
    const persisted = await this.#store.createQueuedRun({ ...records, request });
    const view = await this.getRun(persisted.run.id);
    if (view === null) {
      throw new Error(`Run ${persisted.run.id} disappeared after creation.`);
    }
    return { view, request: persisted.request, created: persisted.created };
  }

  async getRun(runId: string): Promise<RunView | null> {
    OpaqueIdSchema.parse(runId);
    await this.#store.initialize();
    const run = await this.#store.getRun(runId);
    if (run === null) {
      return null;
    }
    const mission = await this.#store.getMission(runId);
    if (mission === null) {
      throw new Error(`Mission for run ${runId} was not found.`);
    }
    const [executions, events, artifacts, requests] = await Promise.all([
      this.#store.listStageExecutions(runId),
      this.#store.listRunEvents(runId),
      this.#store.listArtifacts(runId),
      this.#store.listRunRequests(runId),
    ]);
    const reused = new Set(
      events.filter((event) => event.eventType === "stage_reused").map((event) => event.phase),
    );
    const providerTelemetry =
      run.config.discoveryProviderMode === "live_search"
        ? await readLiveProviderTelemetry({
            runsDirectory: this.#paths.runsDirectory,
            runId,
          }).catch(() => null)
        : null;
    const providerPolicyTrace =
      run.config.discoveryProviderMode === "live_search"
        ? await readProviderPolicyTrace({
            runsDirectory: this.#paths.runsDirectory,
            runId,
          }).catch(() => null)
        : null;
    const stages: RunStageView[] = ORDERED_RUN_PHASES.map((name) => {
      const attempts = executions.filter((execution) => execution.stageName === name);
      const latest = attempts.at(-1);
      if (reused.has(name)) {
        return {
          name,
          status: "reused",
          ...(latest === undefined ? {} : this.#stageTiming(latest)),
        };
      }
      if (latest !== undefined) {
        return {
          name,
          status: latest.status,
          ...this.#stageTiming(latest),
          ...(latest.failure === undefined ? {} : { failureCode: latest.failure.code }),
        };
      }
      return { name, status: "pending" };
    });
    return {
      run,
      mission,
      stages,
      events,
      artifacts,
      requests,
      providerTelemetry,
      providerPolicyTrace,
      fixture: run.config.discoveryProviderMode === "fixture_only",
    };
  }

  async listRuns(input: { limit?: number; status?: LocalRun["status"] } = {}): Promise<LocalRun[]> {
    await this.#store.initialize();
    const runs = await this.#store.listRuns(input.limit ?? 20);
    return input.status === undefined ? runs : runs.filter((run) => run.status === input.status);
  }

  async getRunEvents(
    runId: string,
    input: { afterTimestamp?: string } = {},
  ): Promise<LocalRunEvent[]> {
    OpaqueIdSchema.parse(runId);
    await this.#store.initialize();
    const events = await this.#store.listRunEvents(runId);
    if (input.afterTimestamp === undefined) {
      return events;
    }
    const boundary = Date.parse(input.afterTimestamp);
    if (Number.isNaN(boundary)) {
      throw new ApplicationServiceError({
        code: "EVENT_CURSOR_INVALID",
        message: "afterTimestamp must be a valid ISO timestamp.",
        status: 400,
      });
    }
    return events
      .filter((event) => Date.parse(event.createdAt) > boundary)
      .map((event) => LocalRunEventSchema.parse(event));
  }

  async getRunArtifact(runId: string, artifactType: ArtifactType): Promise<ArtifactRecord | null> {
    OpaqueIdSchema.parse(runId);
    const validatedType = ArtifactTypeSchema.parse(artifactType);
    await this.#store.initialize();
    return this.#store.getLatestArtifact(runId, validatedType);
  }

  async requestResume(runId: string): Promise<RunRequest> {
    const run = await this.#requireRun(runId);
    if (
      !(["failed", "budget_exhausted"] as const).includes(
        run.status as "failed" | "budget_exhausted",
      )
    ) {
      throw new ApplicationServiceError({
        code: "RUN_NOT_RESUMABLE",
        message: `Run ${runId} cannot be resumed from status ${run.status}.`,
        status: 409,
      });
    }
    return this.#enqueue(run, "resume", `resume:${run.id}:${run.updatedAt}`);
  }

  async requestCancel(runId: string): Promise<RunRequest> {
    const run = await this.#requireRun(runId);
    if (["completed", "cancelled"].includes(run.status)) {
      throw new ApplicationServiceError({
        code: "RUN_NOT_CANCELLABLE",
        message: `Run ${runId} cannot be cancelled from status ${run.status}.`,
        status: 409,
      });
    }
    return this.#enqueue(run, "cancel", `cancel:${run.id}:${run.updatedAt}`);
  }

  async getCapabilities(): Promise<CapabilityReport> {
    return {
      mode: this.#discoveryProviderMode === "live_search" ? "live_search" : "fixture",
      discoveryRuntimeMode: this.#discoveryRuntimeMode,
      discoveryProviderMode: this.#discoveryProviderMode,
      discoveryProviderPolicy: this.#discoveryProviderPolicy,
      capabilities: {
        localEngine: true,
        missionCompiler: false,
        webSearch: this.#discoveryProviderMode === "live_search",
        webFetch: false,
        enrichment: false,
        youtube: false,
        outreach: false,
      },
      warnings: [
        this.#discoveryProviderMode === "live_search"
          ? LIVE_DISCOVERY_WARNING
          : this.#discoveryRuntimeMode === "local_discovery_engine"
            ? LOCAL_DISCOVERY_WARNING
            : FIXTURE_WARNING,
      ],
    };
  }

  async getDiagnostics(): Promise<LocalDiagnostics> {
    await this.#store.initialize();
    const heartbeat = await this.#store.getLatestRunnerHeartbeat();
    const available = heartbeat !== null && Date.now() - Date.parse(heartbeat.lastSeenAt) <= 15_000;
    return {
      projectRoot: this.#paths.projectRoot,
      databasePath: this.#paths.databasePath,
      runsDirectory: this.#paths.runsDirectory,
      databaseInstanceId: await this.#store.getDatabaseInstanceId(),
      migrationVersion: await this.#store.getMigrationVersion(),
      engineVersion: LOCAL_ENGINE_VERSION,
      mode: this.#discoveryProviderMode === "live_search" ? "live_search" : "fixture",
      discoveryRuntimeMode: this.#discoveryRuntimeMode,
      discoveryProviderMode: this.#discoveryProviderMode,
      discoveryProviderPolicy: this.#discoveryProviderPolicy,
      runner: { available, heartbeat },
    };
  }

  async #requireRun(runId: string): Promise<LocalRun> {
    OpaqueIdSchema.parse(runId);
    await this.#store.initialize();
    const run = await this.#store.getRun(runId);
    if (run === null) {
      throw new ApplicationServiceError({
        code: "RUN_NOT_FOUND",
        message: `Run ${runId} was not found.`,
        status: 404,
      });
    }
    return run;
  }

  async #enqueue(
    run: LocalRun,
    action: "resume" | "cancel",
    idempotencyKey: string,
  ): Promise<RunRequest> {
    const now = this.#now();
    return this.#store.enqueueRunRequest(
      RunRequestSchema.parse({
        id: createOpaqueId("request"),
        runId: run.id,
        action,
        status: "pending",
        idempotencyKey,
        attempt: 0,
        createdAt: now,
        updatedAt: now,
      }),
    );
  }

  #stageTiming(execution: {
    attempt: number;
    startedAt: string;
    completedAt?: string | undefined;
  }): Pick<RunStageView, "attempt" | "startedAt" | "completedAt"> {
    return {
      attempt: execution.attempt,
      startedAt: execution.startedAt,
      ...(execution.completedAt === undefined ? {} : { completedAt: execution.completedAt }),
    };
  }
}
