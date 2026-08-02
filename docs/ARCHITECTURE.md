# Cluvvi C1-H Local Architecture

```text
Browser
  ↓ same-origin HTTP
Next.js pages and route handlers
  ↓ public service contracts only
packages/application
  ├─ LocalCluvviApplicationService
  └─ LocalRunner
          ↓
packages/engine ───────→ LocalArtifactWriter
  ↓ CluvviStore              ↓ atomic mirrors
packages/storage        .cluvvi/runs/<run-id>/
  ↓
Node 24 `node:sqlite`
  ↓
.cluvvi/cluvvi.sqlite

CLI ───────────────────→ the same CluvviEngine and CluvviStore contracts
```

## One workflow rule

`CluvviEngine` is the only implementation of the eleven-stage business process. The CLI, browser API, and runner are interfaces around it. Next.js does not implement stages, and the worker does not own a second state machine.

## Boundaries

### Core

Owns versioned mission, run, artifact, request, heartbeat, ID, error, and fingerprint contracts. The browser form and server validate through the same mission schema.

### Application

Owns use cases and views:

- atomically create a run plus its first request,
- list and inspect persisted runs,
- enqueue idempotent resume/cancel requests,
- expose capabilities and diagnostics,
- claim and execute durable requests through `CluvviEngine`.

It depends on public engine and storage contracts, not SQLite or Next.js internals.

### Storage

Owns `CluvviStore`, numbered migrations, WAL configuration, short transactions, row mapping, request claims, request leases, runner heartbeat, database identity, and the single-runner leadership lease. It is the only package that imports `node:sqlite`.

### Engine

Owns deterministic orchestration, stage registry, budget checks, cancellation boundaries, fingerprint reuse, fixture stages, failures, and artifact writing. It is independent of Next.js and SQLite.

### Web

Owns React presentation, polling, safe response serialization, and thin route handlers. Active local routes call `LocalCluvviApplicationService`; they contain no SQL and never run the full workflow inside a request.

### Worker

`apps/worker/src/local.ts` opens the same database, obtains the runner leadership lease, writes heartbeat state, claims one request at a time, renews request leases, and invokes the engine. The preserved Phase 0 worker entry remains separate.

### CLI

Owns command parsing and developer output. Path resolution is shared from `packages/storage`, preventing accidental independent databases.

## Durable execution

Creating a browser run transactionally inserts:

1. the run and mission,
2. the initial event,
3. one idempotent `start` request.

The runner claims requests transactionally. Active request leases cannot be stolen; expired leases can be recovered. Stage fingerprints remain the second idempotency layer.

A singleton SQLite leadership row prevents multiple local runners from racing for requests. A crashed leader becomes replaceable after its bounded lease expires.

## Local process model

```text
pnpm dev
  ├─ Next.js on localhost:3100
  └─ local runner
```

The supervisor validates Node, initializes migrations, binds to loopback by default, rejects a busy port, waits for web and runner health, compares database instance IDs, forwards termination, and force-cleans child trees only after a bounded graceful-stop window.

## Discovery process boundary

```text
Cluvvi run
  → discovery_request.v1
  → trusted local Project A process
      ├─ fixture_only
      └─ live_search: HN Algolia + bounded Firebase enrichment + Tavily basic + Brave web
  → search_results.v2
  → live_provider_run_telemetry.v1 sidecar when live
  → strict Cluvvi validation
  → deterministic downstream stages
```

The runtime and provider mode are separate immutable run fields. They participate in stage fingerprints, so a fixture run cannot silently resume under live providers or vice versa.

Mission text is written to a request file and never enters executable names, shell syntax, or child arguments. The child process receives only fixed arguments and an explicit provider-environment allowlist. Secret values are excluded from public fingerprints, execution records, logs, artifacts, diagnostics, and browser responses.

Each run owns an isolated `discovery-exchange` directory. Live telemetry is preserved beside the exact imported V2 artifact and summarized into the bridge execution record. Invalid artifacts or telemetry fail the discovery stage before downstream execution. Partial provider failure can complete only when Project A returns a valid non-empty or honestly covered artifact with explicit warnings and telemetry; Cluvvi never turns missing or invalid provider evidence into false completeness.

C1-H is search-only. Result pages are not fetched, rendered, crawled, or deeply extracted. C1-I requires a separate approval and contract.

## Security and server-only rules

- Local host defaults to `localhost`; `0.0.0.0` requires explicit configuration.
- Same-origin APIs only; no broad CORS.
- Run IDs and artifact types are fixed schemas.
- Arbitrary local file paths are never accepted from the browser.
- SQLite and filesystem modules remain server-only.
- Artifact JSON is escaped by React; report Markdown is not rendered as arbitrary HTML.
- Secrets and raw stack traces are not returned by default.

## Parked Phase 0

Supabase migrations, auth, workspace pages, database adapter, and the original queue worker remain preserved for later hosted work. They are not part of the active C0.5 local browser execution path.
