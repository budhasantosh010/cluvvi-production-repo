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
    "packages/engine/tests/community-real-bridge.integration.test.ts",
    "--reporter=verbose",
  ],
  {
    cwd: root,
    env: {
      ...process.env,
      RUN_COMMUNITY_DISCOVERY_INTEGRATION: "1",
      CLUVVI_DISCOVERY_ENGINE_PATH:
        process.env.CLUVVI_DISCOVERY_ENGINE_PATH ||
        resolve(root, "..", "Separate Discovery engine"),
      CLUVVI_DISCOVERY_ENGINE_EXPECTED_SHA:
        process.env.CLUVVI_DISCOVERY_ENGINE_EXPECTED_SHA ||
        "db13a6cf568b307fa76782306179060b2df23d7c",
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
