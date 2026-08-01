# Cluvvi

Cluvvi is an evidence-backed buyer-discovery engine. Its commercial benchmark is to turn what someone sells into real opportunities worth contacting, with evidence, the right buyer, confidence, and clear limitations.

## Current active phase: C1-C through C1-F Downstream Fixture Pipeline

```text
Command composer or CLI
          ↓
One Cluvvi application/engine path
          ↓
Deterministic mission understanding + unexecuted search plan
          ↓
Validated synthetic search_results.v2 fixture
          ↓
Evidence → identity hypotheses → ranking → Buyer Map
          ↓
SQLite durable stages and versioned artifacts
```

C0.7 through C0.9 established the command-first local browser flow and interaction system. C1-A added typed deterministic Mission Understanding V1 and an unexecuted search plan. C1-0 and C1-0.1 froze the standalone discovery boundary and the separate V1/V2 contracts. C1-B completed the standalone fixture-only Discovery Engine scaffold. C1-C through C1-F now independently validate `search_results.v2`, produce positive and negative evidence findings, create role-only identity hypotheses with public manual routes, rank opportunities with a transparent deterministic scorecard, and persist a fixture Buyer Map. Every company and URL in the downstream demonstration is synthetic; no live source is queried.

## Architecture status

Cluvvi currently:

- accepts website and description input;
- compiles deterministic mission understanding and an unexecuted search plan;
- independently validates fixture `search_results.v2`;
- produces versioned evidence, identity, ranking, Buyer Map, and finalization artifacts;
- preserves provider, query, semantic, URL, warning, and coverage provenance;
- persists and presents the complete fixture pipeline through the shared browser, CLI, runner, and SQLite path.

Cluvvi does not yet:

- execute live discovery or call the standalone engine at runtime;
- crawl websites or call discovery-provider APIs;
- identify real people or infer private contact details;
- rank real customer opportunities;
- send outreach.

Next:

1. Release the C1-C through C1-F fixture pipeline on its independent branch.
2. Keep C1-G—the approved runtime bridge from Project A V2 output into Cluvvi—separate and unstarted.
3. Research live providers only after the bridge boundary is explicitly approved.
4. Preserve the deterministic fixtures as regression and compatibility gates.

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
→ persist mission understanding, source plan, and unexecuted search queries
→ validate a version-controlled synthetic search_results.v2 fixture
→ produce evidence_findings.v1, identity_enrichment.v1, ranked_opportunities.v1, and buyer_map.v1
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

Mission understanding and query planning are visibly marked as deterministic local logic. Evidence, identity, ranking, and Buyer Map are visibly marked as synthetic fixture output. Nothing is presented as live market data, real people, real contact enrichment, or real customer discovery.

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

The maintained browser suite proves URL/text mission mapping, tactile and reduced-motion behavior, duplicate-submit prevention, durable run continuity, the specialized fixture Buyer Map, negative evidence, transparent score components, manual contact routes, coverage gaps, refresh durability, and responsive geometry without mobile overflow. Core and engine tests separately prove V1/V2 rejection boundaries, exact Project A fixture compatibility, raw-payload independence, provenance preservation, deterministic ranking, negative/stale penalties, persistence, idempotent reuse, failure, and resume.

Read `AGENTS.md`, `docs/CLUVVI_NEXT_IMPLEMENTATION_MASTER_PLAN.md`, `docs/ARCHITECTURE_6_ENGINES.md`, `docs/DISCOVERY_ENGINE_STANDALONE_PLAN.md`, `docs/SEARCH_RESULTS_V1_CONTRACT.md`, `docs/SEARCH_RESULTS_V2_CONTRACT.md`, `docs/C1_PARALLEL_BUILD_PLAN.md`, `docs/DISCOVERY_PROVIDER_RESEARCH_TEMPLATE.md`, `docs/CLUVVI_LOCAL_CORE_ENGINE_MASTER_SPEC.md`, `docs/CLUVVI_C0_5_LOCAL_BROWSER_APP_SPEC.md`, `docs/ARCHITECTURE.md`, and `docs/FAILURES_AND_LIMITATIONS.md` before changing the active runtime.
