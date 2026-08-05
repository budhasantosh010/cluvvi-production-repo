import { describe, expect, it } from "vitest";
import {
  LiveProviderRunTelemetryV1Schema,
  MissionInputSchemaV1,
  ProviderPolicyTraceV1Schema,
  fingerprint,
} from "../src";

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

  it("strictly validates provider policy traces", () => {
    const trace = ProviderPolicyTraceV1Schema.parse({
      schemaVersion: "1.0",
      artifactKind: "provider_policy_trace.v1",
      requestId: "run_1234567890abcdef1234567890abcdef",
      providerPolicy: "free_only",
      queries: [
        {
          queryId: "plan_1",
          sourceZone: "general_web",
          searchMethod: "keyword_search",
          attempts: [
            {
              providerId: "startpage_html_search",
              order: 1,
              attempted: true,
              outcome: "success",
              acceptedResults: 5,
              uniqueDomains: 3,
              duplicateRatio: 0,
              paid: false,
            },
          ],
          finalDecision: "sufficient_free_coverage",
        },
      ],
      paidProviderAttempted: false,
      paidFallbackUsed: false,
      warnings: [],
    });
    expect(trace.providerPolicy).toBe("free_only");
    expect(() => ProviderPolicyTraceV1Schema.parse({ ...trace, rawHtml: "forbidden" })).toThrow();
  });

  it("strictly validates live provider telemetry and rejects unknown fields", () => {
    const telemetry = {
      schemaVersion: "1.0",
      artifactKind: "live_provider_run_telemetry.v1",
      requestId: "run_1234567890abcdef1234567890abcdef",
      providerMode: "live_search",
      configurationFingerprint: "a".repeat(64),
      generatedAt: "2026-08-02T10:00:00.000Z",
      providerExecutions: [],
      budget: {
        hacker_news_algolia: { used: 0, limit: 4 },
        hacker_news_firebase: { used: 0, limit: 8 },
        tavily_search: { used: 1, limit: 3 },
        brave_web_search: { used: 1, limit: 3 },
      },
      usage: {
        tavilyRequests: 1,
        tavilyCredits: 1,
        braveRequests: 1,
        hackerNewsAlgoliaRequests: 0,
        hackerNewsFirebaseRequests: 0,
      },
      warnings: ["Search snippets were not crawled."],
    };
    expect(LiveProviderRunTelemetryV1Schema.parse(telemetry).usage.tavilyCredits).toBe(1);
    expect(() =>
      LiveProviderRunTelemetryV1Schema.parse({ ...telemetry, secret: "must-not-parse" }),
    ).toThrow();
  });
});
