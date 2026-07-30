# Cluvvi V0 build specification

**Status:** source of truth  
**Customer zero:** Cluvvi's own AI video-editing SaaS  
**Primary promise:** Cluvvi finds who needs what you sell and shows the evidence.  
**Primary outcome:** Produce up to 20 real potential customers genuinely worth contacting.

## Product outcome

The user supplies a website, offer description, customer outcome, price context, geography, exclusions, and desired count. Cluvvi must:

1. understand the offer;
2. form customer, buyer, signal, and exclusion hypotheses;
3. plan bounded sources and searches;
4. build a broad candidate universe;
5. verify fit, problem, timing, volume, affordability, and recency;
6. resolve the company and relevant buyer;
7. enrich only evidence-backed shortlisted candidates;
8. score using visible dimensions and hard gates;
9. review unsupported claims;
10. return the best opportunities with sources, limitations, and next actions.

A valid final result is:

`real entity + strong fit + problem evidence + recent timing + relevant buyer + ability to pay + usable contact route + source-backed explanation`.

## V0 boundary

V0 includes authentication, workspaces, missions, website understanding, source planning, provider adapters, discovery, evidence investigation, identity resolution, buyer mapping, contact enrichment, scoring, review, export, progress, budgets, audit logs, human labels, evaluation, and automated tests.

V0 excludes automated outreach, inbox warm-up, sequences, social DMs, reply handling, meeting booking, a full CRM, billing, a global private contact database, investor/recruiting/acquisition discovery, sensitive personal data, custom model training, and unapproved autonomous execution.

## Customer-zero mission

Find 20 companies or creators showing recent evidence that they need faster long-form video editing. Start with podcast and YouTube production agencies hiring editors, then internal video teams, new podcast launches, expanding founder-led media programs, frequent talking-head creators, course companies, and agencies coordinating editors.

Strong signals include current editor vacancies, rough-cut or pause-removal duties, new shows, sharp production increases, public complaints about editing speed/cost/backlog, and commercial capacity. Mere industry membership, funding, one old video, likes, or generic comments are weak signals.

## System principles

- AI is a reasoning component, not the workflow engine or database.
- All state-changing AI output uses versioned JSON schemas and Zod.
- Providers sit behind replaceable interfaces.
- Directly observed signals and AI inferences are separate records.
- Evidence precedes buyer/contact enrichment.
- Retrieved content is untrusted data and never executable instruction.
- Runs are durable, resumable, budgeted, audited, authorized, and idempotent.

## Target architecture

- TypeScript monorepo with pnpm workspaces.
- Next.js App Router web application.
- Long-running TypeScript worker.
- Supabase Postgres, Auth, RLS, and pgmq-backed Queues.
- Shared Zod contracts and deterministic state machine.
- LiteLLM plus one initial model provider in later phases.
- One search/fetch provider, Apollo, and YouTube through adapters in later phases.
- Vitest, Playwright, Supabase database tests, and GitHub Actions.

## Build sequence

0. Durable repository and run skeleton.
1. Mission Compiler.
2. Source Planner.
3. Search and candidate universe.
4. YouTube vertical connector.
5. Evidence Investigator.
6. Buyer resolution.
7. Contact enrichment.
8. Scoring and final output.
9. Evaluation harness.
10. Hardening.

## Phase 0 ticket

Build a user-authenticated vertical slice where a person can create a workspace, save a mission, start a run, and see a worker consume a durable queue message and persist an idempotent state transition with a complete event trail.

In scope: pnpm monorepo, Next.js app, TypeScript worker, Supabase, Auth, workspace/mission/run/run-event migrations, pgmq queue, shared schemas, environment validation, health checks, tests, CI, and local documentation.

Out of scope: model calls, website understanding, search, candidates, enrichment, scoring, and outreach.

### Acceptance criteria

1. Local setup is documented.
2. A user can authenticate.
3. A user can create a workspace.
4. A user can create a mission.
5. Starting a run atomically creates the run, first event, and durable message.
6. A worker consumes the message.
7. The run moves through an allowed state transition.
8. `run_events` records the transition.
9. Duplicate delivery does not duplicate transitions.
10. RLS prevents cross-workspace access.
11. Formatting, lint, type checking, tests, builds, and CI pass.
