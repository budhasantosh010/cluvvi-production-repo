# `search_results.v1` Contract

## Purpose

`search_results.v1` is the bridge between the standalone Discovery Engine and Cluvvi.

It freezes the normalized artifact that allows provider infrastructure and Cluvvi's downstream intelligence engines to evolve independently.

## Ownership

**Producer:** Standalone Discovery Engine.

**Consumers:**

- Evidence Engine
- Identity + Enrichment Engine
- Opportunity Ranker
- Buyer Map Output

The Evidence Engine is the primary direct consumer. Later consumers should generally use evidence and identity artifacts rather than reinterpret raw discovery results, but the contract remains available for traceability.

## Required TypeScript shape

```ts
type DiscoveryMode = "free_only" | "balanced" | "paid_deep";

type ProviderCategory = "free" | "paid" | "manual" | "fixture";

type DiscoverySourceType =
  | "search_web"
  | "reddit"
  | "hacker_news"
  | "product_hunt"
  | "job_posts"
  | "reviews"
  | "company_websites"
  | "linkedin_manual";

type NormalizedDiscoveryResult = {
  id: string;
  queryId: string;
  query: string;

  providerId: string;
  providerCategory: ProviderCategory;
  sourceType: DiscoverySourceType;

  title: string;
  snippet: string;
  url: string;

  authorOrCompany?: string;
  domain?: string;
  publishedAt?: string;
  discoveredAt: string;

  language?: string;
  country?: string;

  raw?: unknown;
};

type SearchResultsArtifactV1 = {
  schemaVersion: "1.0";
  artifactKind: "search_results.v1";

  discoveryMode: DiscoveryMode;

  summary: {
    queriesPlanned: number;
    queriesExecuted: number;
    providersUsed: string[];
    rawResults: number;
    dedupedResults: number;
    paidCreditsUsed: number;
    startedAt: string;
    completedAt: string;
  };

  providerBreakdown: Array<{
    providerId: string;
    providerCategory: ProviderCategory;
    sourceType: DiscoverySourceType;
    queriesExecuted: number;
    resultsReturned: number;
    errors: number;
  }>;

  results: NormalizedDiscoveryResult[];

  warnings: string[];
};
```

## Required-result rules

Every result must include:

- `id`
- `queryId`
- `query`
- `providerId`
- `providerCategory`
- `sourceType`
- `title`
- `snippet`
- `url`
- `discoveredAt`

`publishedAt` is optional because many sources do not provide reliable dates.

`raw` is optional and provider-specific.

No downstream engine may depend on `raw`.

## Artifact-level rules

- `schemaVersion` must be exactly `"1.0"`.
- `artifactKind` must be exactly `"search_results.v1"`.
- Dedupe happens before the final artifact is handed to Cluvvi.
- `rawResults` counts provider-returned records before final dedupe.
- `dedupedResults` must equal the final `results.length`.
- `queriesExecuted` must never exceed `queriesPlanned`.
- `paidCreditsUsed` must be numeric and non-negative, including zero in free, manual, or fixture modes.
- `providersUsed` must contain the provider IDs that actually contributed or attempted execution, according to the standalone engine's documented semantics.
- Every provider breakdown row must use the same provider/category/source vocabulary as the result records.
- Timestamps must be ISO-8601 strings.
- Warnings must be plain, durable explanations, not transient console logs.

## Responsibility boundaries

- Results may be weak; the Evidence Engine decides strength later.
- The Discovery Engine does not score payment intent.
- The Discovery Engine does not identify decision-makers.
- The Discovery Engine does not enrich contacts.
- The Discovery Engine does not send messages.
- The Discovery Engine does not claim that a result is a qualified customer.
- The Discovery Engine does not hide provider failures or silently substitute a paid provider.

## Provenance rules

Every result carries both query and provider provenance:

```text
queryId + query
providerId + providerCategory + sourceType
url + discoveredAt
```

This provenance must survive downstream processing so evidence findings can cite the discovery source that produced them.

## Dedupe rules

Dedupe occurs before the final artifact is returned to Cluvvi.

The standalone engine should prefer deterministic rules:

1. Canonical URL equality.
2. Normalized-domain and path equality when safe.
3. Exact provider-record identity.
4. Optional deterministic near-duplicate logic with a documented reason.

Dedupe must not remove distinct evidence merely because titles are similar.

## Compatibility policy

- Additive optional fields may be introduced without changing `artifactKind` only when existing consumers remain valid.
- Required-field changes, enum removals, meaning changes, or structural changes require a new artifact version.
- Consumers must reject unknown incompatible schema versions rather than guessing.
- Downstream engines must validate the artifact before use.

## Fixture usage

Fixture artifacts are allowed for development of downstream Cluvvi engines.

They must use:

```json
{
  "providerCategory": "fixture"
}
```

They must also carry an explicit warning such as:

```text
Fixture example only. This is not live discovery data.
```

See `docs/examples/search-results.v1.example.json`.
