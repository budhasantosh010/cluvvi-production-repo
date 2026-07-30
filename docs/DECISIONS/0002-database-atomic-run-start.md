# ADR 0002: The database transaction is the run-start durability boundary

**Status:** accepted  
**Date:** 2026-07-30

## Context

Creating a run, appending `run_created`, and enqueueing background work in separate network calls permits partial success and misleading UI.

## Decision

Expose one authorized Postgres function that validates workspace membership and mission ownership, creates or reuses the idempotent run, appends the initial event, and sends the pgmq message in one transaction.

## Consequences

The UI can truthfully say a run started only after durable state and work exist together. Retries are safe. Application code is thinner. Database functions require careful tests and versioned migrations.
