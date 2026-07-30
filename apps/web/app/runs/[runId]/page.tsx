import { RunViewClient } from "@/components/run-view-client";
import { getWebLocalRuntime } from "@/lib/server/local-runtime";
import { OpaqueIdSchema } from "@cluvvi/core";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function RunPage({ params }: { params: Promise<{ runId: string }> }) {
  const { runId } = await params;
  if (!OpaqueIdSchema.safeParse(runId).success) notFound();
  const { service } = await getWebLocalRuntime();
  const [view, diagnostics] = await Promise.all([service.getRun(runId), service.getDiagnostics()]);
  if (view === null) notFound();
  return (
    <main className="mx-auto w-full max-w-7xl px-5 py-8 sm:px-8 sm:py-12">
      <RunViewClient initial={view} initialRunner={diagnostics.runner} />
    </main>
  );
}
