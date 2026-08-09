import { spawn } from "node:child_process";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";

const root = process.cwd();
const require = createRequire(resolve(root, "package.json"));
const vitestPackagePath = require.resolve("vitest/package.json");
const vitestPackage = JSON.parse(readFileSync(vitestPackagePath, "utf8"));
const vitest = resolve(dirname(vitestPackagePath), vitestPackage.bin.vitest);
const child = spawn(
  process.execPath,
  [
    vitest,
    "run",
    "packages/engine/tests/developer-real-bridge.integration.test.ts",
    "--reporter=verbose",
  ],
  {
    cwd: root,
    env: {
      ...process.env,
      RUN_DEVELOPER_DISCOVERY_INTEGRATION: "1",
      CLUVVI_DISCOVERY_ENGINE_PATH:
        process.env.CLUVVI_DISCOVERY_ENGINE_PATH ||
        resolve(root, "..", "Separate Discovery engine"),
      CLUVVI_DISCOVERY_ENGINE_EXPECTED_SHA:
        process.env.CLUVVI_DISCOVERY_ENGINE_EXPECTED_SHA ||
        "b9002bff2f56ac20c8db696b3137bda336437b8b",
    },
    stdio: "inherit",
    windowsHide: true,
  },
);
child.once("error", (error) => {
  console.error(error.message);
  process.exitCode = 1;
});
child.once("exit", (code) => {
  process.exitCode = code ?? 1;
});
