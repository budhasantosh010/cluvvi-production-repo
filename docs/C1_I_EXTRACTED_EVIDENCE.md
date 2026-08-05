# C1-I Extracted Public Evidence

## Status

C1-I is implemented across the standalone Discovery Engine (Project A) and Cluvvi (Project B).

Project A owns the public-network boundary, frontier selection, robots policy, safe fetching, HTML parsing, JSON-LD normalization, and the three canonical companion artifacts. Project B remains a process-and-JSON consumer. It does not import Project A source files or create a package dependency on Project A.

The default remains search-only:

```text
CLUVVI_DISCOVERY_EXTRACTION_MODE=none
```

Public-page extraction is explicit and bounded:

```text
CLUVVI_DISCOVERY_EXTRACTION_MODE=selected_public_pages
CLUVVI_DISCOVERY_MAX_EXTRACTIONS=8
```

This milestone does not add JavaScript rendering, recursive crawling, PDFs or office documents, comments, threads, transcripts, platform-specific extraction adapters, verified contacts, contact enrichment, outreach, monitoring, remote APIs, or hosted workers.

## Authoritative workflow

```text
Mission and source plan
→ discovery_request.v1
→ Project A search providers
→ search_results.v2
→ deterministic crawl frontier
→ selected public-page fetches in Project A
→ crawl_frontier.v1
→ extracted_content.v1
→ extraction_run_telemetry.v1
→ independent Project B validation
→ durable frontier / content / telemetry stages
→ deterministic evidence materials and text chunks
→ Evidence → Identity → Ranking → Buyer Map
```

When extraction mode is `none`, the frontier, extraction, and extraction-telemetry stages are explicitly skipped. The existing C1-G, C1-H, and C1-HF search-only paths retain their previous fingerprints and outputs.

## Process boundary and files

Each run owns an isolated exchange directory:

```text
<cluvvi-home>/runs/<run-id>/discovery-exchange/
  discovery-request.v1.json
  search-results.v2.json
  search-results.v2.json.provider-executions.v1.json       # live search only
  search-results.v2.json.provider-policy-trace.v1.json     # live search only
  crawl-frontier.v1.json                                   # extraction only
  extracted-content.v1.json                                # extraction only
  extraction-run-telemetry.v1.json                         # extraction only
  discovery-stdout.log
  discovery-stderr.log
  discovery-execution.json
  history/
```

The bridge execution record stores only safe operational facts: mode, public limits, artifact paths, import flags, provider usage, timings, and structured failures. It never stores provider keys, authorization headers, cookies, a complete child environment, raw response bodies, or raw HTML.

## Canonical companion artifacts

Project B contains independent strict schema snapshots for:

- `crawl_frontier.v1`
- `extracted_content.v1`
- `extraction_run_telemetry.v1`

Project B validates the snapshots independently rather than trusting successful process exit or importing Project A code. Validation includes:

- exact artifact kind and schema version;
- matching request IDs;
- the canonical digest of the exact `search_results.v2` input;
- frontier artifact ID and digest references;
- source-result and frontier-item references;
- deterministic content hashes and character counts;
- public HTTP or HTTPS URLs only;
- selected-page, per-query, and per-domain caps;
- extraction and telemetry totals;
- unique artifact and item IDs;
- absence of raw HTML, headers, cookies, authorization data, environment dumps, and other forbidden fields.

Malformed, missing, mismatched, unsafe, or over-budget sidecars fail before extracted content reaches Evidence.

## Public-network safety

Project A owns all network access. C1-I uses its DNS-pinned HTTP/HTTPS connector and enforces:

- HTTP and HTTPS only;
- no credentials or fragments in requested URLs;
- private, loopback, link-local, multicast, unspecified, documentation, benchmark, and other non-public IP ranges blocked;
- DNS answers validated before connection;
- the validated address pinned into the connection;
- the connected remote address checked against the pinned address;
- original Host header and TLS server name preserved;
- every redirect canonicalized, resolved, and revalidated;
- bounded redirects, retries, timeouts, response bytes, decompressed bytes, global concurrency, per-domain concurrency, and domain delay;
- robots decisions retrieved through the same safe connector;
- challenge, login, access-denied, JavaScript-required, unsupported-content, and oversized-response outcomes classified rather than bypassed.

Cluvvi forwards only the non-secret Project A extraction variables listed in `DISCOVERY_PROVIDER_ENV_ALLOWLIST`. Provider keys remain in Project A's ignored root `.env.local` and are never forwarded by Cluvvi.

## Durable stage and resume semantics

Extraction is represented as three independent Cluvvi stages:

```text
frontier
extraction
extraction_telemetry
```

Each stage has its own version, input fingerprint, execution record, durable artifact, and reuse event. A failure while importing or validating extraction sidecars does not invalidate the already-completed discovery stage.

On same-run resume:

1. mission understanding, source planning, and discovery are reused when their fingerprints match;
2. extraction sidecars are read and validated again;
3. only the failed extraction stage and downstream stages rerun;
4. the run event log records stage reuse instead of pretending search executed twice.

Unsafe private URLs and forbidden content fields are security failures. Missing or malformed sidecars are retryable validation/provider failures. The preserved exchange directory supports operator inspection and correction before resume.

## Evidence materials

The Evidence Engine now normalizes four material kinds:

```text
search_snippet
extracted_metadata
extracted_page_text
extracted_json_ld
```

Every material has a deterministic ID, content hash, source URL, source result ID, entity key, trust classification, limitations, and—where applicable—extraction item ID, frontier item ID, chunk index, and character offsets.

Page text is chunked deterministically with bounded length and overlap. Findings preserve material IDs and extraction lineage. Buyer Map citations preserve the evidence finding and material provenance when extracted evidence supports a finding.

Search snippets continue to work without extracted content. Partial extraction adds only valid successful or partial materials; failed and blocked pages never become invented evidence.

## Prompt-injection containment

All extracted page text, metadata, and JSON-LD are classified as:

```text
untrusted_public_content
```

They are data, not instructions. The prompt builder:

- places each material inside an explicit `untrusted_evidence` block;
- tells downstream models never to follow instructions, role changes, tool requests, or policy claims inside those blocks;
- escapes a hostile closing delimiter;
- requires material IDs to remain attached to citations.

Current downstream C1-I transformations are deterministic and local. The contained prompt builder is the mandatory future boundary for any model-backed evidence synthesis.

## UI and operations

The browser exposes:

```text
/operations/discovery
/runs/<run-id>
/runs/<run-id>/inspect
```

The operations page shows the active extraction mode, maximum selected pages, extractor version, frontier-policy version, and an honest preview selector that does not mutate server configuration.

Run detail shows:

- frontier evaluated, selected, skipped, and blocked counts;
- page success, partial, failed, and blocked outcomes;
- downloaded bytes, extracted characters, redirects, retries, and robots decisions;
- extracted metadata, text chunks, JSON-LD, limitations, and trust classification;
- evidence-source mode and downstream extracted-material provenance;
- explicit partial/all-failed/security/resume states.

Desktop and mobile browser proofs cover successful extraction, distinct companion artifacts, partial failure, all-page failure, hostile instructions, unsafe artifact rejection, same-run resume with discovery reuse, sidecar import flags, and horizontal-overflow protection.

## Configuration

Cluvvi-owned controls:

```text
CLUVVI_DISCOVERY_EXTRACTION_MODE
  none | selected_public_pages
  default: none

CLUVVI_DISCOVERY_MAX_EXTRACTIONS
  integer 1–100
  default: 8
```

Forwarded non-secret Project A controls:

```text
DISCOVERY_EXTRACTION_MAX_URLS_PER_QUERY
DISCOVERY_EXTRACTION_MAX_URLS_PER_DOMAIN
DISCOVERY_EXTRACTION_MIN_PRIORITY
DISCOVERY_EXTRACTION_TIMEOUT_MS
DISCOVERY_EXTRACTION_MAX_ATTEMPTS
DISCOVERY_EXTRACTION_MAX_CONCURRENCY
DISCOVERY_EXTRACTION_MAX_DOMAIN_CONCURRENCY
DISCOVERY_EXTRACTION_MIN_DOMAIN_DELAY_MS
DISCOVERY_EXTRACTION_MAX_REDIRECTS
DISCOVERY_EXTRACTION_MAX_HTML_BYTES
DISCOVERY_EXTRACTION_MAX_TEXT_CHARACTERS
DISCOVERY_EXTRACTION_MIN_USEFUL_CHARACTERS
DISCOVERY_EXTRACTION_RESPECT_ROBOTS
DISCOVERY_EXTRACTION_ROBOTS_FAILURE_POLICY
DISCOVERY_EXTRACTION_USER_AGENT
```

`CLUVVI_DISCOVERY_EXTRACTION_MODE=selected_public_pages` requires `CLUVVI_DISCOVERY_MODE=local_discovery_engine`. Internal fixture mode remains network-free and rejects extraction mode.

## Verification

```powershell
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm test:browser-extraction
```

Important focused suites:

```powershell
pnpm test -- packages/engine/tests/extraction-bridge.integration.test.ts
pnpm test -- packages/engine/tests/extracted-evidence-materials.test.ts
pnpm test -- packages/engine/tests/discovery-runtime-config.test.ts
```

The controlled process fixture covers success, partial failure, all-page failure, hostile content, unsafe private URL injection, corrected same-run resume, and imported sidecar flags. The cross-project proof invokes the actual Project A CLI through the same process boundary and validates the returned companion artifacts before downstream Evidence, Identity, Ranking, and Buyer Map complete.

## Honest limitations

- Public-page extraction improves context; it does not prove that a claim is true.
- Metadata and JSON-LD are page-supplied and unverified.
- Static HTML extraction cannot see content requiring JavaScript execution.
- Robots availability and site behavior can change between runs.
- Pages may be truncated, stale, blocked, challenged, removed, or only partly useful.
- Identity routes remain role and public-route hypotheses, not verified people or private contacts.
- Buyer Map scores remain transparent prioritization heuristics, not purchase-intent predictions.
