import { apiError } from "@/lib/server/api-response";
import { getWebLocalRuntime } from "@/lib/server/local-runtime";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const { service } = await getWebLocalRuntime();
    const diagnostics = await service.getDiagnostics();
    return NextResponse.json({
      status: "ok",
      web: "ok",
      database: "ok",
      runner: diagnostics.runner.available ? "ok" : "offline",
      mode: diagnostics.mode,
      databaseInstanceId: diagnostics.databaseInstanceId,
      runnerDatabaseInstanceId:
        typeof diagnostics.runner.heartbeat?.metadata["databaseInstanceId"] === "string"
          ? diagnostics.runner.heartbeat.metadata["databaseInstanceId"]
          : null,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return apiError(error);
  }
}
