# C1-I.5 Structured HTML and Public-Document Evidence

C1-I.5 extends C1-I without replacing its process/file boundary. Search, frontier selection, bounded fetching, and parsing remain in the standalone Discovery Engine (Project A). Cluvvi (Project B) independently validates and persists two additional companion artifacts:

- `structured-content.v1.json`
- `content-parse-telemetry.v1.json`

The feature is opt-in through `CLUVVI_DISCOVERY_STRUCTURED_CONTENT_MODE=selected_resources`. It requires `CLUVVI_DISCOVERY_MODE=local_discovery_engine` and `CLUVVI_DISCOVERY_EXTRACTION_MODE=selected_public_pages`.

## Pipeline

```text
search_results.v2
→ crawl_frontier.v1
→ extracted_content.v1
→ extraction_run_telemetry.v1
→ structured_content.v1
→ content_parse_telemetry.v1
→ normalized candidates
→ section/table/metadata/footnote evidence materials
→ Evidence → Identity hypotheses → Ranking → Buyer Map
```

`structured_parsing` and `content_parse_telemetry` are explicit durable stages. After a structured-sidecar repair, the same run reuses completed discovery, frontier, extraction, and extraction-telemetry work.

## Bounded resource support

Project A may normalize selected public HTML plus PDF, Word, presentation, spreadsheet, OpenDocument, RTF, EPUB, and CSV resources. Frozen versions for this milestone are:

- `structured_parser_policy@1.0.0`
- `@firecrawl/anydoc@0.1.6`
- `sanitized_html_to_gfm@1.0.0`
- `extraction_quality@1.0.0`

C1-I.5 does not execute macros, formulas, links, embedded instructions, or document assets. It does not perform OCR, JavaScript rendering, recursive crawling, authenticated access, platform crawling, comments/transcripts, contact discovery, outreach, monitoring, or workflow automation.

## Independent validation

Project B owns independent schema snapshots and validators. It does not import Project A source or add Project A as a package dependency. Cluvvi verifies:

- exact request IDs and search/frontier/extraction digests;
- deterministic artifact IDs and content hashes;
- source-result, frontier-item, extraction-item, section, table, link, and footnote references;
- section parent graphs and table consistency;
- bounded resource, section, table, link, footnote, asset, Markdown, and byte totals;
- parser telemetry totals and per-resource outcomes;
- public HTTP/HTTPS URLs and rejection of private/local targets;
- absence of raw HTML, raw/document/asset bytes, base64 payloads, headers, cookies, authorization data, environment data, secret-shaped fields, and temporary paths.

Invalid sidecars fail before normalization and remain available in the exchange directory. Earlier validated artifacts remain durable and reusable.

## Evidence provenance

Accepted structured content is always `untrusted_public_content`. Evidence and Buyer Map citations preserve structured item, section/table/footnote, parser/provider/version, resource kind, heading path/source locator, content hash/completeness, search/frontier/extraction lineage, limitations, and source URL.

Material kinds are `structured_section`, `structured_table`, `structured_metadata`, and `structured_footnote`. Parsing richer content does not automatically increase opportunity scores; ranking remains deterministic and evidence-driven.

## Prompt containment

Structured text is quoted inside `<untrusted_evidence>` blocks. Instructions, role changes, tool requests, policy claims, links, macros, and formulas found in a resource remain source data and are never executed.

## Verification

Controlled tests cover HTML plus document success, partial parses, all-unavailable resources, hostile instructions, private URLs, forbidden byte fields, hash mismatches, missing sidecars, telemetry mismatch, and structured-only resume. The real cross-project proof pins Project A commit `1eec5769f07ec2314565242bb3b421619c34e426` and proves free-only search, extraction, structured sidecar import, downstream section provenance, and zero Tavily/Brave/paid usage.
