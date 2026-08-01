# Cluvvi

Cluvvi is an evidence-backed buyer-discovery engine. Its commercial benchmark is to turn what someone sells into real opportunities worth contacting, with evidence, the right buyer, confidence, and clear limitations.

## Current active phase: C1-0.1 Search Results V2 Contract Amendment

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

C0.7 makes the landing composer smaller and vertically resizable. C1-A turns the existing compilation stage into a typed, deterministic Mission Understanding V1 artifact with buyer hypotheses, pain language, source priorities, and 25–60 deduplicated search queries. C0.8 adds the shared CSS-first tactile system. C0.9 completes the main-flow choreography with immediate pointer-down feedback, a stable committed composer state, truthful local-run status continuity, an intentional opening transition, honest first-paint artifact placeholders, and clearer stage semantics. C1-0 froze the six-engine architecture, the standalone Discovery Engine boundary, the earlier basic `search_results.v1` bridge, provider categories, and the parallel build plan. The separate C1-B Project A fixture scaffold is now complete and emits the expanded `search_results.v2` universal discovery-run artifact. C1-0.1 documents that V1 remains frozen and unchanged, V2 is not backward-compatible because it adds required planning, context, semantic provenance, and coverage structure, and C1-C through C1-F consume clearly labeled fixture V2. C1-0.1 changes documentation only.

## Architecture status

Cluvvi currently:

- accepts website and description input;
- compiles deterministic mission understanding;
- generates buyer hypotheses, source priorities, and search queries;
- shows durable local planning artifacts through the browser and CLI.

Cluvvi does not yet:

- execute live discovery;
- crawl websites;
- call discovery-provider APIs;
- enrich contacts;
- rank real customer opportunities;
- send outreach.

Next:

1. Commit the C1-0.1 documentation-only V2 amendment.
2. Build C1-C Evidence Engine against clearly labeled fixture `search_results.v2`.
3. Continue C1-D through C1-F while preserving V2 citations, semantic provenance, fixture labels, and coverage limitations.
4. Run the cross-project compatibility gate: Project A validates V2, Cluvvi validates the same artifact, Evidence consumes V2, and frozen V1 remains separately valid.

`search_results.v1` remains the earlier frozen basic bridge contract. `search_results.v2`, schema `2.0`, is the expanded universal discovery-run contract. No V1-to-V2 adapter exists; only a future explicit adapter boundary is reserved.

Read `docs/ARCHITECTURE_6_ENGINES.md`, `docs/DISCOVERY_ENGINE_STANDALONE_PLAN.md`, `docs/SEARCH_RESULTS_V1_CONTRACT.md`, `docs/SEARCH_RESULTS_V2_CONTRACT.md`, `docs/C1_PARALLEL_BUILD_PLAN.md`, and `docs/DISCOVERY_PROVIDER_RESEARCH_TEMPLATE.md` before starting discovery or downstream engine work.

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

Read `AGENTS.md`, `docs/CLUVVI_NEXT_IMPLEMENTATION_MASTER_PLAN.md`, `docs/ARCHITECTURE_6_ENGINES.md`, `docs/DISCOVERY_ENGINE_STANDALONE_PLAN.md`, `docs/SEARCH_RESULTS_V1_CONTRACT.md`, `docs/SEARCH_RESULTS_V2_CONTRACT.md`, `docs/C1_PARALLEL_BUILD_PLAN.md`, `docs/DISCOVERY_PROVIDER_RESEARCH_TEMPLATE.md`, `docs/CLUVVI_LOCAL_CORE_ENGINE_MASTER_SPEC.md`, `docs/CLUVVI_C0_5_LOCAL_BROWSER_APP_SPEC.md`, `docs/ARCHITECTURE.md`, and `docs/FAILURES_AND_LIMITATIONS.md` before changing the active runtime.
