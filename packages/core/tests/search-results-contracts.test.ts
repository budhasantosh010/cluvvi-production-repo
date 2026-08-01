import { SearchResultsArtifactV1Schema, SearchResultsArtifactV2Schema } from "../src/index";
import { describe, expect, it } from "vitest";

const v1 = {
  schemaVersion: "1.0",
  artifactKind: "search_results.v1",
  discoveryMode: "free_only",
  summary: {
    queriesPlanned: 1,
    queriesExecuted: 1,
    providersUsed: ["fixture_v1"],
    rawResults: 1,
    dedupedResults: 1,
    paidCreditsUsed: 0,
    startedAt: "2026-08-01T00:00:00.000Z",
    completedAt: "2026-08-01T00:00:00.000Z",
  },
  providerBreakdown: [
    {
      providerId: "fixture_v1",
      providerCategory: "fixture",
      sourceType: "search_web",
      queriesExecuted: 1,
      resultsReturned: 1,
      errors: 0,
    },
  ],
  results: [
    {
      id: "result_v1",
      queryId: "query_v1",
      query: "fixture query",
      providerId: "fixture_v1",
      providerCategory: "fixture",
      sourceType: "search_web",
      title: "Fixture V1 result",
      snippet: "Fixture result for the separately valid V1 contract.",
      url: "https://v1-fixture.invalid/result",
      discoveredAt: "2026-08-01T00:00:00.000Z",
    },
  ],
  warnings: ["Fixture V1 only."],
};

const v2 = {
  schemaVersion: "2.0",
  artifactKind: "search_results.v2",
  requestId: "request_v2",
  discoveryGoal: "customer_opportunities",
  discoveryMode: "free_only",
  domainPackIds: ["content-production"],
  summary: {
    queriesPlanned: 1,
    queriesExecuted: 1,
    providersUsed: ["fixture_v2"],
    rawResults: 1,
    dedupedResults: 1,
    paidCreditsUsed: 0,
    startedAt: "2026-08-01T00:00:00.000Z",
    completedAt: "2026-08-01T00:00:00.000Z",
  },
  providerBreakdown: [
    {
      providerId: "fixture_v2",
      providerCategory: "fixture",
      sourceZone: "forums_communities",
      searchMethod: "keyword_search",
      queriesExecuted: 1,
      resultsReturned: 1,
      errors: 0,
    },
  ],
  results: [
    {
      id: "result_v2",
      queryId: "query_v2",
      query: "fixture query",
      providerId: "fixture_v2",
      providerCategory: "fixture",
      discoveryGoal: "customer_opportunities",
      searchMethod: "keyword_search",
      sourceZone: "forums_communities",
      signalIntent: "direct_purchase",
      title: "Fixture V2 result",
      snippet: "Fixture result for the expanded V2 contract.",
      url: "https://v2-fixture.invalid/result",
      discoveredAt: "2026-08-01T00:00:00.000Z",
    },
  ],
  coverage: {
    searchedSourceZones: ["forums_communities"],
    skippedSourceZones: [],
    providersUsed: ["fixture_v2"],
    providersUnavailable: [],
    manualReviewRecommended: [],
    confidenceLimitations: ["Fixture data."],
    nextBestSearches: [],
  },
  warnings: ["Fixture V2 only."],
};

describe("search result contract separation", () => {
  it("keeps frozen V1 separately valid", () => {
    expect(SearchResultsArtifactV1Schema.parse(v1).artifactKind).toBe("search_results.v1");
    expect(SearchResultsArtifactV2Schema.safeParse(v1).success).toBe(false);
  });

  it("validates V2 independently and rejects reinterpretation as V1", () => {
    expect(SearchResultsArtifactV2Schema.parse(v2).artifactKind).toBe("search_results.v2");
    expect(SearchResultsArtifactV1Schema.safeParse(v2).success).toBe(false);
  });

  it("fails clearly when required V2 semantic provenance is absent", () => {
    const invalid = structuredClone(v2);
    delete (invalid.results[0] as Partial<(typeof invalid.results)[number]>).signalIntent;
    const result = SearchResultsArtifactV2Schema.safeParse(invalid);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(
        result.error.issues.some((issue) => issue.path.join(".") === "results.0.signalIntent"),
      ).toBe(true);
    }
  });

  it("fails clearly when V2 identifiers are wrong", () => {
    expect(SearchResultsArtifactV2Schema.safeParse({ ...v2, schemaVersion: "1.0" }).success).toBe(
      false,
    );
    expect(
      SearchResultsArtifactV2Schema.safeParse({ ...v2, artifactKind: "search_results.v1" }).success,
    ).toBe(false);
  });
});
