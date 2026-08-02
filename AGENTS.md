# Cluvvi engineering rules

Read these before changing active engine or browser-runtime code:

1. `docs/CLUVVI_NEXT_IMPLEMENTATION_MASTER_PLAN.md`
2. `docs/CLUVVI_LOCAL_CORE_ENGINE_MASTER_SPEC.md`
3. `docs/CLUVVI_C0_5_LOCAL_BROWSER_APP_SPEC.md`
4. `docs/ARCHITECTURE.md`
5. `docs/PRODUCT_RULES.md`
6. `docs/DATA_MODEL.md`
7. `docs/PROVIDER_CONTRACTS.md`
8. `docs/EVALS.md`
9. `docs/FAILURES_AND_LIMITATIONS.md`

Before implementing discovery, evidence, identity, enrichment, ranking, or Buyer Map features, also read:

10. `docs/ARCHITECTURE_6_ENGINES.md`
11. `docs/DISCOVERY_ENGINE_STANDALONE_PLAN.md`
12. `docs/SEARCH_RESULTS_V1_CONTRACT.md`
13. `docs/SEARCH_RESULTS_V2_CONTRACT.md`
14. `docs/C1_PARALLEL_BUILD_PLAN.md`
15. `docs/DISCOVERY_PROVIDER_RESEARCH_TEMPLATE.md`
16. `docs/C1_H_LIVE_DISCOVERY_OPERATIONS.md`

## Current product boundary

The active local product at `http://localhost:3100` runs one authoritative workflow through the command composer or CLI.

```text
Command composer or CLI
→ one application/engine path
→ deterministic mission understanding and source/query plan
→ fixture or local_discovery_engine DiscoveryRuntime
→ explicit fixture_only or live_search provider mode
→ validated search_results.v2 plus live telemetry when applicable
→ deterministic evidence → identity hypotheses → ranking → Buyer Map
→ SQLite durability and versioned artifacts
```

C1-C through C1-F implement the deterministic downstream pipeline. C1-G implements a local file/process bridge to the independently executable standalone Discovery Engine. C1-H adds explicit live search through HN Algolia with bounded Firebase enrichment, Tavily basic search, and Brave web search. The default remains Cluvvi's internal fixture runtime. Local-engine mode exports `discovery_request.v1`, invokes the standalone CLI, imports exact `search_results.v2`, validates it, optionally validates `live_provider_run_telemetry.v1`, and then runs the same deterministic downstream stages.

Fixture runs remain synthetic. Live runs contain current public search snippets and provider metadata, but pages are not crawled or deeply extracted, identities and contacts are not verified, and scores are not predictions of purchase behavior.

C1-I crawling/extraction, contact enrichment, outreach, remote APIs, Docker, and workflow automation remain unstarted and unauthorized by C1-H.

## Discovery contract and boundary rules

- Do not add live crawling inside the Cluvvi production repository unless explicitly requested.
- The standalone Discovery Engine lives at `C:\Users\Lenovo\Music\Startups\Cluvvi\Separate Discovery engine`.
- `search_results.v1` is the earlier frozen basic bridge contract and must remain unchanged.
- `search_results.v2`, schema `2.0`, is the expanded universal discovery-run contract.
- V2 is not backward-compatible with V1 because it adds required planning, context, semantic provenance, and coverage structure.
- C1-G/C1-H use Project A's existing `discovery_request.v1`; do not invent a competing request contract.
- The bridge is an adapter across a process boundary and versioned JSON files. Do not import Project A source files or create a permanent package dependency.
- The configured executable and project path are trusted application configuration. User text belongs only in the request JSON and must never enter executable names, shell syntax, or command arguments.
- Fixture mode must remain the default and must not access another repository during ordinary startup or tests.
- Local-engine fixture mode sets `providerPreference: "fixture_only"` and rejects non-fixture provider categories or paid-credit use.
- Local-engine live mode sets `providerPreference: "paid_allowed"`, accepts only approved HN/Tavily/Brave provider IDs, and forwards only the explicit provider environment allowlist.
- Never log, persist, fingerprint, screenshot, or serialize API-key values, authorization headers, or a complete child environment.
- Imported output must be validated for artifact kind, schema version, request ID, required fields, provider category, paid credits, warnings, and coverage before downstream use.
- Live telemetry must be validated for schema, request ID, provider mode, provider IDs, usage, and credit consistency. Invalid telemetry fails the discovery stage and remains preserved for review.
- Preserve the exact imported output and separate bridge provenance; do not place local filesystem paths into the core `search_results.v2` contract.
- The Evidence Engine is the primary direct V2 consumer. Identity, Ranking, and Buyer Map preserve traceability through versioned upstream artifacts.
- Downstream code must not depend on provider-specific `raw` payloads.
- Do not implement or imply a V1-to-V2 adapter. Only a future explicitly reviewed adapter boundary is reserved.
- Cluvvi must validate V1 and V2 independently and reject incompatible versions rather than guess.
- The exact Project A fixture copy remains an immutable compatibility artifact.
- The richer Project B pipeline fixture remains separate, deterministic, synthetic, and `.invalid`-only.
- Do not scrape LinkedIn or bypass login walls.
- Do not add paid providers without explicit approval.
- Do not use fake live-discovery language.
- Fixture V2 artifacts and downstream displays must be clearly labeled as fixture data and not live evidence.

## Active and parked paths

- `packages/core` owns discovery request/runtime contracts plus independent V2, evidence, identity, ranking, Buyer Map, and finalization schemas.
- `packages/engine` is the only workflow implementation and owns the discovery runtime adapters and downstream transformations.
- `packages/application` owns browser-facing services and the local runner loop.
- `packages/storage` owns SQLite, run requests, claims, leases, heartbeats, and leadership.
- `apps/web` owns presentation and thin route handlers; the Buyer Map view is read-only and schema-validated, and active local routes must not use Supabase.
- `apps/worker/src/local.ts` is the active local runner entry and resolves trusted discovery runtime configuration.
- `apps/cli` remains a supported interface to the same engine.
- Existing Supabase/authenticated web routes, the old worker entry, `packages/database`, and `supabase` are preserved Phase 0 code.

## Non-negotiable rules

- Ask whether a capable billion-dollar CTO would approve this as the simplest architecture that directly tests the riskiest assumption.
- Consider first-, second-, third-, and fourth-order consequences before changing shared contracts or persistence.
- React components contain no SQL, filesystem, secrets, or runner logic.
- Route handlers contain no SQL and perform no long-running engine work.
- The runner never imports Next.js.
- Engine code never imports SQLite or Next.js.
- Only `packages/storage` imports `node:sqlite`.
- Web, runner, and CLI resolve one shared `.cluvvi/cluvvi.sqlite` path.
- Run creation and initial execution request are one transaction.
- Requests, stages, and leadership use durable leases and idempotency.
- Only one local runner may own the SQLite leadership lease at a time.
- Each bridge run uses an isolated exchange directory; parallel runs must never share filenames.
- Timeout and cancellation must terminate the child process tree, preserve diagnostics, block downstream execution, and support safe resume.
- Artifact paths and types must be schema validated; never concatenate arbitrary browser input into paths.
- Fixture output must be explicit and must never resemble a claim of real discovery.
- Failures must be structured and added to the failure ledger.
- Refactor only for correctness, simplicity, testability, replaceability, reliability, or direct commercial leverage.
