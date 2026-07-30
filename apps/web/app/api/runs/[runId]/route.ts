import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function GET(_request: Request, { params }: { params: Promise<{ runId: string }> }) {
  const { runId } = await params;
  const client = await createServerSupabaseClient();
  const { data: run, error } = await client.from("runs").select("*").eq("id", runId).single();
  if (error) {
    return NextResponse.json({ error: "Run not found" }, { status: 404 });
  }

  const { data: events, error: eventError } = await client
    .from("run_events")
    .select("*")
    .eq("run_id", runId)
    .order("created_at");
  if (eventError) {
    return NextResponse.json({ error: eventError.message }, { status: 500 });
  }

  return NextResponse.json({ data: { run, events } });
}
