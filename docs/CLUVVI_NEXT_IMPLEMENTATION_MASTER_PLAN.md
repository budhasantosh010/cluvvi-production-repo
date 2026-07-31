# Cluvvi Next Implementation Master Plan

**Current baseline:** C0.6 command-first local browser application

**Verified C0.6 commit:** `6cf2af9f9d0f96897dcd04ac0d7781e24ffc2d51`

**Active implementation:** C0.7 composer polish + C1-A deterministic mission understanding

**Public repository:** `https://github.com/budhasantosh010/cluvvi-production-repo.git`

**Local application:** `http://localhost:3100`

This document is the source-controlled execution summary of the product plan supplied on July 30, 2026. The complete user-provided plan remains the authority when this summary is ambiguous.

## Product promise

Cluvvi finds who needs what you sell—and shows you the evidence.

The company-level success question is:

> Can Cluvvi produce twenty real potential customers that a human genuinely believes are worth contacting?

A final opportunity eventually requires a real company or person, product fit, observable evidence of need, relevant timing, the right buyer, a usable business contact route, source URLs, confidence, and limitations.

## Non-negotiable architecture

```text
CLI ───────┐
           │
Browser ───┼──→ Application Service ──→ CluvviEngine ──→ CluvviStore
           │
Future API ┘
```

- There is one authoritative `CluvviEngine`.
- React owns presentation, not business decisions, SQL, files, or state transitions.
- Route handlers stay thin and contain no SQL or long-running engine work.
- Application code owns state, budgets, retries, persistence, validation, and stage completion.
- Provider integrations sit behind interfaces.
- Facts and inferences are stored and displayed separately.
- Fixture and live modes are explicit; live mission understanding must never flow into fixture discovery.

## Ordered roadmap

1. **G0** — Secure and push the verified baseline.
2. **C0.6** — Command-first homepage.
3. **C0.7** — Smaller, vertically resizable landing composer.
4. **C1-A** — Typed deterministic mission understanding and unexecuted search-query plan.
5. **C1-B** — Bounded source-backed mission understanding with approval.
6. **C2** — Approved-source query execution planning.
7. **C3** — First real discovery slice.
8. **C4** — Evidence investigator.
9. **C5** — Buyer identification.
10. **C6** — Contact enrichment.
11. **C7** — Deterministic opportunity scoring and review.
12. **C8** — Human evaluation and improvement loop.

Each phase uses its own branch, outcome, gate, commit, push, and review. Do not combine phases.

## G0 — Public baseline

Required outcomes:

- Audit tracked files and reachable history for credentials.
- Ignore local databases, `.cluvvi`, environment secrets, builds, test outputs, logs, IDE files, and OS artifacts.
- Keep `.env.example` placeholder-only.
- Publish `main` to the public repository.
- Verify local and remote SHAs and a clean working tree.

Actual repository history contained a harmless GitHub placeholder commit. The verified Cluvvi baseline remains preserved in public history and `main` was advanced without destructive history replacement. See `docs/FAILURES_AND_LIMITATIONS.md`.

## C0.6 — Command-first homepage

**Branch:** `feature/c0-6-command-home`  
**Commit message:** `feat: redesign Cluvvi home around customer-finding command`

### Required experience

- Headline: **Let’s find your customers.**
- Supporting copy: **Tell Cluvvi what you sell. It finds companies showing evidence they need it.**
- One dominant central composer.
- Placeholder: **Describe what you sell or paste your website**.
- Compact website, geography, opportunity-count, advanced, and submit controls.
- Progressive optional context.
- Three example prompt chips.
- Simplified recent runs below the primary interface.
- Honest, secondary fixture-mode disclosure.
- Responsive desktop and mobile behavior at 320px and above.

### Canonical mission mapping

The composer must submit the existing `MissionInputSchemaV1` fields:

- `description`
- `website`
- `geographies`
- `desiredOpportunities`
- `customerOutcome`
- `price`
- `exclusions`
- `goodCustomerExamples`
- `badCustomerExamples`
- `capacityNotes`
- `additionalContext`

Do not introduce a second mission contract.

### URL behavior

- Text only → complete text remains `description`.
- URL only → URL becomes `website`; require a real human description before submit.
- Text plus URL → preserve original text and suggest the detected website.
- Detection never auto-submits.

### Reuse requirements

C0.6 must reuse:

- `POST /api/runs`
- the application service
- SQLite atomic run/request creation
- submission idempotency
- the local runner
- the existing engine
- artifact handling
- CLI behavior
- fixture regression mode
- localhost port 3100

No database migration, AI, search, enrichment, scoring, outreach, Supabase activation, authentication, or deployment belongs in C0.6.

### Accessibility and interaction

- Correct labels and visible focus.
- `Ctrl+Enter` / `Cmd+Enter` submits; normal Enter inserts a newline.
- Escape closes popovers and returns focus.
- Errors link to their fields.
- Minimum 44px touch targets.
- Status is not color-only.
- Reduced motion is respected.
- Mobile controls and popovers remain inside the viewport.

### C0.6 acceptance gate

- Command-first headline and dominant composer are present.
- Canonical schema, API, service, idempotency, CLI, engine, and fixture flow remain intact.
- Advanced fields remain available.
- Recent runs are secondary and show at most five entries.
- Mobile has no horizontal overflow.
- Fixture mode remains honest.
- Prettier passes.
- ESLint passes with zero warnings.
- Strict TypeScript passes.
- All current tests pass.
- Focused browser tests pass.
- Production builds pass.
- Visual QA screenshots are captured and inspected.
- Scope-leak and diff checks pass.
- Feature branch is pushed and the working tree is clean.
- Stop for visual approval. Do not begin C1.

## C0.7 + C1-A — Composer polish and deterministic mission understanding

**Branch:** `feature/c0-7-c1-a-mission-understanding`

C0.7 narrows the landing composer to 720px and gives its textarea a compact 96–112px default height, a 256px maximum height, and vertical-only resizing.

C1-A reuses the existing compilation phase, generic artifact persistence, local runner, idempotency, and run-detail page. It produces `mission_understanding.v1` with:

- normalized mission inputs;
- product category, value proposition, likely sales motion, and confidence;
- three to eight buyer hypotheses;
- pain, competitor, workaround, and exclusion keywords;
- eight deterministic intent signals;
- a source plan including Reddit, job posts, web search, company websites, reviews, Product Hunt, Hacker News, and manual-only LinkedIn research;
- 25–60 trimmed, deduplicated search queries;
- explicit risks, unknowns, and next steps.

The artifact is persisted as `01-mission-understanding.json`, displayed as a specialized run-detail section, and remains available through the generic JSON artifact viewer. Search queries are generated but not executed. No migration, model call, website fetch, crawling, candidate discovery, enrichment, scoring, or outreach belongs in C1-A.

## C1-B — Source-backed mission understanding

Begin only after C1-A is approved and merged.

**Branch:** `feature/c1-b-source-backed-mission-understanding`

**Commit message:** `feat: add source-backed Cluvvi mission understanding`

Required high-level flow:

```text
Browser mission
→ bounded SSRF-safe website ingestion
→ source-document persistence
→ provider-independent structured model gateway
→ validated, provenance-aware interpretation
→ awaiting interpretation approval
→ review / approve / correct / regenerate
→ stop
```

C1 must not add market search, candidate discovery, Apollo, YouTube, enrichment, scoring, outreach, Supabase, authentication, or deployment. Fixture mode remains deterministic for regression and CI.

## Future phases

- **C2:** Versioned bounded source plans only; no search execution.
- **C3:** One real provider and one strong signal family; first ten real candidate companies.
- **C4:** Source-backed passed/rejected/uncertain investigation.
- **C5:** Current, relevant buyer identification; do not default to CEO.
- **C6:** Enrich only investigated candidates; never guess emails.
- **C7:** Deterministic scoring with hard gates and limitations.
- **C8:** Human labels and `Precision@20`; no outreach before quality threshold.

## Git workflow

Before each future phase:

```powershell
git checkout main
git pull --ff-only origin main
git checkout -b feature/<phase-name>
```

After implementation:

```powershell
git status
git diff --check
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

Run the relevant Playwright suite and scope-leak checks, update the failure ledger, commit once, push once, verify local/remote SHA, and confirm a clean working tree.
