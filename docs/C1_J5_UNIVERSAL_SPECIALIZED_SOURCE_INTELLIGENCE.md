# C1-J.5 Universal Specialized Source Intelligence — Project B

## Status

C1-J.5 is implemented on `feature/c1-j4-j5-video-specialized-intelligence` as the opt-in top-level `specialized` source family. There is intentionally no top-level `research` family.

Project A is pinned at:

```text
298446dcfa53b2c8c517c28e9d56a0816ed12480
```

Project B consumes Project A only through versioned JSON files and the existing process boundary.

## Architecture

```text
Mission / discovery_request.v1
  ↓
specialized_source_context.v1
  ↓
data-only specialized registry + selected source packs
  ↓
signal-specific coverage-before
  ↓
known source selection
  ↓
coverage-gap trigger (when needed)
  ↓
provider-routed source-discovery queries
  ↓
domain candidate scoring / merging
  ↓
generic site-search | feed | page routes
  + allowlisted dedicated adapters
  ↓
findings → specialized signals → telemetry
  ↓
Project B strict validation
  ↓
Evidence → role-only Identity → separate capped ranking → Buyer Map
```

The taxonomy is extensible across industries, sub-industries, geography, desired signal types, source types, authority classes, freshness, and access categories. Tech/AI is Pack #1, not the architecture itself.

## Tech / AI Pack #1

The first built-in specialized pack includes arXiv public API, Techmeme public archive with generic public-page fallback, and optional Digg CLI only when an installed machine-readable interface is available.

Project A never auto-installs Digg or another dependency. Missing or unsupported optional dependencies degrade honestly and are recorded in telemetry. No fake Digg result is substituted.

## Dynamic source safety

Dynamic source discovery is coverage-driven. It may search for regulators, government agencies, associations, standards bodies, procurement portals, courts/legal databases, inspection databases, licensing/certification/professional bodies, research/statistics databases, trade publications, tender/project-award sources, directories/registries, and specialist news aggregators.

A discovered candidate may use generic public routes only. Dynamic content cannot add an executable adapter, command, binary, local path, script path, package-install instruction, cookie/auth material, proxy/bypass control, or secret. Dedicated adapter IDs are fixed in Project A code and allowlisted.

Project B never forwards `DISCOVERY_SPECIALIZED_SOURCE_REGISTRY_PATH`. Project A owns its optional local data-only overlay. The effective registry version/digest is persisted in plan/telemetry provenance without exposing the local operator path.

## Durable Project B stages

1. `specialized_context`
2. `specialized_candidate_discovery`
3. `specialized_planning`
4. `specialized_retrieval`
5. `specialized_analysis`
6. `specialized_source_telemetry`

Missing or malformed sidecars fail at their exact stage. Earlier discovery and source-family stages remain reusable on same-run repair/resume.

## Project B configuration

```text
CLUVVI_DISCOVERY_MODE=local_discovery_engine
CLUVVI_DISCOVERY_SOURCE_ADAPTER_MODE=selected_sources
CLUVVI_DISCOVERY_SOURCE_FAMILIES=specialized
DISCOVERY_SPECIALIZED_MODE=auto
DISCOVERY_SPECIALIZED_DYNAMIC_DISCOVERY=true
DISCOVERY_SPECIALIZED_MAX_SELECTED_SOURCES=8
DISCOVERY_SPECIALIZED_MAX_CANDIDATES=30
DISCOVERY_SPECIALIZED_COVERAGE_THRESHOLD=0.65
```

`specialized` can be selected independently or alongside `hiring`, `community`, `developer`, and `video`. Project B forwards only the explicitly allowlisted non-secret `DISCOVERY_SPECIALIZED_*` policy/budget values. The local registry overlay path is intentionally excluded from that allowlist.

## Validation

Project B validates context/request lineage and deterministic IDs; candidate domain uniqueness; public HTTPS URLs; generic-only dynamic routes; declared-domain consistency for trusted feeds; known/dynamic selection lineage; dedicated-adapter allowlists; finding/signal references; independent-source counts; plan/coverage/telemetry reconciliation; registry version/digest provenance; and `paidRequests = 0`, `paidCredits = 0`.

Imported artifacts are also recursively screened for command/path/script/binary/secret/auth/cookie/private shaped fields.

## Evidence, identity, and ranking

Specialized materials cross downstream as `specialized_finding` and `specialized_signal`, classified as `untrusted_public_content`. Authority class is provenance/confidence context, not buyer identity.

Publishers, authors, organizations, agencies, regulators, institutions, and source domains remain source attribution. They do not become contacts, employees, decision makers, buyers, or purchasing-authority evidence.

Normal score components exclude `specialized_signal`. Specialized evidence has a separate `specializedContribution` capped at exactly `+1`. The point requires sufficiently relevant/corroborated non-weak specialist evidence with independent source support; weak, duplicate-domain, ambiguous, single-source, or unlinked evidence contributes zero.

## Buyer Map and UI

Buyer Map preserves finding/signal IDs, source domain/type, authority class, registered-vs-dynamic status, route, relevance/confidence, and independent-source counts. The run view shows context, coverage before/after, why dynamic discovery triggered, selected registered/dynamic sources, routes, Tech/AI Pack #1, findings/signals, degraded states, zero-paid telemetry, and the attribution-only identity boundary.

The operations UI exposes mode/budgets/rule versions/registry version but never the registry overlay path.

## Verification

Controlled Project B tests cover exact missing/invalid sidecar stages, known and dynamic source provenance, zero-paid telemetry, downstream evidence/identity/ranking, and same-run repair/reuse. The final focused bridge/runtime matrix passed 36/36. The dedicated browser suite rebuilt the production Next.js app and passed 2/2 while capturing inspected desktop and 390px mobile Visual-QA screenshots with no horizontal overflow.

The env-gated real Project A → Project B suite pins Project A to the SHA above and passed 2/2: one real public YouTube + Tech/AI specialized run and one free-only non-tech UK HR/compliance coverage-gap run. Both preserved zero paid requests/credits, and the non-tech proof ran with `DISCOVERY_SPECIALIZED_SOURCE_REGISTRY_PATH` blocked from Project B forwarding.

## Scope stop

C1-J.5 stops here. It does not start monitoring, recurring collection, outreach, contact enrichment, arbitrary plugin execution, authenticated/private source collection, or the later cross-source fusion milestone.
