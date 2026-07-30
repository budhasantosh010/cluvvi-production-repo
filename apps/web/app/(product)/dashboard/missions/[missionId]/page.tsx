import { randomUUID } from "node:crypto";
import Link from "next/link";
import { notFound } from "next/navigation";
import { parseServerEnvironment } from "@cluvvi/config";
import { StartRunForm } from "@/components/start-run-form";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export default async function MissionPage({ params }: { params: Promise<{ missionId: string }> }) {
  const { missionId } = await params;
  const client = await createServerSupabaseClient();
  const { data: mission, error } = await client
    .from("missions")
    .select("*")
    .eq("id", missionId)
    .single();

  if (error) {
    notFound();
  }

  const { data: runs } = await client
    .from("runs")
    .select("id, status, phase, created_at")
    .eq("mission_id", mission.id)
    .order("created_at", { ascending: false })
    .limit(10);
  const environment = parseServerEnvironment(process.env);

  return (
    <div className="grid gap-7 lg:grid-cols-[minmax(0,1.25fr)_minmax(320px,0.75fr)]">
      <div className="space-y-6">
        <section className="surface-card p-7 sm:p-9">
          <p className="eyebrow">Mission</p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight">{mission.name}</h1>
          <p className="mt-4 text-base leading-7 text-neutral-600">{mission.raw_description}</p>
          <dl className="mt-8 grid gap-5 border-t border-neutral-100 pt-6 sm:grid-cols-2">
            <div>
              <dt className="text-xs font-semibold uppercase tracking-[0.12em] text-neutral-500">
                Customer outcome
              </dt>
              <dd className="mt-2 text-sm leading-6 text-neutral-800">
                {mission.customer_outcome}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase tracking-[0.12em] text-neutral-500">
                Target locations
              </dt>
              <dd className="mt-2 text-sm leading-6 text-neutral-800">
                {mission.geographies.join(", ")}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase tracking-[0.12em] text-neutral-500">
                Desired customers
              </dt>
              <dd className="mt-2 text-sm leading-6 text-neutral-800">{mission.desired_count}</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase tracking-[0.12em] text-neutral-500">
                Website
              </dt>
              <dd className="mt-2 truncate text-sm leading-6 text-neutral-800">
                {mission.website_url}
              </dd>
            </div>
          </dl>
        </section>

        <section>
          <h2 className="mb-4 text-lg font-semibold">Recent runs</h2>
          {runs && runs.length > 0 ? (
            <div className="space-y-3">
              {runs.map((run) => (
                <Link
                  className="flex items-center justify-between rounded-2xl border border-neutral-200 bg-white px-5 py-4 transition hover:border-neutral-300"
                  href={`/dashboard/runs/${run.id}`}
                  key={run.id}
                >
                  <div>
                    <p className="text-sm font-semibold capitalize">
                      {run.status.replaceAll("_", " ")}
                    </p>
                    <p className="mt-1 text-xs text-neutral-500">
                      {new Date(run.created_at).toLocaleString()}
                    </p>
                  </div>
                  <span className="text-sm text-neutral-500">View →</span>
                </Link>
              ))}
            </div>
          ) : (
            <p className="rounded-2xl border border-dashed border-neutral-300 p-6 text-sm text-neutral-600">
              No runs yet.
            </p>
          )}
        </section>
      </div>

      <aside className="surface-card h-fit p-7 lg:sticky lg:top-24">
        <p className="eyebrow">Step 3 of 3</p>
        <h2 className="mt-3 text-2xl font-semibold tracking-tight">Ready to start</h2>
        <p className="mt-3 text-sm leading-6 text-neutral-600">
          Phase 0 will securely queue the mission and show the worker&apos;s real state transition.
          It will not run AI or search yet.
        </p>
        <div className="my-6 rounded-2xl bg-neutral-100 p-4 text-sm leading-6 text-neutral-700">
          <strong className="font-semibold text-neutral-950">What happens now:</strong>
          <br />
          Create run → save audit event → queue work → worker begins compilation.
        </div>
        <StartRunForm
          defaultBudgetUsd={environment.DEFAULT_RUN_BUDGET_USD}
          idempotencyKey={`run:${randomUUID()}`}
          missionId={mission.id}
          requestedCount={mission.desired_count}
        />
      </aside>
    </div>
  );
}
