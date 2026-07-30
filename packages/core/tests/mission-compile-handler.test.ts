import { describe, expect, it } from "vitest";
import {
  handleMissionCompileMessage,
  type LeasedQueueMessage,
  type MissionCompileProcessor,
} from "../src";

const leasedMessage: LeasedQueueMessage = {
  queueMessageId: 7,
  readCount: 1,
  enqueuedAt: "2026-07-30T13:00:00.000+00:00",
  visibilityDeadline: "2026-07-30T13:01:00.000+00:00",
  message: {
    version: 1,
    messageId: "018f1495-9be7-7c36-a310-c0461a74f102",
    jobType: "mission_compile",
    runId: "018f1495-9be7-7c36-a310-c0461a74f101",
    entityId: null,
    attempt: 1,
    idempotencyKey: "compile:run:2",
    createdAt: "2026-07-30T13:00:00.000+00:00",
    payload: {},
  },
};

describe("mission compile handler", () => {
  it("validates the lease before delegating to infrastructure", async () => {
    const processor: MissionCompileProcessor = {
      process: async (message) => ({
        outcome: "processed",
        runId: message.message.runId,
        status: "compiling",
      }),
    };

    await expect(handleMissionCompileMessage(leasedMessage, processor)).resolves.toEqual({
      outcome: "processed",
      runId: leasedMessage.message.runId,
      status: "compiling",
    });
  });

  it("fails safely before infrastructure sees malformed content", async () => {
    let called = false;
    const processor: MissionCompileProcessor = {
      process: async () => {
        called = true;
        return { outcome: "processed", runId: leasedMessage.message.runId, status: "compiling" };
      },
    };

    await expect(
      handleMissionCompileMessage({ ...leasedMessage, message: { version: 99 } }, processor),
    ).rejects.toBeDefined();
    expect(called).toBe(false);
  });
});
