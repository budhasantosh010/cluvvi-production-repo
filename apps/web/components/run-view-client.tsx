"use client";

import { CommunityIntelligenceView } from "@/components/community-intelligence-view";
import { DownstreamFixtureView } from "@/components/downstream-fixture-view";
import { ExtractionEvidenceView } from "@/components/extraction-evidence-view";
import { HiringIntelligenceView } from "@/components/hiring-intelligence-view";
import { MissionUnderstandingView } from "@/components/mission-understanding-view";
import { StructuredContentView } from "@/components/structured-content-view";
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
  frontier: "Crawl frontier",
  extraction: "Public-page extraction",
  extraction_telemetry: "Extraction telemetry",
  structured_parsing: "Structured content parsing",
  content_parse_telemetry: "Content parse telemetry",
  source_targeting: "Hiring source targeting",
  hiring_retrieval: "Public hiring retrieval",
  hiring_analysis: "Hiring signal analysis",
  source_adapter_telemetry: "Source-adapter telemetry",
  community_planning: "Reddit community planning",
  community_retrieval: "Reddit thread retrieval",
  community_thread_context: "Reddit thread context",
  community_comment_retrieval: "Reddit comment retrieval",
  community_comment_context: "Reddit comment context",
  community_analysis: "Community signal analysis",
  community_source_telemetry: "Community source telemetry",
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
  discoveryProviderMode: RunView["run"]["config"]["discoveryProviderMode"],
): string {
  if (stage.name === "discovery") {
    if (stage.status === "running") {
      return discoveryProviderMode === "live_search"
        ? "Running provider-policy-controlled search through the local Discovery Engine"
        : discoveryRuntimeMode === "local_discovery_engine"
          ? "Running the local Discovery Engine in fixture-provider mode"
          : "Loading fixture discovery results";
    }
    if (stage.status === "reused") return "Reused from durable state";
    if (stage.status === "completed") {
      return discoveryProviderMode === "live_search"
        ? "Imported and validated live search results, provider telemetry, and policy trace"
        : discoveryRuntimeMode === "local_discovery_engine"
          ? "Ran the local Discovery Engine in fixture-provider mode"
          : "Loaded fixture discovery results";
    }
  }
  if (stage.name === "frontier") {
    if (stage.status === "running") return "Validating the deterministic crawl frontier";
    if (stage.status === "completed") return "Imported the validated public-page frontier";
    if (stage.status === "reused") return "Reused the durable crawl frontier";
  }
  if (stage.name === "extraction") {
    if (stage.status === "running") return "Validating bounded public-page extraction";
    if (stage.status === "completed") return "Imported normalized untrusted page evidence";
    if (stage.status === "reused") return "Reused validated extracted content";
  }
  if (stage.name === "extraction_telemetry") {
    if (stage.status === "running") return "Validating extraction attempts, limits, and totals";
    if (stage.status === "completed") return "Imported extraction telemetry";
    if (stage.status === "reused") return "Reused extraction telemetry";
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
      view.stages.filter((stage) => ["completed", "reused", "skipped"].includes(stage.status))
        .length,
    [view.stages],
  );
  const understandingArtifact = useMemo(
    () =>
      view.artifacts.find((artifact) => artifact.artifactType === "mission_understanding") ?? null,
    [view.artifacts],
  );
  const localDiscovery = view.run.config.discoveryRuntimeMode === "local_discovery_engine";
  const liveDiscovery = view.run.config.discoveryProviderMode === "live_search";
  const extractionEnabled = view.run.config.discoveryExtractionMode === "selected_public_pages";
  const hiringEnabled =
    view.run.config.discoverySourceAdapterMode === "selected_sources" &&
    view.run.config.discoverySourceFamilies.includes("hiring");
  const communityEnabled =
    view.run.config.discoverySourceAdapterMode === "selected_sources" &&
    view.run.config.discoverySourceFamilies.includes("community");
  const telemetry = view.providerTelemetry;
  const policyTrace = view.providerPolicyTrace;
  const providerPolicy = view.run.config.discoveryProviderPolicy;
  const policyLabel =
    providerPolicy === "free_only"
      ? "Free only"
      : providerPolicy === "balanced"
        ? "Balanced"
        : "Paid deep";
  const telemetryProviders = telemetry
    ? [...new Set(telemetry.providerExecutions.map((execution) => execution.providerId))]
    : [];
  const failedProviderExecutions =
    telemetry?.providerExecutions.filter((execution) => !execution.success).length ?? 0;
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
          {liveDiscovery
            ? `Live search · ${policyLabel}.`
            : localDiscovery
              ? "Local Discovery Engine · fixture providers only."
              : "Fixture Buyer Map — no live market results."}
        </strong>
        <span>
          {liveDiscovery
            ? providerPolicy === "free_only"
              ? `This run used free search providers only. Paid providers were blocked by policy. Cluvvi validated search_results.v2, provider telemetry, and the provider policy trace before deterministic downstream analysis. ${
                  extractionEnabled
                    ? "Selected public pages were then fetched through bounded SSRF-safe extraction and treated as untrusted source data."
                    : "Only provider snippets were used; no result page was fetched."
                }`
              : providerPolicy === "balanced"
                ? `This run used free providers first and permitted paid fallback only when configured coverage thresholds were not met. Cluvvi preserved the provider order, fallback reason, and paid usage. ${
                    extractionEnabled
                      ? "Selected public pages were then fetched within explicit frontier and response-size limits."
                      : "Only provider snippets were used."
                  }`
                : `This run used explicit paid-deep search routing with bounded request and credit budgets. ${
                    extractionEnabled
                      ? "Selected public pages were subsequently extracted through the standalone safe-fetch boundary."
                      : "No result page was fetched."
                  }`
            : localDiscovery
              ? extractionEnabled
                ? "This run used the standalone local Discovery Engine with fixture providers, then fetched selected public pages through bounded extraction. Fixture search results remain synthetic; extracted public-page claims are unverified source evidence."
                : "This run used the standalone local Discovery Engine with fixture providers. It does not represent live customer discovery. Cluvvi validated its search_results.v2 output before running Evidence, Identity, Ranking, and Buyer Map."
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
                {liveDiscovery
                  ? `${policyLabel} · local engine`
                  : localDiscovery
                    ? "Fixture · local engine"
                    : "Fixture"}
              </span>
              <span className="fixture-badge">
                {extractionEnabled
                  ? `Extraction · max ${view.run.config.discoveryMaximumExtractions}`
                  : "Search only"}
              </span>
              <span className="fixture-badge">
                {hiringEnabled
                  ? `Hiring · ${view.run.config.discoveryMaximumHiringTargets} targets`
                  : "Hiring disabled"}
              </span>
              <span className="fixture-badge">
                {communityEnabled
                  ? `Reddit · ${view.run.config.discoveryRedditDepth} · ${view.run.config.discoveryMaximumRedditThreads} threads max`
                  : "Community disabled"}
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
              <strong>
                {completedCount} / {view.stages.length}
              </strong>
            </div>
            <div className="metric-card">
              <span>Discovery runtime</span>
              <strong>
                {liveDiscovery
                  ? "Local live search"
                  : localDiscovery
                    ? "Local fixture"
                    : "Internal fixture"}
              </strong>
            </div>
            <div className="metric-card">
              <span>Page evidence</span>
              <strong>
                {extractionEnabled
                  ? `Up to ${view.run.config.discoveryMaximumExtractions} pages`
                  : "Disabled"}
              </strong>
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

      {liveDiscovery && telemetry !== null && (
        <section
          className="surface-card smooth-panel p-6 sm:p-8"
          data-testid="live-provider-telemetry"
        >
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="eyebrow">Live provider telemetry</p>
              <h2 className="mt-2 text-xl font-semibold text-neutral-950">
                Search coverage and bounded usage
              </h2>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-neutral-600">
                Provider attempts are imported from the standalone Discovery Engine sidecar. A
                failed provider can coexist with a valid partial result set; warnings and unsearched
                zones remain visible rather than being converted into false completeness.
              </p>
            </div>
            <span className="fixture-badge">
              {failedProviderExecutions > 0 ? "Partial provider coverage" : "Providers completed"}
            </span>
          </div>
          <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            <div className="metric-card">
              <span>Providers attempted</span>
              <strong>{telemetryProviders.length}</strong>
            </div>
            <div className="metric-card">
              <span>Failed attempts</span>
              <strong>{failedProviderExecutions}</strong>
            </div>
            <div className="metric-card">
              <span>Tavily credits</span>
              <strong>{telemetry.usage.tavilyCredits}</strong>
            </div>
            <div className="metric-card">
              <span>Brave requests</span>
              <strong>{telemetry.usage.braveRequests}</strong>
            </div>
            <div className="metric-card">
              <span>HN requests</span>
              <strong>
                {telemetry.usage.hackerNewsAlgoliaRequests +
                  telemetry.usage.hackerNewsFirebaseRequests}
              </strong>
            </div>
          </div>
          <div className="mt-5 flex flex-wrap gap-2" data-testid="live-provider-list">
            {telemetryProviders.map((provider) => (
              <span className="status-pill status-completed" key={provider}>
                {provider.replaceAll("_", " ")}
              </span>
            ))}
          </div>
          {telemetry.warnings.length > 0 && (
            <details className="mt-5 rounded-2xl border border-neutral-200 bg-neutral-50 p-4">
              <summary className="cursor-pointer text-sm font-semibold text-neutral-900">
                Coverage warnings ({telemetry.warnings.length})
              </summary>
              <ul className="mt-3 grid gap-2 text-sm leading-6 text-neutral-600">
                {telemetry.warnings.map((warning) => (
                  <li key={warning}>{warning}</li>
                ))}
              </ul>
            </details>
          )}
        </section>
      )}

      {liveDiscovery && policyTrace !== null && (
        <section
          className="surface-card smooth-panel p-6 sm:p-8"
          data-testid="provider-policy-trace"
        >
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="eyebrow">Provider policy</p>
              <h2 className="mt-2 text-xl font-semibold text-neutral-950">
                {policyLabel} provider ladder
              </h2>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-neutral-600">
                {providerPolicy === "free_only"
                  ? "This run used free search providers only. Paid providers were blocked by policy."
                  : providerPolicy === "balanced"
                    ? policyTrace.paidFallbackUsed
                      ? "Free coverage was below the configured threshold, so an allowed paid fallback was used."
                      : "Free providers produced sufficient coverage. No paid search provider was used."
                    : "Paid providers were permitted for this run under the explicit paid-deep policy."}
              </p>
            </div>
            <span className="fixture-badge">{policyLabel}</span>
          </div>
          <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <div className="metric-card">
              <span>SearXNG requests</span>
              <strong>{telemetry?.usage.searxngRequests ?? 0}</strong>
            </div>
            <div className="metric-card">
              <span>DuckDuckGo requests</span>
              <strong>{telemetry?.usage.duckDuckGoRequests ?? 0}</strong>
            </div>
            <div className="metric-card">
              <span>Startpage requests</span>
              <strong>{telemetry?.usage.startpageRequests ?? 0}</strong>
            </div>
            <div className="metric-card">
              <span>Paid fallback</span>
              <strong>{policyTrace.paidFallbackUsed ? "Used" : "Not used"}</strong>
            </div>
          </div>
          <div className="mt-6 grid gap-3" data-testid="provider-ladder">
            {policyTrace.queries.flatMap((query) =>
              query.attempts.map((attempt) => (
                <article
                  className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4"
                  key={`${query.queryId}-${attempt.order}-${attempt.providerId}`}
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
                        Attempt {attempt.order}
                      </p>
                      <h3 className="mt-1 font-semibold text-neutral-950">
                        {attempt.providerId.replaceAll("_", " ")}
                      </h3>
                    </div>
                    <span className="status-pill status-completed">
                      {attempt.outcome.replaceAll("_", " ")}
                    </span>
                  </div>
                  <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-3">
                    <div>
                      <dt className="text-neutral-500">Accepted results</dt>
                      <dd className="font-medium text-neutral-900">{attempt.acceptedResults}</dd>
                    </div>
                    <div>
                      <dt className="text-neutral-500">Unique domains</dt>
                      <dd className="font-medium text-neutral-900">{attempt.uniqueDomains}</dd>
                    </div>
                    <div>
                      <dt className="text-neutral-500">Duplicate ratio</dt>
                      <dd className="font-medium text-neutral-900">
                        {(attempt.duplicateRatio * 100).toFixed(0)}%
                      </dd>
                    </div>
                  </dl>
                  {(attempt.skippedReason || attempt.safeFailureCode) && (
                    <p className="mt-3 text-sm leading-6 text-neutral-600">
                      {attempt.safeFailureCode ? `${attempt.safeFailureCode}: ` : ""}
                      {attempt.skippedReason ?? "Provider attempt failed safely."}
                    </p>
                  )}
                </article>
              )),
            )}
          </div>
          {policyTrace.queries.some((query) => query.paidFallbackReason) && (
            <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-950">
              <strong>Coverage threshold:</strong>{" "}
              {policyTrace.queries
                .map((query) => query.paidFallbackReason)
                .filter((value): value is string => Boolean(value))
                .join(" ")}
            </div>
          )}
          <p className="mt-5 text-sm leading-6 text-neutral-600">
            Search snippets only. Full pages were not extracted. Coverage may be incomplete, and
            free-provider availability may vary by network.
          </p>
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
        <MissionUnderstandingView
          artifact={understandingArtifact}
          discoveryProviderMode={view.run.config.discoveryProviderMode}
        />
      )}

      <ExtractionEvidenceView
        artifacts={view.artifacts}
        extractionMode={view.run.config.discoveryExtractionMode}
        maximumExtractions={view.run.config.discoveryMaximumExtractions}
        runStatus={view.run.status}
        {...(view.run.failure?.code === undefined ? {} : { failureCode: view.run.failure.code })}
      />

      <StructuredContentView
        artifacts={view.artifacts}
        structuredContentMode={view.run.config.discoveryStructuredContentMode}
        maximumStructuredResources={view.run.config.discoveryMaximumStructuredResources}
        maximumDocumentResources={view.run.config.discoveryMaximumDocumentResources}
        runStatus={view.run.status}
        {...(view.run.failure?.code === undefined ? {} : { failureCode: view.run.failure.code })}
      />

      <HiringIntelligenceView
        artifacts={view.artifacts}
        sourceAdapterMode={view.run.config.discoverySourceAdapterMode}
        sourceFamilies={view.run.config.discoverySourceFamilies}
        maximumTargets={view.run.config.discoveryMaximumHiringTargets}
        maximumBoardsPerTarget={view.run.config.discoveryMaximumHiringBoardsPerTarget}
        maximumJobsPerBoard={view.run.config.discoveryMaximumHiringJobsPerBoard}
        maximumJobsTotal={view.run.config.discoveryMaximumHiringJobsTotal}
        runStatus={view.run.status}
        {...(view.run.failure?.code === undefined ? {} : { failureCode: view.run.failure.code })}
      />

      <CommunityIntelligenceView
        artifacts={view.artifacts}
        sourceAdapterMode={view.run.config.discoverySourceAdapterMode}
        sourceFamilies={view.run.config.discoverySourceFamilies}
        redditDepth={view.run.config.discoveryRedditDepth}
        maximumQueries={view.run.config.discoveryMaximumRedditQueries}
        maximumSubreddits={view.run.config.discoveryMaximumRedditSubreddits}
        maximumThreads={view.run.config.discoveryMaximumRedditThreads}
        maximumThreadDrill={view.run.config.discoveryMaximumRedditThreadDrill}
        communitySignalRuleVersion={view.run.config.communitySignalRuleVersion}
        runStatus={view.run.status}
        {...(view.run.failure?.code === undefined ? {} : { failureCode: view.run.failure.code })}
      />

      <DownstreamFixtureView
        artifacts={view.artifacts}
        discoveryRuntimeMode={view.run.config.discoveryRuntimeMode}
        discoveryProviderMode={view.run.config.discoveryProviderMode}
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
                    {stageStatusLabel(
                      stage,
                      view.run.config.discoveryRuntimeMode,
                      view.run.config.discoveryProviderMode,
                    )}
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
                      <p className="fixture-badge inline-flex">
                        {liveDiscovery && selectedArtifact.artifactType === "search_results"
                          ? "Live search output"
                          : liveDiscovery
                            ? "Deterministic local analysis"
                            : "Fixture output"}
                      </p>
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
