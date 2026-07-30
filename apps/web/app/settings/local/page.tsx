import { getWebLocalRuntime } from "@/lib/server/local-runtime";

export const dynamic = "force-dynamic";

export default async function LocalSettingsPage() {
  const { service } = await getWebLocalRuntime();
  const diagnostics = await service.getDiagnostics();
  const items = [
    ["Project directory", diagnostics.projectRoot],
    ["SQLite database", diagnostics.databasePath],
    ["Artifact directory", diagnostics.runsDirectory],
    ["Database instance", diagnostics.databaseInstanceId],
    ["Migration version", diagnostics.migrationVersion ?? "none"],
    ["Engine version", diagnostics.engineVersion],
    ["Current mode", diagnostics.mode],
    ["Runner status", diagnostics.runner.available ? "active" : "offline"],
    ["Runner heartbeat", diagnostics.runner.heartbeat?.lastSeenAt ?? "none"],
    ["Configured providers", "fixture only"],
    ["Missing providers", "AI, web search, fetch, enrichment, YouTube, outreach"],
  ] as const;
  return (
    <main className="mx-auto w-full max-w-5xl px-5 py-10 sm:px-8 sm:py-14">
      <p className="eyebrow">Read-only diagnostics</p>
      <h1 className="mt-3 text-4xl font-semibold tracking-tight">Local settings</h1>
      <p className="mt-3 max-w-2xl leading-7 text-neutral-600">
        These values prove the web server and runner are pointed at the same durable local runtime.
        Secrets are never shown here.
      </p>
      <section className="surface-card mt-8 overflow-hidden">
        <dl className="divide-y divide-neutral-100">
          {items.map(([label, value]) => (
            <div className="grid gap-2 px-6 py-5 md:grid-cols-[220px_minmax(0,1fr)]" key={label}>
              <dt className="text-sm font-medium text-neutral-500">{label}</dt>
              <dd className="break-all font-mono text-sm text-neutral-900">{value}</dd>
            </div>
          ))}
        </dl>
      </section>
      {!diagnostics.runner.available && (
        <div className="mt-6 rounded-2xl border border-amber-300 bg-amber-50 p-5 text-sm text-amber-950">
          <strong>Runner offline.</strong> Start the complete local application with{" "}
          <code>pnpm dev</code>, or run only the worker with <code>pnpm dev:runner</code>.
        </div>
      )}
      <p className="mt-6 text-sm text-neutral-500">
        Failure ledger: <code>docs/FAILURES_AND_LIMITATIONS.md</code>
      </p>
    </main>
  );
}
