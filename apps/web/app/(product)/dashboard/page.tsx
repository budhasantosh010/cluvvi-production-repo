import Link from "next/link";
import { WorkspaceForm } from "@/components/workspace-form";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export default async function DashboardPage() {
  const client = await createServerSupabaseClient();
  const { data: workspaces, error: workspaceError } = await client
    .from("workspaces")
    .select("*")
    .order("created_at", { ascending: true });

  if (workspaceError) {
    throw new Error(`Could not load workspaces: ${workspaceError.message}`);
  }

  const workspace = workspaces[0];
  if (!workspace) {
    return (
      <section className="mx-auto max-w-2xl">
        <p className="eyebrow">Step 1 of 3</p>
        <div className="surface-card mt-4 p-7 sm:p-10">
          <h1 className="text-3xl font-semibold tracking-tight">Create your workspace</h1>
          <p className="mt-3 max-w-lg text-base leading-7 text-neutral-600">
            A workspace keeps your product missions, runs, and evidence in one private place.
          </p>
          <WorkspaceForm />
        </div>
      </section>
    );
  }

  const { data: missions, error: missionError } = await client
    .from("missions")
    .select("*")
    .eq("workspace_id", workspace.id)
    .order("created_at", { ascending: false });

  if (missionError) {
    throw new Error(`Could not load missions: ${missionError.message}`);
  }

  return (
    <div className="space-y-9">
      <section className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="eyebrow">{workspace.name}</p>
          <h1 className="mt-3 text-4xl font-semibold tracking-[-0.035em] text-neutral-950">
            Find the buyers worth contacting.
          </h1>
          <p className="mt-3 max-w-2xl text-base leading-7 text-neutral-600">
            Describe one product. Cluvvi will build a bounded discovery mission around it.
          </p>
        </div>
        <Link
          className="button-primary shrink-0"
          href={`/dashboard/missions/new?workspace=${workspace.id}`}
        >
          New mission
        </Link>
      </section>

      {missions.length === 0 ? (
        <section className="surface-card grid min-h-72 place-items-center p-8 text-center">
          <div className="max-w-md">
            <div className="mx-auto grid size-12 place-items-center rounded-2xl bg-lime-200 text-xl">
              →
            </div>
            <h2 className="mt-5 text-xl font-semibold">Start with your first product</h2>
            <p className="mt-2 text-sm leading-6 text-neutral-600">
              The form takes a few minutes and prevents vague, low-quality discovery later.
            </p>
            <Link
              className="button-primary mt-6"
              href={`/dashboard/missions/new?workspace=${workspace.id}`}
            >
              Create first mission
            </Link>
          </div>
        </section>
      ) : (
        <section>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold">Your missions</h2>
            <span className="text-sm text-neutral-500">{missions.length} total</span>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            {missions.map((mission) => (
              <Link
                className="surface-card group p-6 transition hover:-translate-y-0.5 hover:border-neutral-300"
                href={`/dashboard/missions/${mission.id}`}
                key={mission.id}
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-neutral-500">
                      {mission.status}
                    </p>
                    <h3 className="mt-2 text-lg font-semibold tracking-tight group-hover:underline group-hover:decoration-neutral-300 group-hover:underline-offset-4">
                      {mission.name}
                    </h3>
                  </div>
                  <span className="text-neutral-400 transition group-hover:translate-x-1 group-hover:text-neutral-950">
                    →
                  </span>
                </div>
                <p className="mt-4 line-clamp-2 text-sm leading-6 text-neutral-600">
                  {mission.customer_outcome}
                </p>
                <div className="mt-5 flex flex-wrap gap-2">
                  {mission.geographies.slice(0, 3).map((geography) => (
                    <span
                      className="rounded-full bg-neutral-100 px-3 py-1 text-xs text-neutral-600"
                      key={geography}
                    >
                      {geography}
                    </span>
                  ))}
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
