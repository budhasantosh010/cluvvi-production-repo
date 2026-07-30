# Cluvvi engineering rules

Read these before changing code:

1. `docs/CLUVVI_V0_BUILD_SPEC.md`
2. `docs/PRODUCT_RULES.md`
3. `docs/DATA_MODEL.md`
4. `docs/PROVIDER_CONTRACTS.md`
5. `docs/EVALS.md`

## Product boundary

Cluvvi V0 finds up to 20 real potential customers worth contacting, with current evidence of need, the relevant buyer, a usable business contact route, transparent scores, sources, dates, confidence, limitations, and a recommended next action.

Phase 0 is only the durable execution skeleton. Do not add model calls, web search, candidate discovery, enrichment, scoring, or outreach until Phase 0 is proven.

## Non-negotiable engineering rules

- Ask before every design decision: would a billion-dollar company CTO accept this architecture, its failure behavior, and its maintenance cost? Refactor when the answer is no.
- First make the complete path work. Then reduce the user's cognitive load until the happy path feels obvious.
- Simple UI does not mean simplistic internals. Hide complexity behind reliable contracts.
- The model may reason later; deterministic code controls state, authorization, budgets, retries, idempotency, and deletion.
- Persist every phase. Runs must resume safely.
- All state-changing external inputs use versioned Zod schemas.
- Separate facts from inferences. Every future inference must reference evidence and state a limitation.
- Use provider adapters. Do not couple domain logic to one vendor.
- Keep secrets server-side and redact them from logs.
- Every database object is workspace scoped. Never trust a client-provided workspace ID without authorization.
- Queue handlers are idempotent. A duplicate message must not duplicate state or events.
- Every task returns tests and command evidence.
- Architecture changes require an ADR under `docs/DECISIONS/`.

## User-experience rule

The primary Phase 0 journey is linear:

`Sign in → Create workspace → Describe product → Start run → See truthful progress`

Expose one clear primary action per screen. Never show fake percentages. Never require the user to understand queues, schemas, providers, or infrastructure.
