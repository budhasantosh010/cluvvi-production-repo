import { StartRunInputSchema } from "@cluvvi/core";
import { NextResponse } from "next/server";
import { z } from "zod";
import { startMissionRun } from "@/lib/server/commands";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ missionId: string }> },
) {
  try {
    const { missionId } = await params;
    const body = (await request.json()) as Record<string, unknown>;
    const input = StartRunInputSchema.parse({ ...body, missionId });
    const client = await createServerSupabaseClient();
    const run = await startMissionRun(client, input);
    return NextResponse.json({ data: run }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid run", details: error.flatten() }, { status: 400 });
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 400 },
    );
  }
}
