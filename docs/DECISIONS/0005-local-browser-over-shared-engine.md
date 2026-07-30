# ADR 0005: Expose the local engine through a durable browser shell

## Status

Accepted for C0.5.

## Context

C0 proved the local SQLite-backed engine through a CLI. The product direction is a browser SaaS, but duplicating workflow logic in Next.js or running the entire engine inside a request would create incompatible state models, timeout risk, and costly future rewrites.

## Decision

Use the existing `CluvviEngine` as the single workflow implementation.

- Next.js calls a server-side application service.
- Browser submissions atomically create a run and a SQLite request.
- A separate local runner claims requests and invokes the engine.
- The CLI continues to invoke the same engine and storage contracts.
- Web and runner share one resolved SQLite path and database identity.
- Request leases provide crash recovery.
- A singleton SQLite leadership lease prevents duplicate local runners.
- Polling reads durable state; no in-memory queue, detached process, WebSocket, or long request is added.
- The development server binds to `localhost:3100` by default.

## Consequences

### First order

The browser can create, observe, inspect, fail, and resume C0 fixture runs without Supabase or authentication.

### Second order

Future real provider calls can become longer without changing the HTTP lifecycle because execution already lives outside requests.

### Third order

The same pages and contracts can progressively display real C1–C9 artifacts while the engine and provider adapters evolve independently.

### Fourth order

A hosted deployment can replace the local SQLite request repository and runner topology behind existing contracts instead of rebuilding product logic or React pages.

## Rejected alternatives

- Running all stages inside `POST /api/runs`.
- Starting detached child processes from route handlers.
- Maintaining an in-memory request queue.
- Reimplementing stages in Next.js or the worker.
- Reintroducing Supabase/authentication before proving the browser workflow.
- Adding WebSockets before stage-level polling becomes insufficient.
