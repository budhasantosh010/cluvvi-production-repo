# Cluvvi Six-Engine Architecture

## Purpose

This document freezes Cluvvi's product architecture after C0.9. It defines the six connected engines, their responsibilities, current completion level, and the boundary between planning, discovery, investigation, identity, enrichment, and ranking.

Cluvvi's intended end-to-end flow is:

```text
INPUT
Website + description of what the user sells

↓
UNDERSTAND
Product, problem, buyer, price, exclusions

↓
DISCOVER
Search for companies/signals showing relevant demand

↓
INVESTIGATE
Verify fit, problem, timing, and ability to pay

↓
IDENTIFY
Find appropriate decision-maker

↓
ENRICH
Find valid business contact route

↓
OUTPUT
20 ranked, evidence-backed customer opportunities
```

## Blunt current status

> Cluvvi currently understands and plans. It does not yet discover real customers.

C0.9 provides a durable local application, deterministic mission understanding, source planning, generated search queries, fixture stages, and browser/CLI inspection. No generated query is executed against a live provider, and no output should be presented as real customer discovery.

## The six engines

### 1. Mission Compiler

**Responsibility:** Understand what the user sells and convert incomplete human input into a structured commercial mission.

**Current status:**

- Deterministic Mission Understanding exists.
- Produces product category, value proposition, buyer hypotheses, pain keywords, exclusions, source plan, and search queries.
- MVP completion is approximately 70%.
- Real-product completion is lower because there is no LLM-backed interpretation, live website ingestion, or live market data.

**Primary output today:** `mission_understanding.v1`.

**Future boundary:** The Mission Compiler may improve understanding, provenance, confidence, and correction workflows, but it must not execute discovery providers itself.

### 2. Source Planner

**Responsibility:** Decide which source families, signal types, and queries are most likely to expose relevant customer demand.

**Current status:**

- `sourcePlan` and `searchQueries` already exist inside `mission_understanding.v1`.
- Queries are generated but not executed.
- MVP completion is approximately 65%.

**Primary output today:** The source-plan and query-plan sections inside `mission_understanding.v1`.

**Future boundary:** The Source Planner decides where to look. It does not fetch results, investigate evidence, identify buyers, enrich contacts, or rank opportunities.

### 3. Discovery Engine

**Responsibility:** Build a broad, normalized universe of public, social, company, job, review, and web signals that might be relevant to the mission.

**Current status:**

- Not implemented.
- Only planned through generated queries.
- MVP completion is approximately 5–10%.
- This is the next product bottleneck.

**Frozen future output:** `search_results.v1`.

**Architecture decision:** Discovery will be developed as a separate standalone project at:

```text
C:\Users\Lenovo\Music\Startups\Cluvvi\Separate Discovery engine
```

The standalone Discovery Engine discovers raw signals. It must not decide whether a result is a buyer, whether the company can pay, who the decision-maker is, or whether outreach should occur.

### 4. Evidence Engine

**Responsibility:** Investigate each discovery result and determine whether the candidate has the relevant problem now, fits the product, has meaningful timing, and appears commercially viable.

**Current status:**

- Placeholder stage only.
- No real investigation exists yet.
- It can be built against fixture `search_results.v1` after the bridge contract is frozen.

**Planned output:** `evidence_findings.v1`.

**Boundary:** Discovery supplies broad results. The Evidence Engine decides whether those results contain strong, weak, contradictory, stale, or irrelevant evidence.

### 5. Identity + Enrichment Engine

**Responsibility:** Identify the appropriate decision-maker and a valid business contact route for candidates that passed evidence review.

**Current status:**

- Placeholder stage only.
- The first version should be manual/contact-route focused, not paid contact enrichment.

**Planned output:** `identity_enrichment.v1`.

**Boundary:** It must not guess private contact details, scrape LinkedIn, bypass login walls, or send messages. Paid enrichment remains an optional later adapter requiring explicit approval.

### 6. Opportunity Ranker

**Responsibility:** Return the strongest evidence-backed opportunities using deterministic scorecards over mission fit, evidence, timing, identity quality, contactability, confidence, and limitations.

**Current status:**

- Placeholder stage only.
- The first version should rank using deterministic scorecards over evidence and identity outputs.

**Planned output:** `ranked_opportunities.v1`, later rendered through `buyer_map.v1`.

**Boundary:** Ranking consumes validated downstream artifacts. It does not discover raw results, invent missing evidence, guess contacts, or send outreach.

## Connected artifact flow

```text
Mission input
  → mission_understanding.v1
  → source plan + search queries
  → search_results.v1
  → evidence_findings.v1
  → identity_enrichment.v1
  → ranked_opportunities.v1
  → buyer_map.v1
```

Each artifact is versioned, schema-validated, replaceable, and independently testable. No downstream engine may depend on provider-specific raw payloads.

## Current status after C0.9

- C0 durable local app foundation: complete for the current fixture-mode scope.
- Mission Compiler deterministic MVP: implemented.
- Source Planner deterministic MVP: implemented but unexecuted.
- Discovery Engine: not implemented and now the primary bottleneck.
- Evidence Engine: placeholder only.
- Identity + Enrichment Engine: placeholder only.
- Opportunity Ranker: placeholder only.
- Buyer Map: not implemented.

## Governing architecture rules

- Discovery is broad supply generation, not buyer qualification.
- Evidence determines whether a discovered signal is commercially meaningful.
- Identity and enrichment happen only after evidence review.
- Ranking never invents facts that upstream engines did not produce.
- Fixtures are allowed for contract development but must be labeled clearly.
- Providers are replaceable pipes; Cluvvi's interpretation, evidence, identity, and ranking logic are the intelligence layer.
- No LinkedIn scraping, login-wall bypassing, automated messaging, or email sending.
- No live-discovery language until live providers actually execute and provenance is preserved.
