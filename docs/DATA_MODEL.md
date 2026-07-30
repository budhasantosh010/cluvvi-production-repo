# Data model

Cluvvi does not use a giant `leads` table. Different concepts remain different records.

## Phase 0 tables

### `workspaces`

Tenant boundary and owner identity.

### `workspace_memberships`

Explicit user-to-workspace authorization. Roles begin with `owner`, `admin`, and `member`.

### `missions`

What the user wants Cluvvi to find: website, offer, customer outcome, price context, geography, exclusions, desired count, and status.

### `runs`

One durable execution attempt for a mission. Includes workspace scope, status, phase, requested count, limits, budgets, actual usage, timestamps, failure details, and a creation idempotency key.

### `run_events`

Append-only audit trail. Every state transition records from/to state, event type, actor, metadata, and an idempotency key.

## Later V0 records

`mission_interpretations`, `source_plans`, `search_jobs`, `source_documents`, `accounts`, `people`, `signals`, `inferences`, `buying_roles`, `contact_routes`, `opportunities`, `evaluation_labels`, and `tool_call_logs` arrive in their build phases.

## Invariants

- Every tenant-owned record carries `workspace_id` directly, even where it can be derived, so RLS and operational queries remain explicit and fast.
- `runs.workspace_id` must equal the mission's workspace.
- Events are append-only and workspace scoped.
- State transitions are validated against the domain state machine.
- Idempotency keys are unique within the boundary where repeating work would be harmful.
- Client roles cannot directly write run state or events; security-definer RPCs and the service worker enforce transitions.
