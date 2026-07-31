# Cluvvi

Cluvvi is an evidence-backed buyer-discovery engine. Its commercial benchmark is to turn what someone sells into real opportunities worth contacting, with evidence, the right buyer, confidence, and clear limitations.

## Current active phase: C0.6 command-first homepage

```text
Command composer or CLI
          ↓
One Cluvvi application/engine path
          ↓
SQLite durable run requests and stages
          ↓
Versioned fixture artifacts
```

C0.6 turns the local browser into a focused AI-agent-style command surface while preserving the proven C0.5 engine and durability architecture. It remains explicit fixture mode and does **not** claim to discover real customers yet.

## Start the browser application

Requirements: Node.js 24+ and pnpm 9.15.9. Docker, Supabase, authentication, and provider keys are not required.

```powershell
pnpm install
pnpm dev
```

Open:

```text
http://localhost:3100
```

`pnpm dev` initializes SQLite, starts the loopback-only Next.js server, starts the local runner, verifies both processes see the same database instance, and prints the active fixture mode. Press `Ctrl+C` to stop both processes.

Explicit commands:

```powershell
pnpm dev:web
pnpm dev:runner
```

## Browser workflow

```text
Enter what you sell
→ create one durable SQLite run
→ enqueue one idempotent run request
→ local runner claims it with a lease
→ shared CluvviEngine executes eleven stages
→ browser polls persisted progress
→ refresh, inspect, fail, and resume safely
```

The browser exposes:

```text
/
/runs
/runs/<run-id>
/runs/<run-id>/inspect
/settings/local
```

Every generated result is visibly marked as deterministic fixture output.

## CLI remains available

```powershell
pnpm cluvvi init
pnpm cluvvi doctor
pnpm cluvvi run ./examples/video-editing-saas.json
pnpm cluvvi status <run-id>
pnpm cluvvi inspect <run-id>
pnpm cluvvi resume <run-id>
```

The CLI and browser use the same engine and SQLite state model.

## Active repository map

```text
apps/web             Browser UI and thin local API routes
apps/worker          Local runner entry plus preserved Phase 0 worker
apps/cli             Developer CLI
packages/application Browser/runner application services
packages/core        Shared schemas, IDs, errors, and fingerprints
packages/engine      The single authoritative workflow implementation
packages/storage     CluvviStore, SQLite adapter, requests, leases, heartbeats
visual_qa            Final browser screenshots
```

The earlier Supabase/authentication code remains preserved but is not imported by the active local browser path.

## Verification

```powershell
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm test:browser-local
```

Focused C0.6 tests prove URL/text mission mapping, progressive context controls, keyboard submission, validation and API errors, duplicate-submit prevention, atomic request idempotency, complete fixture execution, refresh durability, and responsive browser geometry without mobile overflow.

Read `AGENTS.md`, `docs/CLUVVI_NEXT_IMPLEMENTATION_MASTER_PLAN.md`, `docs/CLUVVI_LOCAL_CORE_ENGINE_MASTER_SPEC.md`, `docs/CLUVVI_C0_5_LOCAL_BROWSER_APP_SPEC.md`, `docs/ARCHITECTURE.md`, and `docs/FAILURES_AND_LIMITATIONS.md` before changing the active runtime.
