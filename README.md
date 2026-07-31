# Cluvvi

Cluvvi is an evidence-backed buyer-discovery engine. Its commercial benchmark is to turn what someone sells into real opportunities worth contacting, with evidence, the right buyer, confidence, and clear limitations.

## Current active phase: C0.9 Apple-style flow choreography + C1-A mission understanding

```text
Command composer or CLI
          ↓
One Cluvvi application/engine path
          ↓
Deterministic mission understanding + search plan
          ↓
SQLite durable stages and versioned artifacts
          ↓
Later fixture stages (no live search execution)
```

C0.7 makes the landing composer smaller and vertically resizable. C1-A turns the existing compilation stage into a typed, deterministic Mission Understanding V1 artifact with buyer hypotheses, pain language, source priorities, and 25–60 deduplicated search queries. C0.8 adds the shared CSS-first tactile system. C0.9 completes the main-flow choreography with immediate pointer-down feedback, a stable committed composer state, truthful local-run status continuity, an intentional opening transition, honest first-paint artifact placeholders, and clearer stage semantics. No animation package, artificial delay, executed query, or live-customer claim was added.

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
→ pointer-down feedback commits the composer immediately
→ create one durable SQLite run
→ enqueue one idempotent run request
→ local runner claims it with a lease
→ shared CluvviEngine generates Mission Understanding V1
→ persist buyer hypotheses, source plan, and unexecuted search queries
→ continue the remaining deterministic fixture stages
→ browser polls, refreshes, inspects, fails, and resumes safely
```

The browser exposes:

```text
/
/runs
/runs/<run-id>
/runs/<run-id>/inspect
/settings/local
```

Mission understanding and query planning are visibly marked as deterministic local planning. Later workflow artifacts remain fixture output. Nothing is presented as live market data or real customer discovery.

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

Focused C0.9 tests prove URL/text mission mapping, pointer-down press state on the main controls, `idle → creating → opening` continuity, truthful local-run status copy, stable desktop/mobile submit geometry, smooth menu entry, honest run-detail placeholders, clear stage semantics, reduced-motion behavior, duplicate-submit prevention, run-detail rendering, refresh durability, and responsive geometry without mobile overflow. C1-A generator and persistence tests remain unchanged and green.

Read `AGENTS.md`, `docs/CLUVVI_NEXT_IMPLEMENTATION_MASTER_PLAN.md`, `docs/CLUVVI_LOCAL_CORE_ENGINE_MASTER_SPEC.md`, `docs/CLUVVI_C0_5_LOCAL_BROWSER_APP_SPEC.md`, `docs/ARCHITECTURE.md`, and `docs/FAILURES_AND_LIMITATIONS.md` before changing the active runtime.
