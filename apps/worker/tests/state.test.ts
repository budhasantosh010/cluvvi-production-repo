import { describe, expect, it } from "vitest";
import { WorkerState } from "../src/state";

describe("worker state", () => {
  it("does not expose configuration or secrets", () => {
    const state = new WorkerState();
    state.markReady();
    state.markPoll();
    state.markSuccess(2);
    const serialized = JSON.stringify(state.snapshot());

    expect(serialized).toContain('"status":"ready"');
    expect(serialized).toContain('"processedMessages":2');
    expect(serialized).not.toContain("SUPABASE_SERVICE_ROLE_KEY");
  });

  it("surfaces degraded health after an error", () => {
    const state = new WorkerState();
    state.markError();
    expect(state.snapshot()).toMatchObject({ status: "degraded", consecutiveErrors: 1 });
  });
});
