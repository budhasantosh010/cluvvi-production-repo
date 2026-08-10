import { spawn, spawnSync } from "node:child_process";
import { cp, rm, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { resolve } from "node:path";

const root = process.cwd();
const rootRequire = createRequire(resolve(root, "package.json"));
const webRequire = createRequire(resolve(root, "apps/web/package.json"));
const tsx = rootRequire.resolve("tsx/cli");
const next = webRequire.resolve("next/dist/bin/next");
const playwright = rootRequire.resolve("@playwright/test/cli");
const sourceFixture = resolve(root, "tests/fixtures/local-discovery-engine");
const home = resolve(root, ".cluvvi-test", `browser-j45-${process.pid}`);
const fixture = resolve(root, "tests/fixtures", `.browser-j45-${process.pid}`);
const port = 38_000 + (process.pid % 1_000);
const baseUrl = `http://127.0.0.1:${port}`;
const delay = (ms) => new Promise((done) => setTimeout(done, ms));
const spawnChild = (cmd, args, env, cwd = root) =>
  spawn(cmd, args, { cwd, env, stdio: "inherit", windowsHide: true });
function kill(child) {
  if (!child?.pid || child.exitCode !== null) return;
  if (process.platform === "win32")
    spawnSync("taskkill", ["/PID", String(child.pid), "/T", "/F"], {
      stdio: "ignore",
      windowsHide: true,
    });
  else child.kill("SIGTERM");
}

const pnpm = process.env["npm_execpath"];
if (!pnpm) throw new Error("Run through pnpm.");
const build = spawnSync(process.execPath, [pnpm, "--filter", "@cluvvi/web", "build"], {
  cwd: root,
  env: process.env,
  stdio: "inherit",
  windowsHide: true,
});
if (build.error) throw build.error;
if (build.status !== 0) process.exit(build.status ?? 1);

const env = {
  ...process.env,
  NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54321",
  NEXT_PUBLIC_SUPABASE_ANON_KEY: "browser-test-anon-key",
  SUPABASE_SERVICE_ROLE_KEY: "browser-test-service-role-key",
  APP_BASE_URL: baseUrl,
  DEFAULT_RUN_BUDGET_USD: "25",
  LOG_LEVEL: "info",
  CLUVVI_HOME: home,
  CLUVVI_ENGINE_MODE: "fixture",
  CLUVVI_BROWSER_BASE_URL: baseUrl,
  CLUVVI_DISCOVERY_MODE: "local_discovery_engine",
  CLUVVI_DISCOVERY_PROVIDER_MODE: "fixture_only",
  CLUVVI_DISCOVERY_PROVIDER_POLICY: "free_only",
  CLUVVI_DISCOVERY_EXTRACTION_MODE: "none",
  CLUVVI_DISCOVERY_STRUCTURED_CONTENT_MODE: "none",
  CLUVVI_DISCOVERY_SOURCE_ADAPTER_MODE: "selected_sources",
  CLUVVI_DISCOVERY_SOURCE_FAMILIES: "video,specialized",
  CLUVVI_DISCOVERY_YOUTUBE_DEPTH: "default",
  CLUVVI_DISCOVERY_SPECIALIZED_MODE: "auto",
  CLUVVI_DISCOVERY_SPECIALIZED_MAX_SOURCES: "8",
  CLUVVI_DISCOVERY_SPECIALIZED_MAX_CANDIDATES: "12",
  CLUVVI_DISCOVERY_SPECIALIZED_COVERAGE_TRIGGER: "0.65",
  DISCOVERY_YOUTUBE_ENABLED: "true",
  DISCOVERY_YOUTUBE_DEPTH: "default",
  DISCOVERY_SPECIALIZED_ENABLED: "true",
  DISCOVERY_SPECIALIZED_MODE: "auto",
  CLUVVI_FIXTURE_STAGE_DELAY_MS: "100",
  CLUVVI_DISCOVERY_ENGINE_PATH: fixture,
  CLUVVI_DISCOVERY_FIXTURE_PATH: fixture,
  CLUVVI_DISCOVERY_ENGINE_COMMAND: process.platform === "win32" ? "pnpm.cmd" : "pnpm",
  CLUVVI_DISCOVERY_ENGINE_TIMEOUT_MS: "60000",
  CLUVVI_DISCOVERY_KEEP_EXCHANGE_FILES: "true",
};
delete env.DISCOVERY_SPECIALIZED_SOURCE_REGISTRY_PATH;

await rm(home, { recursive: true, force: true });
await rm(fixture, { recursive: true, force: true });
await cp(sourceFixture, fixture, { recursive: true });
await writeFile(
  resolve(fixture, "behavior.json"),
  '{\n  "mode": "video-specialized-success"\n}\n',
  "utf8",
);
const init = spawnSync(
  process.execPath,
  [tsx, "--tsconfig", "apps/cli/tsconfig.json", "apps/cli/src/index.ts", "init"],
  { cwd: root, env, stdio: "inherit", windowsHide: true },
);
if (init.error) throw init.error;
if (init.status !== 0) process.exit(init.status ?? 1);
let worker, web, tests;
let exitCode = 1;
try {
  worker = spawnChild(
    process.execPath,
    [tsx, "--tsconfig", "apps/worker/tsconfig.json", "apps/worker/src/local.ts"],
    env,
  );
  web = spawnChild(
    process.execPath,
    [next, "start", "--hostname", "127.0.0.1", "--port", String(port)],
    env,
    resolve(root, "apps/web"),
  );
  const deadline = Date.now() + 90_000;
  while (Date.now() < deadline) {
    try {
      const r = await fetch(`${baseUrl}/api/health`, { signal: AbortSignal.timeout(2000) });
      if (r.ok) {
        const h = await r.json();
        if (h.runner === "ok" && h.databaseInstanceId === h.runnerDatabaseInstanceId) break;
      }
    } catch {}
    await delay(500);
  }
  tests = spawnChild(
    process.execPath,
    [
      playwright,
      "test",
      "--config",
      "playwright.video-specialized-intelligence.config.ts",
      "--reporter",
      "list",
    ],
    env,
  );
  exitCode = await new Promise((done) => {
    tests.once("error", () => done(1));
    tests.once("exit", (code) => done(code ?? 1));
  });
  process.exitCode = exitCode;
} finally {
  kill(tests);
  kill(worker);
  kill(web);
  await delay(800);
  if (exitCode === 0 || process.env["CLUVVI_J45_KEEP_FAILURE_OUTPUT"] !== "1") {
    await rm(home, { recursive: true, force: true }).catch(() => undefined);
    await rm(fixture, { recursive: true, force: true }).catch(() => undefined);
  }
}
