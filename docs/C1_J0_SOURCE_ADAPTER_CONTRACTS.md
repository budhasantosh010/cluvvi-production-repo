# C1-J.0 Universal Source-Adapter Contracts

C1-J.0 extends Cluvvi's durable discovery boundary with independently versioned source-adapter artifacts. Project B never imports Project A source code; it reads JSON sidecars across the existing process/file boundary and validates them again locally.

## Source-adapter modes

- `none` is the default and preserves all prior behavior.
- `selected_sources` enables explicitly configured source families.
- C1-J.1 enables only the `hiring` family.

## Canonical hiring companion artifacts

Project B snapshots and validates these Project A contracts independently:

1. `source_target_plan.v1`
2. `job_collection.v1`
3. `hiring_signals.v1`
4. `source_adapter_run_telemetry.v1`

Each artifact has deterministic identity, request linkage, bounded counts, public URL validation, cross-artifact references, and strict forbidden-field scanning.

## Access categories

Source-adapter access is separate from search-provider categories and supports:

- `keyless_free`
- `authenticated_free`
- `paid`
- `manual`

C1-J.1 uses public keyless ATS sources and optional authenticated-free SmartRecruiters. Paid hiring adapters are not implemented. Cluvvi never forwards `DISCOVERY_SMARTRECRUITERS_API_KEY` or any other secret through the process bridge.

## Durable stages

C1-J.0 adds four explicit resumable stages after the existing discovery/extraction/structured boundaries:

1. `source_targeting`
2. `hiring_retrieval`
3. `hiring_analysis`
4. `source_adapter_telemetry`

The source-adapter configuration has its own fingerprint. A hiring-only repair reuses valid discovery, frontier, extraction, and structured artifacts and reruns only the invalid hiring boundary plus deterministic downstream work.

## Security rules

Imported source-adapter artifacts reject private-network URLs, raw HTML, request/response headers, cookies, authorization data, environment data, candidate contact fields, application answers, resumes, cover letters, secret-shaped fields, orphan references, impossible totals, and deterministic-ID mismatches.

Public hiring content is always `untrusted_public_content`. Embedded instructions remain quoted source data and are never interpreted as tool, role, or policy instructions.

## Scope boundary

C1-J.0 establishes reusable contracts only. It does not add candidate tracking, application ingestion, recruiter enrichment, private ATS APIs, login-gated scraping, contact discovery, outreach, monitoring, or workflow automation.
