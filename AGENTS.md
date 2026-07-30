# Cluvvi engineering rules

Read these before changing active engine code:

1. `docs/CLUVVI_LOCAL_CORE_ENGINE_MASTER_SPEC.md`
2. `docs/ARCHITECTURE.md`
3. `docs/PRODUCT_RULES.md`
4. `docs/DATA_MODEL.md`
5. `docs/PROVIDER_CONTRACTS.md`
6. `docs/EVALS.md`
7. `docs/FAILURES_AND_LIMITATIONS.md`

## Current product boundary

The current priority is proving that Cluvvi can turn a product description into 20 source-backed potential customers worth contacting. Production infrastructure is secondary until that commercial loop works.

Phase C0 builds only the local deterministic foundation:

`Mission JSON → CLI → SQLite run → deterministic stages → versioned artifacts → status/inspect/resume`

Do not add real model calls, website ingestion, search, enrichment, ranking logic, or outreach in C0.

## Active and parked paths

- `apps/cli`, `packages/engine`, and `packages/storage` are the active C0 path.
- `apps/web`, `apps/worker`, `packages/database`, and `supabase` are preserved Phase 0 code but parked.
- Active engine code must not import Supabase packages.
- Engine code must not import SQLite APIs; only `packages/storage` may import `node:sqlite`.

## Non-negotiable rules

- Ask whether a capable billion-dollar CTO would approve this as the simplest architecture that directly tests the riskiest assumption.
- Deterministic code controls state, budgets, retries, idempotency, persistence, and arithmetic.
- Every stage input and output is schema validated.
- Every completed stage is durable and resumable.
- Identical completed work is reused by fingerprint.
- Artifact files are atomic mirrors; SQLite is authoritative.
- Fixture output must be visibly labeled and never presented as real discovery.
- Provider-specific code must remain replaceable behind contracts.
- Failures must be explicit, structured, and added to the failure ledger.
- Refactor only for correctness, simplicity, testability, replaceability, reliability, or direct commercial leverage.
