import { mkdir } from "node:fs/promises";
import { createLocalRuntime } from "../runtime";

export async function initCommand(): Promise<void> {
  const { paths, store, discoveryConfig } = createLocalRuntime();
  try {
    await mkdir(paths.runsDirectory, { recursive: true });
    await store.initialize();
    console.log(`Cluvvi initialized.\n\nDatabase:\n${paths.databasePath}\n`);
    console.log("Available capabilities:");
    console.log("Local engine       configured");
    console.log("SQLite             configured");
    console.log("Fixture stages     configured");
    console.log("LLM                not configured");
    console.log("Web search         not configured");
    console.log("Enrichment         not configured");
    console.log(
      `YouTube video      ${discoveryConfig.sourceFamilies.includes("video") ? "selected (bounded public metadata/text via Project A)" : "available when the video source family is selected"}`,
    );
    console.log(
      `Specialized        ${discoveryConfig.sourceFamilies.includes("specialized") ? "selected (bounded public specialist sources via Project A)" : "available when the specialized source family is selected"}`,
    );
    console.log(
      "\nLocal mode runs without Docker, Supabase, or product authentication. Source-specific safety boundaries still apply.",
    );
  } finally {
    await store.close();
  }
}
