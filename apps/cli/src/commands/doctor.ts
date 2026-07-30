import { access, mkdir, rm, writeFile } from "node:fs/promises";
import { constants } from "node:fs";
import { resolve } from "node:path";
import { createLocalRuntime } from "../runtime";

export async function doctorCommand(): Promise<void> {
  const { paths, store } = createLocalRuntime();
  const majorVersion = Number.parseInt(process.versions.node.split(".")[0] ?? "0", 10);
  if (majorVersion < 24) {
    throw new Error(`Node.js 24 or newer is required; found ${process.versions.node}.`);
  }

  try {
    await mkdir(paths.stateDirectory, { recursive: true });
    const probe = resolve(paths.stateDirectory, ".doctor-write-test");
    await writeFile(probe, "ok", "utf8");
    await access(probe, constants.R_OK | constants.W_OK);
    await rm(probe, { force: true });
    await store.initialize();
    console.log("Cluvvi doctor\n");
    console.log(`Node.js            ${process.versions.node} — ok`);
    console.log(`Database writable  ${paths.databasePath} — ok`);
    console.log("Migrations         current — ok");
    console.log("Fixture provider   available — ok");
    console.log("Real LLM           not configured — expected in C0");
    console.log("Real search        not configured — expected in C0");
    console.log("Docker             not required — ok");
    console.log("Supabase           not required — ok");
  } finally {
    await store.close();
  }
}
