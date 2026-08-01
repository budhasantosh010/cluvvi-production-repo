# Cluvvi

Cluvvi is an evidence-backed buyer-discovery engine. Its commercial benchmark is to turn what someone sells into real opportunities worth contacting, with evidence, the right buyer, confidence, and clear limitations.

## Current active phase: C1-G Local Discovery-to-Cluvvi Bridge

```text
Command composer or CLI
          ↓
One Cluvvi application/engine path
          ↓
Deterministic mission understanding + source plan
          ↓
DiscoveryRuntime
   ├─ fixture → internal deterministic search_results.v2 fixture
   └─ local_discovery_engine
        → discovery_request.v1 JSON
        → standalone Discovery Engine CLI
        → fixture-provider search_results.v2 JSON
          ↓
Strict Cluvvi V2 validation
          ↓
Evidence → identity hypotheses → ranking → Buyer Map
          ↓
SQLite durable stages and versioned artifacts
```

C0.7 through C0.9 established the command-first local browser flow and interaction system. C1-A added typed deterministic Mission Understanding V1 and a source/query plan. C1-0 and C1-0.1 froze the standalone discovery boundary and the separate V1/V2 contracts. C1-B completed the standalone fixture-only Discovery Engine. C1-C through C1-F implemented Evidence, role-only Identity + Enrichment, transparent Ranking, and the Buyer Map. C1-G now connects Cluvvi to the independently executable standalone engine through a process boundary and versioned JSON files.

Both C1-G runtime modes remain fixture-only. The bridge is real; the returned companies, URLs, evidence, roles, scores, and Buyer Map are still synthetic and must never be presented as live customer discovery.

## Architecture status

Cluvvi currently:

- accepts website and description input;
- compiles deterministic mission understanding and a source/query plan;
- supports `fixture` and `local_discovery_engine` discovery runtime modes;
- exports Project A's existing `discovery_request.v1` contract;
- invokes the standalone Discovery Engine CLI through a safe local process boundary;
- passes user content only through JSON files, never executable arguments;
- validates the exact returned `search_results.v2` artifact, request ID, fixture provider category, coverage, and zero paid-credit use;
- preserves the original imported artifact plus bridge execution records and logs;
- produces versioned evidence, identity, ranking, Buyer Map, and finalization artifacts;
- preserves provider, query, semantic, URL, warning, and coverage provenance;
- supports timeout, cancellation, structured failure, resume, and idempotent artifact reuse;
- persists and presents the complete workflow through the shared browser, CLI, runner, and SQLite path.

Cluvvi does not yet:

- execute live discovery or use a live provider;
- crawl websites or call discovery-provider APIs;
- identify real people or infer private contact details;
- rank real customer opportunities;
- send outreach.

Next:

1. Preserve the C1-G process/file bridge and deterministic fixtures as compatibility gates.
2. Research and explicitly approve the first live-provider path in C1-H.
3. Keep live providers, crawlers, and extractors outside C1-G.
4. Do not begin real customer discovery or outreach before provenance and quality thresholds are proven.

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
$env:CLUVVI_DISCOVERY_ENGINE_PATH = "C:\Users\Lenovo\Music\Startups\Cluvvi\Separate Discovery engine"
$env:CLUVVI_DISCOVERY_ENGINE_COMMAND = "pnpm"
$env:CLUVVI_DISCOVERY_ENGINE_TIMEOUT_MS = "60000"
$env:CLUVVI_DISCOVERY_KEEP_EXCHANGE_FILES = "true"
pnpm dev
```

Configuration:

```text
CLUVVI_DISCOVERY_MODE
  fixture | local_discovery_engine
  default: fixture

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
  discovery-stdout.log
  discovery-stderr.log
  discovery-execution.json
  history/
```

The configured command is trusted application configuration. Mission text is written only into `discovery-request.v1.json`; it is never interpolated into a shell command. C1-G always sets `providerPreference: "fixture_only"` and rejects non-fixture or paid output.

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

The browser distinguishes internal fixture execution from the standalone local engine's fixture-provider execution. Neither mode is presented as live market data, real people, real contact enrichment, or real customer discovery.

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
```

The real cross-project integration test is opt-in and runs only when `CLUVVI_DISCOVERY_ENGINE_PATH` is configured. It proves Cluvvi request export, actual Project A CLI execution, exact V2 validation, request-ID agreement, Evidence consumption, Identity, Ranking, and Buyer Map completion without network access.

The maintained browser suites prove fixture-mode regression behavior, real local-engine desktop/mobile completion, imported V2 inspection, refresh durability, no mobile overflow, invalid-output failure, preserved diagnostics, and successful resume. Core and engine tests separately prove V1/V2 rejection boundaries, configuration validation, request adaptation, process execution, stdout/stderr capture, timeout, cancellation, nonzero exit, missing/invalid output, unexpected provider rejection, persistence, idempotency, and resume.

Read `AGENTS.md`, `docs/CLUVVI_NEXT_IMPLEMENTATION_MASTER_PLAN.md`, `docs/ARCHITECTURE_6_ENGINES.md`, `docs/DISCOVERY_ENGINE_STANDALONE_PLAN.md`, `docs/SEARCH_RESULTS_V1_CONTRACT.md`, `docs/SEARCH_RESULTS_V2_CONTRACT.md`, `docs/C1_PARALLEL_BUILD_PLAN.md`, `docs/DISCOVERY_PROVIDER_RESEARCH_TEMPLATE.md`, `docs/CLUVVI_LOCAL_CORE_ENGINE_MASTER_SPEC.md`, `docs/CLUVVI_C0_5_LOCAL_BROWSER_APP_SPEC.md`, `docs/ARCHITECTURE.md`, and `docs/FAILURES_AND_LIMITATIONS.md` before changing the active runtime.
