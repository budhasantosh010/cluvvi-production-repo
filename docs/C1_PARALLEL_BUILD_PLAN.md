# C1 Parallel Build Plan

## Purpose

C1 proceeds on two connected tracks so Cluvvi can build downstream intelligence contracts without waiting for live provider infrastructure.

The bridge between the tracks is the frozen `search_results.v1` artifact.

## Track A — Standalone Discovery Engine

**Goal:** Build standalone, reusable discovery infrastructure outside the Cluvvi production repository.

**Target location:**

```text
C:\Users\Lenovo\Music\Startups\Cluvvi\Separate Discovery engine
```

### A0 — Contract and fixture scaffold

Build:

- discovery request contracts;
- `search_results.v1` contract;
- provider interface and registry;
- fixture provider;
- deterministic URL normalization;
- deterministic dedupe;
- CLI;
- tests.

No live discovery.

### A1 — First safe free provider

Add the first safe free provider after provider research, likely Hacker News or another structured public source.

Requirements:

- official or clearly allowed access path;
- stable URLs and provenance;
- normalized output;
- bounded retries and rate limits;
- no login-wall bypass.

### A2 — Configurable search-web provider

Add a generic search-web adapter after comparing available free and paid options through the provider research template.

### A3 — Reddit or search-web route

Add a Reddit/public-search route only if provider documentation, terms, and technical behavior are acceptable.

### A4 — Job-post discovery provider

Add job-post discovery through a researched, bounded, replaceable adapter.

### A5 — Company-website fetch provider

Add a safe company-website fetch/parsing adapter with SSRF protections, size limits, content-type validation, timeouts, and provenance.

### A6 — Paid providers

Add paid provider adapters only after the free flow works and only with explicit approval, configuration, budgets, and credit reporting.

## Track B — Cluvvi downstream engines using fixture `search_results.v1`

**Goal:** Build and test Cluvvi's evidence, identity, ranking, and output contracts without pretending fixture data is live discovery.

### B1 — Evidence Engine

Create `evidence_findings.v1` from fixture `search_results.v1`.

The engine should classify evidence as passed, rejected, uncertain, stale, contradictory, or insufficient while preserving citations and limitations.

### B2 — Identity + Enrichment Engine

Create `identity_enrichment.v1` with manual contact-route suggestions.

The first version should identify likely decision-maker roles and public/manual contact routes. It must not guess private emails or add paid contact enrichment.

### B3 — Opportunity Ranker

Create `ranked_opportunities.v1` using deterministic scorecards over mission fit, evidence quality, timing, identity relevance, contact-route quality, confidence, and limitations.

### B4 — Buyer Map Output

Create `buyer_map.v1` and a run-page display that presents the strongest opportunities, evidence, decision-maker rationale, contact route, confidence, and limitations.

## Parallel-track rule

> Track B must not wait for live discovery, but it must not fake real discovery either.

Track B may use fixture `search_results.v1` only when every fixture artifact and downstream display is clearly labeled as fixture data.

## Resource recommendation

```text
70% effort → Standalone Discovery Engine
30% effort → Cluvvi downstream contracts
```

## Why this split

Discovery is the supply engine.

Evidence, identity, enrichment, and ranking are downstream filters over supply.

Without broad, relevant supply, downstream intelligence has nothing valuable to evaluate. Without downstream contracts, live discovery has no stable product destination. The parallel plan advances both while keeping their responsibilities separate.

## Integration gates

Track A may integrate with Cluvvi only when:

- `search_results.v1` validates;
- provider provenance is preserved;
- dedupe is deterministic;
- provider errors and warnings are explicit;
- paid credit usage is visible;
- fixture and live modes cannot be confused.

Track B may move from fixtures to live artifacts only when:

- the same `search_results.v1` schema is used;
- live provenance survives downstream processing;
- UI language stops short of claims not supported by the evidence;
- regression fixtures remain available for deterministic testing.

## Explicitly deferred

This plan does not authorize:

- live crawling inside the Cluvvi production repository;
- SocialCrawl, Firecrawl, Apify, SerpAPI, Tavily, Reddit API, or other provider integration;
- LinkedIn scraping;
- login-wall bypass;
- contact enrichment;
- automated messaging;
- email sending;
- outreach;
- authentication, billing, or deployment work.
