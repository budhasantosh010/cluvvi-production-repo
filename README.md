# Cluvvi

Cluvvi is an evidence-backed buyer-discovery engine. Its commercial benchmark is to turn what someone sells into real opportunities worth contacting, with evidence, the right buyer, confidence, and clear limitations.

## Current active phase: C1-J.5 Universal Specialized Source Intelligence

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

C0.7 through C0.9 established the command-first local browser flow and interaction system. C1-A added typed deterministic Mission Understanding V1 and a source/query plan. C1-0 and C1-0.1 froze the standalone discovery boundary and the separate V1/V2 contracts. C1-B completed the standalone fixture Discovery Engine. C1-C through C1-F implemented Evidence, role-only Identity + Enrichment, transparent Ranking, and the Buyer Map. C1-G connected Cluvvi to the independently executable standalone engine through a safe process/file boundary. C1-H added approved live search. C1-HF added policy-controlled free search. C1-I added an opt-in depth-zero frontier and bounded public HTML extraction path. C1-I.5 added independent structured HTML/document evidence. C1-J.0 added universal source-adapter contracts; C1-J.1 added bounded public hiring/ATS intelligence; C1-J.2 added bounded keyless public Reddit community intelligence; C1-J.3 added bounded public GitHub developer intelligence; C1-J.4 adds bounded public YouTube metadata/transcript/comment intelligence; and C1-J.5 adds the extensible top-level `specialized` family with data-only source packs/registry, coverage-gap discovery, generic public routes, and allowlisted dedicated adapters. Tech/AI is Pack #1, not a separate top-level research family.

Search-only, extraction-only, and structured-parsing modes remain valid. Source adapters default to `none`; `selected_sources` can explicitly select any combination of `hiring`, `community`, `developer`, `video`, and `specialized`. Cluvvi independently validates and durably persists each source family, carries it through Evidence and Buyer Map with source-specific provenance, keeps source authors/usernames/creators/publishers out of buyer/contact identity, and gives each family its own bounded ranking contribution. Public source evidence never proves representative demand, budget, expansion, replacement hiring, approved projects, purchase intent, buyer identity, contact identity, or purchasing authority. Candidate/application data, private/login-gated sources, contact enrichment, monitoring, outreach, and the later cross-source fusion milestone remain out of scope.

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
- optionally imports the independently validated C1-J.2 Reddit plan/thread/comment/context/signal/telemetry companion family and manifest-referenced thread/comment files;
- optionally imports the independently validated C1-J.3 GitHub developer plan/repository/thread/comment/signal/telemetry companion family and manifest-referenced universal thread/comment files;
- optionally imports C1-J.4 `video_source_plan.v1`, `video_collection.v1`, frozen `transcript.v1` companions, video comment companions, `video_signals.v1`, and video telemetry while treating restricted/private/premium/age-restricted items as metadata-only and never drilling them;
- optionally imports C1-J.5 specialized context/candidates/plan/findings/signals/telemetry with signal-specific coverage, data-only registry provenance, generic dynamic routes, and fixed allowlisted dedicated adapters;
- rejects private or malformed URLs, raw HTML/bytes, temporary paths, headers, cookies, authorization/environment data, candidate/application/private ATS fields, private GitHub fields, secret/token/contact-shaped developer fields, executable/path/script-shaped specialized fields, digest mismatches, orphan references, invalid section graphs/tables, and inconsistent telemetry;
- converts successful or partial page, structured, public-job, Reddit, GitHub developer, YouTube, and specialized items into deterministic evidence materials with explicit `untrusted_public_content` classification;
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

- render JavaScript applications, recursively crawl sites, execute OCR, or access authenticated/private documents, communities, or repositories;
- perform unbounded comment/thread traversal beyond the explicit bounded Reddit, GitHub, and YouTube text adapters;
- collect candidate/application data or access private/login-gated ATS/community/repository/video sources;
- clone repositories, download source/diffs/patches/release assets, download YouTube media, execute workflows, or perform GitHub mutations;
- install optional specialist tooling at runtime, accept arbitrary executable adapters/scripts/binaries, or expose the local specialized registry overlay path through Project B;
- identify verified real people or infer private contact details;
- prove representative demand, budget, expansion, replacement hiring, approved projects, authority, or purchase intent from public source evidence;
- monitor sources, send outreach, or start the later cross-source fusion milestone.

Next:

1. Preserve every C1-G through C1-J.5 compatibility, source-boundary, and browser gate before later work.
2. Evaluate the bounded hiring, Reddit, GitHub, YouTube, and specialized evidence slices without expanding into recursive crawling, OCR, JavaScript rendering, private data, contacts, monitoring, or outreach.
3. Do not begin contact enrichment, outreach, monitoring, or later fusion work before the current evidence/identity quality thresholds are proven.

`search_results.v1` remains the earlier frozen basic bridge contract. `search_results.v2`, schema `2.0`, is the expanded universal discovery-run contract. No V1-to-V2 adapter exists; only a future explicit adapter boundary is reserved.

Read `docs/ARCHITECTURE_6_ENGINES.md`, `docs/DISCOVERY_ENGINE_STANDALONE_PLAN.md`, `docs/SEARCH_RESULTS_V1_CONTRACT.md`, `docs/SEARCH_RESULTS_V2_CONTRACT.md`, `docs/C1_PARALLEL_BUILD_PLAN.md`, `docs/C1_I_EXTRACTED_EVIDENCE.md`, `docs/C1_J0_SOURCE_ADAPTER_CONTRACTS.md`, `docs/C1_J1_PUBLIC_HIRING_INTELLIGENCE.md`, `docs/C1_J1_PUBLIC_HIRING_OPERATIONS.md`, `docs/C1_J2_REDDIT_COMMUNITY_INTELLIGENCE.md`, `docs/C1_J3_GITHUB_DEVELOPER_INTELLIGENCE.md`, and `docs/DISCOVERY_PROVIDER_RESEARCH_TEMPLATE.md` before starting discovery or downstream engine work.

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
$env:CLUVVI_DISCOVERY_SOURCE_FAMILIES = "hiring,community,developer"
$env:CLUVVI_DISCOVERY_MAX_HIRING_TARGETS = "10"
$env:CLUVVI_DISCOVERY_MAX_HIRING_BOARDS_PER_TARGET = "3"
$env:CLUVVI_DISCOVERY_MAX_HIRING_JOBS_PER_BOARD = "250"
$env:CLUVVI_DISCOVERY_MAX_HIRING_JOBS_TOTAL = "2000"
$env:CLUVVI_DISCOVERY_REDDIT_DEPTH = "quick"
$env:CLUVVI_DISCOVERY_MAX_REDDIT_QUERIES = "2"
$env:CLUVVI_DISCOVERY_MAX_REDDIT_SUBREDDITS = "4"
$env:CLUVVI_DISCOVERY_MAX_REDDIT_THREADS = "20"
$env:CLUVVI_DISCOVERY_MAX_REDDIT_THREAD_DRILL = "3"
$env:CLUVVI_DISCOVERY_GITHUB_DEPTH = "default"
$env:CLUVVI_DISCOVERY_MAX_GITHUB_QUERIES = "4"
$env:CLUVVI_DISCOVERY_MAX_GITHUB_REPOSITORIES = "8"
$env:CLUVVI_DISCOVERY_MAX_GITHUB_THREAD_DRILL = "5"

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
  implemented: hiring, community, developer

CLUVVI_DISCOVERY_MAX_HIRING_TARGETS
  default: 10

CLUVVI_DISCOVERY_MAX_HIRING_BOARDS_PER_TARGET
  default: 3

CLUVVI_DISCOVERY_MAX_HIRING_JOBS_PER_BOARD
  default: 250

CLUVVI_DISCOVERY_MAX_HIRING_JOBS_TOTAL
  default: 2000

CLUVVI_DISCOVERY_REDDIT_DEPTH
  quick | default | deep
  default: default

CLUVVI_DISCOVERY_MAX_REDDIT_QUERIES / SUBREDDITS / THREADS / THREAD_DRILL
  bounded C1-J.2 public Reddit budgets

CLUVVI_DISCOVERY_GITHUB_DEPTH
  quick | default | deep
  default: default

CLUVVI_DISCOVERY_MAX_GITHUB_QUERIES
  default: 4

CLUVVI_DISCOVERY_MAX_GITHUB_REPOSITORIES
  default: 8

CLUVVI_DISCOVERY_MAX_GITHUB_THREAD_DRILL
  default: 5
```

Project B never accepts or forwards `DISCOVERY_GITHUB_TOKEN`; optional authenticated-free GitHub access remains Project A-owned and public-only.

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
  community-source-plan.v1.json                       # selected_sources/community only
  thread-manifest.v1.json                             # selected_sources/community only
  community-thread-context.v1.json                    # selected_sources/community only
  comment-collection-manifest.v1.json                 # selected_sources/community only
  community-comment-context.v1.json                   # selected_sources/community only
  community-signals.v1.json                           # selected_sources/community only
  community-source-run-telemetry.v1.json              # selected_sources/community only
  developer-source-plan.v1.json                       # selected_sources/developer only
  developer-repository-collection.v1.json             # selected_sources/developer only
  developer-thread-manifest.v1.json                   # selected_sources/developer only
  developer-thread-metadata.v1.json                   # selected_sources/developer only
  developer-comment-collection-manifest.v1.json       # selected_sources/developer only
  developer-comment-metadata.v1.json                  # selected_sources/developer only
  developer-signals.v1.json                           # selected_sources/developer only
  developer-source-run-telemetry.v1.json              # selected_sources/developer only
  developer/threads/*.thread.v1.json                  # manifest-referenced public GitHub threads
  developer/comments/*.comment_collection.v1.json    # manifest-referenced public GitHub comments
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
→ optional Reddit community plan/thread/comment/context/signal/telemetry companions
→ optional GitHub developer plan/repository/thread/comment/signal/telemetry companions
→ build deterministic snippet/page/structured/public-job/community/developer evidence materials
→ produce evidence_findings.v1, role-only identity_enrichment.v1, separately capped ranked_opportunities.v1, and buyer_map.v1
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

The browser distinguishes internal fixtures, local-engine fixtures, live search, opt-in public-page/structured evidence, public hiring intelligence, keyless Reddit community intelligence, and public GitHub developer intelligence. Hiring views show target confidence, board/provider/access category, current public jobs, cautious signals, provider attempts, partial/unavailable outcomes, and telemetry. Community views show bounded threads/comments/signals and engagement provenance. Developer views show public repositories, issue/PR context, selected comments/releases, rate-limit state, signal independence, identity boundaries, and zero-paid telemetry. Buyer Map preserves each source family's provenance and separate capped contribution; none of these public-source lanes is presented as verified buyer identity, representative demand, budget, authority, or purchase intent.

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
pnpm test:browser-community
pnpm test:browser-developer
pnpm test:browser-video-specialized
pnpm test:real-hiring-bridge
pnpm test:real-community-bridge
pnpm test:real-developer-bridge

$env:RUN_VIDEO_SPECIALIZED_DISCOVERY_INTEGRATION = "1"
$env:CLUVVI_DISCOVERY_ENGINE_PATH = "C:\\Users\\Lenovo\\Music\\Startups\\Cluvvi\\Separate Discovery engine"
pnpm exec vitest run packages/engine/tests/video-specialized-real-bridge.integration.test.ts

$env:RUN_EXTRACTION_DISCOVERY_INTEGRATION = "1"
$env:CLUVVI_DISCOVERY_ENGINE_PATH = "C:\Users\Lenovo\Music\Startups\Cluvvi\Separate Discovery engine"
$env:CLUVVI_DISCOVERY_ENGINE_EXPECTED_SHA = "9e86a1506578763419c11262afc107b2db76500f"
pnpm exec vitest run packages/engine/tests/extraction-real-bridge.integration.test.ts
```

The fixture cross-project integration test is opt-in and proves the original C1-G no-network compatibility path. The C1-H live integration test is separately opt-in with `RUN_LIVE_DISCOVERY_INTEGRATION=1`; it proves actual Project A provider execution, exact V2 and telemetry validation, request-ID agreement, provider/category/cost integrity, and complete Evidence → Identity → Ranking → Buyer Map processing.

The real C1-I integration test is separately opt-in and pins the expected Project A commit before proving free-only search, selected public-page extraction, all three companion artifacts, zero paid usage, Evidence consumption, and Buyer Map provenance through the actual child-process boundary.

The C1-J.1 real hiring bridge pins Project A at `19cf88710241b3337df4f7c401728741bffab384`, runs Project A in a separate process, performs a real bounded keyless Greenhouse retrieval, independently validates all four hiring sidecars in Project B, proves zero paid requests, and carries public-job/hiring-signal provenance through Evidence, Identity, the one-point hiring ranking cap, and Buyer Map. The C1-J.2 real community bridge pins Project A at `db13a6cf568b307fa76782306179060b2df23d7c` and proves bounded public Reddit evidence with zero paid/authenticated usage. The C1-J.3 real developer bridge pins Project A at `b9002bff2f56ac20c8db696b3137bda336437b8b` and proves bounded anonymous public GitHub evidence with zero paid usage. C1-J.4/J.5 pin Project A at `298446dcfa53b2c8c517c28e9d56a0816ed12480`; the release proof performs real public YouTube retrieval plus Tech/AI specialized retrieval and a separate non-tech UK HR/compliance coverage-gap run through free-only provider routing. Both C1-J.4/J.5 live proofs pass with zero paid requests/credits, no media download, no cookie/login/proxy bypass, and no Project B forwarding of the specialized registry overlay path. Operator-reviewed seeds remain limited to older source-family proofs that explicitly document them.

The maintained browser suites prove fixture regressions, real live desktop/mobile completion, provider telemetry presentation, imported V2 inspection, refresh durability, no mobile overflow, invalid-artifact failure, preserved exchange evidence, and successful same-run resume. C1-J.1 covers bounded public ATS providers and hiring provenance. C1-J.2 covers keyless Reddit threads/comments/signals, unknown/stale engagement semantics, challenge degradation, same-run repair, and the separate community cap. C1-J.3 covers public repositories, issue/PR context, selected comments/releases, rate-limit degradation, exact durable developer stages, same-run repair/reuse, developer identity isolation, Buyer Map GitHub provenance, and the separate +1 developer cap. C1-J.4/J.5 add dedicated production-browser coverage for video and specialized operations cards, transcript/comment/signal presentation, context/coverage/dynamic-source presentation, separate ranking caps, Buyer Map counts, desktop and 390px mobile layouts, and zero horizontal overflow. Core and engine tests separately prove contract strictness, configuration allowlisting, request adaptation, process execution, stdout/stderr capture, timeout, cancellation, nonzero exit, missing/invalid artifacts, cross-artifact mismatch rejection, private/secret/path-field rejection, persistence, idempotency, and resume.

Read `AGENTS.md`, `docs/CLUVVI_NEXT_IMPLEMENTATION_MASTER_PLAN.md`, `docs/ARCHITECTURE_6_ENGINES.md`, `docs/DISCOVERY_ENGINE_STANDALONE_PLAN.md`, `docs/SEARCH_RESULTS_V1_CONTRACT.md`, `docs/SEARCH_RESULTS_V2_CONTRACT.md`, `docs/C1_PARALLEL_BUILD_PLAN.md`, `docs/DISCOVERY_PROVIDER_RESEARCH_TEMPLATE.md`, `docs/C1_H_LIVE_DISCOVERY_OPERATIONS.md`, `docs/LIVE_DISCOVERY_OPERATIONS.md`, `docs/C1_I_EXTRACTED_EVIDENCE.md`, `docs/C1_I5_STRUCTURED_DOCUMENT_EVIDENCE.md`, `docs/C1_I5_STRUCTURED_DOCUMENT_EVIDENCE_OPERATIONS.md`, `docs/C1_J0_SOURCE_ADAPTER_CONTRACTS.md`, `docs/C1_J1_PUBLIC_HIRING_INTELLIGENCE.md`, `docs/C1_J1_PUBLIC_HIRING_OPERATIONS.md`, `docs/C1_J2_REDDIT_COMMUNITY_INTELLIGENCE.md`, `docs/C1_J3_GITHUB_DEVELOPER_INTELLIGENCE.md`, `docs/C1_J4_YOUTUBE_VIDEO_INTELLIGENCE.md`, `docs/C1_J5_UNIVERSAL_SPECIALIZED_SOURCE_INTELLIGENCE.md`, `docs/CLUVVI_LOCAL_CORE_ENGINE_MASTER_SPEC.md`, `docs/CLUVVI_C0_5_LOCAL_BROWSER_APP_SPEC.md`, `docs/ARCHITECTURE.md`, and `docs/FAILURES_AND_LIMITATIONS.md` before changing the active runtime.
