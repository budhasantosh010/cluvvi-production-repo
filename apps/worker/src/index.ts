import { parseWorkerEnvironment } from "@cluvvi/config";
import { createAdminClient, MissionCompileGateway } from "@cluvvi/database";
import process from "node:process";
import { startHealthServer } from "./health";
import { createLogger, type LogLevel } from "./logger";
import { runWorkerLoop } from "./runtime";
import { WorkerState } from "./state";

async function main(): Promise<void> {
  const environment = parseWorkerEnvironment(process.env);
  const logger = createLogger(environment.LOG_LEVEL as LogLevel);
  const state = new WorkerState();
  const abortController = new AbortController();
  const client = createAdminClient(process.env);
  const queue = new MissionCompileGateway(client);
  const healthServer = startHealthServer({
    port: environment.WORKER_HEALTH_PORT,
    state,
    logger,
  });
  const once = process.argv.includes("--once");

  const shutdown = (signal: string) => {
    logger.info("Worker shutdown requested", { signal });
    state.markStopping();
    abortController.abort();
  };

  process.once("SIGINT", () => shutdown("SIGINT"));
  process.once("SIGTERM", () => shutdown("SIGTERM"));

  logger.info("Worker started", { once, pollIntervalMs: environment.WORKER_POLL_INTERVAL_MS });
  await runWorkerLoop({
    queue,
    logger,
    state,
    pollIntervalMs: environment.WORKER_POLL_INTERVAL_MS,
    signal: abortController.signal,
    once,
  });

  await new Promise<void>((resolve, reject) => {
    healthServer.close((error) => (error ? reject(error) : resolve()));
  });
  logger.info("Worker stopped cleanly");
}

main().catch((error: unknown) => {
  console.error(
    JSON.stringify({
      timestamp: new Date().toISOString(),
      service: "cluvvi-worker",
      level: "error",
      message: "Worker failed to start",
      errorName: error instanceof Error ? error.name : "UnknownError",
      errorMessage: error instanceof Error ? error.message : "Unknown startup error",
    }),
  );
  process.exitCode = 1;
});
