# Provider and execution contracts

## Phase 0

Phase 0 has no AI, search, enrichment, or platform provider. It establishes the contracts those providers must later use.

## Queue message envelope

Every message contains:

- version;
- message ID;
- job type;
- run ID;
- optional entity ID;
- attempt;
- idempotency key;
- creation timestamp;
- bounded payload.

Messages are validated before handling. Unknown versions and job types fail safely.

## Tool result envelope for later phases

Every external tool result must contain status, provider, tool name, request ID, structured data, provenance, measured usage/cost, and warnings. Untracked free-form provider output never flows directly into an opportunity.

## Adapter rule

Business logic depends on capability interfaces, never concrete providers. Provider adapters own authentication, retries, timeouts, rate limits, raw response normalization, and health checks.

## Queue semantics

- Database transaction creates state and message atomically.
- Worker leases a message with a visibility timeout.
- Handler validates schema and current state.
- Successful result and audit event are persisted idempotently.
- Message acknowledgement happens last.
- Transient failure leaves the message retryable.
- Permanent malformed input is quarantined or recorded without an infinite retry loop.
