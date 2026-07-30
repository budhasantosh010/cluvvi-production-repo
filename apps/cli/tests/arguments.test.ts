import { describe, expect, it } from "vitest";
import { parseArguments, stringFlag } from "../src/arguments";

describe("CLI arguments", () => {
  it("parses one command, positionals, value flags, and boolean flags", () => {
    const parsed = parseArguments(["inspect", "run_123", "--stage", "investigation", "--errors"]);
    expect(parsed.command).toBe("inspect");
    expect(parsed.positionals).toEqual(["run_123"]);
    expect(stringFlag(parsed, "stage")).toBe("investigation");
    expect(parsed.flags.get("errors")).toBe(true);
  });
});
