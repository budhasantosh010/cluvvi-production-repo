import { apiError } from "@/lib/server/api-response";
import { getWebLocalRuntime } from "@/lib/server/local-runtime";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_request: Request, context: { params: Promise<{ runId: string }> }) {
  try {
    const { runId } = await context.params;
    const { service } = await getWebLocalRuntime();
    const view = await service.getRun(runId);
    if (view === null) {
      return NextResponse.json(
        { error: { code: "RUN_NOT_FOUND", message: "Run not found.", retryable: false } },
        { status: 404 },
      );
    }
    const diagnostics = await service.getDiagnostics();
    return NextResponse.json({ ...view, runner: diagnostics.runner });
  } catch (error) {
    return apiError(error);
  }
}
