import {
  LocalRunEventSchema,
  LocalRunSchema,
  RunnerHeartbeatSchema,
  classifyError,
  createOpaqueId,
  type DiscoveryProviderMode,
  type DiscoveryProviderPolicy,
  type DiscoveryRuntimeMode,
  type LocalRunPhase,
  type RunRequest,
} from "@cluvvi/core";
import type { CluvviEngine, LocalArtifactWriter } from "@cluvvi/engine";
import type { LocalRuntimeStore } from "@cluvvi/storage";

export interface LocalRunnerOptions {
  store: LocalRuntimeStore;
  engine: CluvviEngine;
  artifactWriter: Pick<LocalArtifactWriter, "ensureRunDirectory">;
  runnerId: string;
  hostname: string;
  processId: number;
  pollIntervalMs?: number;
  leaseDurationMs?: number;
  heartbeatIntervalMs?: number;
  leadershipLeaseDurationMs?: number;
  failStage?: LocalRunPhase;
  discoveryRuntimeMode?: DiscoveryRuntimeMode;
  discoveryProviderMode?: DiscoveryProviderMode;
  discoveryProviderPolicy?: DiscoveryProviderPolicy;
  now?: () => string;
  onReady?: () => void | Promise<void>;
}

export class LocalRunnerLeadershipError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LocalRunnerLeadershipError";
  }
}

export class LocalRunner {
  readonly #store: LocalRuntimeStore;
  readonly #engine: CluvviEngine;
  readonly #artifactWriter: Pick<LocalArtifactWriter, "ensureRunDirectory">;
  readonly #runnerId: string;
  readonly #hostname: string;
  readonly #processId: number;
  readonly #pollIntervalMs: number;
  readonly #leaseDurationMs: number;
  readonly #heartbeatIntervalMs: number;
  readonly #leadershipLeaseDurationMs: number;
  readonly #failStage: LocalRunPhase | undefined;
  readonly #discoveryRuntimeMode: DiscoveryRuntimeMode;
  readonly #discoveryProviderMode: DiscoveryProviderMode;
  readonly #discoveryProviderPolicy: DiscoveryProviderPolicy;
  readonly #now: () => string;
  readonly #startedAt: string;
  readonly #onReady: (() => void | Promise<void>) | undefined;
  #heartbeatPromise: Promise<void> | null = null;
  #leadershipError: Error | null = null;

  constructor(options: LocalRunnerOptions) {
    this.#store = options.store;
    this.#engine = options.engine;
    this.#artifactWriter = options.artifactWriter;
    this.#runnerId = options.runnerId;
    this.#hostname = options.hostname;
    this.#processId = options.processId;
    this.#pollIntervalMs = options.pollIntervalMs ?? 750;
    this.#leaseDurationMs = options.leaseDurationMs ?? 30_000;
    this.#heartbeatIntervalMs = options.heartbeatIntervalMs ?? 5_000;
    this.#leadershipLeaseDurationMs = options.leadershipLeaseDurationMs ?? 20_000;
    this.#failStage = options.failStage;
    this.#discoveryRuntimeMode = options.discoveryRuntimeMode ?? "fixture";
    this.#discoveryProviderMode = options.discoveryProviderMode ?? "fixture_only";
    this.#discoveryProviderPolicy = options.discoveryProviderPolicy ?? "free_only";
    this.#now = options.now ?? (() => new Date().toISOString());
    this.#startedAt = this.#now();
    this.#onReady = options.onReady;
  }

  async start(signal: AbortSignal): Promise<void> {
    await this.#withLeadership(async () => {
      await this.#becomeReady();
      const heartbeatTimer = setInterval(
        () => this.#scheduleHeartbeat(),
        this.#heartbeatIntervalMs,
      );
      try {
        while (!signal.aborted) {
          this.#throwIfLeadershipLost();
          const processed = await this.#processNextRequest(signal);
          this.#throwIfLeadershipLost();
          if (!processed) {
            await this.#sleep(this.#pollIntervalMs, signal);
          }
        }
      } finally {
        clearInterval(heartbeatTimer);
      }
    });
  }

  async startOnce(): Promise<boolean> {
    return this.#withLeadership(async () => {
      await this.#becomeReady();
      const heartbeatTimer = setInterval(
        () => this.#scheduleHeartbeat(),
        this.#heartbeatIntervalMs,
      );
      try {
        const processed = await this.#processNextRequest();
        this.#throwIfLeadershipLost();
        return processed;
      } finally {
        clearInterval(heartbeatTimer);
      }
    });
  }

  async #withLeadership<T>(operation: () => Promise<T>): Promise<T> {
    await this.#store.initialize();
    const acquiredAt = this.#now();
    const acquired = await this.#store.acquireRunnerLeadership({
      runnerId: this.#runnerId,
      now: acquiredAt,
      leaseExpiresAt: this.#leadershipLeaseExpiry(acquiredAt),
    });
    if (!acquired) {
      throw new LocalRunnerLeadershipError(
        "Another Cluvvi local runner owns the SQLite leadership lease. Stop that runner or wait for its lease to expire before starting another one.",
      );
    }

    this.#leadershipError = null;
    try {
      return await operation();
    } finally {
      await this.#heartbeatPromise?.catch(() => undefined);
      try {
        await this.#store.removeRunnerHeartbeat(this.#runnerId);
      } finally {
        await this.#store.releaseRunnerLeadership(this.#runnerId);
      }
    }
  }

  async #becomeReady(): Promise<void> {
    await this.#heartbeat();
    await this.#onReady?.();
  }

  async #processNextRequest(signal?: AbortSignal): Promise<boolean> {
    const now = this.#now();
    const request = await this.#store.claimNextRunRequest({
      runnerId: this.#runnerId,
      now,
      leaseExpiresAt: this.#leaseExpiry(now),
    });
    if (request === null) {
      return false;
    }

    const leaseTimer = setInterval(
      () => {
        const renewedAt = this.#now();
        void this.#store.renewRunRequestLease(
          request.id,
          this.#runnerId,
          renewedAt,
          this.#leaseExpiry(renewedAt),
        );
      },
      Math.max(1_000, Math.floor(this.#leaseDurationMs / 3)),
    );

    try {
      await this.#process(request, signal);
      await this.#store.completeRunRequest(request.id, this.#runnerId, this.#now());
    } catch (error) {
      await this.#store.failRunRequest(
        request.id,
        this.#runnerId,
        classifyError(error),
        this.#now(),
      );
    } finally {
      clearInterval(leaseTimer);
    }
    return true;
  }

  async #process(request: RunRequest, signal?: AbortSignal): Promise<void> {
    if (request.action === "cancel") {
      await this.#cancelWhenSafe(request.runId);
      return;
    }

    await this.#artifactWriter.ensureRunDirectory(request.runId);
    const options = {
      shouldCancel: () => this.#store.hasPendingCancellation(request.runId),
      ...(signal === undefined ? {} : { signal }),
      ...(this.#failStage === undefined ? {} : { failStage: this.#failStage }),
    };
    if (request.action === "resume") {
      await this.#engine.resume(request.runId, options);
      return;
    }
    await this.#engine.run(request.runId, options);
  }

  async #cancelWhenSafe(runId: string): Promise<void> {
    const run = await this.#store.getRun(runId);
    if (run === null || run.status === "completed" || run.status === "cancelled") {
      return;
    }
    if (run.status === "running") {
      return;
    }
    const now = this.#now();
    const cancelledRun = LocalRunSchema.parse({
      ...run,
      status: "cancelled",
      failure: undefined,
      updatedAt: now,
      completedAt: now,
    });
    const event = LocalRunEventSchema.parse({
      id: createOpaqueId("event"),
      runId,
      eventType: "run_cancelled",
      phase: run.phase,
      data: { requestedBy: "local-browser" },
      createdAt: now,
    });
    await this.#store.persistRunAndEvent(cancelledRun, event);
  }

  #scheduleHeartbeat(): void {
    if (this.#heartbeatPromise !== null || this.#leadershipError !== null) {
      return;
    }
    this.#heartbeatPromise = this.#heartbeat()
      .catch((error: unknown) => {
        this.#leadershipError =
          error instanceof Error ? error : new LocalRunnerLeadershipError(String(error));
      })
      .finally(() => {
        this.#heartbeatPromise = null;
      });
  }

  async #heartbeat(): Promise<void> {
    const now = this.#now();
    const renewed = await this.#store.renewRunnerLeadership({
      runnerId: this.#runnerId,
      now,
      leaseExpiresAt: this.#leadershipLeaseExpiry(now),
    });
    if (!renewed) {
      throw new LocalRunnerLeadershipError(
        `Cluvvi runner ${this.#runnerId} lost the SQLite leadership lease.`,
      );
    }
    await this.#store.upsertRunnerHeartbeat(
      RunnerHeartbeatSchema.parse({
        runnerId: this.#runnerId,
        hostname: this.#hostname,
        processId: this.#processId,
        startedAt: this.#startedAt,
        lastSeenAt: now,
        metadata: {
          mode: this.#discoveryProviderMode === "live_search" ? "live_search" : "fixture",
          discoveryRuntimeMode: this.#discoveryRuntimeMode,
          discoveryProviderMode: this.#discoveryProviderMode,
          discoveryProviderPolicy: this.#discoveryProviderPolicy,
          databaseInstanceId: await this.#store.getDatabaseInstanceId(),
        },
      }),
    );
  }

  #throwIfLeadershipLost(): void {
    if (this.#leadershipError !== null) {
      throw this.#leadershipError;
    }
  }

  #leaseExpiry(now: string): string {
    return new Date(Date.parse(now) + this.#leaseDurationMs).toISOString();
  }

  #leadershipLeaseExpiry(now: string): string {
    return new Date(Date.parse(now) + this.#leadershipLeaseDurationMs).toISOString();
  }

  async #sleep(milliseconds: number, signal: AbortSignal): Promise<void> {
    await new Promise<void>((resolve) => {
      const timeout = setTimeout(resolve, milliseconds);
      signal.addEventListener(
        "abort",
        () => {
          clearTimeout(timeout);
          resolve();
        },
        { once: true },
      );
    });
  }
}
