import { apiError } from "@/lib/server/api-response";
import { getWebLocalRuntime } from "@/lib/server/local-runtime";
import { ArtifactTypeSchema } from "@cluvvi/core";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  context: { params: Promise<{ runId: string; artifactType: string }> },
) {
  try {
    const { runId, artifactType } = await context.params;
    const validatedType = ArtifactTypeSchema.parse(artifactType);
    const { service } = await getWebLocalRuntime();
    const artifact = await service.getRunArtifact(runId, validatedType);
    if (artifact === null) {
      return NextResponse.json(
        { error: { code: "ARTIFACT_NOT_FOUND", message: "Artifact not found.", retryable: false } },
        { status: 404 },
      );
    }
    return NextResponse.json({ artifact });
  } catch (error) {
    return apiError(error);
  }
}
