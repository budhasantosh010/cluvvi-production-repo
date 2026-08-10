# Cluvvi C1-J.5 Local Architecture

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

`CluvviEngine` is the only implementation of the durable business process. The CLI, browser API, and runner are interfaces around it. Next.js does not implement stages, and the worker does not own a second state machine.

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
  ? provider_policy_trace.v1 sidecar when live
  ? optional crawl_frontier.v1
  ? optional extracted_content.v1
  ? optional extraction_run_telemetry.v1
  ? strict Cluvvi cross-artifact validation
  ? deterministic evidence materials and downstream stages
```

The runtime and provider mode are separate immutable run fields. They participate in stage fingerprints, so a fixture run cannot silently resume under live providers or vice versa.

Mission text is written to a request file and never enters executable names, shell syntax, or child arguments. The child process receives only fixed arguments and an explicit non-secret provider/extraction environment allowlist. Secret values are excluded from public fingerprints, execution records, logs, artifacts, diagnostics, and browser responses.

Each run owns an isolated `discovery-exchange` directory. Live telemetry, provider policy, and optional extraction sidecars are preserved beside the exact imported V2 artifact and summarized into the bridge execution record. Invalid artifacts fail before downstream execution. Partial provider or page failure can complete only when every accepted and failed attempt is represented consistently; Cluvvi never converts missing or invalid evidence into false completeness.

Search remains independently usable without page fetching. C1-I adds an explicit `selected_public_pages` mode in which Project A selects and fetches a bounded depth-zero public frontier. Cluvvi imports the three companion artifacts across the existing file/process boundary, validates them independently, persists them separately, and converts accepted metadata, text, and JSON-LD into content-hashed evidence materials. Search and frontier stages can be reused when extraction fails and the same run is resumed. Raw HTML and transport/security data are never admitted into the durable contracts.

## Security and server-only rules

- Local host defaults to `localhost`; `0.0.0.0` requires explicit configuration.
- Same-origin APIs only; no broad CORS.
- Run IDs and artifact types are fixed schemas.
- Arbitrary local file paths are never accepted from the browser.
- SQLite and filesystem modules remain server-only.
- Artifact JSON is escaped by React; report Markdown is not rendered as arbitrary HTML.
- Imported extraction artifacts reject raw HTML, headers, cookies, authorization data, environment dumps, secret-shaped fields, and private-network URLs.
- Extracted evidence enters any future model only through the contained untrusted-evidence prompt boundary.
- Secrets and raw stack traces are not returned by default.

## Parked Phase 0

Supabase migrations, auth, workspace pages, database adapter, and the original queue worker remain preserved for later hosted work. They are not part of the active C0.5 local browser execution path.

## C1-J source-adapter boundary

C1-J keeps source adapters in Project A and keeps Project B as an independent consumer. Project B never imports Project A source modules. With `selected_sources`, the process bridge may emit any explicit combination of `hiring`, `community`, `developer`, `video`, and `specialized`. C1-J.4 adds the YouTube companion family (`video_source_plan.v1`, `video_collection.v1`, the frozen `transcript.v1` plus transcript manifest, video-specific comment collection/manifest, `video_signals.v1`, and `video_source_run_telemetry.v1`). C1-J.5 adds Universal Specialized Source Intelligence (`specialized_source_context.v1`, `specialized_source_candidates.v1`, `specialized_source_plan.v1`, `specialized_findings.v1`, `specialized_signals.v1`, and `specialized_source_run_telemetry.v1`). `specialized` is the top-level family; there is no executable top-level `research` family. Tech/AI is Pack #1 inside the specialized registry.

The Cluvvi engine validates every source-family artifact independently and persists J.4 video work in six separately resumable stages and J.5 specialized work in six separately resumable stages, each with separate configuration fingerprints. A broken later video or specialized artifact can therefore be repaired and resumed without rerunning valid discovery or earlier source-family stages. Dynamic specialized discovery remains bounded, uses approved Provider Router search, and can only create generic site/feed/page routes. It cannot invent dedicated adapters or mutate the trusted registry.

Public Reddit, GitHub, YouTube, transcript/comment, and specialized-source text enters Evidence only as `untrusted_public_content`; entity attachment requires a conservative unique match to an already-known discovery entity. Creator/channel/commenter names and specialized authors/organizations remain source attribution only and never become buyer/contact identities. Normal ranking components ignore source-family signals. Community, developer, video, and specialized intelligence each retain their own maximum +1 contribution under their family-specific corroboration rules. Buyer Map preserves source-specific provenance and explicit evidence limitations even when a live source cannot be linked safely enough to affect a buyer entity.

Secrets remain owned by Project A. Optional SmartRecruiters and GitHub credentials are never forwarded, serialized, fingerprinted, logged, or rendered by Cluvvi. Reddit is keyless. YouTube is metadata/text only: no cookies, browser profiles, login, proxy/challenge bypass, media download, or runtime installation is allowed. Project B also never forwards `DISCOVERY_SPECIALIZED_SOURCE_REGISTRY_PATH`, arbitrary script/binary paths, or specialist credentials. arXiv is keyless public API access with bounded pacing; Techmeme uses the approved public/search route with generic fallback; Digg is optional and may truthfully degrade to dependency-missing. C1-J.5 stops before monitoring, cross-source fusion expansion, contact enrichment, or outreach.
