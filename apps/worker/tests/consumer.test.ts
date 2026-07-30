import { describe, expect, it } from "vitest";
import type {
  LeasedQueueMessage,
  MissionCompileProcessor,
  ProcessCompileResult,
} from "@cluvvi/core";
import { processMissionCompileBatch, type MissionCompileQueue } from "../src/consumer";
import type { Logger } from "../src/logger";
import { WorkerState } from "../src/state";

const message: LeasedQueueMessage = {
  queueMessageId: 1,
  readCount: 1,
  enqueuedAt: "2026-07-30T13:00:00.000+00:00",
  visibilityDeadline: "2026-07-30T13:01:00.000+00:00",
  message: {
    version: 1,
    messageId: "018f1495-9be7-7c36-a310-c0461a74f302",
    jobType: "mission_compile",
    runId: "018f1495-9be7-7c36-a310-c0461a74f301",
    entityId: null,
    attempt: 1,
    idempotencyKey: "compile:018f1495-9be7-7c36-a310-c0461a74f301",
    createdAt: "2026-07-30T13:00:00.000+00:00",
    payload: {},
  },
};

const silentLogger: Logger = {
  debug: () => undefined,
  info: () => undefined,
  warn: () => undefined,
  error: () => undefined,
};

class IdempotentFakeQueue implements MissionCompileQueue, MissionCompileProcessor {
  readonly #seen = new Set<string>();
  readonly #messages: LeasedQueueMessage[];

  constructor(messages: LeasedQueueMessage[]) {
    this.#messages = messages;
  }

  async lease(): Promise<LeasedQueueMessage[]> {
    return this.#messages;
  }

  async process(leased: LeasedQueueMessage): Promise<ProcessCompileResult> {
    const key = leased.message.idempotencyKey;
    const duplicate = this.#seen.has(key);
    this.#seen.add(key);
    return {
      outcome: duplicate ? "duplicate" : "processed",
      runId: leased.message.runId,
      status: "compiling",
    };
  }
}

describe("worker consumer", () => {
  it("processes leased messages and records truthful health state", async () => {
    const state = new WorkerState();
    const queue = new IdempotentFakeQueue([message]);

    await expect(processMissionCompileBatch({ queue, logger: silentLogger, state })).resolves.toBe(
      1,
    );
    expect(state.snapshot()).toMatchObject({
      status: "ready",
      consecutiveErrors: 0,
      processedMessages: 1,
    });
  });

  it("makes duplicate delivery harmless at the handler boundary", async () => {
    const state = new WorkerState();
    const queue = new IdempotentFakeQueue([message]);
    await processMissionCompileBatch({ queue, logger: silentLogger, state });
    await processMissionCompileBatch({ queue, logger: silentLogger, state });
    expect(state.snapshot().processedMessages).toBe(2);
  });
});
