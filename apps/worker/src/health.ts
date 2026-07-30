import { createServer, type Server } from "node:http";
import type { Logger } from "./logger";
import type { WorkerState } from "./state";

export function startHealthServer(input: {
  port: number;
  state: WorkerState;
  logger: Logger;
}): Server {
  const server = createServer((request, response) => {
    if (request.url !== "/health") {
      response.writeHead(404, { "content-type": "application/json" });
      response.end(JSON.stringify({ error: "Not found" }));
      return;
    }

    const snapshot = input.state.snapshot();
    const healthy = snapshot.status === "ready" || snapshot.status === "starting";
    response.writeHead(healthy ? 200 : 503, {
      "content-type": "application/json",
      "cache-control": "no-store",
    });
    response.end(
      JSON.stringify({
        service: "cluvvi-worker",
        version: "0.0.0",
        ...snapshot,
        checkedAt: new Date().toISOString(),
      }),
    );
  });

  server.listen(input.port, "127.0.0.1", () => {
    input.logger.info("Worker health endpoint listening", { port: input.port });
  });
  return server;
}
