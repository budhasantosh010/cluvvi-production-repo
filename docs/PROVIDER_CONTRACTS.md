# Provider and execution contracts

## Active C1-HF search and C1-I extraction boundary

Cluvvi does not call search providers directly. The independently executable Project A Discovery Engine owns provider authentication, HTTP behavior, normalization, routing, retries, rate limits, and provider-specific response validation.

Cluvvi owns the process and contract boundary:

```text
discovery_request.v1
→ trusted Project A CLI
→ search_results.v2
→ live_provider_run_telemetry.v1 when providerMode=live_search
? provider_policy_trace.v1 when providerMode=live_search
? crawl_frontier.v1 when extractionMode=selected_public_pages
? extracted_content.v1 when extractionMode=selected_public_pages
? extraction_run_telemetry.v1 when extractionMode=selected_public_pages
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
- Cluvvi forwards only the documented provider and public-extraction environment allowlist.
- API keys and authorization values must never appear in fingerprints, execution records, logs, artifacts, browser responses, screenshots, or Git.
- Project A may load its own ignored root `.env.local`; explicit allowlisted environment values may override it.

## Failure and resume

Provider failures remain visible in Project A telemetry and V2 coverage warnings. Cluvvi may continue with an honest partial result only when the complete artifact and telemetry contracts validate. All-provider failure, invalid output, invalid telemetry, request mismatch, provider mismatch, or usage mismatch fails the discovery stage.

Failed exchange files are preserved. Provider/search failure resumes by rerunning discovery. Extraction-sidecar validation failure reuses the completed discovery stage, rereads or repairs the companion files, and reruns only frontier/extraction and downstream stages. Cancellation and timeout terminate the standalone process tree.

## Search and extraction separation

Search-only execution retrieves snippets and public result metadata without fetching result pages. C1-I adds a separate opt-in `selected_public_pages` path. Project A owns bounded safe public fetching and normalized HTML extraction; Project B owns independent companion-artifact validation, durable persistence, untrusted evidence materials, and downstream provenance.

C1-I remains depth zero. It does not render JavaScript, recurse through sites, traverse threads/transcripts, extract documents, verify identities, enrich contacts, or send outreach.

## Queue semantics

- Database transaction creates state and request atomically.
- Runner leases a request with a visibility timeout.
- Handler validates schema and current state.
- Successful result and audit event are persisted idempotently.
- Request acknowledgement happens last.
- Transient failure remains retryable.
- Permanent malformed input is recorded without an infinite retry loop.
