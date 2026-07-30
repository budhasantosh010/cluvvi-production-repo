# ADR 0001: Store workspace scope directly on runs and events

**Status:** accepted  
**Date:** 2026-07-30

## Context

The product specification can derive a run's workspace through its mission. RLS, operational dashboards, audit queries, and future partitioning repeatedly need the workspace boundary.

## Decision

Store `workspace_id` directly on `runs` and `run_events`. Database functions verify that the run workspace equals the mission workspace. Foreign keys and transactional creation prevent drift.

## Consequences

Authorization policies are simpler and less error-prone, common queries avoid repeated joins, and later tenant-level retention/export is straightforward. The cost is controlled denormalization plus an invariant enforced in database functions.
