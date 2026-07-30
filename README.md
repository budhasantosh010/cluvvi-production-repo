# Cluvvi

Cluvvi is an evidence-backed buyer-discovery engine. Given a product and clear commercial boundaries, it will eventually return up to 20 real potential customers worth contacting, with current evidence of need, the relevant buyer, a usable business contact route, transparent reasoning, limitations, and sources.

This repository currently implements **Phase 0: the durable execution skeleton**. It intentionally contains no model calls, web search, enrichment, scoring, or outreach.

## What works in Phase 0

```text
Sign in
  ↓
Create workspace
  ↓
Save product mission
  ↓
Start run atomically
  ├── run row
  ├── run_created event
  └── durable pgmq message
        ↓
Worker leases and validates message
        ↓
Run moves draft → compiling
        ↓
compilation_started event is appended once
```

Duplicate run starts and duplicate worker delivery are idempotent. Tenant data is protected with Supabase Row Level Security.

## Repository map

```text
apps/web        Next.js App Router product and APIs
apps/worker     Long-running queue worker and health endpoint
packages/core   Domain schemas, state machine, queue contracts
packages/config Environment validation and capability reporting
packages/database Typed Supabase adapter and worker gateway
supabase        Local config, migrations, seed, and pgTAP tests
docs            Product rules, architecture, contracts, evaluations, ADRs
scripts         Contract smoke test and local Supabase E2E flow
```

## Requirements

- Node.js 24 or newer
- pnpm 9.15.9
- Docker Desktop running

All project files, dependencies, and generated local state remain under this repository, except Docker's normal managed runtime storage.

## First setup

```bash
pnpm install
pnpm supabase:start
pnpm supabase:status -o env
```

Copy `.env.example` to `.env.local`, then replace the local anon and service-role keys with the values printed by `supabase:status`. PowerShell:

```powershell
Copy-Item .env.example .env.local
pnpm supabase:status -o env
```

The local web app reads `.env.local` from `apps/web`, while root scripts and the worker read the repository root. Create a shared local file in both places:

```powershell
Copy-Item .env.local apps/web/.env.local
```

Never commit `.env.local`.

## Run locally

Terminal 1:

```bash
pnpm dev:web
```

Terminal 2:

```bash
pnpm dev:worker
```

Open `http://localhost:3000`, create an account, create a workspace, describe one product, and start the run. The run page refreshes from persisted events and never shows a fake percentage.

Health endpoints:

- Web: `http://localhost:3000/api/health`
- Worker: `http://127.0.0.1:3001/health`

## Verification

Fast contract smoke:

```bash
pnpm smoke
```

Quality gates:

```bash
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm test:e2e
```

Database and real local E2E:

```bash
pnpm supabase:reset
pnpm supabase:test
pnpm e2e:local
```

The local E2E creates isolated users, verifies workspace/mission/run creation, consumes the real pgmq message, confirms idempotent processing, tests cross-workspace RLS, and cleans up.

## Product and architecture rules

Start with `AGENTS.md` and the files under `docs/`. The core rule is simple: first make the complete path reliable; then make it obvious enough that a new user only needs to follow one primary action at a time.
