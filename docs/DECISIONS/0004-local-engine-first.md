# ADR 0004: Prove the local engine before production infrastructure

## Status

Accepted — 2026-07-30

## Context

Phase 0 proved a production-shaped Supabase/web skeleton, but Cluvvi's company-defining risk is whether it can produce 20 evidence-backed buyers worth contacting. Cloud authentication, RLS, and durable hosted queues do not answer that question.

## Decision

Preserve Phase 0 history and code, but park it outside the active path. Build C0 as a local TypeScript CLI using SQLite behind `CluvviStore`, deterministic stages, durable artifacts, fingerprints, budgets, events, and resume behavior.

## Consequences

- The complete engine can evolve without Docker or Supabase.
- Provider and storage implementations remain replaceable.
- SQLite-specific code is isolated in `packages/storage`.
- Hosted features return only after discovery quality is measured.
- C0 fixture output proves orchestration only and must never be presented as real leads.
