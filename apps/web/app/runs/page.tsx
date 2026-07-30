import { getWebLocalRuntime } from "@/lib/server/local-runtime";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function RunsPage() {
  const { service } = await getWebLocalRuntime();
  const runs = await service.listRuns({ limit: 100 });
  return (
    <main className="mx-auto w-full max-w-6xl px-5 py-10 sm:px-8 sm:py-14">
      <div className="flex flex-wrap items-end justify-between gap-5">
        <div>
          <p className="eyebrow">Local history</p>
          <h1 className="mt-3 text-4xl font-semibold tracking-tight">Cluvvi runs</h1>
          <p className="mt-3 text-neutral-600">
            Persisted in one local SQLite database, newest first.
          </p>
        </div>
        <Link className="button-primary" href="/">
          Create a run
        </Link>
      </div>
      <section className="surface-card mt-8 overflow-hidden">
        {runs.length === 0 ? (
          <div className="p-8 text-neutral-500">No runs yet.</div>
        ) : (
          <div className="divide-y divide-neutral-100">
            {runs.map((run) => (
              <Link
                key={run.id}
                href={`/runs/${run.id}`}
                className="run-list-row grid-cols-[minmax(0,1fr)_auto_auto] sm:grid-cols-[minmax(0,1fr)_auto_auto_auto]"
              >
                <div className="min-w-0">
                  <strong className="block truncate text-sm text-neutral-950">
                    {run.missionName}
                  </strong>
                  <span className="mt-1 block truncate font-mono text-xs text-neutral-400">
                    {run.id}
                  </span>
                </div>
                <span className={`status-pill status-${run.status}`}>
                  {run.status.replaceAll("_", " ")}
                </span>
                <span className="hidden text-sm capitalize text-neutral-500 sm:block">
                  {run.phase.replaceAll("_", " ")}
                </span>
                <time className="text-right text-xs text-neutral-500">
                  {new Date(run.startedAt).toLocaleString()}
                </time>
              </Link>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
