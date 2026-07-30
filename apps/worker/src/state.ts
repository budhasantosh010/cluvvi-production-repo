export type WorkerSnapshot = {
  status: "starting" | "ready" | "degraded" | "stopping";
  startedAt: string;
  lastPollAt: string | null;
  lastSuccessAt: string | null;
  lastErrorAt: string | null;
  consecutiveErrors: number;
  processedMessages: number;
};

export class WorkerState {
  readonly #startedAt = new Date().toISOString();
  #status: WorkerSnapshot["status"] = "starting";
  #lastPollAt: string | null = null;
  #lastSuccessAt: string | null = null;
  #lastErrorAt: string | null = null;
  #consecutiveErrors = 0;
  #processedMessages = 0;

  markReady(): void {
    this.#status = "ready";
  }

  markPoll(): void {
    this.#lastPollAt = new Date().toISOString();
  }

  markSuccess(processedCount: number): void {
    this.#status = "ready";
    this.#lastSuccessAt = new Date().toISOString();
    this.#consecutiveErrors = 0;
    this.#processedMessages += processedCount;
  }

  markError(): void {
    this.#status = "degraded";
    this.#lastErrorAt = new Date().toISOString();
    this.#consecutiveErrors += 1;
  }

  markStopping(): void {
    this.#status = "stopping";
  }

  snapshot(): WorkerSnapshot {
    return {
      status: this.#status,
      startedAt: this.#startedAt,
      lastPollAt: this.#lastPollAt,
      lastSuccessAt: this.#lastSuccessAt,
      lastErrorAt: this.#lastErrorAt,
      consecutiveErrors: this.#consecutiveErrors,
      processedMessages: this.#processedMessages,
    };
  }
}
