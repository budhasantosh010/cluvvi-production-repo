# C1-H live discovery operations

## Scope

C1-H connects Cluvvi to Project A's approved search-only providers:

- Hacker News Algolia search;
- bounded Hacker News Firebase item enrichment;
- Tavily basic search;
- Brave web search.

It does not fetch or render result pages, crawl websites, deeply extract page bodies, traverse threads, verify identities, enrich contacts, send outreach, run a remote Discovery API, or start C1-I.

## Runtime selection

Fixture remains the default:

```powershell
$env:CLUVVI_DISCOVERY_MODE = "fixture"
$env:CLUVVI_DISCOVERY_PROVIDER_MODE = "fixture_only"
pnpm dev
```

Local Project A fixture execution:

```powershell
$env:CLUVVI_DISCOVERY_MODE = "local_discovery_engine"
$env:CLUVVI_DISCOVERY_PROVIDER_MODE = "fixture_only"
$env:CLUVVI_DISCOVERY_ENGINE_PATH = "C:\absolute\path\to\universal-discovery-engine"
$env:CLUVVI_DISCOVERY_ENGINE_COMMAND = "pnpm"
pnpm dev
```

Live search:

```powershell
$env:CLUVVI_DISCOVERY_MODE = "local_discovery_engine"
$env:CLUVVI_DISCOVERY_PROVIDER_MODE = "live_search"
$env:CLUVVI_DISCOVERY_ENGINE_PATH = "C:\absolute\path\to\universal-discovery-engine"
$env:CLUVVI_DISCOVERY_ENGINE_COMMAND = "pnpm"
$env:CLUVVI_DISCOVERY_ENGINE_TIMEOUT_MS = "90000"
$env:CLUVVI_DISCOVERY_KEEP_EXCHANGE_FILES = "true"

$env:DISCOVERY_BROAD_PROVIDER_STRATEGY = "fanout"
$env:DISCOVERY_LIVE_MAX_QUERIES = "3"
$env:DISCOVERY_MAX_RESULTS_PER_PROVIDER = "3"
$env:DISCOVERY_HN_ALGOLIA_MAX_REQUESTS_PER_RUN = "3"
$env:DISCOVERY_HN_FIREBASE_MAX_ITEMS_PER_RUN = "3"
$env:DISCOVERY_TAVILY_MAX_REQUESTS_PER_RUN = "2"
$env:DISCOVERY_BRAVE_MAX_REQUESTS_PER_RUN = "2"
$env:DISCOVERY_HTTP_TIMEOUT_MS = "20000"
$env:DISCOVERY_HTTP_MAX_ATTEMPTS = "2"
$env:DISCOVERY_HTTP_CONCURRENCY = "2"
$env:DISCOVERY_TAVILY_SEARCH_DEPTH = "basic"
pnpm dev
```

Project A loads Tavily and Brave keys from its ignored root `.env.local`. Cluvvi may override them only through the explicit provider environment allowlist. Do not put keys in commands, committed files, screenshots, logs, or test fixtures.

## Exchange files

Each local-engine run owns:

```text
<cluvvi-home>/runs/<run-id>/discovery-exchange/
  discovery-request.v1.json
  search-results.v2.json
  search-results.v2.json.provider-executions.v1.json  # live only
  discovery-stdout.log
  discovery-stderr.log
  discovery-execution.json
  history/
```

The exact V2 artifact and telemetry sidecar are immutable provider evidence. Cluvvi validates them before any downstream stage. Bridge-local paths and process metadata stay outside the V2 contract.

## Validation

Live execution requires:

- `search_results.v2`, schema `2.0`;
- matching run/request ID;
- approved HN/Tavily/Brave provider IDs only;
- free or paid provider categories only;
- no fixture provider in live mode;
- strict `live_provider_run_telemetry.v1`;
- matching telemetry request ID and `live_search` mode;
- V2 `paidCreditsUsed` equal to telemetry Tavily credits;
- explicit warnings and coverage.

No malformed or incomplete output is repaired silently.

## Failure codes

Important bridge codes include:

```text
DISCOVERY_ENGINE_COMMAND_FAILED
DISCOVERY_ENGINE_TIMEOUT
DISCOVERY_ENGINE_CANCELLED
DISCOVERY_ENGINE_OUTPUT_MISSING
DISCOVERY_ENGINE_OUTPUT_INVALID_JSON
DISCOVERY_ENGINE_SCHEMA_MISMATCH
DISCOVERY_ENGINE_REQUEST_ID_MISMATCH
DISCOVERY_ENGINE_TELEMETRY_MISSING
DISCOVERY_ENGINE_TELEMETRY_INVALID_JSON
DISCOVERY_ENGINE_TELEMETRY_SCHEMA_MISMATCH
DISCOVERY_ENGINE_TELEMETRY_REQUEST_ID_MISMATCH
DISCOVERY_ENGINE_PROVIDER_MODE_MISMATCH
DISCOVERY_ENGINE_UNEXPECTED_PROVIDER
DISCOVERY_ENGINE_USAGE_MISMATCH
DISCOVERY_ENGINE_ARTIFACT_PERSISTENCE_FAILED
```

Failure stops downstream work and preserves the exchange directory. Resume archives the previous attempt, reuses completed durable stages, reruns discovery, validates the replacement output, and continues the same run. Cancellation and timeout terminate the child process tree.

## Partial provider coverage

A provider may fail while another returns valid evidence. Project A must preserve the failed attempt in telemetry and V2 coverage warnings. Cluvvi presents:

- providers attempted;
- failed attempts;
- Tavily credits;
- Brave requests;
- HN requests;
- provider warnings;
- unsearched or unavailable zones.

Partial coverage is not universal web coverage and is not proof of customer intent.

## Verification

Offline:

```powershell
pnpm check
```

Real Project A integration:

```powershell
$env:RUN_LIVE_DISCOVERY_INTEGRATION = "1"
$env:CLUVVI_DISCOVERY_ENGINE_PATH = "C:\absolute\path\to\universal-discovery-engine"
pnpm exec vitest run packages/engine/tests/live-discovery-bridge.integration.test.ts
```

Browser suites require a matching `pnpm dev:local` environment:

```powershell
pnpm test:browser-live-discovery
pnpm test:browser-live-discovery-failure
```

The maintained fixture suites must continue to pass independently.
