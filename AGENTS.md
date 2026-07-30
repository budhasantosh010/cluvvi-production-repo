# Cluvvi engineering rules

Read these before changing active engine or browser-runtime code:

1. `docs/CLUVVI_LOCAL_CORE_ENGINE_MASTER_SPEC.md`
2. `docs/CLUVVI_C0_5_LOCAL_BROWSER_APP_SPEC.md`
3. `docs/ARCHITECTURE.md`
4. `docs/PRODUCT_RULES.md`
5. `docs/DATA_MODEL.md`
6. `docs/PROVIDER_CONTRACTS.md`
7. `docs/EVALS.md`
8. `docs/FAILURES_AND_LIMITATIONS.md`

## Current product boundary

C0.5 exposes the existing local deterministic engine through a browser at `http://localhost:3100`.

```text
Browser or CLI
→ one application/engine path
→ SQLite durability
→ deterministic fixture artifacts
```

Do not add real model calls, website ingestion, search, enrichment, scoring, outreach, authentication, billing, or deployment in C0.5.

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
