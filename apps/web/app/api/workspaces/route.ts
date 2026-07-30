import { CreateWorkspaceInputSchema } from "@cluvvi/core";
import { NextResponse } from "next/server";
import { z } from "zod";
import { createWorkspace } from "@/lib/server/commands";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function GET() {
  const client = await createServerSupabaseClient();
  const { data, error } = await client.from("workspaces").select("*").order("created_at");
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ data });
}

export async function POST(request: Request) {
  try {
    const client = await createServerSupabaseClient();
    const workspace = await createWorkspace(
      client,
      CreateWorkspaceInputSchema.parse(await request.json()),
    );
    return NextResponse.json({ data: workspace }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid workspace", details: error.flatten() },
        { status: 400 },
      );
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 400 },
    );
  }
}
