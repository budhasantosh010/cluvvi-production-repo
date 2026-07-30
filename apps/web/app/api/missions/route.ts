import { CreateMissionInputSchema } from "@cluvvi/core";
import { NextResponse } from "next/server";
import { z } from "zod";
import { createMission } from "@/lib/server/commands";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  try {
    const client = await createServerSupabaseClient();
    const mission = await createMission(
      client,
      CreateMissionInputSchema.parse(await request.json()),
    );
    return NextResponse.json({ data: mission }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid mission", details: error.flatten() },
        { status: 400 },
      );
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 400 },
    );
  }
}
