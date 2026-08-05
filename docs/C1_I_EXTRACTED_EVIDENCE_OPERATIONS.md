# C1-I Extracted Public-Page Evidence Operations

## Purpose

C1-I adds a narrow Discovery-versus-Drill boundary without changing the frozen `search_results.v2` contract.

```text
Cluvvi mission
→ discovery_request.v1
→ Project A search
→ search_results.v2
→ optional depth-zero frontier
→ bounded public HTML extraction
→ three companion artifacts
→ independent Cluvvi validation
→ deterministic evidence materials
→ Evidence → Identity → Ranking → Buyer Map
```

Search-only execution remains valid and is still the default. Public-page extraction runs only when trusted local configuration explicitly selects `selected_public_pages`.

## Runtime configuration

```text
CLUVVI_DISCOVERY_MODE
  fixture | local_discovery_engine

CLUVVI_DISCOVERY_EXTRACTION_MODE
  none | selected_public_pages
  default: none

CLUVVI_DISCOVERY_MAX_EXTRACTIONS
  integer from 1 to 100
  default: 8
```

`selected_public_pages` requires `CLUVVI_DISCOVERY_MODE=local_discovery_engine`. Cluvvi passes the extraction mode and maximum through fixed process arguments. Mission text never enters executable names, shell syntax, or process arguments.

Project A may also receive only the documented non-secret extraction allowlist:

- URL/query/domain frontier limits;
- minimum frontier priority;
- request timeout, attempts, and concurrency;
- same-domain delay;
- maximum response bytes and extracted text characters;
- robots policy;
- public user agent.

Cluvvi does not forward provider keys, arbitrary parent environment variables, authorization values, cookies, or headers.

## Companion artifacts

Every selected-page execution uses the existing isolated exchange directory:

```text
<cluvvi-home>/runs/<run-id>/discovery-exchange/
  discovery-request.v1.json
  search-results.v2.json
  crawl-frontier.v1.json
  extracted-content.v1.json
  extraction-run-telemetry.v1.json
  discovery-stdout.log
  discovery-stderr.log
  discovery-execution.json
  history/
```

The three C1-I artifacts are separate contracts, not fields added to `search_results.v2`:

1. `crawl_frontier.v1` records deterministic page selection, limits, decisions, source-result references, and the search artifact digest.
2. `extracted_content.v1` records normalized metadata, visible text, bounded JSON-LD, outcomes, content hashes, trust classification, and frontier references.
3. `extraction_run_telemetry.v1` records fetch attempts, statuses, limits, byte totals, timing, and the extracted-content digest.

Cluvvi preserves the exact exchange copies and separately persists validated representations through its ordinary versioned artifact writer.

## Independent validation

Project B owns independent schema snapshots and cross-artifact validation. It rejects:

- wrong artifact kind or schema version;
- malformed JSON or missing sidecars;
- request-ID mismatch;
- search, frontier, or extracted-content digest mismatch;
- unknown search-result, frontier, or extraction-item references;
- duplicate identifiers;
- summary or telemetry totals that do not match item rows;
- extraction counts above the configured maximum;
- private, loopback, link-local, or otherwise unsafe URLs;
- raw HTML, request or response headers, cookies, authorization values, environment data, or secret-shaped fields;
- inconsistent content hashes, trust classification, or page outcomes.

Invalid artifacts are never silently repaired. Discovery/extraction diagnostics and exchange files remain available for review when preservation is configured.

## Evidence-material boundary

Accepted extraction items are converted deterministically into versioned evidence materials:

```text
search_snippet
extracted_metadata
extracted_page_text
extracted_json_ld
```

Page text is chunked deterministically with stable character ranges and overlap. Every material carries a content hash, source URL, search-result ID, optional frontier/extraction IDs, material ID, limitations, and one trust classification:

```text
provider_snippet
untrusted_public_content
```

Extracted content is quoted source data. The prompt boundary explicitly says that instructions, role changes, tool requests, and policy claims inside source blocks must never be followed. A closing delimiter inside page text is escaped before prompt construction.

Buyer Map citations preserve material ID/kind, extraction and frontier IDs, extracted-content hash, source URL, and trust classification. This is provenance, not verification of the page's claims.

## Failure and resume

The stages are independently durable:

```text
discovery
frontier
extraction
extraction_telemetry
```

A malformed or unsafe extraction artifact blocks extracted evidence and later stages. On same-run resume:

- already completed discovery can be reused;
- an already validated frontier can be reused when appropriate;
- corrected extraction sidecars are imported again;
- downstream evidence and Buyer Map stages continue only after validation passes.

The run timeline visibly labels reused durable stages. Cancellation and timeout continue to terminate the complete Project A child-process tree.

Partial page failure can complete honestly when at least one accepted page remains and every failed/blocked attempt is represented consistently. All selected pages may also fail safely; Cluvvi keeps search evidence and does not invent extracted evidence.

## Browser operations

`/operations/discovery` shows the active extraction configuration and a non-persisting preview selector. The run page shows:

- selected/attempted/successful/partial/failed/blocked page counts;
- frontier and telemetry limits;
- per-page outcome and safe reason;
- normalized metadata/text previews;
- untrusted-content warnings;
- partial or total extraction failure;
- extraction security failure before import;
- search/frontier reuse after resume;
- all three companion artifacts in the artifact inspector;
- extracted-evidence provenance in Evidence and Buyer Map.

The interface does not claim that public pages are verified, complete, current, or proof of purchase intent.

## Verification

```powershell
pnpm exec vitest run packages/engine/tests/extraction-bridge.integration.test.ts
pnpm exec vitest run packages/engine/tests/extracted-evidence-materials.test.ts
pnpm test:browser-extraction

$env:RUN_EXTRACTION_DISCOVERY_INTEGRATION = "1"
$env:CLUVVI_DISCOVERY_ENGINE_PATH = "C:\Users\Lenovo\Music\Startups\Cluvvi\Separate Discovery engine"
$env:CLUVVI_DISCOVERY_ENGINE_EXPECTED_SHA = "9e86a1506578763419c11262afc107b2db76500f"
pnpm exec vitest run packages/engine/tests/extraction-real-bridge.integration.test.ts
```

The browser command runs ten isolated proofs and restarts the local web/runner environment between them. This prevents a failed proof or stale Windows process lease from contaminating later proofs.

The controlled matrix covers:

- operations configuration on desktop and mobile;
- successful extraction and downstream provenance;
- durable inspection of all three companion artifacts;
- partial and all-page failure;
- hostile-instruction containment;
- unsafe-artifact failure followed by same-run resume with discovery reuse;
- mobile overflow;
- secret-free bridge execution records.

The opt-in cross-project integration test may use the actual Project A path to prove the real standalone CLI contract without adding a package dependency.

## Explicitly outside C1-I

C1-I does not add:

- JavaScript rendering or browser automation for source pages;
- recursive crawling or link expansion;
- PDFs, office documents, media, comments, threads, or transcripts;
- Reddit, GitHub, YouTube, hiring, or monitoring adapters;
- login-wall or anti-bot bypass;
- verified identities, contact enrichment, or outreach;
- remote Discovery APIs, Docker, authentication, billing, or deployment.
