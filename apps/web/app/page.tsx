import { LocalMissionForm } from "@/components/local-mission-form";
import { getWebLocalRuntime } from "@/lib/server/local-runtime";
import Link from "next/link";

export const dynamic = "force-dynamic";

function statusClass(status: string): string {
  return `status-pill status-${status}`;
}

export default async function HomePage() {
  const { service } = await getWebLocalRuntime();
  const [runs, diagnostics] = await Promise.all([
    service.listRuns({ limit: 5 }),
    service.getDiagnostics(),
  ]);

  return (
    <main className="mx-auto grid w-full max-w-7xl gap-10 px-5 py-10 sm:px-8 sm:py-14 lg:py-16">
      <section className="grid gap-8 lg:grid-cols-[minmax(0,0.9fr)_minmax(540px,1.25fr)] lg:items-start">
        <div className="pt-2 lg:sticky lg:top-10 lg:pt-10">
          <div className="inline-flex items-center gap-2 rounded-full border border-lime-300 bg-lime-100 px-3 py-1.5 text-xs font-semibold text-lime-950">
            <span className="size-2 rounded-full bg-lime-600" />
            Local browser application
          </div>
          <h1 className="mt-6 max-w-2xl text-5xl font-semibold tracking-[-0.05em] text-neutral-950 sm:text-6xl lg:text-7xl">
            Find who needs what you sell.
          </h1>
          <p className="mt-6 max-w-xl text-lg leading-8 text-neutral-600">
            Tell Cluvvi what you sell. Cluvvi will progressively search for potential customers and
            show the evidence behind every result.
          </p>
          <div className="mt-8 rounded-2xl border border-violet-200 bg-violet-50 p-5 text-sm leading-6 text-violet-950">
            <strong>Local fixture mode:</strong> The current engine demonstrates the complete
            workflow using deterministic test data. Real AI and market discovery arrive in later
            phases.
          </div>
          <dl className="mt-8 grid grid-cols-2 gap-3 text-sm">
            <div className="metric-card">
              <dt>Runner</dt>
              <dd>{diagnostics.runner.available ? "Active" : "Offline"}</dd>
            </div>
            <div className="metric-card">
              <dt>Storage</dt>
              <dd>SQLite · WAL</dd>
            </div>
            <div className="metric-card">
              <dt>Engine</dt>
              <dd>{diagnostics.engineVersion}</dd>
            </div>
            <div className="metric-card">
              <dt>Mode</dt>
              <dd>Fixture</dd>
            </div>
          </dl>
        </div>
        <LocalMissionForm runnerAvailable={diagnostics.runner.available} />
      </section>

      <section className="surface-card overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-neutral-200 px-6 py-5 sm:px-8">
          <div>
            <p className="eyebrow">Durable history</p>
            <h2 className="mt-2 text-xl font-semibold">Recent runs</h2>
          </div>
          <Link href="/runs" className="button-secondary">
            View all runs
          </Link>
        </div>
        {runs.length === 0 ? (
          <div className="p-8 text-sm leading-6 text-neutral-500">
            Your first browser-created run will appear here and remain available after restarts.
          </div>
        ) : (
          <div className="divide-y divide-neutral-100">
            {runs.map((run) => (
              <Link key={run.id} href={`/runs/${run.id}`} className="run-list-row">
                <div className="min-w-0">
                  <strong className="block truncate text-sm text-neutral-950">
                    {run.missionName}
                  </strong>
                  <span className="mt-1 block truncate font-mono text-xs text-neutral-400">
                    {run.id}
                  </span>
                </div>
                <span className={statusClass(run.status)}>{run.status.replaceAll("_", " ")}</span>
                <span className="hidden text-sm capitalize text-neutral-500 sm:block">
                  {run.phase.replaceAll("_", " ")}
                </span>
                <time className="hidden text-sm text-neutral-500 md:block">
                  {new Date(run.startedAt).toLocaleString()}
                </time>
                <span aria-hidden="true" className="text-neutral-400">
                  →
                </span>
              </Link>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
