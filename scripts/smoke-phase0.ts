import {
  createMissionCompileMessage,
  handleMissionCompileMessage,
  type LeasedQueueMessage,
  type MissionCompileProcessor,
  type ProcessCompileResult,
} from "@cluvvi/core";
import { randomUUID } from "node:crypto";

class InMemoryProcessor implements MissionCompileProcessor {
  readonly #seen = new Set<string>();

  async process(message: LeasedQueueMessage): Promise<ProcessCompileResult> {
    const key = message.message.idempotencyKey;
    const duplicate = this.#seen.has(key);
    this.#seen.add(key);

    return {
      outcome: duplicate ? "duplicate" : "processed",
      runId: message.message.runId,
      status: "compiling",
    };
  }
}

async function main(): Promise<void> {
  const runId = randomUUID();
  const envelope = createMissionCompileMessage({
    messageId: randomUUID(),
    runId,
    idempotencyKey: `compile:${runId}`,
    createdAt: new Date().toISOString(),
  });
  const lease: LeasedQueueMessage = {
    queueMessageId: 1,
    readCount: 1,
    enqueuedAt: new Date().toISOString(),
    visibilityDeadline: new Date(Date.now() + 60_000).toISOString(),
    message: envelope,
  };
  const processor = new InMemoryProcessor();
  const first = await handleMissionCompileMessage(lease, processor);
  const duplicate = await handleMissionCompileMessage(lease, processor);

  console.log(
    JSON.stringify(
      {
        scenario: "phase-zero-contract-smoke",
        runId,
        first,
        duplicate,
        invariant: "duplicate delivery did not create a second transition",
      },
      null,
      2,
    ),
  );
}

void main();
