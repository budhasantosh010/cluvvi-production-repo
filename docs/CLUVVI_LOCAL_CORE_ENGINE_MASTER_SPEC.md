# Cluvvi Local Core Engine — C0 Source of Truth

**Baseline:** `0c4660f`  
**Active phase:** C0 Local engine foundation  
**Primary interface:** CLI  
**Primary storage:** SQLite  
**Commercial benchmark:** eventually produce 20 real, evidence-backed opportunities worth contacting.

## Why the architecture changed

The Phase 0 Supabase/web foundation is preserved, but it does not directly prove Cluvvi's riskiest assumption: discovery quality. The active path therefore moves to a local, provider-independent engine that can be run, inspected, resumed, and evaluated without cloud infrastructure.

## C0 outcome

```text
pnpm cluvvi run ./examples/video-editing-saas.json
```

must validate the mission, create a SQLite-backed run, execute every deterministic placeholder stage, persist stage executions and events, write versioned artifacts, record fixture tool calls, support status/inspect/resume/doctor, and require no Docker, Supabase, or authentication.

## C0 stages

```text
mission
→ compilation
→ source_planning
→ discovery
→ normalization
→ investigation
→ buyer_identification
→ enrichment
→ ranking
→ review
→ finalization
```

Every stage has a version, validated input/output, deterministic fingerprint, durable execution record, artifact, and explicit failure behavior.

## Hard boundaries

- Engine depends on `CluvviStore`, never SQLite directly.
- Only `packages/storage` may import SQLite APIs. C0 uses Node 24's built-in `node:sqlite` to avoid a native dependency.
- SQLite is authoritative; files under `.cluvvi/runs` are inspectable mirrors.
- Artifact files are written using temporary-file + rename.
- Completed stage fingerprints are reused without duplicate output or provider charges.
- C0 fixture artifacts contain `fixture: true` and a warning that they are not real discovery.
- Existing Supabase/web/worker code is parked, not deleted.

## C0 non-goals

No real AI, website fetch, search, candidate discovery, enrichment, opportunity scoring, outreach, authentication, multi-tenancy, billing, or deployment work.

## Acceptance criteria

- Local run needs no Docker, Supabase, or authentication.
- SQLite initializes and applies numbered migrations.
- CLI can initialize, run, resume, inspect, show status, and run doctor checks.
- All stages persist state and artifacts.
- Resume skips completed fingerprints.
- Simulated stage failure can resume without restarting successful work.
- Tool-call records are durable.
- CI quality gates pass.
- No real provider code enters C0.
