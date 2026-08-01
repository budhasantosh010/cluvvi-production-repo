# `search_results.v2` Contract

## Purpose

`search_results.v2` is the expanded universal discovery-run contract produced by the standalone Discovery Engine and consumed by Cluvvi's downstream C1 intelligence phases.

It carries not only normalized discovery results, but also the request identity, discovery goal, domain-pack context, semantic search provenance, provider execution breakdown, and an explicit coverage report needed by the Evidence Engine and later downstream stages.

## Contract history

- `search_results.v1` is the earlier frozen basic bridge contract defined in `docs/SEARCH_RESULTS_V1_CONTRACT.md`.
- `search_results.v1` remains unchanged and separately valid.
- `search_results.v2` is the expanded universal discovery-run contract.
- V2 is not backward-compatible with V1 because it adds required planning, context, semantic, provenance, and coverage structure and replaces V1's single `sourceType` dimension with required `sourceZone`, `searchMethod`, and `signalIntent` fields.
- No V1-to-V2 migration adapter is implemented in C1-0.1.
- A future explicit adapter boundary is reserved, but no mapping may be guessed or implemented until separately approved.

## Ownership

**Producer:** Standalone Discovery Engine.

**Primary direct consumer:** Evidence Engine.

**Downstream consumers preserving V2 lineage:**

- Identity + Enrichment Engine
- Opportunity Ranker
- Buyer Map Output

C1-C through C1-F use clearly labeled fixture `search_results.v2` as their discovery source artifact. The Evidence Engine consumes V2 directly. Later engines should primarily consume the preceding versioned Cluvvi artifacts while preserving citations and traceability back to the original V2 result.

## Required identifiers

```ts
type SearchResultsArtifactV2 = {
  schemaVersion: "2.0";
  artifactKind: "search_results.v2";
  // ...
};
```

Consumers must reject incompatible artifact kinds or schema versions rather than infer compatibility.

## Shared value types

```ts
type DiscoveryMode = "free_only" | "balanced" | "paid_deep";

type ProviderCategory = "free" | "paid" | "manual" | "fixture";

type SourceZone =
  | "general_web"
  | "search_results"
  | "company_websites"
  | "forums_communities"
  | "social_posts"
  | "deep_comments"
  | "job_boards"
  | "freelance_marketplaces"
  | "review_sites"
  | "app_marketplaces"
  | "business_directories"
  | "maps_local"
  | "events_associations"
  | "industry_publications"
  | "news_media"
  | "procurement_tenders"
  | "rfp_award_databases"
  | "public_records"
  | "permits_licenses_inspections"
  | "regulatory_compliance"
  | "legal_court_records"
  | "funding_grants_budgets"
  | "research_patents_trials"
  | "academic_lab_pages"
  | "standards_bodies"
  | "certification_databases"
  | "supply_chain_vendor"
  | "equipment_marketplaces"
  | "import_export_trade_data"
  | "developer_ecosystem"
  | "datasets_databases"
  | "satellite_geospatial_sources"
  | "private_manual_sources"
  | `custom:${string}`;

type SearchMethod =
  | "keyword_search"
  | "site_search"
  | "structured_filter"
  | "public_api"
  | "website_fetch"
  | "directory_lookup"
  | "manual_review"
  | `custom:${string}`;

type SignalIntent =
  | "direct_purchase"
  | "hiring"
  | "procurement"
  | "complaint"
  | "recommendation_request"
  | "competitor_switching"
  | "manual_workaround"
  | "expansion"
  | "negative_evidence"
  | "general_relevance"
  | `custom:${string}`;
```

Custom values must use the explicit `custom:` namespace. Consumers must preserve unknown valid custom values and must not silently coerce them into a known value.

## Required normalized result

```ts
type NormalizedDiscoveryResultV2 = {
  id: string;
  queryId: string;
  query: string;

  providerId: string;
  providerCategory: ProviderCategory;

  discoveryGoal: string;
  searchMethod: SearchMethod;
  sourceZone: SourceZone;
  signalIntent: SignalIntent;

  title: string;
  snippet: string;
  url: string;

  domain?: string;
  authorOrCompany?: string;
  publishedAt?: string;
  discoveredAt: string;

  language?: string;
  country?: string;
  region?: string;
  city?: string;

  credibility?: "low" | "medium" | "high" | "official";
  riskLevel?: "low" | "medium" | "high";

  raw?: unknown;
};
```

Every result must include query provenance, provider provenance, semantic search provenance, source URL, and discovery timestamp.

`publishedAt` remains optional because many sources do not provide a reliable publication time.

`raw` is optional provider-specific provenance. No downstream Cluvvi engine may depend on `raw`.

## Required coverage report

```ts
type CoverageReportV2 = {
  searchedSourceZones: SourceZone[];

  skippedSourceZones: Array<{
    sourceZone: SourceZone;
    reason: string;
  }>;

  providersUsed: string[];
  providersUnavailable: string[];

  manualReviewRecommended: Array<{
    sourceZone: SourceZone;
    reason: string;
    suggestedAction: string;
  }>;

  confidenceLimitations: string[];
  nextBestSearches: string[];
};
```

Coverage is an audit of what the run did and did not search. It is not a claim of complete internet, market, or industry coverage.

Skipped zones, unavailable providers, recommended manual review, confidence limitations, and next-best searches must remain explicit. Consumers must not convert an absent source zone into positive evidence.

## Required artifact shape

```ts
type SearchResultsArtifactV2 = {
  schemaVersion: "2.0";
  artifactKind: "search_results.v2";

  requestId: string;
  discoveryGoal: string;
  discoveryMode: DiscoveryMode;
  domainPackIds: string[];

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
    sourceZone: SourceZone;
    searchMethod: SearchMethod;
    queriesExecuted: number;
    resultsReturned: number;
    errors: number;
  }>;

  results: NormalizedDiscoveryResultV2[];
  coverage: CoverageReportV2;
  warnings: string[];
};
```

## Artifact-level rules

- `schemaVersion` must be exactly `"2.0"`.
- `artifactKind` must be exactly `"search_results.v2"`.
- `requestId`, `discoveryGoal`, and every `domainPackId` must be non-empty.
- Dedupe happens before the artifact is handed to Cluvvi.
- `summary.rawResults` counts provider-returned records before final dedupe.
- `summary.dedupedResults` must equal `results.length`.
- `summary.queriesExecuted` must not exceed `summary.queriesPlanned`.
- `summary.paidCreditsUsed` must be numeric and non-negative, including zero for fixture, free, or manual execution.
- Timestamps must be ISO-8601 date-time strings.
- Provider breakdown rows must use the same provider, source-zone, and search-method vocabulary as result provenance.
- Warnings and coverage limitations must be durable plain-language explanations, not transient console output.
- Provider failures or unavailable coverage must not be hidden by silent substitution.

## Responsibility boundaries

The Discovery Engine may return strong, weak, stale, contradictory, irrelevant, or negative evidence candidates.

The Evidence Engine decides what the result supports.

The Discovery Engine does not:

- decide that a result is a qualified buyer;
- score payment intent;
- infer commercial viability as fact;
- identify the final decision-maker;
- guess private contact information;
- enrich contacts;
- send outreach;
- hide provider failures;
- claim complete source coverage.

## Fixture usage for C1-C through C1-F

Project B must consume fixture `search_results.v2` for C1-C through C1-F.

Fixture artifacts must:

- use `providerCategory: "fixture"`;
- contain an explicit warning that they are not live discovery data;
- preserve V2 query, provider, semantic, URL, and coverage provenance;
- remain deterministic regression fixtures;
- never be presented as real customers, live market evidence, or complete coverage.

The canonical Project A compatibility artifact is produced from:

```text
C:\Users\Lenovo\Music\Startups\Cluvvi\Separate Discovery engine\fixtures\video-editing.search-results.v2.json
```

Project B may copy a version-controlled fixture into Cluvvi tests. Cluvvi must not create a permanent runtime import or filesystem dependency on the standalone repository.

## V1 and V2 validation policy

- V1 and V2 remain separate contracts and must be validated independently.
- A V2 consumer must reject V1 rather than reinterpret it.
- A V1 consumer must reject V2 rather than ignore required V2 structure.
- `docs/SEARCH_RESULTS_V1_CONTRACT.md` must remain unchanged.
- No V1-to-V2 adapter exists in C1-0.1.
- Any future adapter requires a separately reviewed mapping, tests, provenance rules, and its own versioned boundary.

## Compatibility gate before live integration

The final cross-project compatibility gate must prove:

1. Project A validates its V2 artifact with the Project A runtime schema.
2. Project B independently validates the same artifact with the Cluvvi V2 schema.
3. The Evidence Engine consumes validated V2 and preserves citations, semantic provenance, and limitations.
4. Frozen V1 remains unchanged and separately valid.

Passing the fixture compatibility gate does not authorize live providers, network calls, crawling, scraping, enrichment, outreach, auth, billing, or deployment work.
