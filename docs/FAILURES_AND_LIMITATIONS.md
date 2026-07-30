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

# Remaining limitation

The repository contains the complete Supabase migration, pgTAP schema/flow/RLS tests, and a real local end-to-end script, but those database-backed checks were not executed because local Supabase requires Docker-managed files outside the requested project folder.

The verified in-repository checks are:

- Formatting: passed.
- ESLint: passed with zero warnings.
- Strict TypeScript: passed across all packages and apps.
- Unit/integration tests: 16 passed.
- Contract smoke test: passed, including duplicate-delivery behavior.
- Production build: passed for shared packages, worker, and Next.js web app.
