# Provider and execution contracts

## Active C1-H provider boundary

Cluvvi does not call search providers directly. The independently executable Project A Discovery Engine owns provider authentication, HTTP behavior, normalization, routing, retries, rate limits, and provider-specific response validation.

Cluvvi owns the process and contract boundary:

```text
discovery_request.v1
→ trusted Project A CLI
→ search_results.v2
→ live_provider_run_telemetry.v1 when providerMode=live_search
```

Supported provider modes:

- `fixture_only`: deterministic compatibility data, fixture provider categories only, zero paid credits;
- `live_search`: approved Hacker News Algolia/Firebase, Tavily basic search, and Brave web search only.

## Live telemetry requirements

The live sidecar is strict and must contain:

- request ID and provider mode;
- a secret-free public configuration fingerprint;
- per-operation provider ID, query ID, source zone, method, timing, attempts, status, accepted result count, rate-limit status, success, usage, and safe error details;
- per-provider request budgets;
- aggregate Tavily, Brave, HN Algolia, and HN Firebase usage;
- explicit warnings.

Cluvvi rejects missing, malformed, schema-incompatible, wrong-request, wrong-mode, unsupported-provider, or cost-inconsistent telemetry. Artifact `paidCreditsUsed` must equal API-reported Tavily credits. Brave request counts remain request telemetry and are not reinterpreted as Tavily credits.

## Secret and process rules

- Project paths and executable names are trusted application configuration.
- User mission content is written only to JSON files.
- Shell interpolation is disabled.
- Child arguments are fixed.
- Cluvvi forwards only the documented provider environment allowlist.
- API keys and authorization values must never appear in fingerprints, execution records, logs, artifacts, browser responses, screenshots, or Git.
- Project A may load its own ignored root `.env.local`; explicit allowlisted environment values may override it.

## Failure and resume

Provider failures remain visible in Project A telemetry and V2 coverage warnings. Cluvvi may continue with an honest partial result only when the complete artifact and telemetry contracts validate. All-provider failure, invalid output, invalid telemetry, request mismatch, provider mismatch, or usage mismatch fails the discovery stage.

Failed exchange files are preserved. Resume archives the previous exchange, reuses completed durable stages, reruns discovery, validates the new output, and continues through downstream stages. Cancellation and timeout terminate the standalone process tree.

## Search-only limitation

C1-H retrieves search snippets and public result metadata. It does not fetch result pages, crawl sites, render browsers, traverse threads, extract page bodies, verify identities, enrich contacts, or send outreach. Those behaviors require separate C1-I or later approval.

## Queue semantics

- Database transaction creates state and request atomically.
- Runner leases a request with a visibility timeout.
- Handler validates schema and current state.
- Successful result and audit event are persisted idempotently.
- Request acknowledgement happens last.
- Transient failure remains retryable.
- Permanent malformed input is recorded without an infinite retry loop.
