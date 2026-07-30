import { apiError } from "@/lib/server/api-response";
import { getWebLocalRuntime } from "@/lib/server/local-runtime";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const { service } = await getWebLocalRuntime();
    return NextResponse.json(await service.getCapabilities());
  } catch (error) {
    return apiError(error);
  }
}
