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

The active local product at `http://localhost:3100` runs one authoritative workflow through the command composer or CLI.

```text
Command composer or CLI
→ one application/engine path
→ deterministic mission understanding and unexecuted query plan
→ validated synthetic search_results.v2 fixture
→ evidence → identity hypotheses → ranking → Buyer Map
→ SQLite durability and versioned artifacts
```

C1-C through C1-F are implemented as a deterministic downstream fixture pipeline. Mission understanding and query planning are real local logic. The downstream companies, URLs, evidence, identity hypotheses, scores, and Buyer Map are synthetic fixture output and must never be presented as live market data.

C1-G—the runtime bridge from standalone Project A V2 output into Cluvvi—has not started. No live provider or discovery execution is authorized.

## Discovery contract and boundary rules

- Do not add live crawling inside the Cluvvi production repository unless explicitly requested.
- The standalone Discovery Engine lives at `C:\Users\Lenovo\Music\Startups\Cluvvi\Separate Discovery engine`.
- `search_results.v1` is the earlier frozen basic bridge contract and must remain unchanged.
- `search_results.v2`, schema `2.0`, is the expanded universal discovery-run contract.
- V2 is not backward-compatible with V1 because it adds required planning, context, semantic provenance, and coverage structure.
- C1-C through C1-F consume clearly labeled fixture `search_results.v2` and are implemented in the shared Cluvvi engine.
- The Evidence Engine is the primary direct V2 consumer. Identity, Ranking, and Buyer Map preserve traceability through versioned upstream artifacts.
- Do not implement or imply a V1-to-V2 adapter. Only the future adapter boundary is reserved.
- Cluvvi must validate V1 and V2 independently and reject incompatible versions rather than guess.
- Do not create a permanent runtime import or filesystem dependency on the standalone Discovery Engine repository.
- The exact Project A fixture copy is an immutable compatibility artifact; preserve its bytes and validate it independently.
- The richer Project B pipeline fixture is separate and must remain synthetic, deterministic, and `.invalid`-only.
- Do not scrape LinkedIn or bypass login walls.
- Do not add paid providers without explicit approval.
- Do not use fake live-discovery language.
- Fixture V2 artifacts and downstream displays must be clearly labeled as fixture data and not live evidence.

## Active and parked paths

- `packages/core` owns the independent V2, evidence, identity, ranking, Buyer Map, and finalization schemas.
- `packages/engine` is the only workflow implementation and owns deterministic fixture transformations.
- `packages/application` owns browser-facing services and the local runner loop.
- `packages/storage` owns SQLite, run requests, claims, leases, heartbeats, and leadership.
- `apps/web` owns presentation and thin route handlers; the Buyer Map view is read-only and schema-validated, and active local routes must not use Supabase.
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
