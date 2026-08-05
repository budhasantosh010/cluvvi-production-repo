import { spawn, spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { createRequire } from "node:module";
import { cp, rm, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import process from "node:process";

const root = process.cwd();
const sourceFixtureProject = resolve(root, "tests", "fixtures", "local-discovery-engine");
const rootRequire = createRequire(resolve(root, "package.json"));
const webRequire = createRequire(resolve(root, "apps", "web", "package.json"));
const tsxBinary = rootRequire.resolve("tsx/cli");
const nextBinary = webRequire.resolve("next/dist/bin/next");
const playwrightBinary = rootRequire.resolve("@playwright/test/cli");
const scriptPath = resolve(root, "scripts", "run-extraction-browser-tests.mjs");

const proofTitles = [
  "operations page exposes the active extraction mode and an honest preview selector",
  "successful extraction renders frontier, telemetry, page evidence, and downstream provenance",
  "companion artifacts remain inspectable as three distinct durable records",
  "partial page failure stays visible while successful evidence continues downstream",
  "all page attempts can fail without invented extracted evidence",
  "hostile page instructions remain displayed as untrusted source text",
  "unsafe extraction fails after search, then resumes on the same run with search reuse",
  "mobile extraction view has no horizontal overflow",
  "operations selector remains usable on mobile",
  "controlled execution records mark all extraction sidecars as imported",
];

function behaviorFor(title) {
  if (title.includes("partial page failure")) return "extraction-partial";
  if (title.includes("all page attempts")) return "extraction-all-failed";
  if (title.includes("hostile page instructions")) return "extraction-hostile-instructions";
  if (title.includes("unsafe extraction fails")) return "extraction-private-url";
  return "success";
}

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
    return;
  }
  child.kill("SIGTERM");
}

async function waitForHealthy(worker, web, baseUrl) {
  const deadline = Date.now() + 90_000;
  while (Date.now() < deadline) {
    if (worker.exitCode !== null) {
      throw new Error(`Extraction browser worker exited with ${worker.exitCode}.`);
    }
    if (web.exitCode !== null) {
      throw new Error(`Extraction browser web server exited with ${web.exitCode}.`);
    }
    try {
      const response = await fetch(`${baseUrl}/api/health`, {
        signal: AbortSignal.timeout(2_000),
      });
      if (response.ok) {
        const health = await response.json();
        if (
          health.runner === "ok" &&
          health.databaseInstanceId === health.runnerDatabaseInstanceId
        ) {
          return;
        }
      }
    } catch {
      // The isolated proof environment is still starting.
    }
    await delay(500);
  }
  throw new Error("Extraction browser environment did not become healthy.");
}

async function waitForPortClose(baseUrl) {
  const deadline = Date.now() + 15_000;
  while (Date.now() < deadline) {
    try {
      await fetch(`${baseUrl}/api/health`, { signal: AbortSignal.timeout(500) });
    } catch {
      return;
    }
    await delay(250);
  }
  throw new Error(`Extraction browser server did not release ${baseUrl}.`);
}

function ensureProductionWebBuild() {
  if (existsSync(resolve(root, "apps", "web", ".next", "BUILD_ID"))) return;
  const pnpmCli = process.env["npm_execpath"];
  if (!pnpmCli) {
    throw new Error("Run this suite through pnpm so the production web build can be prepared.");
  }
  const build = spawnSync(process.execPath, [pnpmCli, "--filter", "@cluvvi/web", "build"], {
    cwd: root,
    env: process.env,
    stdio: "inherit",
    windowsHide: true,
  });
  if (build.error !== undefined) throw build.error;
  if (build.status !== 0) process.exit(build.status ?? 1);
}

async function runProof(title, index) {
  const cluvviHome = resolve(root, ".cluvvi-test", `browser-extraction-${process.pid}-${index}`);
  const proofFixtureProject = resolve(
    root,
    "tests",
    "fixtures",
    `.browser-extraction-fixture-${process.pid}-${index}`,
  );
  const port = 32_000 + ((process.pid + index) % 1_000);
  const baseUrl = `http://127.0.0.1:${port}`;
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
    CLUVVI_FIXTURE_STAGE_DELAY_MS: index === 2 || index === 8 ? "1200" : "120",
    CLUVVI_DISCOVERY_ENGINE_PATH: proofFixtureProject,
    CLUVVI_DISCOVERY_FIXTURE_PATH: proofFixtureProject,
    CLUVVI_DISCOVERY_ENGINE_COMMAND: process.platform === "win32" ? "pnpm.cmd" : "pnpm",
    CLUVVI_DISCOVERY_ENGINE_TIMEOUT_MS: "60000",
    CLUVVI_DISCOVERY_KEEP_EXCHANGE_FILES: "true",
  };

  await rm(cluvviHome, { recursive: true, force: true });
  await rm(proofFixtureProject, { recursive: true, force: true });
  await cp(sourceFixtureProject, proofFixtureProject, { recursive: true });
  await writeFile(
    resolve(proofFixtureProject, "behavior.json"),
    `${JSON.stringify({ mode: behaviorFor(title) }, null, 2)}\n`,
    "utf8",
  );

  const initialization = spawnSync(
    process.execPath,
    [tsxBinary, "--tsconfig", "apps/cli/tsconfig.json", "apps/cli/src/index.ts", "init"],
    { cwd: root, env: environment, stdio: "inherit", windowsHide: true },
  );
  if (initialization.error !== undefined) {
    console.error(initialization.error.message);
    return 1;
  }
  if (initialization.status !== 0) return initialization.status ?? 1;

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
    await waitForHealthy(worker, web, baseUrl);
    tests = spawnChild(
      process.execPath,
      [
        playwrightBinary,
        "test",
        "--config",
        "playwright.extraction.config.ts",
        "--reporter",
        "list",
        "--grep",
        title,
      ],
      environment,
    );
    return await new Promise((resolveExit) => {
      tests.once("error", (error) => {
        console.error(error.message);
        resolveExit(1);
      });
      tests.once("exit", (code) => resolveExit(code ?? 1));
    });
  } catch (error) {
    console.error(error instanceof Error ? (error.stack ?? error.message) : String(error));
    return 1;
  } finally {
    terminateTree(tests);
    terminateTree(worker);
    terminateTree(web);
    await waitForPortClose(baseUrl).catch((error) => console.error(error.message));
    await delay(1_000);
    await rm(cluvviHome, { recursive: true, force: true }).catch(() => undefined);
    await rm(proofFixtureProject, { recursive: true, force: true }).catch(() => undefined);
  }
}

ensureProductionWebBuild();
const singleTitle = process.env["C1I_BROWSER_SINGLE_TITLE"]?.trim();
if (singleTitle) {
  const index = proofTitles.indexOf(singleTitle) + 1;
  if (index === 0) {
    console.error(`Unknown C1-I browser proof ${JSON.stringify(singleTitle)}.`);
    process.exit(1);
  }
  console.log(`\nC1-I browser proof ${index}/${proofTitles.length}: ${singleTitle}`);
  process.exit(await runProof(singleTitle, index));
}

const requestedProof = process.env["C1I_BROWSER_GREP"]?.trim();
const selectedTitles = requestedProof
  ? proofTitles.filter((title) => title.includes(requestedProof))
  : proofTitles;
if (selectedTitles.length === 0) {
  console.error(`No C1-I browser proof matched ${JSON.stringify(requestedProof)}.`);
  process.exit(1);
}

let passed = 0;
for (const title of selectedTitles) {
  const child = spawnSync(process.execPath, [scriptPath], {
    cwd: root,
    env: {
      ...process.env,
      C1I_BROWSER_GREP: "",
      C1I_BROWSER_SINGLE_TITLE: title,
    },
    stdio: "inherit",
    windowsHide: true,
  });
  if (child.error !== undefined) {
    console.error(child.error.message);
    process.exit(1);
  }
  if (child.status !== 0) process.exit(child.status ?? 1);
  passed += 1;
  await delay(2_000);
}

console.log(`\nC1-I extraction browser proofs passed: ${passed}/${selectedTitles.length}`);
