# C1-I.5 Structured Evidence Operations

## Enable the mode

Set the following for both the web process and local runner, then restart both:

```dotenv
CLUVVI_DISCOVERY_MODE=local_discovery_engine
CLUVVI_DISCOVERY_EXTRACTION_MODE=selected_public_pages
CLUVVI_DISCOVERY_STRUCTURED_CONTENT_MODE=selected_resources
CLUVVI_DISCOVERY_MAX_EXTRACTIONS=8
CLUVVI_DISCOVERY_MAX_STRUCTURED_RESOURCES=8
CLUVVI_DISCOVERY_MAX_DOCUMENT_RESOURCES=4
```

`CLUVVI_DISCOVERY_MAX_DOCUMENT_RESOURCES` must not exceed the total structured-resource budget. Search-only and C1-I extraction-only modes remain valid by setting structured mode to `none`.

## Safe forwarded Project A settings

Cluvvi forwards only explicit non-secret parser limits. Common controls are:

```dotenv
DISCOVERY_STRUCTURED_MAX_RESOURCES=8
DISCOVERY_STRUCTURED_MAX_DOCUMENT_RESOURCES=4
DISCOVERY_DOCUMENT_MAX_BYTES=20971520
DISCOVERY_DOCUMENT_PARSE_TIMEOUT_MS=30000
DISCOVERY_DOCUMENT_WORKER_MAX_ATTEMPTS=1
DISCOVERY_MARKDOWN_MAX_CHARACTERS=250000
DISCOVERY_SECTIONS_MAX_PER_RESOURCE=2000
DISCOVERY_TABLES_MAX_PER_RESOURCE=100
DISCOVERY_LINKS_MAX_PER_RESOURCE=5000
DISCOVERY_FOOTNOTES_MAX_PER_RESOURCE=1000
DISCOVERY_ASSETS_MAX_PER_RESOURCE=1000
DISCOVERY_TABLE_MAX_ROWS=2000
DISCOVERY_TABLE_MAX_COLUMNS=100
DISCOVERY_TABLE_MAX_CELL_CHARACTERS=10000
DISCOVERY_TABLE_MAX_TOTAL_CELLS=100000
DISCOVERY_HTML_MARKDOWN_ENABLED=true
DISCOVERY_ANYDOC_ENABLED=true
DISCOVERY_ANYDOC_WORKER_CONCURRENCY=1
```

`DISCOVERY_ANYDOC_TEMP_ROOT` is deliberately not forwarded. Project A owns its temporary directory inside its own outputs boundary. API keys, authorization data, and arbitrary parent environment variables are never forwarded.

## Durable exchange files

For an enabled run, the exchange directory contains the existing discovery/extraction files plus:

```text
structured-content.v1.json
content-parse-telemetry.v1.json
discovery-execution.json
```

The execution record begins with `structuredContentImported=false` and `contentParseTelemetryImported=false`. Cluvvi sets both true only after independent validation succeeds.

## Failure and resume

Typical safe failures include:

- `STRUCTURED_CONTENT_MISSING`
- `CONTENT_PARSE_TELEMETRY_MISSING`
- `STRUCTURED_CONTENT_INVALID`
- `STRUCTURED_CONTENT_PRIVATE_URL_REJECTED`
- `STRUCTURED_CONTENT_BINARY_DATA_REJECTED`
- `STRUCTURED_CONTENT_HASH_MISMATCH`
- `STRUCTURED_CONTENT_REFERENCE_MISMATCH`
- `CONTENT_PARSE_TELEMETRY_INVALID`
- `CONTENT_PARSE_TELEMETRY_MISMATCH`

Do not edit persisted Cluvvi artifacts. Repair or regenerate the two exchange sidecars, then resume the same run. Discovery, frontier, extraction, and extraction telemetry should be reported as reused; structured parsing and downstream stages run again.

## Inspection

The operations page shows active mode, budgets, parser versions, and hard scope boundaries. Run pages show resource outcomes, format, parser, quality/completeness, sections, bounded tables, limitations, and parse telemetry. Buyer Map citations label structured sections/tables/metadata/footnotes and preserve source locators.

No UI view displays raw document bytes, raw HTML, temporary paths, headers, cookies, authorization data, secrets, or complete environments.

## Verification commands

```powershell
pnpm exec vitest run packages/engine/tests/structured-content-bridge.integration.test.ts
pnpm test:browser-structured-content

$env:RUN_EXTRACTION_DISCOVERY_INTEGRATION = "1"
$env:CLUVVI_DISCOVERY_ENGINE_PATH = "C:\Users\Lenovo\Music\Startups\Cluvvi\Separate Discovery engine"
$env:CLUVVI_DISCOVERY_ENGINE_EXPECTED_SHA = "1eec5769f07ec2314565242bb3b421619c34e426"
pnpm exec vitest run packages/engine/tests/extraction-real-bridge.integration.test.ts
```

The real proof must show zero Tavily requests, zero Tavily credits, zero Brave requests, zero paid credits, and the expected Project A SHA.
