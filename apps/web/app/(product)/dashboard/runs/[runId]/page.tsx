import { notFound } from "next/navigation";
import { RunAutoRefresh } from "@/components/run-auto-refresh";
import { createServerSupabaseClient } from "@/lib/supabase/server";

const terminalStatuses = new Set(["completed", "cancelled", "failed"]);

const eventCopy: Record<string, { title: string; description: string }> = {
  run_created: {
    title: "Run created safely",
    description: "The run, first audit event, and queue message were saved together.",
  },
  compilation_started: {
    title: "Worker started compilation",
    description:
      "The worker validated the message and moved the run through an allowed state transition.",
  },
};

export default async function RunPage({ params }: { params: Promise<{ runId: string }> }) {
  const { runId } = await params;
  const client = await createServerSupabaseClient();
  const { data: run, error } = await client.from("runs").select("*").eq("id", runId).single();

  if (error) {
    notFound();
  }

  const { data: events, error: eventError } = await client
    .from("run_events")
    .select("*")
    .eq("run_id", run.id)
    .order("created_at", { ascending: true });

  if (eventError) {
    throw new Error(`Could not load run events: ${eventError.message}`);
  }

  const active = !terminalStatuses.has(run.status);

  return (
    <div className="mx-auto max-w-4xl">
      <RunAutoRefresh active={active} />
      <section className="surface-card overflow-hidden">
        <div className="border-b border-neutral-100 p-7 sm:p-9">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="eyebrow">Run progress</p>
              <h1 className="mt-3 text-3xl font-semibold tracking-tight capitalize">
                {run.status.replaceAll("_", " ")}
              </h1>
              <p className="mt-3 max-w-xl text-sm leading-6 text-neutral-600">
                Cluvvi reports completed events instead of guessing a percentage.
              </p>
            </div>
            <span className="inline-flex w-fit items-center gap-2 rounded-full bg-neutral-100 px-3 py-1.5 text-xs font-semibold text-neutral-700">
              {active ? <span className="size-2 animate-pulse rounded-full bg-lime-500" /> : null}
              {run.phase}
            </span>
          </div>
        </div>

        <div className="p-7 sm:p-9">
          <ol className="relative space-y-0">
            {events.map((event, index) => {
              const copy = eventCopy[event.event_type] ?? {
                title: event.event_type.replaceAll("_", " "),
                description: `Run moved to ${event.to_status.replaceAll("_", " ")}.`,
              };
              const last = index === events.length - 1;
              return (
                <li
                  className="relative grid grid-cols-[2rem_1fr] gap-4 pb-8 last:pb-0"
                  key={event.id}
                >
                  {!last ? (
                    <span className="absolute left-[0.9375rem] top-8 h-full w-px bg-neutral-200" />
                  ) : null}
                  <span className="relative z-10 mt-0.5 grid size-8 place-items-center rounded-full bg-neutral-950 text-sm text-lime-300">
                    ✓
                  </span>
                  <div>
                    <h2 className="font-semibold capitalize text-neutral-950">{copy.title}</h2>
                    <p className="mt-1 text-sm leading-6 text-neutral-600">{copy.description}</p>
                    <time className="mt-2 block text-xs text-neutral-400">
                      {new Date(event.created_at).toLocaleString()}
                    </time>
                  </div>
                </li>
              );
            })}
          </ol>
        </div>
      </section>

      <div className="mt-5 rounded-2xl border border-neutral-200 bg-white/70 px-5 py-4 text-sm leading-6 text-neutral-600">
        <strong className="font-semibold text-neutral-900">Phase 0 boundary:</strong> this run
        proves durable execution only. AI understanding and buyer research arrive after this
        foundation passes.
      </div>
    </div>
  );
}
