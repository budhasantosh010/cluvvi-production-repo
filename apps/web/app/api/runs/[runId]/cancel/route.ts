import { apiError } from "@/lib/server/api-response";
import { getWebLocalRuntime } from "@/lib/server/local-runtime";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(_request: Request, context: { params: Promise<{ runId: string }> }) {
  try {
    const { runId } = await context.params;
    const { service } = await getWebLocalRuntime();
    return NextResponse.json({ request: await service.requestCancel(runId) }, { status: 202 });
  } catch (error) {
    return apiError(error);
  }
}
