import { setTimeout as sleep } from "node:timers/promises";
import type { MissionCompileQueue } from "./consumer";
import { processMissionCompileBatch } from "./consumer";
import type { Logger } from "./logger";
import type { WorkerState } from "./state";

export async function runWorkerLoop(input: {
  queue: MissionCompileQueue;
  logger: Logger;
  state: WorkerState;
  pollIntervalMs: number;
  signal: AbortSignal;
  once?: boolean;
}): Promise<void> {
  input.state.markReady();

  for (;;) {
    if (input.signal.aborted) {
      break;
    }

    try {
      await processMissionCompileBatch({
        queue: input.queue,
        logger: input.logger,
        state: input.state,
      });
    } catch (error) {
      input.state.markError();
      input.logger.error("Worker poll failed", {
        errorName: error instanceof Error ? error.name : "UnknownError",
        errorMessage: error instanceof Error ? error.message : "Unknown worker error",
      });
    }

    if (input.once) {
      break;
    }

    try {
      await sleep(input.pollIntervalMs, undefined, { signal: input.signal });
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        continue;
      }
      throw error;
    }
  }
}
