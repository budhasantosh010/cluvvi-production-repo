import { describe, expect, it } from "vitest";
import { InvalidRunTransitionError, assertRunTransition, canTransitionRun } from "../src";

describe("run state machine", () => {
  it("permits the first durable worker transition", () => {
    expect(canTransitionRun("draft", "compiling")).toBe(true);
    expect(() => assertRunTransition("draft", "compiling")).not.toThrow();
  });

  it("rejects skipped and terminal transitions", () => {
    expect(canTransitionRun("draft", "discovering")).toBe(false);
    expect(canTransitionRun("completed", "reviewing")).toBe(false);
    expect(() => assertRunTransition("draft", "discovering")).toThrow(InvalidRunTransitionError);
  });

  it("rejects no-op transitions so events remain meaningful", () => {
    expect(canTransitionRun("compiling", "compiling")).toBe(false);
  });
});
