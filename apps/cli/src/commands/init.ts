import { mkdir } from "node:fs/promises";
import { createLocalRuntime } from "../runtime";

export async function initCommand(): Promise<void> {
  const { paths, store } = createLocalRuntime();
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
    console.log("YouTube            not configured");
    console.log("\nC0 runs locally without Docker, Supabase, or authentication.");
  } finally {
    await store.close();
  }
}
