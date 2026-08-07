import {
  CommunityCommentContextArtifactV1Schema,
  CommunitySignalsArtifactV1Schema,
  CommunitySourcePlanArtifactV1Schema,
  CommunitySourceRunTelemetryArtifactV1Schema,
  CommunityThreadContextArtifactV1Schema,
  EvidenceFindingsArtifactV1Schema,
  ThreadManifestArtifactV1Schema,
  type ArtifactRecord,
  type CluvviSourceAdapterMode,
  type CluvviSourceFamily,
} from "@cluvvi/core";

interface CommunityIntelligenceViewProps {
  artifacts: ArtifactRecord[];
  sourceAdapterMode: CluvviSourceAdapterMode;
  sourceFamilies: CluvviSourceFamily[];
  redditDepth: "quick" | "default" | "deep";
  maximumQueries: number;
  maximumSubreddits: number;
  maximumThreads: number;
  maximumThreadDrill: number;
  communitySignalRuleVersion: string;
  runStatus: string;
  failureCode?: string;
}

function number(value: number): string {
  return new Intl.NumberFormat("en-US").format(value);
}
function engagementLabel(input: {
  engagementObservations: Array<{
    source: string;
    stalePossible: boolean;
    upvotes?: number | undefined;
    comments?: number | undefined;
  }>;
}): string {
  const observation = [...input.engagementObservations].sort(
    (left, right) => Number(left.stalePossible) - Number(right.stalePossible),
  )[0];
  if (observation === undefined) return "Engagement unknown";
  const values = [
    observation.upvotes === undefined ? undefined : `${number(observation.upvotes)} upvotes`,
    observation.comments === undefined ? undefined : `${number(observation.comments)} comments`,
  ].filter(Boolean);
  return `${observation.source.replaceAll("_", " ")}${values.length > 0 ? ` · ${values.join(" · ")}` : ""}${observation.stalePossible ? " · possibly stale" : ""}`;
}

export function CommunityIntelligenceView({
  artifacts,
  sourceAdapterMode,
  sourceFamilies,
  redditDepth,
  maximumQueries,
  maximumSubreddits,
  maximumThreads,
  maximumThreadDrill,
  communitySignalRuleVersion,
  runStatus,
  failureCode,
}: CommunityIntelligenceViewProps) {
  if (sourceAdapterMode === "none" || !sourceFamilies.includes("community")) return null;
  const planRecord = artifacts.find(
    (artifact) => artifact.artifactType === "community_source_plan",
  );
  const manifestRecord = artifacts.find((artifact) => artifact.artifactType === "thread_manifest");
  const threadContextRecord = artifacts.find(
    (artifact) => artifact.artifactType === "community_thread_context",
  );
  const commentContextRecord = artifacts.find(
    (artifact) => artifact.artifactType === "community_comment_context",
  );
  const signalsRecord = artifacts.find((artifact) => artifact.artifactType === "community_signals");
  const telemetryRecord = artifacts.find(
    (artifact) => artifact.artifactType === "community_source_telemetry",
  );
  const evidenceRecord = artifacts.find(
    (artifact) => artifact.artifactType === "evidence_findings",
  );
  const plan =
    planRecord === undefined ? null : CommunitySourcePlanArtifactV1Schema.parse(planRecord.data);
  const manifest =
    manifestRecord === undefined ? null : ThreadManifestArtifactV1Schema.parse(manifestRecord.data);
  const threadContext =
    threadContextRecord === undefined
      ? null
      : CommunityThreadContextArtifactV1Schema.parse(threadContextRecord.data);
  const commentContext =
    commentContextRecord === undefined
      ? null
      : CommunityCommentContextArtifactV1Schema.parse(commentContextRecord.data);
  const signals =
    signalsRecord === undefined ? null : CommunitySignalsArtifactV1Schema.parse(signalsRecord.data);
  const telemetry =
    telemetryRecord === undefined
      ? null
      : CommunitySourceRunTelemetryArtifactV1Schema.parse(telemetryRecord.data);
  const evidence =
    evidenceRecord === undefined
      ? null
      : EvidenceFindingsArtifactV1Schema.parse(evidenceRecord.data);

  if (
    plan === null ||
    manifest === null ||
    threadContext === null ||
    commentContext === null ||
    signals === null ||
    telemetry === null
  ) {
    const failed =
      runStatus === "failed" && /COMMUNITY|THREAD|COMMENT|REDDIT/iu.test(failureCode ?? "");
    return (
      <section
        className={`rounded-3xl border p-6 sm:p-8 ${failed ? "border-rose-200 bg-rose-50" : "border-neutral-200 bg-neutral-50"}`}
        data-testid={failed ? "community-intelligence-failure" : "community-intelligence-running"}
      >
        <p className={`eyebrow ${failed ? "text-rose-700" : "text-neutral-500"}`}>
          C1-J.2 keyless community intelligence
        </p>
        <h2
          className={`mt-2 text-xl font-semibold ${failed ? "text-rose-950" : "text-neutral-950"}`}
        >
          {failed
            ? "Community artifacts were rejected at a durable boundary"
            : "Collecting bounded public Reddit evidence"}
        </h2>
        <p
          className={`mt-3 max-w-3xl text-sm leading-6 ${failed ? "text-rose-900" : "text-neutral-600"}`}
        >
          {failed
            ? `Earlier durable discovery and completed community stages remain reusable. Repair the rejected sidecar and resume the same run. Failure: ${failureCode}.`
            : `Depth ${redditDepth}: up to ${maximumQueries} queries, ${maximumSubreddits} subreddits, ${maximumThreads} threads, and ${maximumThreadDrill} selected thread drills.`}
        </p>
      </section>
    );
  }

  const threadMaterials =
    evidence?.materials.filter((material) => material.kind === "reddit_thread") ?? [];
  const commentMaterials =
    evidence?.materials.filter((material) => material.kind === "reddit_comment") ?? [];
  const contextById = new Map(
    threadContext.threads.map((context) => [context.threadArtifactId, context]),
  );

  return (
    <section className="surface-card overflow-hidden" data-testid="community-intelligence-view">
      <div className="border-b border-neutral-200 bg-neutral-50/70 px-6 py-5 sm:px-8">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="eyebrow">C1-J.2 keyless community intelligence</p>
            <h2 className="mt-2 text-xl font-semibold text-neutral-950">
              Public Reddit threads, selected comments, and cautious signals
            </h2>
            <p className="mt-2 max-w-4xl text-sm leading-6 text-neutral-600">
              Community evidence is sampled, anecdotal, and untrusted. It may strengthen
              problem/context evidence only; it does not prove representative demand, company or
              buyer identity, budget, authority, or purchase intent. No Reddit login, OAuth,
              cookies, paid API, private communities, or challenge bypass are used.
            </p>
          </div>
          <span className="fixture-badge">Reddit · {plan.policy.depth}</span>
        </div>
      </div>

      <dl className="grid gap-3 border-b border-neutral-200 p-5 sm:grid-cols-2 xl:grid-cols-7 sm:p-7">
        {[
          ["Queries", plan.summary.queriesSelected],
          ["Subreddits", plan.summary.subredditsSelected],
          ["Threads", manifest.summary.threadCount],
          ["Drilled", telemetry.totals.threadsDrilled],
          ["Comments", telemetry.totals.commentsAccepted],
          ["Signals", signals.signals.length],
          ["Paid", telemetry.totals.paidRequests],
        ].map(([label, value]) => (
          <div className="rounded-2xl border border-neutral-200 bg-white p-4" key={label}>
            <dt className="text-xs font-medium uppercase tracking-wide text-neutral-500">
              {label}
            </dt>
            <dd className="mt-2 text-xl font-semibold text-neutral-950">{number(Number(value))}</dd>
          </div>
        ))}
      </dl>

      <div
        className="grid gap-5 border-b border-neutral-200 p-5 sm:p-7"
        data-testid="community-plan"
      >
        <div className="grid gap-4 lg:grid-cols-2">
          <article className="rounded-3xl border border-neutral-200 bg-neutral-50 p-5">
            <p className="eyebrow">Semantic query plan</p>
            <div className="mt-3 grid gap-2">
              {plan.queries
                .filter((query) => query.selected)
                .map((query) => (
                  <div
                    className="rounded-2xl border border-neutral-200 bg-white p-3"
                    key={query.queryId}
                  >
                    <p className="text-sm font-semibold text-neutral-900">{query.query}</p>
                    <p className="mt-1 text-xs text-neutral-500">
                      {query.intent.replaceAll("_", " ")} · relevance intent{" "}
                      {query.importance.toFixed(2)}
                    </p>
                  </div>
                ))}
            </div>
          </article>
          <article className="rounded-3xl border border-neutral-200 bg-neutral-50 p-5">
            <p className="eyebrow">Selected subreddits</p>
            <div className="mt-3 flex flex-wrap gap-2" data-testid="community-subreddits">
              {plan.subredditTargets.map((target) => (
                <span className="fixture-badge" key={target.targetId}>
                  r/{target.subreddit} · {target.dedicated ? "dedicated" : "broad"}
                </span>
              ))}
            </div>
          </article>
        </div>
      </div>

      <div
        className="grid gap-4 border-b border-neutral-200 p-5 sm:p-7"
        data-testid="community-thread-list"
      >
        <p className="eyebrow">Mission-relevant public threads</p>
        {threadContext.threads.map((context) => {
          const material = threadMaterials.find(
            (item) => item.threadArtifactId === context.threadArtifactId,
          );
          return (
            <article
              className="min-w-0 rounded-3xl border border-neutral-200 bg-neutral-50 p-5"
              data-testid="community-thread-card"
              key={context.threadArtifactId}
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap gap-2">
                    <span className="fixture-badge">r/{context.subreddit}</span>
                    <span className="fixture-badge">
                      relevance {context.relevanceScore.toFixed(2)}
                    </span>
                    <span className="fixture-badge">
                      local score {context.redditLocalScore.toFixed(2)}
                    </span>
                    {context.selectedForDrill && (
                      <span className="fixture-badge">selected for comments</span>
                    )}
                  </div>
                  <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-neutral-800">
                    {material?.content ??
                      "Thread content retained in the external manifest; downstream context remains visible."}
                  </p>
                </div>
                <span
                  className="shrink-0 text-xs text-neutral-500"
                  data-testid="community-engagement-state"
                >
                  {engagementLabel(context)}
                </span>
              </div>
              {context.limitations.length > 0 && (
                <p className="mt-3 text-xs leading-5 text-neutral-500">
                  {context.limitations.join(" ")}
                </p>
              )}
            </article>
          );
        })}
      </div>

      <div
        className="grid gap-4 border-b border-neutral-200 p-5 sm:p-7"
        data-testid="community-comment-list"
      >
        <p className="eyebrow">Selected top-comment evidence</p>
        {commentContext.comments.length === 0 ? (
          <p className="text-sm text-neutral-600">
            No selected public comments were retained. Thread evidence remains usable without
            inventing missing comments.
          </p>
        ) : (
          commentContext.comments.map((context) => {
            const material = commentMaterials.find((item) => item.commentId === context.commentId);
            return (
              <article
                className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4"
                data-testid="community-comment-card"
                key={context.commentId}
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className="fixture-badge">
                    {contextById.get(context.threadArtifactId)?.subreddit ?? "reddit"}
                  </span>
                  <span className="fixture-badge">untrusted public content</span>
                </div>
                <p className="mt-3 text-sm leading-6 text-neutral-800">
                  {material?.content ??
                    "Selected comment metadata retained; comment text was not promoted into buyer identity."}
                </p>
              </article>
            );
          })
        )}
      </div>

      <div
        className="grid gap-4 border-b border-neutral-200 p-5 sm:p-7"
        data-testid="community-signal-list"
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="eyebrow">Deterministic community signals</p>
          <span className="fixture-badge">{communitySignalRuleVersion}</span>
        </div>
        {signals.signals.map((signal) => (
          <article
            className="rounded-2xl border border-amber-200 bg-amber-50 p-4"
            data-testid="community-signal-card"
            key={signal.signalId}
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <strong className="text-sm text-amber-950">{signal.type.replaceAll("_", " ")}</strong>
              <div className="flex flex-wrap gap-2">
                <span className="fixture-badge">confidence {signal.confidence.toFixed(2)}</span>
                <span className="fixture-badge">
                  {signal.independentThreadCount} independent thread(s)
                </span>
              </div>
            </div>
            <p className="mt-3 text-sm leading-6 text-amber-950">{signal.inference}</p>
            <p className="mt-2 text-xs leading-5 text-amber-900">{signal.limitations.join(" ")}</p>
          </article>
        ))}
      </div>

      <div
        className="bg-neutral-950 px-6 py-5 text-sm text-neutral-200 sm:px-8"
        data-testid="community-telemetry"
      >
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-6">
          <p>
            RSS requests:{" "}
            <strong className="text-white">{telemetry.totals.redditRssRequests}</strong>
          </p>
          <p>
            Listing requests:{" "}
            <strong className="text-white">{telemetry.totals.redditListingRequests}</strong>
          </p>
          <p>
            Comment requests:{" "}
            <strong className="text-white">{telemetry.totals.redditCommentRequests}</strong>
          </p>
          <p>
            Challenges:{" "}
            <strong className="text-white">{telemetry.totals.challengesDetected}</strong>
          </p>
          <p>
            Rate limits: <strong className="text-white">{telemetry.totals.rateLimits}</strong>
          </p>
          <p>
            Paid requests: <strong className="text-white">{telemetry.totals.paidRequests}</strong>
          </p>
        </div>
        <p className="mt-3 text-xs text-neutral-400">
          Challenge pages are classified and never bypassed. Arctic Shift observations, when
          present, are explicitly stale-possible rather than treated as live engagement.
        </p>
      </div>
    </section>
  );
}
