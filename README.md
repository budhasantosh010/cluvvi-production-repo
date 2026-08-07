# Cluvvi

Cluvvi is an evidence-backed buyer-discovery engine. Its commercial benchmark is to turn what someone sells into real opportunities worth contacting, with evidence, the right buyer, confidence, and clear limitations.

## Current active phase: C1-J.0/C1-J.1 Universal Source Adapters and Public Hiring Intelligence

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
        └─ live_search + provider policy
             ├─ free_only → HN + SearXNG/DDG/Startpage ladder; paid blocked
             ├─ balanced → free ladder first; paid fallback only after insufficient coverage
             └─ paid_deep → bounded direct paid search permitted
        → search_results.v2 JSON
        → live_provider_run_telemetry.v1 sidecar
        → provider_policy_trace.v1 sidecar
          ↓
Strict cross-artifact V2 + telemetry + policy-trace validation
          ↓
Deterministic Evidence → identity hypotheses → ranking → Buyer Map
          ↓
SQLite durable stages and versioned artifacts
```

C0.7 through C0.9 established the command-first local browser flow and interaction system. C1-A added typed deterministic Mission Understanding V1 and a source/query plan. C1-0 and C1-0.1 froze the standalone discovery boundary and the separate V1/V2 contracts. C1-B completed the standalone fixture Discovery Engine. C1-C through C1-F implemented Evidence, role-only Identity + Enrichment, transparent Ranking, and the Buyer Map. C1-G connected Cluvvi to the independently executable standalone engine through a safe process/file boundary. C1-H added approved live search. C1-HF added policy-controlled free search. C1-I added an opt-in depth-zero frontier and bounded public HTML extraction path. C1-I.5 added independent structured HTML/document evidence. C1-J.0 now adds universal source-adapter contracts, and C1-J.1 adds bounded public hiring/ATS intelligence through independently validated `source_target_plan.v1`, `job_collection.v1`, `hiring_signals.v1`, and `source_adapter_run_telemetry.v1` companions.

Search-only, extraction-only, and structured-parsing modes remain valid. Source adapters default to `none`; `selected_sources` with the `hiring` family is explicit opt-in. Cluvvi validates and durably persists public hiring artifacts, carries public jobs and cautious hiring signals through Evidence and Buyer Map, preserves exact target/board/job/provider provenance, and caps hiring contribution to ranking at one point. Hiring evidence never proves budget, expansion, replacement hiring, approved projects, purchase intent, buyer identity, or purchasing authority. Candidate/application data, private ATS endpoints, contact enrichment, and outreach remain out of scope.

## Architecture status

Cluvvi currently:

- accepts website and description input;
- compiles deterministic mission understanding and a source/query plan;
- supports `fixture` and `local_discovery_engine` runtime modes, explicit `fixture_only` and `live_search` provider modes, and validated `free_only`, `balanced`, or `paid_deep` policies;
- exports Project A's existing `discovery_request.v1` contract;
- invokes the standalone Discovery Engine CLI through a safe local process boundary;
- passes user content only through JSON files, never executable arguments;
- forwards only an explicit provider-environment allowlist and never logs or persists secret values;
- validates the exact returned `search_results.v2` artifact, request ID, provider categories, coverage, and paid-credit accounting;
- validates and preserves Project A's `live_provider_run_telemetry.v1` and `provider_policy_trace.v1` sidecars for live runs;
- optionally imports independently validated `crawl_frontier.v1`, `extracted_content.v1`, and `extraction_run_telemetry.v1` companion artifacts;
- optionally imports independent `structured_content.v1` and `content_parse_telemetry.v1` artifacts for bounded selected HTML/document resources;
- optionally imports independently validated `source_target_plan.v1`, `job_collection.v1`, `hiring_signals.v1`, and `source_adapter_run_telemetry.v1` artifacts for the public hiring source family;
- rejects private or malformed URLs, raw HTML/bytes, temporary paths, headers, cookies, authorization/environment data, candidate/application/private ATS fields, digest mismatches, orphan references, invalid section graphs/tables, and inconsistent telemetry;
- converts successful or partial page, structured, public-job, and hiring-signal items into deterministic evidence materials with explicit `untrusted_public_content` classification;
- contains all extracted/structured text inside a quoted-data prompt boundary so instructions, role changes, links, macros, formulas, and tool requests remain data rather than commands;
- reuses completed discovery/frontier/extraction work when structured artifacts are corrected and resumed on the same run;
- rejects paid results, attempts, telemetry, fallback flags, or credits under `free_only`;
- requires a deterministic free-coverage decision and reason before paid fallback under `balanced`;
- preserves the original imported artifact plus bridge execution records and logs;
- produces versioned evidence, identity, ranking, Buyer Map, and finalization artifacts;
- preserves provider, query, semantic, URL, warning, and coverage provenance;
- supports timeout, cancellation, structured failure, resume, and idempotent artifact reuse;
- persists and presents the complete workflow through the shared browser, CLI, runner, and SQLite path.

Cluvvi does not yet:

- render JavaScript applications, recurse through sites, traverse comments/threads/transcripts, execute OCR, or access authenticated/private documents;
- collect candidate/application data or access private/login-gated ATS endpoints;
- identify verified real people or infer private contact details;
- prove budget, expansion, replacement hiring, approved projects, or purchase intent from public hiring/search evidence;
- send outreach.

Next:

1. Preserve every C1-G through C1-J compatibility and browser gate before expanding the source-adapter family.
2. Evaluate the narrow public-hiring evidence slice without expanding into recursive crawling, OCR, JavaScript rendering, candidate data, contacts, or outreach.
3. Do not begin contact enrichment or outreach before identity and evidence quality thresholds are proven.

`search_results.v1` remains the earlier frozen basic bridge contract. `search_results.v2`, schema `2.0`, is the expanded universal discovery-run contract. No V1-to-V2 adapter exists; only a future explicit adapter boundary is reserved.

Read `docs/ARCHITECTURE_6_ENGINES.md`, `docs/DISCOVERY_ENGINE_STANDALONE_PLAN.md`, `docs/SEARCH_RESULTS_V1_CONTRACT.md`, `docs/SEARCH_RESULTS_V2_CONTRACT.md`, `docs/C1_PARALLEL_BUILD_PLAN.md`, `docs/C1_I_EXTRACTED_EVIDENCE.md`, `docs/C1_J0_SOURCE_ADAPTER_CONTRACTS.md`, `docs/C1_J1_PUBLIC_HIRING_INTELLIGENCE.md`, `docs/C1_J1_PUBLIC_HIRING_OPERATIONS.md`, and `docs/DISCOVERY_PROVIDER_RESEARCH_TEMPLATE.md` before starting discovery or downstream engine work.

## Start the browser application

Requirements: Node.js 24+ and pnpm 9.15.9. Docker, Supabase, and authentication are not required. Provider keys are not required for fixture or `free_only` execution. `balanced` can run without paid fallback; `paid_deep` or an actual balanced paid fallback requires Project A's ignored secret configuration. Cluvvi never forwards provider keys.

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
$env:CLUVVI_DISCOVERY_EXTRACTION_MODE = "selected_public_pages" # or none
$env:CLUVVI_DISCOVERY_MAX_EXTRACTIONS = "8"
$env:CLUVVI_DISCOVERY_STRUCTURED_CONTENT_MODE = "selected_resources" # or none
$env:CLUVVI_DISCOVERY_SOURCE_ADAPTER_MODE = "selected_sources" # or none
$env:CLUVVI_DISCOVERY_SOURCE_FAMILIES = "hiring"
$env:CLUVVI_DISCOVERY_MAX_HIRING_TARGETS = "10"
$env:CLUVVI_DISCOVERY_MAX_HIRING_BOARDS_PER_TARGET = "3"
$env:CLUVVI_DISCOVERY_MAX_HIRING_JOBS_PER_BOARD = "250"
$env:CLUVVI_DISCOVERY_MAX_HIRING_JOBS_TOTAL = "2000"

# Optional public live-provider/source-adapter limits. Project A loads its ignored root .env.local for keys.
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

CLUVVI_DISCOVERY_EXTRACTION_MODE
  none | selected_public_pages
  default: none
  selected_public_pages requires local_discovery_engine

CLUVVI_DISCOVERY_MAX_EXTRACTIONS
  integer from 1 to 100
  default: 8

CLUVVI_DISCOVERY_STRUCTURED_CONTENT_MODE
  none | selected_resources
  default: none
  selected_resources requires selected_public_pages

CLUVVI_DISCOVERY_SOURCE_ADAPTER_MODE
  none | selected_sources
  default: none

CLUVVI_DISCOVERY_SOURCE_FAMILIES
  comma-separated explicit families
  C1-J.1 supports: hiring

CLUVVI_DISCOVERY_MAX_HIRING_TARGETS
  default: 10

CLUVVI_DISCOVERY_MAX_HIRING_BOARDS_PER_TARGET
  default: 3

CLUVVI_DISCOVERY_MAX_HIRING_JOBS_PER_BOARD
  default: 250

CLUVVI_DISCOVERY_MAX_HIRING_JOBS_TOTAL
  default: 2000
```

For every local-engine execution, Cluvvi creates an isolated run workspace:

```text
<cluvvi-home>/runs/<run-id>/discovery-exchange/
  discovery-request.v1.json
  search-results.v2.json
  search-results.v2.json.provider-executions.v1.json # live_search only
  crawl-frontier.v1.json                             # selected_public_pages only
  extracted-content.v1.json                          # selected_public_pages only
  extraction-run-telemetry.v1.json                   # selected_public_pages only
  structured-content.v1.json                         # selected_resources only
  content-parse-telemetry.v1.json                     # selected_resources only
  source-target-plan.v1.json                          # selected_sources/hiring only
  job-collection.v1.json                              # selected_sources/hiring only
  hiring-signals.v1.json                              # selected_sources/hiring only
  source-adapter-run-telemetry.v1.json                # selected_sources/hiring only
  discovery-stdout.log
  discovery-stderr.log
  discovery-execution.json
  history/
```

The configured command is trusted application configuration. Mission text is written only into `discovery-request.v1.json`; it is never interpolated into a shell command. Fixture mode rejects non-fixture or paid output. Live mode derives provider preference from the validated policy and accepts only approved provider IDs and consistent cost data. Extraction is separately opt-in. The child process receives fixed arguments plus an explicit non-secret provider/extraction allowlist; unrelated parent environment variables and provider keys are not forwarded. Cluvvi preserves exact exchange files but persists only validated normalized artifacts through its ordinary artifact writer.

## Browser workflow

```text
Enter what you sell
→ create one durable SQLite run
→ enqueue one idempotent run request
→ local runner claims it with a lease
→ shared CluvviEngine generates Mission Understanding V1
→ persist mission understanding and source/query plan
→ DiscoveryRuntime returns validated search_results.v2
→ optional frontier → extraction → structured parsing
→ optional source_target_plan.v1 → job_collection.v1 → hiring_signals.v1 → source_adapter_run_telemetry.v1
→ build deterministic snippet/page/structured/public-job/hiring-signal evidence materials
→ produce evidence_findings.v1, identity_enrichment.v1, capped ranked_opportunities.v1, and buyer_map.v1
→ browser polls, refreshes, inspects, fails, and resumes safely
```

The browser exposes:

```text
/
/runs
/runs/<run-id>
/runs/<run-id>/inspect
/operations/discovery
/settings/local
```

The browser distinguishes internal fixtures, local-engine fixtures, live search, opt-in public-page/structured evidence, and opt-in public hiring intelligence. Hiring views show target confidence, board/provider/access category, current public jobs, cautious signals, provider attempts, partial/unavailable outcomes, and telemetry; Buyer Map preserves public-job and hiring-signal provenance. Neither jobs nor hiring signals are presented as verified people, budget, expansion, replacement hiring, approved projects, or purchase intent.

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
pnpm test:browser-free-live-discovery
pnpm test:browser-balanced-live-discovery
pnpm test:browser-extraction
pnpm test:browser-structured-content
pnpm test:browser-hiring
pnpm test:real-hiring-bridge

$env:RUN_EXTRACTION_DISCOVERY_INTEGRATION = "1"
$env:CLUVVI_DISCOVERY_ENGINE_PATH = "C:\Users\Lenovo\Music\Startups\Cluvvi\Separate Discovery engine"
$env:CLUVVI_DISCOVERY_ENGINE_EXPECTED_SHA = "9e86a1506578763419c11262afc107b2db76500f"
pnpm exec vitest run packages/engine/tests/extraction-real-bridge.integration.test.ts
```

The fixture cross-project integration test is opt-in and proves the original C1-G no-network compatibility path. The C1-H live integration test is separately opt-in with `RUN_LIVE_DISCOVERY_INTEGRATION=1`; it proves actual Project A provider execution, exact V2 and telemetry validation, request-ID agreement, provider/category/cost integrity, and complete Evidence → Identity → Ranking → Buyer Map processing.

The real C1-I integration test is separately opt-in and pins the expected Project A commit before proving free-only search, selected public-page extraction, all three companion artifacts, zero paid usage, Evidence consumption, and Buyer Map provenance through the actual child-process boundary.

The C1-J.1 real hiring bridge pins Project A at `19cf88710241b3337df4f7c401728741bffab384`, runs Project A in a separate process, performs a real bounded keyless Greenhouse retrieval, independently validates all four hiring sidecars in Project B, proves zero paid requests, and carries public-job/hiring-signal provenance through Evidence, Identity, the one-point hiring ranking cap, and Buyer Map. The operator-reviewed company/search seed exists only to isolate the public ATS provider boundary; the Greenhouse network retrieval is real.

The maintained browser suites prove fixture regressions, real live desktop/mobile completion, provider telemetry presentation, imported V2 inspection, refresh durability, no mobile overflow, invalid-telemetry failure, preserved exchange evidence, and successful same-run resume. The C1-I suite additionally proves the operations mode view, successful extracted evidence, all three companion artifacts, partial and total page failure, hostile-instruction containment, extraction-only resume with discovery reuse, mobile layout, and secret-free execution provenance. The C1-J suite proves operations desktop/mobile, target planning, provider ladder, Greenhouse/Ashby/Lever/Workable, JSON-LD and generic fallbacks, deduplication, SmartRecruiters auth-missing, partial/all-unavailable outcomes, invalid private-candidate artifact rejection, same-run hiring repair with prior-stage reuse, Buyer Map hiring provenance, and mobile hiring cards. Its runner uses isolated local state and a copied fixture to prevent cross-test leases and Windows process residue. Core and engine tests separately prove contract strictness, configuration allowlisting, request adaptation, process execution, stdout/stderr capture, timeout, cancellation, nonzero exit, missing/invalid artifacts, cross-artifact mismatch rejection, persistence, idempotency, and resume.

Read `AGENTS.md`, `docs/CLUVVI_NEXT_IMPLEMENTATION_MASTER_PLAN.md`, `docs/ARCHITECTURE_6_ENGINES.md`, `docs/DISCOVERY_ENGINE_STANDALONE_PLAN.md`, `docs/SEARCH_RESULTS_V1_CONTRACT.md`, `docs/SEARCH_RESULTS_V2_CONTRACT.md`, `docs/C1_PARALLEL_BUILD_PLAN.md`, `docs/DISCOVERY_PROVIDER_RESEARCH_TEMPLATE.md`, `docs/C1_H_LIVE_DISCOVERY_OPERATIONS.md`, `docs/LIVE_DISCOVERY_OPERATIONS.md`, `docs/C1_I_EXTRACTED_EVIDENCE.md`, `docs/C1_I5_STRUCTURED_DOCUMENT_EVIDENCE.md`, `docs/C1_I5_STRUCTURED_DOCUMENT_EVIDENCE_OPERATIONS.md`, `docs/C1_J0_SOURCE_ADAPTER_CONTRACTS.md`, `docs/C1_J1_PUBLIC_HIRING_INTELLIGENCE.md`, `docs/C1_J1_PUBLIC_HIRING_OPERATIONS.md`, `docs/CLUVVI_LOCAL_CORE_ENGINE_MASTER_SPEC.md`, `docs/CLUVVI_C0_5_LOCAL_BROWSER_APP_SPEC.md`, `docs/ARCHITECTURE.md`, and `docs/FAILURES_AND_LIMITATIONS.md` before changing the active runtime.
