# C1 Parallel Build Plan

## Purpose

C1 proceeds on two connected tracks so Cluvvi can build downstream intelligence contracts without waiting for live provider infrastructure.

The contract history is now explicit:

- `search_results.v1` is the earlier frozen basic bridge contract and remains unchanged.
- `search_results.v2`, schema `2.0`, is the expanded universal discovery-run contract produced by the standalone Discovery Engine.
- V2 is not backward-compatible with V1 because it adds required request, planning, domain-context, semantic-provenance, and coverage structure.
- C1-C through C1-G consume clearly labeled, validated fixture-provider `search_results.v2`.
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

## C1-0.1 — Search Results V2 contract amendment — complete

C1-0.1 is the committed documentation-only bridge between completed Project A and Project B. It preserves frozen V1, documents V2, and reserves—but does not implement—a future V1-to-V2 adapter boundary.

## Track B — Cluvvi downstream engines, fixture bridge, and live search bridge — implemented

**Implementation branches:**

```text
feature/c1-c-to-c1-f-downstream-fixture-pipeline
feature/c1-g-local-discovery-bridge
feature/c1-h-live-discovery-providers
```

**Goal:** Build and test Cluvvi's evidence, identity, ranking, output, and standalone-runtime adapter contracts without pretending fixture data is live discovery.

### B1 / C1-C — Evidence Engine — complete

Consumes validated fixture `search_results.v2` and produces `evidence_findings.v1` with positive, negative, weak, stale, and risk findings while preserving result/query IDs, URLs, timestamps, provider provenance, `sourceZone`, `searchMethod`, `signalIntent`, warnings, coverage limitations, and citations.

### B2 / C1-D — Identity + Enrichment Engine — complete

Consumes evidence findings and produces `identity_enrichment.v1` with likely department and decision-maker-role hypotheses plus public/manual contact routes. It does not identify real people, guess private emails, scrape LinkedIn, or add paid contact enrichment.

### B3 / C1-E — Opportunity Ranker — complete

Produces `ranked_opportunities.v1` with an explicit deterministic scorecard over pain, recency, hiring, workaround, company identity, manual contactability, exclusions, and weak/stale evidence. The ranker does not reinterpret discovery `raw` payloads or erase V2 coverage limitations.

### B4 / C1-F — Buyer Map Output — complete

Produces `buyer_map.v1` and a responsive run-page display of ranked fixture opportunities, positive and negative evidence, likely buyer roles, public manual routes, transparent score components, risks, limitations, source citations, and coverage gaps. The UI labels every downstream result as synthetic fixture output.

### B5 / C1-G — Local Discovery-to-Cluvvi Bridge — complete

Adds `fixture` and `local_discovery_engine` runtime adapters behind one interface. The local adapter writes Project A's existing `discovery_request.v1`, invokes the standalone CLI with explicit file paths, captures an execution record and logs, validates exact `search_results.v2`, enforces matching request IDs and fixture-only/zero-credit output, then passes the imported artifact into the existing downstream stages.

The bridge is a process plus JSON contract boundary. It does not import Project A source, expose arbitrary commands through the UI, or pass mission text in executable arguments. Timeout, cancellation, invalid output, failure diagnostics, resume, and idempotent reuse are proven independently.

### B6 / C1-H — Live Discovery Providers — complete

Adds explicit `fixture_only` and `live_search` provider modes behind the same C1-G runtime. Live mode invokes Project A's approved HN Algolia/Firebase, Tavily basic-search, and Brave web-search adapters; imports exact `search_results.v2`; validates `live_provider_run_telemetry.v1`; checks request IDs, provider IDs/categories, partial-failure warnings, request budgets, and Tavily credit consistency; then runs the unchanged downstream stage graph.

### B7 / C1-HF — Free Search Backbone — complete

Adds one persisted policy source of truth: `free_only`, `balanced`, or `paid_deep`. Project A supplies HN plus optional SearXNG, DuckDuckGo HTML, and Startpage HTML. Cluvvi imports `provider_policy_trace.v1`, validates provider order, coverage decisions, fallback reasons, and usage against V2 and telemetry, and rejects every paid signal under `free_only`. Controlled and real cross-project runs prove zero-paid free search, free-first balanced fallback, policy-violation rejection, durable failure/resume, and policy-aware browser presentation.

Secrets remain in Project A's ignored `.env.local`; Cluvvi does not forward provider keys. They are never included in commands, fingerprints, logs, artifacts, diagnostics, screenshots, or Git. Live search retrieves snippets and result metadata only; result pages are not crawled or deeply extracted.

## Parallel-track rule

> Track B must not wait for live discovery, but it must not fake real discovery either.

Track B may use fixture `search_results.v2` only when every fixture artifact and downstream display is clearly labeled as fixture data.

Frozen V1 remains separately valid for historical compatibility tests. It is not the input contract for C1-C through C1-G.

## Resource recommendation

```text
70% effort → Standalone Discovery Engine supply quality
30% effort → Cluvvi downstream and adapter contracts
```

## Why this split

Discovery is the supply engine.

Evidence, identity, enrichment, ranking, and output are downstream filters over supply.

Without broad, relevant supply, downstream intelligence has nothing valuable to evaluate. Without downstream contracts, live discovery has no stable product destination. The parallel plan advances both while keeping their responsibilities separate.

V2 makes that boundary more explicit by carrying the run's planning context, semantic provenance, and coverage limitations instead of forcing downstream engines to infer them.

## Integration gates

Project A's fixture/live/free-policy gates, Project B's downstream gates, and the C1-G/C1-H/C1-HF runtime gates have passed locally:

- Project A validates `discovery_request.v1` and emits fixture-provider `search_results.v2` through its real CLI;
- Cluvvi exports the same request contract, invokes the actual standalone process, and independently validates the exact returned artifact;
- request IDs match; fixture runs remain fixture/zero-credit; free-only runs reject paid attempts/results/usage; balanced runs prove free-first fallback reasons; paid-deep runs retain approved bounded paid behavior;
- the Evidence Engine accepts only validated V2;
- fixture labels or live search limitations survive Evidence, Identity, Ranking, Buyer Map, persistence, CLI, and browser presentation;
- frozen V1 remains unchanged and separately valid;
- timeout, cancellation, malformed output, nonzero exit, missing output, idempotency, failure, and resume behavior are tested;
- browser desktop/mobile and controlled failure/resume proofs pass without claiming live discovery.

The C1-HF move from paid-capable live search to policy-controlled free-first live artifacts is complete because:

- the approved provider boundary is explicit and search-only;
- the same `search_results.v2` schema is used;
- live telemetry, provenance, cost, warnings, and coverage survive downstream processing;
- UI language stops short of claims not supported by snippets;
- regression fixtures remain available and are still the default for deterministic testing.

## Final compatibility and runtime gate

The cross-project gate passed locally:

1. Project A validates the request and resulting V2 artifact.
2. Project B validates the same artifact independently.
3. The request ID matches the originating Cluvvi run.
4. Evidence consumes V2 without depending on `raw`.
5. Identity, Ranking, and Buyer Map complete.
6. Frozen V1 remains unchanged and separately valid.

## C1-G — Completed runtime bridge boundary

C1-G connects validated standalone Project A `search_results.v2` output to Cluvvi through an approved file/process boundary. It does not import provider implementations, bypass schema validation, or blur fixture and live execution. Fixture mode remains independently testable and the default.

## Future V1-to-V2 adapter boundary

A future package may translate validated V1 into V2 only after an explicit mapping is approved.

C1-0.1 and Project B must not implement that adapter, silently upgrade V1, or guess missing V2 planning and coverage data.

## Explicitly deferred

This plan does not authorize:

- live crawling inside the Cluvvi production repository;
- SocialCrawl, Firecrawl, Apify, SerpAPI, Reddit API, or additional unapproved provider integration;
- Tavily Extract/Crawl/Map/Research or Brave Local/News/Answers;
- LinkedIn scraping;
- login-wall bypass;
- V1-to-V2 migration code;
- C1-I crawlers or extractors;
- remote Discovery APIs;
- contact enrichment;
- automated messaging;
- email sending;
- outreach;
- authentication, billing, or deployment work.
