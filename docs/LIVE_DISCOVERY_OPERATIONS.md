# Live Discovery Operations

C1-HF extends the C1-H search-only bridge with an explicit provider policy. It does not add crawling or extraction.

## Runtime and policy

Cluvvi uses one validated configuration source:

```text
CLUVVI_DISCOVERY_MODE=local_discovery_engine
CLUVVI_DISCOVERY_PROVIDER_MODE=live_search
CLUVVI_DISCOVERY_PROVIDER_POLICY=free_only | balanced | paid_deep
```

The policy is persisted on the run, included in the configuration fingerprint, passed to Project A as one shell-free argument pair, and recorded in `local_discovery_execution.v1`.

### `free_only`

- HN and free broad-search providers may run.
- Tavily and Brave are blocked before their HTTP clients can execute.
- Paid provider results, telemetry, fallback flags, requests, or credits cause `FREE_ONLY_POLICY_VIOLATION`.
- No provider key is forwarded by Cluvvi.

### `balanced`

- Free providers run first.
- Paid fallback is permitted only after a deterministic free-coverage decision fails.
- The policy trace must preserve the provider order and an actual reason, such as too few accepted results, too few unique domains, duplicate ratio too high, relevant-result ratio too low, or free providers unavailable.
- A paid provider before the free ladder, or fallback without a reason, is rejected.

### `paid_deep`

- Approved paid providers may execute directly within configured request and credit budgets.
- Request ID, provider mode, policy, provider IDs, usage, and result/telemetry consistency remain mandatory.

## Free provider ladder

The normal broad-search ladder is:

```text
SearXNG → DuckDuckGo HTML → Startpage HTML
```

SearXNG is optional. An absent `DISCOVERY_SEARXNG_URL` is `unconfigured`, not an installation request and not a success.

DuckDuckGo and Startpage are best-effort HTML search providers. Challenge pages, consent pages, unusual content types, oversized responses, and parser drift are explicit safe failures. Cluvvi and Project A do not bypass provider challenges.

HN Algolia and bounded HN Firebase enrichment remain separate free community/developer sources.

## Required live artifacts

Every successful live bridge run must produce and preserve:

```text
discovery-request.v1.json
search-results.v2.json
search-results.v2.json.provider-executions.v1.json
search-results.v2.json.provider-policy-trace.v1.json
discovery-execution.json
discovery-stdout.log
discovery-stderr.log
history/
```

The filename suffixes match Project A's existing output convention. The logical artifact kinds are:

- `search_results.v2`
- `live_provider_run_telemetry.v1`
- `provider_policy_trace.v1`
- `local_discovery_execution.v1`

Writes are atomic, each run has an isolated directory, retry archives preserve prior evidence, and Cluvvi never repairs a malformed artifact silently.

## Cross-artifact validation

Cluvvi independently validates all three imported artifacts and their relationship:

- artifact and schema versions;
- request ID;
- provider mode and policy;
- recognized provider IDs and categories;
- policy execution order;
- coverage decision and fallback reason;
- result, telemetry, request, and credit usage agreement;
- zero paid execution under `free_only`.

Structured failures:

```text
PROVIDER_POLICY_TRACE_MISSING
PROVIDER_POLICY_TRACE_INVALID
PROVIDER_POLICY_TRACE_MISMATCH
FREE_ONLY_POLICY_VIOLATION
DISCOVERY_ENGINE_USAGE_MISMATCH
```

Failure preserves safe paths, process exit state, timeout/cancellation state, policy, request ID, and redacted diagnostics. It never persists API keys, authorization headers, the full child environment, provider secrets, or raw HTML.

## Operator commands

Default fixture execution:

```powershell
pnpm dev
```

Local free-only example:

```powershell
$env:CLUVVI_DISCOVERY_MODE = "local_discovery_engine"
$env:CLUVVI_DISCOVERY_PROVIDER_MODE = "live_search"
$env:CLUVVI_DISCOVERY_PROVIDER_POLICY = "free_only"
$env:CLUVVI_DISCOVERY_ENGINE_PATH = "C:\absolute\path\to\Separate Discovery engine"
pnpm dev
```

Focused verification:

```powershell
pnpm test -- packages/engine/tests/provider-policy-bridge.test.ts
pnpm test -- packages/engine/tests/provider-policy-resume.test.ts
$env:RUN_FREE_DISCOVERY_INTEGRATION = "1"
pnpm test -- packages/engine/tests/free-discovery-bridge.integration.test.ts
pnpm test:browser-free-live-discovery
pnpm test:browser-balanced-live-discovery
```

## Truthful product boundary

Live results are search snippets and public result metadata only. Full pages are not extracted. Coverage may be incomplete. Identity routes are hypotheses, contacts are not verified, and Buyer Map scores do not prove purchase intent.

C1-I is the next separate milestone. It may add safe public fetching, metadata/body/JSON-LD extraction, frontier scoring, selected-page drilling, prompt-injection containment, document/PDF extraction, thread/transcript interfaces, and optional Crawl4AI. None of that is part of C1-HF.
