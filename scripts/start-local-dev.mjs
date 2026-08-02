import { spawn, spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { createServer } from "node:net";
import { resolve } from "node:path";
import process from "node:process";

const minimumNodeMajor = 24;
const currentNodeMajor = Number(process.versions.node.split(".")[0]);
if (!Number.isInteger(currentNodeMajor) || currentNodeMajor < minimumNodeMajor) {
  console.error(`Cluvvi requires Node ${minimumNodeMajor}+; found ${process.versions.node}.`);
  process.exit(1);
}

const host = process.env.CLUVVI_DEV_HOST?.trim() || "localhost";
const port = Number(process.env.CLUVVI_DEV_PORT?.trim() || "3100");
if (!new Set(["127.0.0.1", "0.0.0.0", "localhost"]).has(host)) {
  console.error(
    `Unsupported CLUVVI_DEV_HOST ${JSON.stringify(host)}. Use 127.0.0.1, localhost, or explicitly 0.0.0.0.`,
  );
  process.exit(1);
}

async function assertPortAvailable(port) {
  await new Promise((resolvePromise, reject) => {
    const server = createServer();
    server.once("error", (error) => reject(error));
    server.listen(port, host === "0.0.0.0" ? "0.0.0.0" : host, () => {
      server.close((error) => (error ? reject(error) : resolvePromise()));
    });
  });
}

try {
  await assertPortAvailable(port);
} catch (error) {
  console.error(
    `Cluvvi cannot start because ${host}:${port} is already in use. Stop the existing process and rerun pnpm dev.`,
  );
  if (error instanceof Error) console.error(error.message);
  process.exit(1);
}

const rootRequire = createRequire(resolve(process.cwd(), "package.json"));
const workerRequire = createRequire(resolve(process.cwd(), "apps/worker/package.json"));
const tsxBinary = rootRequire.resolve("tsx/cli");
const workerTsxBinary = workerRequire.resolve("tsx/cli");
const environment = {
  ...process.env,
  CLUVVI_ENGINE_MODE: "fixture",
  CLUVVI_DEV_HOST: host,
  CLUVVI_DEV_PORT: String(port),
};

const initialization = spawnSync(
  process.execPath,
  [tsxBinary, "--tsconfig", "apps/cli/tsconfig.json", "apps/cli/src/index.ts", "init"],
  {
    cwd: process.cwd(),
    env: environment,
    stdio: "inherit",
    windowsHide: false,
  },
);
if (initialization.error) {
  console.error(`Cluvvi initialization could not start: ${initialization.error.message}`);
  process.exit(1);
}
if (initialization.status !== 0) {
  process.exit(initialization.status ?? 1);
}

const children = new Map();
let stopping = false;
let exitCode = 0;

function start(name, command, args, cwd = process.cwd()) {
  const child = spawn(command, args, {
    cwd,
    env: environment,
    stdio: "inherit",
    windowsHide: false,
  });
  children.set(name, child);
  child.once("error", (error) => {
    console.error(`${name} failed to start: ${error.message}`);
    exitCode = 1;
    void shutdown("child-error");
  });
  child.once("exit", (code, signal) => {
    children.delete(name);
    if (!stopping) {
      console.error(`${name} exited unexpectedly (${code ?? signal ?? "unknown"}).`);
      exitCode = code ?? 1;
      void shutdown("child-exit");
    }
  });
  return child;
}

function forceStopTree(child) {
  if (child.pid === undefined) return;
  if (process.platform === "win32") {
    spawnSync("taskkill", ["/PID", String(child.pid), "/T", "/F"], {
      stdio: "ignore",
      windowsHide: true,
    });
    return;
  }
  if (child.exitCode === null) child.kill("SIGKILL");
}

async function shutdown(reason) {
  if (stopping) return;
  stopping = true;
  if (reason === "SIGINT" || reason === "SIGTERM") {
    console.log("\nStopping Cluvvi local development environment…");
  }
  const active = [...children.values()];
  for (const child of active) {
    if (child.exitCode === null && !child.killed) {
      child.kill(reason === "SIGINT" ? "SIGINT" : "SIGTERM");
    }
  }
  await new Promise((resolvePromise) => setTimeout(resolvePromise, 2500));
  for (const child of active) forceStopTree(child);
  process.exitCode = exitCode;
}

process.once("SIGINT", () => void shutdown("SIGINT"));
process.once("SIGTERM", () => void shutdown("SIGTERM"));

start("Cluvvi web", process.execPath, ["scripts/start-web.mjs"]);
start(
  "Cluvvi runner",
  process.execPath,
  [workerTsxBinary, "src/local.ts"],
  resolve(process.cwd(), "apps/worker"),
);

const healthUrl = `http://${host}:${port}/api/health`;
const deadline = Date.now() + 45_000;
let lastFailure = "waiting for web and runner";
while (!stopping && Date.now() < deadline) {
  try {
    const response = await fetch(healthUrl, { signal: AbortSignal.timeout(2_000) });
    if (response.ok) {
      const health = await response.json();
      if (
        health.runner === "ok" &&
        typeof health.databaseInstanceId === "string" &&
        health.databaseInstanceId === health.runnerDatabaseInstanceId
      ) {
        console.log(
          [
            "\nCluvvi local development environment",
            "",
            `Web:\nhttp://${host}:${port}`,
            "",
            "SQLite:\n.cluvvi/cluvvi.sqlite",
            "",
            "Runner:\nactive",
            "",
            `Discovery providers:\n${environment.CLUVVI_DISCOVERY_PROVIDER_MODE ?? "fixture_only"}`,
            "",
            "Press Ctrl+C to stop.",
          ].join("\n"),
        );
        lastFailure = "";
        break;
      }
      lastFailure =
        health.runner !== "ok"
          ? "runner heartbeat is not active"
          : "web and runner resolved different SQLite database instances";
    } else {
      lastFailure = `health returned HTTP ${response.status}`;
    }
  } catch (error) {
    lastFailure = error instanceof Error ? error.message : String(error);
  }
  await new Promise((resolvePromise) => setTimeout(resolvePromise, 500));
}

if (!stopping && lastFailure.length > 0) {
  console.error(`Cluvvi local startup failed: ${lastFailure}.`);
  exitCode = 1;
  await shutdown("health-timeout");
}
