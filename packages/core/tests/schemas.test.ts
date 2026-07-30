import { describe, expect, it } from "vitest";
import {
  CreateMissionInputSchema,
  LeasedQueueMessageSchema,
  QueueMessageEnvelopeSchema,
  createMissionCompileMessage,
} from "../src";

const ids = {
  workspace: "018f1495-9be7-7c36-a310-c0461a74f100",
  run: "018f1495-9be7-7c36-a310-c0461a74f101",
  message: "018f1495-9be7-7c36-a310-c0461a74f102",
};

describe("versioned contracts", () => {
  it("normalizes a valid mission while preserving product constraints", () => {
    const mission = CreateMissionInputSchema.parse({
      workspaceId: ids.workspace,
      name: "Find video teams with editing pressure",
      websiteUrl: "https://cluvvi.example/product",
      rawDescription: "An AI rough-cut editor for long-form talking-head video.",
      customerOutcome: "Publish long-form videos faster with less editing labor.",
      priceMin: 99,
      priceMax: 499,
      currency: "usd",
      geographies: ["United States"],
      desiredCount: 20,
      exclusions: ["Short-form-only creators"],
    });

    expect(mission.currency).toBe("USD");
    expect(mission.desiredCount).toBe(20);
  });

  it("rejects an impossible price range", () => {
    const result = CreateMissionInputSchema.safeParse({
      workspaceId: ids.workspace,
      name: "Find video teams",
      websiteUrl: "https://example.com",
      rawDescription: "A detailed enough description of the product being sold.",
      customerOutcome: "A detailed outcome for the customer receiving it.",
      priceMin: 500,
      priceMax: 100,
      geographies: ["UAE"],
    });

    expect(result.success).toBe(false);
  });

  it("rejects unknown queue schema versions", () => {
    const valid = createMissionCompileMessage({
      messageId: ids.message,
      runId: ids.run,
      idempotencyKey: "compile:run:1",
      createdAt: "2026-07-30T13:00:00.000+00:00",
    });

    expect(QueueMessageEnvelopeSchema.parse(valid).version).toBe(1);
    expect(QueueMessageEnvelopeSchema.safeParse({ ...valid, version: 2 }).success).toBe(false);
  });

  it("validates the database lease envelope", () => {
    const message = createMissionCompileMessage({
      messageId: ids.message,
      runId: ids.run,
      idempotencyKey: "compile:run:2",
      createdAt: "2026-07-30T13:00:00.000+00:00",
    });

    expect(
      LeasedQueueMessageSchema.parse({
        queueMessageId: 1,
        readCount: 1,
        enqueuedAt: "2026-07-30T13:00:00.000+00:00",
        visibilityDeadline: "2026-07-30T13:01:00.000+00:00",
        message,
      }).message.jobType,
    ).toBe("mission_compile");
  });
});
