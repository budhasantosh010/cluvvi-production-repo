# Cluvvi

Cluvvi is an evidence-backed buyer-discovery engine. Its commercial benchmark is to turn what someone sells into real opportunities worth contacting, with evidence, the right buyer, confidence, and clear limitations.

## Current active phase: C1-H Live Discovery Providers

```text
Command composer or CLI
          ↓
One Cluvvi application/engine path
          ↓
Deterministic mission understanding + source plan
          ↓
DiscoveryRuntime
   ├─ fixture / fixture_only → internal deterministic search_results.v2 fixture
   └─ local_discovery_engine
        → discovery_request.v1 JSON
        → standalone Discovery Engine CLI
        ├─ fixture_only → deterministic provider fixture
        └─ live_search → bounded HN + Tavily + Brave search
        → search_results.v2 JSON
        → optional live_provider_run_telemetry.v1 sidecar
          ↓
Strict Cluvvi V2 + telemetry validation
          ↓
Deterministic Evidence → identity hypotheses → ranking → Buyer Map
          ↓
SQLite durable stages and versioned artifacts
```

C0.7 through C0.9 established the command-first local browser flow and interaction system. C1-A added typed deterministic Mission Understanding V1 and a source/query plan. C1-0 and C1-0.1 froze the standalone discovery boundary and the separate V1/V2 contracts. C1-B completed the standalone fixture Discovery Engine. C1-C through C1-F implemented Evidence, role-only Identity + Enrichment, transparent Ranking, and the Buyer Map. C1-G connected Cluvvi to the independently executable standalone engine through a safe process/file boundary. C1-H now adds an explicit `live_search` provider mode for Hacker News, Tavily basic search, and Brave web search while preserving every fixture compatibility gate.

Live mode uses current public search snippets and provider metadata. It does not crawl or deeply extract result pages, identify real people, infer private contacts, or prove that a company is ready to buy. Downstream evidence, role hypotheses, scoring, and Buyer Map generation remain deterministic local analysis with transparent limitations.

## Architecture status

Cluvvi currently:

- accepts website and description input;
- compiles deterministic mission understanding and a source/query plan;
- supports `fixture` and `local_discovery_engine` runtime modes plus explicit `fixture_only` and `live_search` provider modes;
- exports Project A's existing `discovery_request.v1` contract;
- invokes the standalone Discovery Engine CLI through a safe local process boundary;
- passes user content only through JSON files, never executable arguments;
- forwards only an explicit provider-environment allowlist and never logs or persists secret values;
- validates the exact returned `search_results.v2` artifact, request ID, provider categories, coverage, and paid-credit accounting;
- validates and preserves Project A's `live_provider_run_telemetry.v1` sidecar for live runs;
- preserves the original imported artifact plus bridge execution records and logs;
- produces versioned evidence, identity, ranking, Buyer Map, and finalization artifacts;
- preserves provider, query, semantic, URL, warning, and coverage provenance;
- supports timeout, cancellation, structured failure, resume, and idempotent artifact reuse;
- persists and presents the complete workflow through the shared browser, CLI, runner, and SQLite path.

Cluvvi does not yet:

- crawl, render, or deeply extract result pages;
- identify verified real people or infer private contact details;
- prove purchase intent from search snippets alone;
- send outreach.

Next:

1. Preserve C1-G fixture execution and C1-H live search as compatibility gates.
2. Keep C1-I crawler/extractor work separate until robots, terms, page limits, provenance, and cost controls are explicitly approved.
3. Do not begin contact enrichment or outreach before identity and evidence quality thresholds are proven.

`search_results.v1` remains the earlier frozen basic bridge contract. `search_results.v2`, schema `2.0`, is the expanded universal discovery-run contract. No V1-to-V2 adapter exists; only a future explicit adapter boundary is reserved.

Read `docs/ARCHITECTURE_6_ENGINES.md`, `docs/DISCOVERY_ENGINE_STANDALONE_PLAN.md`, `docs/SEARCH_RESULTS_V1_CONTRACT.md`, `docs/SEARCH_RESULTS_V2_CONTRACT.md`, `docs/C1_PARALLEL_BUILD_PLAN.md`, and `docs/DISCOVERY_PROVIDER_RESEARCH_TEMPLATE.md` before starting discovery or downstream engine work.

## Start the browser application

Requirements: Node.js 24+ and pnpm 9.15.9. Docker, Supabase, and authentication are not required. Provider keys are not required for the default fixture mode; live search requires configured Tavily and Brave keys in Project A's ignored root `.env.local` or explicit allowlisted process environment.

```powershell
pnpm install
pnpm dev
```

Open:

```text
http://localhost:3100
```

Without discovery configuration, `pnpm dev` remains in the internal `fixture` mode. It initializes SQLite, starts the loopback-only Next.js server, starts the local runner, verifies both processes see the same database instance, and prints the active data and discovery runtime modes. Press `Ctrl+C` to stop both processes.

Explicit commands:

```powershell
pnpm dev:web
pnpm dev:runner
```

## Local Discovery Engine bridge

The standalone Discovery Engine remains a separate repository and independently executable program. Cluvvi does not import its source files or provider implementations.

Example PowerShell configuration:

```powershell
$env:CLUVVI_DISCOVERY_MODE = "local_discovery_engine"
$env:CLUVVI_DISCOVERY_PROVIDER_MODE = "live_search" # or fixture_only
$env:CLUVVI_DISCOVERY_ENGINE_PATH = "C:\Users\Lenovo\Music\Startups\Cluvvi\Separate Discovery engine"
$env:CLUVVI_DISCOVERY_ENGINE_COMMAND = "pnpm"
$env:CLUVVI_DISCOVERY_ENGINE_TIMEOUT_MS = "90000"
$env:CLUVVI_DISCOVERY_KEEP_EXCHANGE_FILES = "true"

# Optional public live-provider limits. Project A loads its ignored root .env.local for keys.
$env:DISCOVERY_BROAD_PROVIDER_STRATEGY = "fanout"
$env:DISCOVERY_LIVE_MAX_QUERIES = "3"
$env:DISCOVERY_MAX_RESULTS_PER_PROVIDER = "3"
pnpm dev
```

Configuration:

```text
CLUVVI_DISCOVERY_MODE
  fixture | local_discovery_engine
  default: fixture

CLUVVI_DISCOVERY_PROVIDER_MODE
  fixture_only | live_search
  default: fixture_only
  live_search requires local_discovery_engine

CLUVVI_DISCOVERY_ENGINE_PATH
  absolute path to the standalone Discovery Engine
  required in local_discovery_engine mode

CLUVVI_DISCOVERY_ENGINE_COMMAND
  trusted executable name or path
  required in local_discovery_engine mode; use pnpm for Project A

CLUVVI_DISCOVERY_ENGINE_TIMEOUT_MS
  1000–300000
  default: 60000

CLUVVI_DISCOVERY_KEEP_EXCHANGE_FILES
  true | false
  default: false
```

For every local-engine execution, Cluvvi creates an isolated run workspace:

```text
<cluvvi-home>/runs/<run-id>/discovery-exchange/
  discovery-request.v1.json
  search-results.v2.json
  search-results.v2.json.provider-executions.v1.json # live_search only
  discovery-stdout.log
  discovery-stderr.log
  discovery-execution.json
  history/
```

The configured command is trusted application configuration. Mission text is written only into `discovery-request.v1.json`; it is never interpolated into a shell command. Fixture mode sets `providerPreference: "fixture_only"` and rejects non-fixture or paid output. Live mode sets `providerPreference: "paid_allowed"`, accepts only the approved HN/Tavily/Brave provider IDs and free/paid categories, validates the telemetry request ID and mode, and requires artifact paid credits to equal API-reported Tavily credits. The child process receives only a fixed allowlist of provider settings; unrelated parent environment variables are not forwarded.

## Browser workflow

```text
Enter what you sell
→ create one durable SQLite run
→ enqueue one idempotent run request
→ local runner claims it with a lease
→ shared CluvviEngine generates Mission Understanding V1
→ persist mission understanding and source/query plan
→ DiscoveryRuntime returns validated search_results.v2
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

The browser distinguishes internal fixtures, local-engine fixtures, and live search. Live runs show provider attempts, failed attempts, Tavily credits, Brave/HN request counts, provider warnings, and coverage gaps. Live snippets are not presented as crawled evidence, verified people, private contact enrichment, or confirmed purchase intent.

## CLI remains available

```powershell
pnpm cluvvi init
pnpm cluvvi doctor
pnpm cluvvi run ./examples/video-editing-saas.json
pnpm cluvvi status <run-id>
pnpm cluvvi inspect <run-id>
pnpm cluvvi resume <run-id>
```

The CLI and browser use the same engine, discovery runtime configuration, and SQLite state model.

## Active repository map

```text
apps/web             Browser UI and thin local API routes
apps/worker          Local runner entry plus preserved Phase 0 worker
apps/cli             Developer CLI
packages/application Browser/runner application services
packages/core        Shared schemas, IDs, errors, and fingerprints
packages/engine      Workflow, discovery adapters, and downstream engines
packages/storage     CluvviStore, SQLite adapter, requests, leases, heartbeats
tests/fixtures       Controlled fixture CLI for process failure tests
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
pnpm test:browser-local-discovery
pnpm test:browser-local-discovery-failure
pnpm test:browser-live-discovery
pnpm test:browser-live-discovery-failure
```

The fixture cross-project integration test is opt-in and proves the original C1-G no-network compatibility path. The C1-H live integration test is separately opt-in with `RUN_LIVE_DISCOVERY_INTEGRATION=1`; it proves actual Project A provider execution, exact V2 and telemetry validation, request-ID agreement, provider/category/cost integrity, and complete Evidence → Identity → Ranking → Buyer Map processing.

The maintained browser suites prove fixture regressions, real live desktop/mobile completion, provider telemetry presentation, imported V2 inspection, refresh durability, no mobile overflow, invalid-telemetry failure, preserved exchange evidence, and successful same-run resume. Core and engine tests separately prove contract strictness, configuration allowlisting, request adaptation, process execution, stdout/stderr capture, timeout, cancellation, nonzero exit, missing/invalid artifact or telemetry, provider/mode/request/cost mismatch rejection, partial-provider success, persistence, idempotency, and resume.

Read `AGENTS.md`, `docs/CLUVVI_NEXT_IMPLEMENTATION_MASTER_PLAN.md`, `docs/ARCHITECTURE_6_ENGINES.md`, `docs/DISCOVERY_ENGINE_STANDALONE_PLAN.md`, `docs/SEARCH_RESULTS_V1_CONTRACT.md`, `docs/SEARCH_RESULTS_V2_CONTRACT.md`, `docs/C1_PARALLEL_BUILD_PLAN.md`, `docs/DISCOVERY_PROVIDER_RESEARCH_TEMPLATE.md`, `docs/C1_H_LIVE_DISCOVERY_OPERATIONS.md`, `docs/CLUVVI_LOCAL_CORE_ENGINE_MASTER_SPEC.md`, `docs/CLUVVI_C0_5_LOCAL_BROWSER_APP_SPEC.md`, `docs/ARCHITECTURE.md`, and `docs/FAILURES_AND_LIMITATIONS.md` before changing the active runtime.
