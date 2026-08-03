import { CustomerMissionComposer } from "@/components/customer-mission-composer";
import { getWebLocalRuntime } from "@/lib/server/local-runtime";
import Link from "next/link";

export const dynamic = "force-dynamic";

function statusClass(status: string): string {
  return `status-pill status-${status}`;
}

function relativeTime(timestamp: string): string {
  const elapsedSeconds = Math.max(0, Math.floor((Date.now() - Date.parse(timestamp)) / 1_000));
  if (elapsedSeconds < 60) return "just now";
  const elapsedMinutes = Math.floor(elapsedSeconds / 60);
  if (elapsedMinutes < 60) return `${elapsedMinutes}m ago`;
  const elapsedHours = Math.floor(elapsedMinutes / 60);
  if (elapsedHours < 24) return `${elapsedHours}h ago`;
  const elapsedDays = Math.floor(elapsedHours / 24);
  return `${elapsedDays}d ago`;
}

export default async function HomePage() {
  const { service } = await getWebLocalRuntime();
  const [runs, diagnostics] = await Promise.all([
    service.listRuns({ limit: 5 }),
    service.getDiagnostics(),
  ]);

  return (
    <main className="mx-auto w-full max-w-[928px] px-5 pb-20 pt-14 sm:px-8 sm:pt-20">
      <section className="text-center">
        <div className="fixture-disclosure relative mx-auto inline-block text-left">
          <details className="group">
            <summary className="fixture-trigger">
              <span className="size-1.5 rounded-full bg-lime-600" />
              {diagnostics.discoveryProviderMode === "live_search"
                ? `Local live search · ${diagnostics.discoveryProviderPolicy.replaceAll("_", " ")}`
                : diagnostics.discoveryRuntimeMode === "local_discovery_engine"
                  ? "Local Discovery Engine fixture mode"
                  : "Local fixture mode"}
            </summary>
          </details>
          <div className="fixture-popover" role="tooltip">
            {diagnostics.discoveryProviderMode === "live_search"
              ? diagnostics.discoveryProviderPolicy === "free_only"
                ? "Cluvvi sends a versioned JSON request to the standalone Discovery Engine using free search providers only. Paid providers are blocked by policy. Search snippets are validated before deterministic downstream analysis; full pages are not extracted and coverage may be incomplete."
                : diagnostics.discoveryProviderPolicy === "balanced"
                  ? "Cluvvi runs the free search ladder first and permits a paid fallback only when deterministic coverage thresholds fail. Provider order, fallback reason, and paid usage remain visible."
                  : "Cluvvi uses explicit paid-deep routing with bounded request and credit budgets. Provider telemetry and policy decisions remain visible."
              : diagnostics.discoveryRuntimeMode === "local_discovery_engine"
                ? "Mission understanding is real local logic. Cluvvi sends a versioned JSON request to the standalone local Discovery Engine, which uses fixture providers only, then validates its search_results.v2 output before running Evidence, Identity, Ranking, and Buyer Map. No live market source is queried."
                : "Mission understanding is real local logic. Evidence, identity, ranking, and Buyer Map use synthetic companies from a version-controlled search_results.v2 fixture. No live market source is queried."}
          </div>
        </div>

        <h1 className="mx-auto mt-7 max-w-[720px] text-5xl font-semibold tracking-[-0.055em] text-neutral-950 sm:text-6xl md:text-7xl">
          Let&apos;s find your customers.
        </h1>
        <p className="mx-auto mt-5 max-w-2xl text-base leading-7 text-neutral-600 sm:text-lg sm:leading-8">
          Tell Cluvvi what you sell. It finds companies showing evidence they need it.
        </p>
      </section>

      <section className="mx-auto mt-10 max-w-[720px] sm:mt-12">
        <CustomerMissionComposer runnerAvailable={diagnostics.runner.available} />
      </section>

      <section
        className="mx-auto mt-20 max-w-[840px] sm:mt-24"
        aria-labelledby="recent-runs-heading"
      >
        <div className="flex items-end justify-between gap-4 border-b border-neutral-200 pb-4">
          <div>
            <p className="eyebrow">Your work</p>
            <h2
              id="recent-runs-heading"
              className="mt-2 text-xl font-semibold tracking-tight text-neutral-950"
            >
              Recent runs
            </h2>
          </div>
          <Link
            href="/runs"
            className="text-sm font-medium text-neutral-600 underline-offset-4 hover:text-neutral-950 hover:underline"
          >
            View all runs
          </Link>
        </div>

        {runs.length === 0 ? (
          <p className="py-8 text-sm leading-6 text-neutral-500">
            Your first run will appear here and remain available after restarts.
          </p>
        ) : (
          <div className="divide-y divide-neutral-200/80">
            {runs.map((run) => (
              <Link key={run.id} href={`/runs/${run.id}`} className="recent-run-row">
                <span className="min-w-0">
                  <strong className="block truncate text-sm font-medium text-neutral-950">
                    {run.missionName}
                  </strong>
                  <time
                    className="mt-1 block text-xs text-neutral-400 sm:hidden"
                    dateTime={run.updatedAt}
                  >
                    {relativeTime(run.updatedAt)}
                  </time>
                </span>
                <span className={statusClass(run.status)}>{run.status.replaceAll("_", " ")}</span>
                <span className="hidden text-sm capitalize text-neutral-500 sm:block">
                  {run.phase.replaceAll("_", " ")}
                </span>
                <time className="hidden text-sm text-neutral-400 sm:block" dateTime={run.updatedAt}>
                  {relativeTime(run.updatedAt)}
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
