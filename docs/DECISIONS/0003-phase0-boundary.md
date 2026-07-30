# ADR 0003: Prove durability before adding intelligence

**Status:** accepted  
**Date:** 2026-07-30

## Context

Cluvvi's eventual value comes from AI-guided research, but unreliable state, authorization, queues, or auditability would make every later result untrustworthy.

## Decision

Phase 0 contains no model or web-search integration. It proves authentication, tenancy, mission persistence, atomic run start, durable queue consumption, idempotent transitions, truthful progress, health, tests, and CI.

## Consequences

The first milestone is less visually dramatic but removes the most expensive class of future architectural failure. Provider work begins only after this slice passes.
