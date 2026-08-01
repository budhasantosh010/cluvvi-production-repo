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

## Current product boundary

C0.9 presents the existing C0.7 + C1-A local engine through a smaller command composer with CSS-first tactile controls and continuous Apple-style main-flow choreography at `http://localhost:3100`.

```text
Command composer or CLI
→ one application/engine path
→ deterministic mission understanding and unexecuted query plan
→ SQLite durability
→ remaining deterministic fixture artifacts
```

C0.9 may change interaction CSS, tiny reusable pointer-state helpers, client-side submit/status continuity, honest run-detail placeholders, stage presentation, and browser tests only. C1-A may classify the mission, generate buyer hypotheses, pain language, source priorities, and search queries.

C1-0.1 is a documentation-only contract amendment after the separate fixture-only C1-B scaffold. It adds no Cluvvi runtime behavior, dependencies, providers, APIs, crawlers, migrations, enrichment, ranking, or outreach.

Query planning is real local logic. Market evidence remains absent from the Cluvvi runtime until a later approved phase.

## Discovery contract and boundary rules

- Do not add live crawling inside the Cluvvi production repository unless explicitly requested.
- The standalone Discovery Engine lives at `C:\Users\Lenovo\Music\Startups\Cluvvi\Separate Discovery engine`.
- `search_results.v1` is the earlier frozen basic bridge contract and must remain unchanged.
- `search_results.v2`, schema `2.0`, is the expanded universal discovery-run contract.
- V2 is not backward-compatible with V1 because it adds required planning, context, semantic provenance, and coverage structure.
- C1-C through C1-F consume clearly labeled fixture `search_results.v2`.
- The Evidence Engine is the primary direct V2 consumer. Later engines preserve traceability to V2 through their versioned upstream artifacts.
- Do not implement or imply a V1-to-V2 adapter. Only the future adapter boundary is reserved.
- Cluvvi must validate V1 and V2 independently and reject incompatible versions rather than guess.
- Do not create a permanent runtime import or filesystem dependency on the standalone Discovery Engine repository.
- Do not scrape LinkedIn or bypass login walls.
- Do not add paid providers without explicit approval.
- Do not use fake live-discovery language.
- Fixture V2 artifacts and downstream displays must be clearly labeled as fixture data and not live evidence.

## Active and parked paths

- `packages/engine` is the only workflow implementation.
- `packages/application` owns browser-facing services and the local runner loop.
- `packages/storage` owns SQLite, run requests, claims, leases, heartbeats, and leadership.
- `apps/web` owns presentation and thin route handlers; active local routes must not use Supabase.
- `apps/worker/src/local.ts` is the active local runner entry.
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
- Artifact paths and types must be schema validated; never concatenate arbitrary browser input into paths.
- Fixture output must be explicit and must never resemble a claim of real discovery.
- Failures must be structured and added to the failure ledger.
- Refactor only for correctness, simplicity, testability, replaceability, reliability, or direct commercial leverage.
