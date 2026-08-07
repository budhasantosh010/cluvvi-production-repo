import { spawn, spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { cp, rm, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { resolve } from "node:path";

const root = process.cwd();
const rootRequire = createRequire(resolve(root, "package.json"));
const webRequire = createRequire(resolve(root, "apps", "web", "package.json"));
const tsxBinary = rootRequire.resolve("tsx/cli");
const nextBinary = webRequire.resolve("next/dist/bin/next");
const playwrightBinary = rootRequire.resolve("@playwright/test/cli");
const sourceFixtureProject = resolve(root, "tests", "fixtures", "local-discovery-engine");
const cluvviHome = resolve(root, ".cluvvi-test", `browser-hiring-${process.pid}`);
const fixtureProject = resolve(root, "tests", "fixtures", `.browser-hiring-fixture-${process.pid}`);
const port = 34_000 + (process.pid % 1_000);
const baseUrl = `http://127.0.0.1:${port}`;

function delay(milliseconds) {
  return new Promise((resolvePromise) => setTimeout(resolvePromise, milliseconds));
}

function spawnChild(command, arguments_, environment, cwd = root) {
  return spawn(command, arguments_, {
    cwd,
    env: environment,
    stdio: "inherit",
    windowsHide: true,
  });
}

function terminateTree(child) {
  if (child === undefined || child.pid === undefined || child.exitCode !== null) return;
  if (process.platform === "win32") {
    spawnSync("taskkill", ["/PID", String(child.pid), "/T", "/F"], {
      stdio: "ignore",
      windowsHide: true,
    });
  } else {
    child.kill("SIGTERM");
  }
}

function ensureProductionWebBuild() {
  if (existsSync(resolve(root, "apps", "web", ".next", "BUILD_ID"))) return;
  const pnpmCli = process.env["npm_execpath"];
  if (!pnpmCli) throw new Error("Run this suite through pnpm so the web build can be prepared.");
  const build = spawnSync(process.execPath, [pnpmCli, "--filter", "@cluvvi/web", "build"], {
    cwd: root,
    env: process.env,
    stdio: "inherit",
    windowsHide: true,
  });
  if (build.error !== undefined) throw build.error;
  if (build.status !== 0) process.exit(build.status ?? 1);
}

async function waitForHealthy(worker, web) {
  const deadline = Date.now() + 90_000;
  while (Date.now() < deadline) {
    if (worker.exitCode !== null) throw new Error(`Hiring worker exited with ${worker.exitCode}.`);
    if (web.exitCode !== null) throw new Error(`Hiring web server exited with ${web.exitCode}.`);
    try {
      const response = await fetch(`${baseUrl}/api/health`, { signal: AbortSignal.timeout(2_000) });
      if (response.ok) {
        const health = await response.json();
        if (health.runner === "ok" && health.databaseInstanceId === health.runnerDatabaseInstanceId)
          return;
      }
    } catch {
      // The isolated browser environment is still starting.
    }
    await delay(500);
  }
  throw new Error("Hiring browser environment did not become healthy.");
}

const environment = {
  ...process.env,
  NEXT_PUBLIC_SUPABASE_URL: process.env["NEXT_PUBLIC_SUPABASE_URL"] ?? "http://127.0.0.1:54321",
  NEXT_PUBLIC_SUPABASE_ANON_KEY:
    process.env["NEXT_PUBLIC_SUPABASE_ANON_KEY"] ?? "browser-test-anon-key",
  SUPABASE_SERVICE_ROLE_KEY:
    process.env["SUPABASE_SERVICE_ROLE_KEY"] ?? "browser-test-service-role-key",
  APP_BASE_URL: baseUrl,
  DEFAULT_RUN_BUDGET_USD: "25",
  LOG_LEVEL: "info",
  CLUVVI_HOME: cluvviHome,
  CLUVVI_ENGINE_MODE: "fixture",
  CLUVVI_BROWSER_BASE_URL: baseUrl,
  CLUVVI_DISCOVERY_MODE: "local_discovery_engine",
  CLUVVI_DISCOVERY_PROVIDER_MODE: "fixture_only",
  CLUVVI_DISCOVERY_PROVIDER_POLICY: "free_only",
  CLUVVI_DISCOVERY_EXTRACTION_MODE: "selected_public_pages",
  CLUVVI_DISCOVERY_MAX_EXTRACTIONS: "2",
  CLUVVI_DISCOVERY_STRUCTURED_CONTENT_MODE: "selected_resources",
  CLUVVI_DISCOVERY_MAX_STRUCTURED_RESOURCES: "2",
  CLUVVI_DISCOVERY_MAX_DOCUMENT_RESOURCES: "1",
  CLUVVI_DISCOVERY_SOURCE_ADAPTER_MODE: "selected_sources",
  CLUVVI_DISCOVERY_SOURCE_FAMILIES: "hiring",
  CLUVVI_DISCOVERY_MAX_HIRING_TARGETS: "2",
  CLUVVI_DISCOVERY_MAX_HIRING_BOARDS_PER_TARGET: "3",
  CLUVVI_DISCOVERY_MAX_HIRING_JOBS_PER_BOARD: "50",
  CLUVVI_DISCOVERY_MAX_HIRING_JOBS_TOTAL: "100",
  DISCOVERY_HIRING_MAX_TARGETS: "2",
  DISCOVERY_HIRING_MAX_BOARDS_PER_TARGET: "3",
  DISCOVERY_HIRING_MAX_JOBS_PER_BOARD: "50",
  DISCOVERY_HIRING_MAX_TOTAL_JOBS: "100",
  CLUVVI_FIXTURE_STAGE_DELAY_MS: "300",
  CLUVVI_DISCOVERY_ENGINE_PATH: fixtureProject,
  CLUVVI_DISCOVERY_FIXTURE_PATH: fixtureProject,
  CLUVVI_DISCOVERY_ENGINE_COMMAND: process.platform === "win32" ? "pnpm.cmd" : "pnpm",
  CLUVVI_DISCOVERY_ENGINE_TIMEOUT_MS: "60000",
  CLUVVI_DISCOVERY_KEEP_EXCHANGE_FILES: "true",
};

ensureProductionWebBuild();
await rm(cluvviHome, { recursive: true, force: true });
await rm(fixtureProject, { recursive: true, force: true });
await cp(sourceFixtureProject, fixtureProject, { recursive: true });
await writeFile(
  resolve(fixtureProject, "behavior.json"),
  '{\n  "mode": "hiring-greenhouse"\n}\n',
  "utf8",
);

const initialization = spawnSync(
  process.execPath,
  [tsxBinary, "--tsconfig", "apps/cli/tsconfig.json", "apps/cli/src/index.ts", "init"],
  { cwd: root, env: environment, stdio: "inherit", windowsHide: true },
);
if (initialization.error !== undefined) throw initialization.error;
if (initialization.status !== 0) process.exit(initialization.status ?? 1);

let worker;
let web;
let tests;
try {
  worker = spawnChild(
    process.execPath,
    [tsxBinary, "--tsconfig", "apps/worker/tsconfig.json", "apps/worker/src/local.ts"],
    environment,
  );
  web = spawnChild(
    process.execPath,
    [nextBinary, "start", "--hostname", "127.0.0.1", "--port", String(port)],
    environment,
    resolve(root, "apps", "web"),
  );
  await waitForHealthy(worker, web);
  tests = spawnChild(
    process.execPath,
    [
      playwrightBinary,
      "test",
      "--config",
      "playwright.hiring-intelligence.config.ts",
      "--reporter",
      "list",
    ],
    environment,
  );
  const exitCode = await new Promise((resolveExit) => {
    tests.once("error", (error) => {
      console.error(error.message);
      resolveExit(1);
    });
    tests.once("exit", (code) => resolveExit(code ?? 1));
  });
  process.exitCode = exitCode;
} finally {
  terminateTree(tests);
  terminateTree(worker);
  terminateTree(web);
  await delay(1_000);
  await rm(cluvviHome, { recursive: true, force: true }).catch(() => undefined);
  await rm(fixtureProject, { recursive: true, force: true }).catch(() => undefined);
}
