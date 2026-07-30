import { apiError } from "@/lib/server/api-response";
import { getWebLocalRuntime } from "@/lib/server/local-runtime";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request, context: { params: Promise<{ runId: string }> }) {
  try {
    const { runId } = await context.params;
    const afterTimestamp = new URL(request.url).searchParams.get("afterTimestamp") ?? undefined;
    const { service } = await getWebLocalRuntime();
    const events = await service.getRunEvents(runId, {
      ...(afterTimestamp === undefined ? {} : { afterTimestamp }),
    });
    return NextResponse.json({ events });
  } catch (error) {
    return apiError(error);
  }
}
