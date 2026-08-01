# C1 Parallel Build Plan

## Purpose

C1 proceeds on two connected tracks so Cluvvi can build downstream intelligence contracts without waiting for live provider infrastructure.

The contract history is now explicit:

- `search_results.v1` is the earlier frozen basic bridge contract and remains unchanged.
- `search_results.v2`, schema `2.0`, is the expanded universal discovery-run contract produced by the standalone Discovery Engine.
- V2 is not backward-compatible with V1 because it adds required request, planning, domain-context, semantic-provenance, and coverage structure.
- C1-C through C1-F consume clearly labeled fixture `search_results.v2`.
- No V1-to-V2 adapter is implemented. Only a future explicit adapter boundary is reserved.

## Track A — Standalone Discovery Engine

**Goal:** Build standalone, reusable discovery infrastructure outside the Cluvvi production repository.

**Target location:**

```text
C:\Users\Lenovo\Music\Startups\Cluvvi\Separate Discovery engine
```

### A0 — C1-B fixture-only universal scaffold — complete

Project A now provides:

- `discovery_request.v1` input validation;
- `SearchResultsArtifactV2` and `NormalizedDiscoveryResultV2`;
- `artifactKind: "search_results.v2"`;
- `schemaVersion: "2.0"`;
- composable domain packs;
- an operational fictional Source Atlas;
- deterministic query and falsification planning;
- replaceable provider registry and selector;
- targeted fixture provider;
- execution telemetry;
- normalization and deterministic dedupe;
- structured coverage reporting;
- CLI;
- seven cross-industry examples;
- deterministic architecture portability benchmark;
- comprehensive tests.

The scaffold is fixture-only. It performs no live discovery, network request, crawling, scraping, browser automation, LLM call, enrichment, scoring, outreach, authentication, billing, or deployment work.

Canonical fixture for the later compatibility gate:

```text
C:\Users\Lenovo\Music\Startups\Cluvvi\Separate Discovery engine\fixtures\video-editing.search-results.v2.json
```

Cluvvi may copy this artifact into version-controlled tests. Cluvvi must not create a permanent runtime import or filesystem dependency on the standalone repository.

### A1 — First safe free provider

Add the first safe free provider only after provider research, likely Hacker News or another structured public source.

Requirements:

- official or clearly allowed access path;
- stable URLs and provenance;
- normalized V2 output;
- bounded retries and rate limits;
- explicit coverage and failure reporting;
- no login-wall bypass.

### A2 — Configurable search-web provider

Add a generic search-web adapter only after comparing available free and paid options through the provider research template.

### A3 — Reddit or public-search route

Add a Reddit/public-search route only if provider documentation, terms, and technical behavior are acceptable.

### A4 — Job-post discovery provider

Add job-post discovery through a researched, bounded, replaceable adapter.

### A5 — Company-website fetch provider

Add a safe company-website fetch/parsing adapter with SSRF protections, size limits, content-type validation, timeouts, provenance, and honest coverage reporting.

### A6 — Paid providers

Add paid provider adapters only after the free flow works and only with explicit approval, configuration, budgets, and credit reporting.

## C1-0.1 — Search Results V2 contract amendment

C1-0.1 is the documentation-only bridge between completed Project A and Project B.

It must:

- preserve `docs/SEARCH_RESULTS_V1_CONTRACT.md` unchanged;
- document `search_results.v2` in `docs/SEARCH_RESULTS_V2_CONTRACT.md`;
- update Cluvvi operating rules and implementation plans;
- state that C1-C through C1-F consume fixture V2;
- reserve, but not implement, a future V1-to-V2 adapter boundary;
- add no runtime code, provider, dependency, API, migration, or data-path change.

## Track B — Cluvvi downstream engines using fixture `search_results.v2`

**Goal:** Build and test Cluvvi's evidence, identity, ranking, and output contracts without pretending fixture data is live discovery.

### B1 / C1-C — Evidence Engine

Consume validated fixture `search_results.v2` and produce `evidence_findings.v1`.

The Evidence Engine is the primary direct V2 consumer. It should classify evidence as passed, rejected, uncertain, stale, contradictory, irrelevant, or insufficient while preserving:

- result and query IDs;
- URLs and timestamps;
- provider provenance;
- `sourceZone`, `searchMethod`, and `signalIntent`;
- coverage limitations and warnings;
- citations back to the discovery artifact.

It must not claim live evidence when consuming fixtures.

### B2 / C1-D — Identity + Enrichment Engine

Consume evidence findings derived from fixture V2 and create `identity_enrichment.v1` with manual/public contact-route suggestions.

The first version should identify likely decision-maker roles and public/manual contact routes. It must not guess private emails, scrape LinkedIn, or add paid contact enrichment.

Traceability to the originating V2 discovery result must survive through the evidence artifact.

### B3 / C1-E — Opportunity Ranker

Create `ranked_opportunities.v1` using deterministic scorecards over mission fit, evidence quality, timing, identity relevance, contact-route quality, confidence, and limitations.

The ranker must not reinterpret discovery `raw` payloads or erase V2 coverage limitations.

### B4 / C1-F — Buyer Map Output

Create `buyer_map.v1` and a run-page display that presents the strongest fixture opportunities, evidence, decision-maker rationale, contact route, confidence, limitations, and source citations.

The UI must clearly label fixture-derived results and must not present them as live customers or complete market coverage.

## Parallel-track rule

> Track B must not wait for live discovery, but it must not fake real discovery either.

Track B may use fixture `search_results.v2` only when every fixture artifact and downstream display is clearly labeled as fixture data.

Frozen V1 remains separately valid for historical compatibility tests. It is not the input contract for C1-C through C1-F.

## Resource recommendation

```text
70% effort → Standalone Discovery Engine
30% effort → Cluvvi downstream contracts
```

## Why this split

Discovery is the supply engine.

Evidence, identity, enrichment, ranking, and output are downstream filters over supply.

Without broad, relevant supply, downstream intelligence has nothing valuable to evaluate. Without downstream contracts, live discovery has no stable product destination. The parallel plan advances both while keeping their responsibilities separate.

V2 makes that boundary more explicit by carrying the run's planning context, semantic provenance, and coverage limitations instead of forcing downstream engines to infer them.

## Integration gates

Project A is ready for fixture compatibility testing when:

- `search_results.v2` validates in Project A;
- provider, query, source-zone, search-method, and signal-intent provenance is preserved;
- dedupe is deterministic;
- provider errors, warnings, and coverage gaps are explicit;
- paid credit usage is visible;
- fixture and live modes cannot be confused.

Project B may begin after C1-0.1 is committed.

Its first implementation gates are:

- Cluvvi independently implements the V2 runtime schema;
- the exact Project A fixture validates in Cluvvi before Evidence logic consumes it;
- the Evidence Engine accepts only validated V2;
- fixture labels and V2 limitations survive downstream processing;
- frozen V1 remains unchanged and separately valid.

Track B may move from fixtures to live artifacts only when:

- the same `search_results.v2` schema is used;
- live provenance and coverage survive downstream processing;
- UI language stops short of claims not supported by the evidence;
- regression fixtures remain available for deterministic testing.

## Final compatibility gate

The cross-project gate must verify:

1. Project A V2 artifact validates in Project A.
2. Project B V2 schema validates the same artifact.
3. Evidence Engine consumes V2 and preserves citations and limitations.
4. V1 remains unchanged and separately valid.

## Future adapter boundary

A future package may translate validated V1 into V2 only after an explicit mapping is approved.

C1-0.1 and Project B must not implement that adapter, silently upgrade V1, or guess missing V2 planning and coverage data.

## Explicitly deferred

This plan does not authorize:

- live crawling inside the Cluvvi production repository;
- SocialCrawl, Firecrawl, Apify, SerpAPI, Tavily, Reddit API, or other provider integration;
- LinkedIn scraping;
- login-wall bypass;
- V1-to-V2 migration code;
- contact enrichment;
- automated messaging;
- email sending;
- outreach;
- authentication, billing, or deployment work.
