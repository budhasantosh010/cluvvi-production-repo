# Cluvvi Next Implementation Master Plan

**Current baseline:** C0.6 command-first local browser application

**Verified C0.6 commit:** `6cf2af9f9d0f96897dcd04ac0d7781e24ffc2d51`

**Active implementation:** C1-C through C1-F Downstream Fixture Pipeline after completed C1-0.1 V2 amendment

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

## Current status after C0.9

- C0 application foundation: complete for the current local fixture-mode scope.
- C0.7 + C1-A deterministic Mission Understanding: complete.
- C0.8 tactile interaction polish: complete.
- C0.9 Apple-style flow choreography: complete.
- C1-0 Discovery Architecture Freeze: complete at `c4e7b3567159bff23f621e80c3f24b1ff283d3db`.
- C1-B Standalone Discovery Engine fixture scaffold: complete in the separate Project A repository at `d1891db5d53736299200874a41ae34f95025073d`.
- C1-0.1 Search Results V2 Contract Amendment: complete at `4cec85b32d5ac5a83d89f7fd880d2de22ffa5761`.
- C1-C Evidence Engine fixture-contract version: implemented in the current Project B branch.
- C1-D Identity + Enrichment fixture-contract version: implemented with role hypotheses and public manual routes only.
- C1-E Opportunity Ranker: implemented with a transparent deterministic scorecard and negative/stale penalties.
- C1-F Buyer Map Output: implemented with citations, risks, warnings, coverage gaps, and responsive browser presentation.
- C1-G Project A runtime bridge: not started.

Cluvvi now understands and plans, independently validates synthetic V2 discovery artifacts, and runs the fixture downstream intelligence pipeline through one durable engine. It still does not discover real customers or call Project A at runtime.

## Ordered roadmap

1. **G0** — Secure and push the verified baseline.
2. **C0.6** — Command-first homepage.
3. **C0.7** — Smaller, vertically resizable landing composer.
4. **C1-A** — Typed deterministic mission understanding and unexecuted search-query plan.
5. **C0.8** — CSS-first tactile interaction polish.
6. **C0.9** — Apple-style main-flow choreography.
7. **C1-0** — Discovery Architecture Freeze.
8. **C1-B** — Standalone Discovery Engine fixture scaffold.
9. **C1-0.1** — Search Results V2 Contract Amendment.
10. **C1-C** — Evidence Engine fixture-contract version consuming V2.
11. **C1-D** — Identity + Enrichment fixture-contract version preserving V2 lineage.
12. **C1-E** — Opportunity Ranker over fixture-derived evidence.
13. **C1-F** — Buyer Map Output with fixture labeling and V2 citations.
14. **C1-G** — Approved runtime bridge from standalone Project A V2 output into Cluvvi.
15. **C2** — First researched live discovery providers and approved integration path.
16. **C3** — First real discovery slice.
17. **C4** — Human evaluation and improvement loop.

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

## C0.8 — Tactile interaction polish

**Branch:** `feature/c0-8-tactile-polish`

C0.8 adds one CSS-first interaction system without changing the product architecture or installing an animation dependency. It includes shared easing/duration tokens, tactile press/hover states, stable submit-button geometry, immediate `Starting run…` and `Opening run…` feedback, a lightweight loading dot, smooth composer/menu/popover transitions, subtle recent-row and artifact-tab affordances, a running-stage pulse, and explicit reduced-motion overrides.

C0.8 must not add fake delays, page-transition libraries, Framer Motion, Lottie, engine/core/storage changes, migrations, providers, website ingestion, query execution, candidate discovery, enrichment, scoring, or outreach. Browser verification must prove immediate busy state, no button resize, reduced-motion behavior, and no horizontal overflow on mobile.

## C0.9 — Apple-style main-flow choreography

**Branch:** `feature/c0-9-apple-flow-choreography`

C0.9 preserves the C0.8 visual language and makes the existing local flow feel continuous:

```text
pointer down
→ composer commits immediately
→ Creating your run locally…
→ Run created. Opening details…
→ run summary and stage timeline
→ Mission Understanding
```

C0.9 adds a tiny reusable pointer-state hook for the primary composer controls, scoped `data-pressed` styling, form-level `idle | creating | opening` state, a reserved-height accessible status row, truthful opening continuity without artificial delay, honest first-paint Mission Understanding/artifact placeholders, clearer running/reused stage labels, and screenshot-only removal of Next.js development UI. The route, API, engine, persistence, idempotency, and C1-A artifact remain unchanged.

UI/UX references reviewed for C0.9: UI Skills Motion, Emil Kowalski Skills, Kinetics, OriginKit, Colorion Animated Buttons/Text Effects, Tabler Icons, Component Gallery, NameThatUI, Uiverse, Beautiful UI, AIcss, Arlan Vault, Bag UI. These were used as references only; Cluvvi keeps its native lightweight interaction system.

C0.9 must not install a UI or motion library, animate layout dimensions, add artificial waiting, claim live discovery, execute queries, ingest websites, add providers, or change engine/core/storage/API contracts. Browser verification must prove pointer-down feedback, creating/opening continuity, stable geometry, truthful copy, reduced-motion behavior, Mission Understanding visibility, and no mobile overflow.

## C1-0 — Discovery Architecture Freeze

**Branch:** `feature/c1-0-discovery-architecture-freeze`

**Status:** Complete at `c4e7b3567159bff23f621e80c3f24b1ff283d3db`.

C1-0 historically froze:

- the six connected engines;
- Discovery Engine as the next bottleneck;
- the separate project location `C:\Users\Lenovo\Music\Startups\Cluvvi\Separate Discovery engine`;
- free, paid, manual, and fixture provider categories;
- `free_only`, `balanced`, and `paid_deep` discovery modes;
- the earlier basic `search_results.v1` bridge contract;
- the Track A / Track B parallel build plan;
- the human provider-research template.

The frozen V1 contract remains unchanged and separately valid. C1-0 was documentation and planning only; it added no providers, APIs, crawlers, runtime behavior, dependencies, or migrations.

## C1-B — Standalone Discovery Engine fixture scaffold

**Target project:** `C:\Users\Lenovo\Music\Startups\Cluvvi\Separate Discovery engine`

**Status:** Complete in Project A at `d1891db5d53736299200874a41ae34f95025073d` on `feature/c1-b-standalone-discovery-scaffold`.

Project A implements:

- `SearchResultsArtifactV2`;
- `NormalizedDiscoveryResultV2`;
- `schemaVersion: "2.0"`;
- `artifactKind: "search_results.v2"`;
- deterministic request compilation, domain packs, Source Atlas planning, fixture execution, normalization, dedupe, coverage, CLI, examples, benchmark, and tests.

The scaffold is fixture-only. It adds no live provider, network request, crawler, scraper, browser automation, LLM, database, Cluvvi import, enrichment, scoring, outreach, auth, billing, or V1-to-V2 adapter.

## C1-0.1 — Search Results V2 Contract Amendment

**Status:** Complete at `4cec85b32d5ac5a83d89f7fd880d2de22ffa5761`.

C1-0.1 preserves the frozen V1 contract, documents V2 as the expanded non-backward-compatible universal discovery-run contract, and reserves—but does not implement—a future V1-to-V2 adapter boundary.

## C1-C — Evidence Engine fixture-contract version

**Status:** Implemented in `feature/c1-c-to-c1-f-downstream-fixture-pipeline`.

Consumes validated, clearly labeled fixture `search_results.v2` and produces `evidence_findings.v1`. It preserves result/query IDs, URLs, provider provenance, `sourceZone`, `searchMethod`, `signalIntent`, citations, warnings, and coverage limitations while separating positive, negative, weak, stale, and risk evidence.

## C1-D — Identity + Enrichment fixture-contract version

**Status:** Implemented in `feature/c1-c-to-c1-f-downstream-fixture-pipeline`.

Consumes evidence findings and produces `identity_enrichment.v1` with role hypotheses and public/manual contact-route suggestions only. It does not guess private contacts, identify real people, scrape LinkedIn, or add paid enrichment.

## C1-E — Opportunity Ranker

**Status:** Implemented in `feature/c1-c-to-c1-f-downstream-fixture-pipeline`.

Produces `ranked_opportunities.v1` using an explicit deterministic scorecard over pain, recency, hiring, workaround, company identity, manual contactability, exclusions, and weak/stale evidence. It does not reinterpret provider `raw` payloads or erase V2 coverage limitations.

## C1-F — Buyer Map Output

**Status:** Implemented in `feature/c1-c-to-c1-f-downstream-fixture-pipeline`.

Produces `buyer_map.v1` and a responsive run-page presentation of ranked fixture opportunities, evidence, buyer rationale, public manual routes, confidence, score components, risks, limitations, citations, and coverage gaps. Fixture-derived output remains explicitly labeled and is never presented as live customers or complete market coverage.

## C1 V1/V2 compatibility boundary

- V1 and V2 validate independently.
- V1 remains unchanged and separately valid.
- C1-C through C1-F consume fixture V2, not V1.
- A V2 consumer must reject V1 rather than guess missing planning or coverage data.
- No V1-to-V2 adapter exists in C1-0.1 or Project B.
- A future adapter requires a separate reviewed mapping, provenance rules, and tests.
- Cluvvi must not create a permanent runtime import or filesystem dependency on the standalone Project A repository.

The final compatibility gate has passed locally:

1. Project A validates its V2 artifact.
2. Project B validates the same byte-identical artifact with an independent Cluvvi V2 schema.
3. The Evidence Engine consumes validated V2 and preserves citations and limitations.
4. Frozen V1 remains unchanged and separately valid.

## Future phases

- **C1-G:** Add an approved runtime bridge from standalone Project A V2 output into Cluvvi without importing provider implementations.
- **C2:** Research and approve the first live discovery providers and integration path.
- **C3:** Execute a narrow real discovery slice with preserved provenance.
- **C4:** Human evaluation and improvement loop; no outreach before quality thresholds are proven.

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
