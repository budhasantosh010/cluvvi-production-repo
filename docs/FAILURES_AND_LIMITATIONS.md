# Phase 0 Failures and Limitations

This document records every meaningful failure encountered while building Cluvvi Phase 0, what caused it, what was tried, what changed, and the shortest correct solution.

## 1. Supabase CLI was not globally installed

**What failed:** The machine did not have a global `supabase` command available.

**Where:** Initial repository/toolchain inspection.

**When:** Before implementation.

**Why:** The environment had Node, pnpm, and Docker, but no globally installed Supabase CLI.

**How it appeared:** Toolchain check returned `supabase=missing`.

**What was tried:** Added the Supabase CLI as a pinned project dependency and exposed it through package scripts.

**Current status:** Resolved inside the repository.

**One-line solution:** Use the pinned local Supabase CLI through `pnpm supabase:*` scripts instead of relying on a global install.

## 2. TypeScript and ESLint versions exceeded Next.js peer support

**What failed:** Initial dependency installation produced peer-dependency warnings.

**Where:** Root package installation.

**When:** First `pnpm install`.

**Why:** TypeScript 7 and ESLint 10 were newer than the versions supported by the current Next.js lint stack.

**How it appeared:** `@typescript-eslint` rejected TypeScript 7 and several Next lint plugins rejected ESLint 10.

**What was tried:** Checked compatible published versions and pinned TypeScript 5.9.3 and ESLint 9.39.5.

**Current status:** Resolved.

**One-line solution:** Pin the newest mutually supported toolchain versions instead of using latest releases blindly.

## 3. ESLint type-aware rules lacked project configuration

**What failed:** ESLint could not run type-aware rules and incorrectly assumed a root-level Pages Router.

**Where:** `eslint.config.mjs`.

**When:** First lint run.

**Why:** Type-aware TypeScript rules require project-service configuration, and Next's `no-html-link-for-pages` rule assumed a root `pages/` directory.

**How it appeared:** ESLint threw parser-service errors and a Pages directory error.

**What was tried:** Added project-service configuration, scoped typed rules to TypeScript files, and disabled only the irrelevant Pages Router rule.

**Current status:** Resolved; lint passes with zero warnings.

**One-line solution:** Configure typed linting explicitly for a monorepo and disable only framework rules that do not match the chosen router.

## 4. Package TypeScript `rootDir` excluded tests

**What failed:** Type checking rejected test files outside `src`.

**Where:** `packages/core/tsconfig.json`, `packages/config/tsconfig.json`, `packages/database/tsconfig.json`, and `apps/worker/tsconfig.json`.

**When:** First monorepo typecheck.

**Why:** Each package declared `rootDir: "src"` while also including `tests/**/*.ts`.

**How it appeared:** TypeScript error TS6059.

**What was tried:** Removed the unnecessary `rootDir` restriction while preserving strict checking.

**Current status:** Resolved.

**One-line solution:** Do not constrain `rootDir` to `src` when package tests are part of the same TypeScript program.

## 5. Shared config package depended on NodeJS namespace

**What failed:** The environment-validation package could not find `NodeJS.ProcessEnv`.

**Where:** `packages/config/src/index.ts`.

**When:** Monorepo typecheck.

**Why:** The package was intended to remain runtime-neutral but its public API referenced Node-specific types.

**How it appeared:** TypeScript errors for missing `NodeJS` namespace.

**What was tried:** Replaced `NodeJS.ProcessEnv` with a portable readonly string-record type.

**Current status:** Resolved.

**One-line solution:** Keep shared configuration contracts platform-neutral and add Node types only in Node-specific packages.

## 6. Worker imported `process` incorrectly

**What failed:** Worker type checking rejected the named import from `node:process`.

**Where:** `apps/worker/src/index.ts`.

**When:** Worker typecheck.

**Why:** `node:process` exposes the process object as the default export, not a named `process` export.

**How it appeared:** TypeScript error TS2305.

**What was tried:** Changed the import to `import process from "node:process"`.

**Current status:** Resolved.

**One-line solution:** Import Node's process object as the default export or use the global.

## 7. Vitest 4.1.10 failed to start under the installed package layout

**What failed:** The test runner crashed before executing tests.

**Where:** Root `pnpm test`.

**When:** First test run.

**Why:** Vitest 4.1.10 attempted to resolve the internal `#module-evaluator` package import incorrectly in this installed layout.

**How it appeared:** `ERR_PACKAGE_IMPORT_NOT_DEFINED`.

**What was tried:** Inspected the installed package metadata and pinned Vitest and its coverage plugin to 4.0.18.

**Current status:** Resolved; all 16 tests pass.

**One-line solution:** Pin Vitest and its coverage package to the same known-working version.

## 8. TypeScript 6 broke declaration builds through a deprecated inherited option

**What failed:** `tsup` declaration generation stopped the production build.

**Where:** Shared package builds.

**When:** First production build.

**Why:** TypeScript 6 promoted an inherited `baseUrl` deprecation into a build error inside the declaration toolchain.

**How it appeared:** TypeScript error TS5101 during DTS generation.

**What was tried:** Verified no repository config explicitly depended on `baseUrl`, then pinned the stable supported TypeScript 5.9.3 release.

**Current status:** Resolved.

**One-line solution:** Use TypeScript 5.9.3 until the declaration toolchain fully supports TypeScript 6.

## 9. Worker build used an unsupported `tsup --bundle` flag

**What failed:** Worker production build stopped immediately.

**Where:** `apps/worker/package.json`.

**When:** Production build.

**Why:** The installed tsup version bundles by default and does not expose `--bundle` as a CLI flag.

**How it appeared:** `CACError: Unknown option --bundle`.

**What was tried:** Removed the redundant flag.

**Current status:** Resolved.

**One-line solution:** Use tsup defaults and specify only format, platform, target, and clean options.

## 10. Next.js tried to prerender authenticated pages without environment keys

**What failed:** Production build crashed while prerendering `/sign-in` and `/`.

**Where:** Next.js App Router pages.

**When:** Production build without local Supabase environment variables.

**Why:** Authenticated request-time pages validated Supabase keys during static prerendering.

**How it appeared:** Zod errors for missing `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`.

**What was tried:** Marked authentication-dependent routes and layouts as dynamic request-time pages.

**Current status:** Resolved; production build passes without pretending runtime configuration exists.

**One-line solution:** Force request-time rendering for pages whose behavior depends on authenticated runtime services.

## 11. Next.js inferred the wrong monorepo root

**What failed:** Build emitted a workspace-root warning because another lockfile existed higher on the machine.

**Where:** `apps/web/next.config.ts`.

**When:** Production build.

**Why:** Next.js inferred `C:\Users\Lenovo` as the workspace root due to an unrelated parent lockfile.

**How it appeared:** Turbopack and output-file-tracing root warning.

**What was tried:** Explicitly configured the repository root in Next.js.

**Current status:** Resolved.

**One-line solution:** Set `turbopack.root` and `outputFileTracingRoot` explicitly in monorepos.

## 12. Docker Desktop was not running

**What failed:** Local Supabase could not start.

**Where:** Local database verification.

**When:** First `pnpm supabase:start`.

**Why:** Docker Desktop's Linux engine was not active.

**How it appeared:** Docker named-pipe connection error.

**What was tried:** Started Docker Desktop and confirmed the engine became ready.

**Current status:** Docker was deliberately stopped afterward.

**One-line solution:** Start Docker Desktop before running local Supabase verification.

## 13. Supabase first startup required global Docker-managed storage

**What failed:** The requested "nothing outside this folder" constraint conflicted with local Supabase runtime behavior.

**Where:** Local Supabase/Docker verification.

**When:** Supabase began pulling container images.

**Why:** Docker stores images, layers, and volumes in Docker Desktop's managed global storage, even when project files remain inside the repository.

**How it appeared:** Docker started downloading Supabase service images outside the project folder's filesystem tree.

**What was tried:** Stopped the Supabase process and Docker Desktop immediately after the conflict was recognized.

**Current status:** Real local migration, pgTAP RLS tests, and database-backed end-to-end proof were not executed.

**One-line solution:** Allow Docker-managed storage for local Supabase testing, or run the migration against an approved hosted/staging Supabase project.

## 14. Supabase startup exceeded the command execution window

**What failed:** The first startup command timed out before services were created.

**Where:** Local Supabase verification.

**When:** First image pull and container initialization.

**Why:** Initial Supabase container downloads exceeded the command tool's execution window.

**How it appeared:** Command timeout followed by no database container in status output.

**What was tried:** Restarted it as a background process with debug output; then stopped it because of the storage-location conflict above.

**Current status:** Not retried.

**One-line solution:** Run the first Supabase startup interactively with Docker storage explicitly approved.

## 15. Smoke script used top-level await in a CommonJS transform context

**What failed:** `pnpm smoke` could not compile.

**Where:** `scripts/smoke-phase0.ts`.

**When:** Final architecture review.

**Why:** `tsx` transformed the root script using a CommonJS output context where top-level await was unsupported.

**How it appeared:** Esbuild transform errors at both top-level await lines.

**What was tried:** Wrapped the script in an async `main()` function.

**Current status:** Resolved; smoke proof shows one processed delivery and one duplicate delivery.

**One-line solution:** Use an explicit async entry function for portable command-line scripts.

# Historical Phase 0 limitation

The parked Supabase implementation still contains migrations and database-backed tests that were not executed because its local runtime requires Docker-managed files outside the requested project folder. C0 no longer depends on that runtime.

# C0 failures and decisions

## 16. Native SQLite package installation was approval-gated

**What failed:** Installing the initially selected `better-sqlite3` dependency could not proceed automatically.

**Where:** C0 storage-package setup.

**When:** Immediately before the first C0 typecheck.

**Why:** The Harness requires operator approval for package installation, and C0 needed to stay on the fastest single implementation track.

**How it appeared:** `pnpm install --frozen-lockfile=false` returned an approval-required response instead of installing the package.

**What was tried:** The storage boundary was preserved while the adapter was changed to Node 24's built-in `node:sqlite`, removing the new external dependency.

**Current status:** Resolved for C0; no package installation is required.

**One-line solution:** Use built-in `node:sqlite` for C0 and reassess a stable external adapter only when measured limitations justify it.

## 17. Local run contracts collided with parked Phase 0 export names

**What failed:** Strict TypeScript reported duplicate exports for run status and run-event contracts.

**Where:** `packages/core/src/index.ts` exports from the parked Phase 0 and active C0 contract modules.

**When:** First C0 typecheck.

**Why:** Both generations initially exported generic names such as `RunStatusSchema` and `RunEventSchema`.

**How it appeared:** TypeScript `TS2308` duplicate-export errors.

**What was tried:** Active C0 contracts were renamed explicitly to `LocalRunStatusSchema`, `LocalRunEventSchema`, and `LocalRunEvent`.

**Current status:** Resolved; both generations can coexist without ambiguous public contracts.

**One-line solution:** Prefix active local contracts with `Local` while parked cloud contracts remain preserved.

## 18. Node SQLite rows required explicit boundary casting

**What failed:** Strict TypeScript rejected direct casts from generic SQLite output records to typed adapter rows.

**Where:** `packages/storage/src/sqlite/sqlite-store.ts` list queries.

**When:** Second C0 typecheck.

**Why:** `node:sqlite` correctly types query output as generic records and cannot infer the adapter's SQL column shape.

**How it appeared:** Five `TS2352` conversion errors on `.all()` results.

**What was tried:** Casts were isolated at the storage boundary through `unknown`, followed by Zod validation when rows become domain objects.

**Current status:** Resolved; no cast escapes the SQLite adapter.

**One-line solution:** Keep unavoidable SQL row casts inside the adapter and validate mapped domain records immediately.

## 19. Engine package had an unnecessary direct Zod dependency

**What failed:** The engine package could not resolve its direct `zod` import without creating new workspace links.

**Where:** `packages/engine/src/stage.ts` and `packages/engine/src/placeholder-stages.ts`.

**When:** Third C0 typecheck.

**Why:** The engine only needed a runtime `parse()` contract, not ownership of the validation library.

**How it appeared:** TypeScript `TS2307` module-resolution errors.

**What was tried:** Replaced the direct import with a minimal `RuntimeSchema<T>` interface and consumed schemas exported by `@cluvvi/core`.

**Current status:** Resolved; validation ownership is clearer and the engine has one fewer dependency.

**One-line solution:** Depend on schema behavior through `parse()` rather than coupling the engine to Zod directly.

## 20. Node SQLite emits an experimental-feature warning

**What happened:** Successful CLI and test commands print an experimental warning for `node:sqlite`.

**Where:** Every process that opens the C0 SQLite database.

**When:** Tests and real CLI execution under Node.js 24.14.1.

**Why:** Node currently labels the built-in SQLite API experimental even though the required C0 behavior works.

**How it appears:** `ExperimentalWarning: SQLite is an experimental feature and might change at any time`.

**What was tried:** The warning was left visible rather than hidden because it does not affect correctness and replacing the adapter now would require unnecessary dependency work.

**Current status:** Known limitation; all C0 storage tests and CLI flows pass.

**One-line solution:** Keep SQLite isolated behind `CluvviStore` so the adapter can be replaced without changing the engine if Node's API becomes unsuitable.

## 21. Harness and DevSpace connectors became temporarily unreachable

**What failed:** Final verification and commit commands could not be executed through either local coding connector.

**Where:** ChatGPT Harness command execution and the DevSpace fallback.

**When:** After the last lint fix and before the final consolidated gate.

**Why:** The Harness Tailscale endpoint returned connection failures, while DevSpace returned an OAuth `503 Service Unavailable` response.

**How it appeared:** Repeated tool calls returned `mcp_network_error: Connection failed`; the fallback could not authenticate.

**What was tried:** Retried the primary connector, attempted the available DevSpace fallback, stopped without making unverified claims, and resumed once the primary connector recovered.

**Current status:** Resolved externally; the final gate subsequently completed successfully.

**One-line solution:** Restore the local connector service, reopen the same task and workspace, then rerun the unchanged final gate.

## 22. PowerShell rejected the Bash-style command separator

**What failed:** The first resumed final-gate command did not start formatting or checks.

**Where:** Windows PowerShell command execution.

**When:** Immediately after the Harness connector recovered.

**Why:** That PowerShell version does not accept `&&` as a statement separator.

**How it appeared:** Parser error: `The token '&&' is not a valid statement separator in this version.`

**What was tried:** Replaced `&&` with PowerShell-safe sequencing and an explicit `$LASTEXITCODE` guard.

**Current status:** Resolved; the complete gate passed.

**One-line solution:** Use `; if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE };` for fail-fast sequencing in this PowerShell environment.

## 23. New ledger text failed the formatting check

**What failed:** The first post-edit formatting check rejected this Markdown file.

**Where:** `docs/FAILURES_AND_LIMITATIONS.md`.

**When:** After documenting the recovered connector and PowerShell failures.

**Why:** The new Markdown had not yet been normalized by the repository's Prettier configuration.

**How it appeared:** `pnpm format:check` named this file and exited with code 1 before the scope search ran.

**What was tried:** Ran Prettier only on the changed ledger file, then reran the formatting and scope checks.

**Current status:** Resolved.

**One-line solution:** Format the edited Markdown file before rerunning the repository formatting gate.

## 24. Harness rejected a skipped task-state transition

**What failed:** The first task-closure call tried to move directly from `new` to `review_ready` and was rejected.

**Where:** Harness task lifecycle management for `T-907799ff70ef266e51f1dd67`.

**When:** After the C0 commit and clean-tree verification.

**Why:** The Harness requires every lifecycle transition to proceed in sequence.

**How it appeared:** `Illegal transition new → review_ready.`

**What was tried:** Advanced through `discovering`, `planning`, `implementing`, and `validating` before entering `review_ready`.

**Current status:** Resolved; the task reached `review_ready`.

**One-line solution:** Advance Harness tasks through each required lifecycle state instead of skipping directly to review-ready.

## 25. Harness refused task completion before turn publication

**What failed:** The first `finish_task` call was rejected even though the task was review-ready and fully verified.

**Where:** Harness task completion for `T-907799ff70ef266e51f1dd67`.

**When:** After all six task steps were marked complete.

**Why:** The Harness requires observed tool calls to be published to the task turn ledger before completion.

**How it appeared:** `[TURN_UNPUBLISHED] 153 observed tool calls have not been published.`

**What was tried:** Prepared the final result and evidence, published the completed work to the turn ledger, then retried task completion.

**Current status:** Resolved by following the required publication order.

**One-line solution:** Call `publish_turn` before `finish_task` whenever the current task has unpublished observed tool calls.

# Current C0 verification status

- No Docker, Supabase, or authentication is required by the active path.
- Strict TypeScript passes across all nine workspace projects.
- Unit and integration tests pass, including SQLite migrations, complete fixture execution, failure/resume, and fingerprint idempotency.
- The real CLI fixture run completes all eleven stages.
- A simulated investigation failure resumes from persisted state and reuses the first five completed stages.
- All C0 output is visibly marked as fixture data and is never presented as real customer discovery.
