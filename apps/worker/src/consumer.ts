import { handleMissionCompileMessage, type MissionCompileProcessor } from "@cluvvi/core";
import type { MissionCompileGateway } from "@cluvvi/database";
import type { Logger } from "./logger";
import type { WorkerState } from "./state";

export type MissionCompileQueue = Pick<MissionCompileGateway, "lease"> & MissionCompileProcessor;

export async function processMissionCompileBatch(input: {
  queue: MissionCompileQueue;
  logger: Logger;
  state: WorkerState;
  quantity?: number;
  visibilityTimeoutSeconds?: number;
}): Promise<number> {
  const quantity = input.quantity ?? 5;
  const visibilityTimeoutSeconds = input.visibilityTimeoutSeconds ?? 60;
  input.state.markPoll();
  const messages = await input.queue.lease({ quantity, visibilityTimeoutSeconds });

  let processedCount = 0;
  for (const message of messages) {
    const result = await handleMissionCompileMessage(message, input.queue);
    processedCount += 1;
    input.logger.info("Mission compile message handled", {
      queueMessageId: message.queueMessageId,
      runId: result.runId,
      outcome: result.outcome,
      status: result.status,
    });
  }

  input.state.markSuccess(processedCount);
  return processedCount;
}
