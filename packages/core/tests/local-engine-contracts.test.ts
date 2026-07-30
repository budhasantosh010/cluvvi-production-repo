import { describe, expect, it } from "vitest";
import { MissionInputSchemaV1, fingerprint } from "../src";

const mission = {
  schemaVersion: "1.0",
  name: "Video editing SaaS customer discovery",
  description:
    "AI-assisted video editing software that creates rough cuts for long-form talking-head videos.",
  customerOutcome: "Publish long-form video faster.",
  price: {
    minimum: 100,
    maximum: 500,
    currency: "usd",
    billingPeriod: "monthly",
  },
};

describe("local engine contracts", () => {
  it("validates and normalizes a versioned mission", () => {
    const parsed = MissionInputSchemaV1.parse(mission);
    expect(parsed.price?.currency).toBe("USD");
    expect(parsed.desiredOpportunities).toBe(20);
    expect(parsed.geographies).toEqual(["global"]);
  });

  it("rejects an inverted price range", () => {
    expect(() =>
      MissionInputSchemaV1.parse({
        ...mission,
        price: { ...mission.price, minimum: 500, maximum: 100 },
      }),
    ).toThrow(/Maximum price/);
  });

  it("creates stable fingerprints independent of object key order", () => {
    expect(fingerprint({ alpha: 1, nested: { beta: 2, gamma: 3 } })).toBe(
      fingerprint({ nested: { gamma: 3, beta: 2 }, alpha: 1 }),
    );
  });
});
