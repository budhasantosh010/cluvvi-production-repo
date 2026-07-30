import { apiError } from "@/lib/server/api-response";
import { getWebLocalRuntime } from "@/lib/server/local-runtime";
import { LocalRunStatusSchema, MissionInputSchemaV1 } from "@cluvvi/core";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const limit = Math.min(Math.max(Number(url.searchParams.get("limit") ?? 20), 1), 100);
    const rawStatus = url.searchParams.get("status");
    const status = rawStatus === null ? undefined : LocalRunStatusSchema.parse(rawStatus);
    const { service } = await getWebLocalRuntime();
    const runs = await service.listRuns({ limit, ...(status === undefined ? {} : { status }) });
    return NextResponse.json({ runs });
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: Request) {
  try {
    const idempotencyKey = request.headers.get("Idempotency-Key") ?? "";
    const mission = MissionInputSchemaV1.parse(await request.json());
    const { service } = await getWebLocalRuntime();
    const result = await service.createRun(mission, idempotencyKey);
    return NextResponse.json(
      {
        run: result.view.run,
        request: result.request,
        created: result.created,
        links: {
          self: `/api/runs/${result.view.run.id}`,
          page: `/runs/${result.view.run.id}`,
        },
      },
      { status: result.created ? 201 : 200 },
    );
  } catch (error) {
    return apiError(error);
  }
}
