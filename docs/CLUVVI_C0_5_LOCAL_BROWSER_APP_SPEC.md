# Cluvvi C0.5 — Local Browser Application

**Baseline:** `7befa477b89bbcb4ca6fdc9bd60285f273f146ed`  
**Primary interface:** browser  
**Development URL:** `http://localhost:3100`  
**Engine mode:** explicit fixture mode  
**Storage:** `.cluvvi/cluvvi.sqlite`

## Purpose

C0.5 exposes the existing C0 engine through a browser without creating a second workflow implementation.

```text
Browser
→ enter what you sell
→ create one durable run and request
→ local runner executes the shared engine
→ persisted progress and artifacts appear
→ refresh, inspect, fail, and resume safely
```

## Scope

C0.5 includes:

- the existing Next.js application as the browser shell,
- a mission form using the shared mission schema,
- explicit internal API contracts,
- a server-side application service,
- durable SQLite `run_requests`, claims, leases, and idempotency,
- a persistent local runner with heartbeat and single-runner leadership,
- run history, progress, artifacts, errors, resume, cancel, and diagnostics,
- one Windows-safe `pnpm dev` command,
- Playwright browser and responsive visual verification.

C0.5 excludes AI, real search, website ingestion, enrichment, scoring, outreach, authentication, billing, cloud deployment, and marketing-site work.

## Critical architecture

```text
CLI ─────┐
         ├──→ one CluvviEngine → CluvviStore → SQLite and artifacts
Browser ─┘          ↑
               local runner
```

- Route handlers call public application services.
- Route handlers contain no direct SQL and do not execute long runs.
- The runner imports no Next.js code.
- The engine imports no Next.js or SQLite APIs.
- Only storage owns SQLite.

## Local processes

`pnpm dev` starts:

1. Next.js on `localhost:3100`.
2. The local Cluvvi runner.

Both resolve one shared database path and compare a persisted database instance identifier. The web server reads persisted progress while the runner writes short WAL transactions.

## Durability and concurrency

- Browser run creation inserts the run, initial event, and first request atomically.
- Submission idempotency returns the same logical run for the same key.
- Request claims use bounded leases.
- Active leases cannot be stolen; expired leases can be reclaimed.
- A singleton runner leadership lease permits only one active local runner.
- Stage fingerprints prevent repeated completed work.
- A crashed runner leaves the run resumable.

## Browser product surface

```text
/                       mission input and recent runs
/runs                   durable history
/runs/<run-id>          live persisted progress and artifacts
/runs/<run-id>/inspect  full inspection
/settings/local         read-only local diagnostics
```

The run page displays all eleven stages without inventing percentages. Polling backs off after terminal states and while the tab is hidden. Refresh and multiple tabs read the same SQLite state.

Every page and export that displays generated output identifies it as deterministic fixture data, not real market research.

## API surface

```text
GET  /api/health
GET  /api/capabilities
POST /api/runs
GET  /api/runs
GET  /api/runs/<run-id>
GET  /api/runs/<run-id>/events
GET  /api/runs/<run-id>/artifacts/<artifact-type>
POST /api/runs/<run-id>/resume
POST /api/runs/<run-id>/cancel
```

Errors use one safe contract with code, message, retryability, optional field errors, and request ID.

## Security

- Loopback binding by default.
- Same-origin operation.
- Strict run-ID and artifact-type validation.
- No arbitrary browser-supplied file paths.
- No broad CORS.
- No secret values in diagnostics.
- No unsafe raw HTML for artifacts.

## Acceptance

C0.5 is complete when:

- `pnpm dev` starts web and runner on `localhost:3100`,
- a browser mission creates one durable SQLite run,
- the runner completes all eleven fixture stages,
- progress survives refresh,
- artifacts are inspectable and clearly labeled fixture output,
- duplicate submissions and duplicate runners are blocked safely,
- active and expired leases behave correctly,
- a browser-visible failure resumes with completed-stage reuse,
- desktop and mobile screenshots pass visual and DOM-geometry checks,
- Windows SIGINT removes the supervisor, web listener, and runner,
- formatting, lint, strict TypeScript, tests, browser tests, and builds pass,
- scope-leak checks find no provider integrations in the active C0.5 path,
- failures are documented and the working tree is clean.
