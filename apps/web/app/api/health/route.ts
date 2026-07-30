import { environmentCapabilities } from "@cluvvi/config";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export function GET() {
  const capabilities = environmentCapabilities(process.env);
  const ready = capabilities.supabaseConfigured;

  return NextResponse.json(
    {
      service: "cluvvi-web",
      status: ready ? "ready" : "degraded",
      version: "0.0.0",
      capabilities,
      checkedAt: new Date().toISOString(),
    },
    { status: ready ? 200 : 503 },
  );
}
