import { spawn, spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import process from "node:process";

const host = process.env.CLUVVI_DEV_HOST?.trim() || "localhost";
const port = Number(process.env.CLUVVI_DEV_PORT?.trim() || "3100");
if (!new Set(["127.0.0.1", "0.0.0.0", "localhost"]).has(host)) {
  console.error(
    `Unsupported CLUVVI_DEV_HOST ${JSON.stringify(host)}. Use 127.0.0.1, localhost, or explicitly 0.0.0.0.`,
  );
  process.exit(1);
}

const webRequire = createRequire(resolve(process.cwd(), "apps/web/package.json"));
const nextBinary = webRequire.resolve("next/dist/bin/next");
const child = spawn(
  process.execPath,
  [nextBinary, "dev", "--hostname", host, "--port", String(port)],
  {
    cwd: resolve(process.cwd(), "apps/web"),
    env: {
      ...process.env,
      CLUVVI_ENGINE_MODE: process.env.CLUVVI_ENGINE_MODE?.trim() || "fixture",
    },
    stdio: "inherit",
    windowsHide: false,
  },
);

let stopping = false;
function forceStopTree() {
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

function stop(signal) {
  if (stopping) return;
  stopping = true;
  if (child.exitCode === null) child.kill(signal === "SIGINT" ? "SIGINT" : "SIGTERM");
  const fallback = setTimeout(forceStopTree, 2500);
  fallback.unref();
}

process.once("SIGINT", () => stop("SIGINT"));
process.once("SIGTERM", () => stop("SIGTERM"));
child.once("error", (error) => {
  console.error(`Cluvvi web process could not start: ${error.message}`);
  process.exitCode = 1;
});
child.once("exit", (code, signal) => {
  process.exitCode = code ?? (signal && !stopping ? 1 : 0);
});
