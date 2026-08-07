# C1-J.1 Public Hiring Operations

## Enabling the source family

New runs remain source-adapter-off by default. Enable public hiring only with the local Discovery Engine:

```text
CLUVVI_DISCOVERY_SOURCE_ADAPTER_MODE=selected_sources
CLUVVI_DISCOVERY_SOURCE_FAMILIES=hiring
```

Bounded controls:

```text
CLUVVI_DISCOVERY_MAX_HIRING_TARGETS=10
CLUVVI_DISCOVERY_MAX_HIRING_BOARDS_PER_TARGET=3
CLUVVI_DISCOVERY_MAX_HIRING_JOBS_PER_BOARD=250
CLUVVI_DISCOVERY_MAX_HIRING_JOBS_TOTAL=2000
```

Project A has additional non-secret timeout, concurrency, description, target-confidence, and board-relationship controls. Cluvvi forwards only allowlisted public settings.

## SmartRecruiters

SmartRecruiters is optional authenticated-free. Its credential stays in Project A's environment and is never copied into Cluvvi, an execution record, an artifact, a log, a screenshot, or a fingerprint. Without authentication the provider records `auth_missing` and other public/fallback providers continue.

## Run inspection

The operations page shows active source-adapter mode, enabled families, and hiring budgets. Run pages show target plans, provider/access category, board status, public jobs, signals, partial/unavailable outcomes, and source-adapter telemetry. Buyer Map shows hiring provenance and confidence limitations.

## Failure and resume

Missing, malformed, private, secret-bearing, inconsistent, or orphaned hiring sidecars fail at the dedicated hiring stage. Earlier durable discovery work remains intact. Repair the sidecars/configuration and resume the same run; only invalid hiring and downstream stages rerun when earlier fingerprints are unchanged.

## Release verification

Required release gates:

1. controlled hiring bridge and strict mutation tests
2. dedicated hiring browser suite and exact visual QA captures
3. real Project A to Project B public ATS proof pinned to Project A SHA
4. all previous maintained browser suites
5. `pnpm check`
6. staged secret/private-data/scope scans
7. local/upstream/remote SHA equality and clean trees

## Operational interpretation

A job posting means a public job posting was observed. A hiring signal is a bounded inference from public jobs. Neither establishes budget, expansion, replacement hiring, an approved initiative, purchase intent, a buyer, or authority to purchase.
