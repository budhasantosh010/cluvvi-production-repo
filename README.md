# Cluvvi

Cluvvi is an evidence-backed buyer-discovery engine. Its benchmark is simple: given what someone sells, return the real companies or people most worth contacting, with evidence, the appropriate buyer, a safe business contact route, confidence, and limitations.

## Current active phase: C0 local core engine

```text
Mission JSON
→ local CLI
→ SQLite run
→ deterministic stage runner
→ versioned artifacts
→ status / inspect / resume
```

C0 deliberately uses fixture stages. It proves durable orchestration and does **not** claim to discover real customers yet.

## Run it

Requirements: Node.js 24+ and pnpm 9.15.9. Docker, Supabase, and authentication are not required.

```bash
pnpm install
pnpm cluvvi init
pnpm cluvvi doctor
pnpm cluvvi run ./examples/video-editing-saas.json
```

The run prints its ID. Then:

```bash
pnpm cluvvi status <run-id>
pnpm cluvvi inspect <run-id>
pnpm cluvvi inspect <run-id> --stage investigation
pnpm cluvvi inspect <run-id> --errors
pnpm cluvvi resume <run-id>
```

Local state is stored only under:

```text
.cluvvi/
├── cluvvi.sqlite
└── runs/<run-id>/
```

## Active repository map

```text
apps/cli          Local command interface
packages/core     Versioned schemas, IDs, errors, fingerprints
packages/engine   Deterministic stages, budgets, resume, artifacts
packages/storage  CluvviStore and SQLite adapter
examples          Versioned mission inputs
```

## Parked Phase 0

These remain preserved but are not part of the local execution path:

```text
apps/web
apps/worker
packages/database
supabase
```

## Verification

```bash
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

The focused C0 tests prove SQLite migrations, full fixture execution, atomic artifacts, failure/resume, and fingerprint idempotency.

Read `AGENTS.md`, `docs/CLUVVI_LOCAL_CORE_ENGINE_MASTER_SPEC.md`, and `docs/ARCHITECTURE.md` before changing the active engine.
