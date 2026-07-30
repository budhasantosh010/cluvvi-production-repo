import { LocalRunner } from "@cluvvi/application";
import { RunPhaseSchema } from "@cluvvi/core";
import { CluvviEngine, LocalArtifactWriter, createDefaultStageRegistry } from "@cluvvi/engine";
import { SqliteCluvviStore, resolveLocalCluvviPaths } from "@cluvvi/storage";
import { hostname } from "node:os";
import process from "node:process";

async function main(): Promise<void> {
  const mode = process.env["CLUVVI_ENGINE_MODE"] ?? "fixture";
  if (mode !== "fixture") {
    throw new Error(`Unsupported CLUVVI_ENGINE_MODE: ${mode}. C0.5 supports fixture only.`);
  }

  const paths = resolveLocalCluvviPaths();
  const store = new SqliteCluvviStore({ databasePath: paths.databasePath });
  const artifactWriter = new LocalArtifactWriter(paths.runsDirectory);
  const failStageValue = process.env["CLUVVI_FIXTURE_FAIL_STAGE"]?.trim();
  const failStage =
    failStageValue === undefined || failStageValue.length === 0
      ? undefined
      : RunPhaseSchema.parse(failStageValue);
  const runnerId = `runner_${hostname()}_${process.pid}`;
  const runner = new LocalRunner({
    store,
    artifactWriter,
    engine: new CluvviEngine({
      store,
      artifactWriter,
      stages: createDefaultStageRegistry(),
      stageDelayMs: Number(process.env["CLUVVI_FIXTURE_STAGE_DELAY_MS"] ?? 120),
    }),
    runnerId,
    hostname: hostname(),
    processId: process.pid,
    pollIntervalMs: Number(process.env["CLUVVI_RUNNER_POLL_MS"] ?? 750),
    ...(failStage === undefined ? {} : { failStage }),
    onReady: async () => {
      console.log(
        [
          "Cluvvi local runner active",
          `Runner: ${runnerId}`,
          `SQLite: ${paths.databasePath}`,
          `Database instance: ${await store.getDatabaseInstanceId()}`,
          "Mode: fixture",
        ].join("\n"),
      );
    },
  });
  const abortController = new AbortController();
  const stop = (signal: string) => {
    console.log(`Cluvvi local runner stopping after ${signal}.`);
    abortController.abort();
  };
  process.once("SIGINT", () => stop("SIGINT"));
  process.once("SIGTERM", () => stop("SIGTERM"));

  console.log(`Cluvvi local runner starting\nRunner: ${runnerId}\nSQLite: ${paths.databasePath}`);
  try {
    if (process.argv.includes("--once")) {
      await runner.startOnce();
      return;
    }
    await runner.start(abortController.signal);
  } finally {
    await store.close();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? (error.stack ?? error.message) : String(error));
  process.exitCode = 1;
});
