"use client";

import { DownstreamFixtureView } from "@/components/downstream-fixture-view";
import { MissionUnderstandingView } from "@/components/mission-understanding-view";
import type { RunView } from "@cluvvi/application/contracts";
import type { ArtifactRecord } from "@cluvvi/core";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

interface RunnerState {
  available: boolean;
  heartbeat: unknown;
}

interface RunViewClientProps {
  initial: RunView;
  initialRunner: RunnerState;
}

const labels: Record<RunView["stages"][number]["name"], string> = {
  mission: "Mission",
  compilation: "Mission understanding",
  source_planning: "Search planning",
  discovery: "Discovery",
  normalization: "Normalization",
  investigation: "Evidence analysis",
  buyer_identification: "Buyer hypotheses",
  enrichment: "Identity routes",
  ranking: "Opportunity ranking",
  review: "Buyer Map",
  finalization: "Finalization",
};

const terminal = new Set(["completed", "failed", "budget_exhausted", "cancelled"]);

function hasActiveResumeRequest(view: RunView): boolean {
  const latestRequest = view.requests.at(-1);
  return (
    latestRequest?.action === "resume" &&
    (latestRequest.status === "pending" || latestRequest.status === "claimed")
  );
}

function shouldPollRun(view: RunView): boolean {
  return !terminal.has(view.run.status) || hasActiveResumeRequest(view);
}

function stageStatusLabel(
  stage: RunView["stages"][number],
  discoveryRuntimeMode: RunView["run"]["config"]["discoveryRuntimeMode"],
): string {
  if (stage.name === "discovery") {
    if (stage.status === "running") {
      return discoveryRuntimeMode === "local_discovery_engine"
        ? "Running the local Discovery Engine in fixture-provider mode"
        : "Loading fixture discovery results";
    }
    if (stage.status === "completed" || stage.status === "reused") {
      return discoveryRuntimeMode === "local_discovery_engine"
        ? "Ran the local Discovery Engine in fixture-provider mode"
        : "Loaded fixture discovery results";
    }
  }
  if (stage.status === "running") return "Running locally";
  if (stage.status === "reused") return "Reused from durable state";
  if (stage.status === "completed") return "Completed";
  if (stage.status === "failed") return "Failed";
  if (stage.status === "skipped") return "Skipped";
  return "Pending";
}

export function RunViewClient({ initial, initialRunner }: RunViewClientProps) {
  const [view, setView] = useState(initial);
  const [runner, setRunner] = useState(initialRunner);
  const [selectedArtifact, setSelectedArtifact] = useState<ArtifactRecord | null>(
    initial.artifacts.at(-1) ?? null,
  );
  const [requestError, setRequestError] = useState<string | null>(null);
  const [actionPending, setActionPending] = useState(false);
  const runId = view.run.id;
  const pollAllowed = shouldPollRun(view);

  useEffect(() => {
    if (!pollAllowed) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const poll = async () => {
      const delay = document.hidden ? 5000 : 1000;
      let nextView: RunView | null = null;
      try {
        const response = await fetch(`/api/runs/${runId}`, { cache: "no-store" });
        if (response.ok) {
          const next = (await response.json()) as RunView & { runner: RunnerState };
          nextView = next;
          if (!cancelled) {
            setView(next);
            setRunner(next.runner);
            setRequestError(null);
            if (selectedArtifact === null && next.artifacts.length > 0) {
              setSelectedArtifact(next.artifacts.at(-1) ?? null);
            }
          }
        } else if (!cancelled) {
          setRequestError("Progress is temporarily unavailable. Cluvvi will retry.");
        }
      } catch {
        if (!cancelled)
          setRequestError("The web server is temporarily unavailable. The run remains durable.");
      }
      if (!cancelled && (nextView === null ? pollAllowed : shouldPollRun(nextView))) {
        timer = setTimeout(() => {
          void poll();
        }, delay);
      }
    };
    timer = setTimeout(() => {
      void poll();
    }, 700);
    return () => {
      cancelled = true;
      if (timer !== undefined) clearTimeout(timer);
    };
  }, [pollAllowed, runId, selectedArtifact]);

  const completedCount = useMemo(
    () =>
      view.stages.filter((stage) => stage.status === "completed" || stage.status === "reused")
        .length,
    [view.stages],
  );
  const understandingArtifact = useMemo(
    () =>
      view.artifacts.find((artifact) => artifact.artifactType === "mission_understanding") ?? null,
    [view.artifacts],
  );
  const localDiscovery = view.run.config.discoveryRuntimeMode === "local_discovery_engine";
  const resumeRequested = hasActiveResumeRequest(view);

  async function runAction(action: "resume" | "cancel") {
    setActionPending(true);
    setRequestError(null);
    try {
      const response = await fetch(`/api/runs/${view.run.id}/${action}`, { method: "POST" });
      const body = (await response.json()) as { error?: { message: string } };
      if (!response.ok) throw new Error(body.error?.message ?? `Could not ${action} run.`);
      const refreshed = await fetch(`/api/runs/${view.run.id}`, { cache: "no-store" });
      if (refreshed.ok) {
        const next = (await refreshed.json()) as RunView & { runner: RunnerState };
        setView(next);
        setRunner(next.runner);
      }
    } catch (error) {
      setRequestError(error instanceof Error ? error.message : `Could not ${action} run.`);
    } finally {
      setActionPending(false);
    }
  }

  async function copyArtifact() {
    if (selectedArtifact !== null) {
      await navigator.clipboard.writeText(JSON.stringify(selectedArtifact.data, null, 2));
    }
  }

  function downloadArtifact() {
    if (selectedArtifact === null) return;
    const blob = new Blob([`${JSON.stringify(selectedArtifact.data, null, 2)}\n`], {
      type: "application/json",
    });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = selectedArtifact.fileName;
    link.click();
    URL.revokeObjectURL(link.href);
  }

  return (
    <div className="grid gap-6" data-testid="run-view" data-run-status={view.run.status}>
      <div className="fixture-banner" data-testid="fixture-provider-warning">
        <strong>
          {localDiscovery
            ? "Local Discovery Engine · fixture providers only."
            : "Fixture Buyer Map — no live market results."}
        </strong>
        <span>
          {localDiscovery
            ? "This run used the standalone local Discovery Engine with fixture providers. It does not represent live customer discovery. Cluvvi validated its search_results.v2 output before running Evidence, Identity, Ranking, and Buyer Map."
            : "Cluvvi generated mission understanding locally, then processed a version-controlled search_results.v2 fixture through Evidence, Identity, Ranking, and Buyer Map. Every company and URL is synthetic."}
        </span>
      </div>

      {!runner.available && !terminal.has(view.run.status) && (
        <div className="rounded-2xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950">
          <strong>Runner offline.</strong> Start it with <code>pnpm dev:runner</code>. The queued
          run remains in SQLite.
        </div>
      )}
      {requestError && (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          {requestError}
        </div>
      )}

      <section className="surface-card smooth-panel p-6 sm:p-8">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className={`status-pill status-${view.run.status}`}>
                {view.run.status.replaceAll("_", " ")}
              </span>
              <span className="fixture-badge">
                {localDiscovery ? "Fixture · local engine" : "Fixture"}
              </span>
            </div>
            <h1 className="mt-4 text-3xl font-semibold tracking-tight text-neutral-950 sm:text-4xl">
              {view.run.missionName}
            </h1>
            <p className="mt-3 break-all font-mono text-xs text-neutral-500">{view.run.id}</p>
          </div>
          <div className="grid grid-cols-2 gap-3 text-sm lg:min-w-[520px] lg:grid-cols-4">
            <div className="metric-card">
              <span>Current phase</span>
              <strong>{labels[view.run.phase]}</strong>
            </div>
            <div className="metric-card">
              <span>Stages done</span>
              <strong>{completedCount} / 11</strong>
            </div>
            <div className="metric-card">
              <span>Discovery runtime</span>
              <strong>{localDiscovery ? "Local engine" : "Internal fixture"}</strong>
            </div>
            <div className="metric-card">
              <span>Started</span>
              <strong>{new Date(view.run.startedAt).toLocaleString()}</strong>
            </div>
          </div>
        </div>
        <div className="mt-6 flex flex-wrap gap-3">
          {(view.run.status === "failed" || view.run.status === "budget_exhausted") && (
            <button
              className="button-primary"
              disabled={actionPending || resumeRequested}
              onClick={() => void runAction("resume")}
            >
              {resumeRequested ? "Resume requested" : "Resume run"}
            </button>
          )}
          {!terminal.has(view.run.status) && (
            <button
              className="button-secondary"
              disabled={actionPending}
              onClick={() => void runAction("cancel")}
            >
              Cancel at safe boundary
            </button>
          )}
          <Link className="button-secondary" href={`/runs/${view.run.id}/inspect`}>
            Open full inspection
          </Link>
        </div>
      </section>

      {view.run.failure && (
        <section
          className="rounded-3xl border border-red-200 bg-red-50 p-6 sm:p-8"
          data-testid="run-failure"
        >
          <p className="eyebrow text-red-700">Run failure</p>
          <h2 className="mt-2 text-xl font-semibold text-red-950">{view.run.failure.code}</h2>
          <p className="mt-3 text-sm leading-6 text-red-900">{view.run.failure.message}</p>
          <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-3">
            <div>
              <dt className="text-red-700">Stage</dt>
              <dd className="font-medium">{view.run.failure.stage ?? view.run.phase}</dd>
            </div>
            <div>
              <dt className="text-red-700">Category</dt>
              <dd className="font-medium">{view.run.failure.category}</dd>
            </div>
            <div>
              <dt className="text-red-700">Retryable</dt>
              <dd className="font-medium">{view.run.failure.retryable ? "Yes" : "No"}</dd>
            </div>
          </dl>
        </section>
      )}

      {understandingArtifact === null && (
        <section
          className="surface-card smooth-panel p-6 sm:p-8"
          data-testid="mission-understanding-pending"
          aria-live="polite"
        >
          <div className="flex items-start gap-3">
            {!terminal.has(view.run.status) && (
              <span className="loading-dot mt-2 text-neutral-500" aria-hidden="true" />
            )}
            <div>
              <p className="eyebrow">Mission understanding</p>
              <h2 className="mt-2 text-xl font-semibold text-neutral-950">
                {terminal.has(view.run.status)
                  ? "Mission Understanding is not available for this run."
                  : "Preparing local run artifacts…"}
              </h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-neutral-600">
                {terminal.has(view.run.status)
                  ? "This run ended before the local compilation stage produced the artifact."
                  : "Mission Understanding will appear here once the local runner completes compilation."}
              </p>
            </div>
          </div>
        </section>
      )}

      {understandingArtifact !== null && (
        <MissionUnderstandingView artifact={understandingArtifact} />
      )}

      <DownstreamFixtureView
        artifacts={view.artifacts}
        discoveryRuntimeMode={view.run.config.discoveryRuntimeMode}
      />

      <div className="grid gap-6 xl:grid-cols-[minmax(320px,0.78fr)_minmax(0,1.4fr)]">
        <section className="surface-card p-6 sm:p-8">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="eyebrow">Durable progress</p>
              <h2 className="mt-2 text-xl font-semibold">Stage timeline</h2>
            </div>
            <span className="text-xs text-neutral-500">Persisted in SQLite</span>
          </div>
          <ol className="mt-6 grid gap-2" data-testid="stage-timeline">
            {view.stages.map((stage, index) => (
              <li
                key={stage.name}
                className={`stage-row stage-${stage.status}`}
                data-stage={stage.name}
                data-stage-status={stage.status}
                aria-current={stage.status === "running" ? "step" : undefined}
              >
                <span className="stage-icon" aria-hidden="true">
                  {stage.status === "completed" || stage.status === "reused"
                    ? "✓"
                    : stage.status === "running"
                      ? "→"
                      : stage.status === "failed"
                        ? "!"
                        : index + 1}
                </span>
                <span className="min-w-0 flex-1">
                  <strong className="block truncate text-sm text-neutral-900">
                    {labels[stage.name]}
                  </strong>
                  <span className="text-xs text-neutral-500">
                    {stageStatusLabel(stage, view.run.config.discoveryRuntimeMode)}
                    {stage.attempt ? ` · attempt ${stage.attempt}` : ""}
                  </span>
                </span>
              </li>
            ))}
          </ol>
        </section>

        <section className="surface-card min-w-0 overflow-hidden">
          <div className="border-b border-neutral-200 px-6 py-5 sm:px-8">
            <p className="eyebrow">Generated artifacts</p>
            <h2 className="mt-2 text-xl font-semibold">Inspect what Cluvvi produced</h2>
          </div>
          <div className="grid min-h-[520px] md:grid-cols-[220px_minmax(0,1fr)]">
            <div className="border-b border-neutral-200 bg-neutral-50 p-3 md:border-r md:border-b-0">
              {view.artifacts.length === 0 ? (
                <p className="p-3 text-sm leading-6 text-neutral-500">
                  {terminal.has(view.run.status)
                    ? "No durable artifacts were produced for this run."
                    : "Preparing local run artifacts. Each completed stage will appear here."}
                </p>
              ) : (
                <div className="flex gap-2 overflow-x-auto md:grid md:overflow-visible">
                  {view.artifacts.map((artifact) => (
                    <button
                      key={artifact.id}
                      className={`artifact-tab ${selectedArtifact?.id === artifact.id ? "artifact-tab-active" : ""}`}
                      onClick={() => setSelectedArtifact(artifact)}
                      type="button"
                    >
                      <span className="capitalize">
                        {artifact.artifactType.replaceAll("_", " ")}
                      </span>
                      <small>v{artifact.version}</small>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="min-w-0 p-5 sm:p-7">
              {selectedArtifact === null ? (
                <div className="grid h-full place-items-center text-center text-sm leading-6 text-neutral-500">
                  {terminal.has(view.run.status)
                    ? "No artifact is available to inspect."
                    : "Preparing local run artifacts…"}
                </div>
              ) : (
                <div>
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <p className="fixture-badge inline-flex">Fixture output</p>
                      <h3 className="mt-3 text-lg font-semibold capitalize">
                        {selectedArtifact.artifactType.replaceAll("_", " ")}
                      </h3>
                      <p className="mt-1 text-xs text-neutral-500">
                        Schema {selectedArtifact.schemaVersion} · Created{" "}
                        {new Date(selectedArtifact.createdAt).toLocaleString()}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <button
                        className="button-secondary min-h-9 px-3 py-1 text-xs"
                        onClick={() => void copyArtifact()}
                      >
                        Copy
                      </button>
                      <button
                        className="button-secondary min-h-9 px-3 py-1 text-xs"
                        onClick={downloadArtifact}
                      >
                        Download
                      </button>
                    </div>
                  </div>
                  <pre className="json-viewer mt-5" data-testid="artifact-json">
                    {JSON.stringify(selectedArtifact.data, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          </div>
        </section>
      </div>

      <section className="surface-card p-6 sm:p-8">
        <details>
          <summary className="cursor-pointer font-semibold">
            Events and execution details ({view.events.length})
          </summary>
          <div className="mt-5 overflow-x-auto">
            <table className="w-full min-w-[680px] text-left text-sm">
              <thead className="text-xs uppercase tracking-wide text-neutral-500">
                <tr>
                  <th className="pb-3">Time</th>
                  <th className="pb-3">Event</th>
                  <th className="pb-3">Phase</th>
                  <th className="pb-3">Data</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {view.events.map((event) => (
                  <tr key={event.id}>
                    <td className="py-3 pr-4 text-neutral-500">
                      {new Date(event.createdAt).toLocaleTimeString()}
                    </td>
                    <td className="py-3 pr-4 font-medium">{event.eventType}</td>
                    <td className="py-3 pr-4">{labels[event.phase]}</td>
                    <td className="py-3 font-mono text-xs text-neutral-500">
                      {JSON.stringify(event.data)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      </section>
    </div>
  );
}
