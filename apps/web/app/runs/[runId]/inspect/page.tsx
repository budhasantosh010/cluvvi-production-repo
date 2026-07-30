import { getWebLocalRuntime } from "@/lib/server/local-runtime";
import { OpaqueIdSchema } from "@cluvvi/core";
import Link from "next/link";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function InspectRunPage({ params }: { params: Promise<{ runId: string }> }) {
  const { runId } = await params;
  if (!OpaqueIdSchema.safeParse(runId).success) notFound();
  const { service } = await getWebLocalRuntime();
  const view = await service.getRun(runId);
  if (view === null) notFound();
  return (
    <main className="mx-auto w-full max-w-6xl px-5 py-10 sm:px-8 sm:py-14">
      <div className="flex flex-wrap items-start justify-between gap-5">
        <div>
          <p className="eyebrow">Full inspection</p>
          <h1 className="mt-3 text-4xl font-semibold tracking-tight">{view.run.missionName}</h1>
          <p className="mt-3 font-mono text-xs text-neutral-500">{view.run.id}</p>
        </div>
        <Link className="button-secondary" href={`/runs/${runId}`}>
          Back to progress
        </Link>
      </div>
      <div className="fixture-banner mt-8">
        <strong>Fixture output — not real market data.</strong>
        <span>Every artifact below is deterministic test output.</span>
      </div>
      <div className="mt-6 grid gap-5">
        {view.artifacts.map((artifact) => (
          <section className="surface-card overflow-hidden" key={artifact.id}>
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-neutral-200 px-6 py-5">
              <div>
                <h2 className="font-semibold capitalize">
                  {artifact.artifactType.replaceAll("_", " ")}
                </h2>
                <p className="mt-1 text-xs text-neutral-500">
                  Schema {artifact.schemaVersion} · version {artifact.version} · {artifact.fileName}
                </p>
              </div>
              <a
                className="button-secondary min-h-9 px-3 py-1 text-xs"
                href={`/api/runs/${runId}/artifacts/${artifact.artifactType}`}
                target="_blank"
              >
                Open API JSON
              </a>
            </div>
            <pre className="json-viewer m-5 sm:m-6">{JSON.stringify(artifact.data, null, 2)}</pre>
          </section>
        ))}
        {view.artifacts.length === 0 && (
          <div className="surface-card p-8 text-neutral-500">
            No artifacts have been persisted yet.
          </div>
        )}
      </div>
    </main>
  );
}
