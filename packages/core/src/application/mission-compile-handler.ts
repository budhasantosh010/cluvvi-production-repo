import { LeasedQueueMessageSchema, type LeasedQueueMessage } from "../schemas/queue";
import { ProcessCompileResultSchema, type ProcessCompileResult } from "../schemas/run";

export interface MissionCompileProcessor {
  process(message: LeasedQueueMessage): Promise<ProcessCompileResult>;
}

export async function handleMissionCompileMessage(
  rawMessage: unknown,
  processor: MissionCompileProcessor,
): Promise<ProcessCompileResult> {
  const message = LeasedQueueMessageSchema.parse(rawMessage);

  const result = await processor.process(message);
  return ProcessCompileResultSchema.parse(result);
}
