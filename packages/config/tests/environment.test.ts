import { describe, expect, it } from "vitest";
import { environmentCapabilities, parsePublicEnvironment, parseWorkerEnvironment } from "../src";

const valid = {
  NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54321",
  NEXT_PUBLIC_SUPABASE_ANON_KEY: "a".repeat(40),
  SUPABASE_SERVICE_ROLE_KEY: "s".repeat(40),
};

describe("environment validation", () => {
  it("fails clearly when required browser configuration is absent", () => {
    expect(() => parsePublicEnvironment({})).toThrow();
    expect(environmentCapabilities({}).supabaseConfigured).toBe(false);
  });

  it("coerces bounded worker settings", () => {
    const parsed = parseWorkerEnvironment({
      ...valid,
      WORKER_POLL_INTERVAL_MS: "1500",
      WORKER_HEALTH_PORT: "3333",
    });

    expect(parsed.WORKER_POLL_INTERVAL_MS).toBe(1500);
    expect(parsed.WORKER_HEALTH_PORT).toBe(3333);
  });

  it("never returns secret values from the capability summary", () => {
    const summary = environmentCapabilities(valid);
    expect(summary).toEqual({ supabaseConfigured: true, workerConfigured: true });
    expect(JSON.stringify(summary)).not.toContain(valid.SUPABASE_SERVICE_ROLE_KEY);
  });
});
