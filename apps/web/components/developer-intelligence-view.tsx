import {
  DeveloperCommentMetadataArtifactV1Schema,
  DeveloperRepositoryCollectionArtifactV1Schema,
  DeveloperSignalsArtifactV1Schema,
  DeveloperSourcePlanArtifactV1Schema,
  DeveloperSourceRunTelemetryArtifactV1Schema,
  DeveloperThreadMetadataArtifactV1Schema,
  EvidenceFindingsArtifactV1Schema,
  RankedOpportunitiesArtifactV1Schema,
  type ArtifactRecord,
  type CluvviSourceAdapterMode,
  type CluvviSourceFamily,
} from "@cluvvi/core";

interface DeveloperIntelligenceViewProps {
  artifacts: ArtifactRecord[];
  sourceAdapterMode: CluvviSourceAdapterMode;
  sourceFamilies: CluvviSourceFamily[];
  githubDepth: "quick" | "default" | "deep";
  maximumQueries: number;
  maximumRepositories: number;
  maximumThreadDrill: number;
  developerSignalRuleVersion: string;
  runStatus: string;
  failureCode?: string;
}

function number(value: number): string {
  return new Intl.NumberFormat("en-US").format(value);
}

export function DeveloperIntelligenceView({
  artifacts,
  sourceAdapterMode,
  sourceFamilies,
  githubDepth,
  maximumQueries,
  maximumRepositories,
  maximumThreadDrill,
  developerSignalRuleVersion,
  runStatus,
  failureCode,
}: DeveloperIntelligenceViewProps) {
  if (sourceAdapterMode === "none" || !sourceFamilies.includes("developer")) return null;

  const planRecord = artifacts.find(
    (artifact) => artifact.artifactType === "developer_source_plan",
  );
  const repositoryRecord = artifacts.find(
    (artifact) => artifact.artifactType === "developer_repository_collection",
  );
  const threadMetadataRecord = artifacts.find(
    (artifact) => artifact.artifactType === "developer_thread_metadata",
  );
  const commentMetadataRecord = artifacts.find(
    (artifact) => artifact.artifactType === "developer_comment_metadata",
  );
  const signalsRecord = artifacts.find((artifact) => artifact.artifactType === "developer_signals");
  const telemetryRecord = artifacts.find(
    (artifact) => artifact.artifactType === "developer_source_telemetry",
  );
  const evidenceRecord = artifacts.find(
    (artifact) => artifact.artifactType === "evidence_findings",
  );
  const rankingRecord = artifacts.find(
    (artifact) => artifact.artifactType === "ranked_opportunities",
  );

  const plan =
    planRecord === undefined ? null : DeveloperSourcePlanArtifactV1Schema.parse(planRecord.data);
  const repositories =
    repositoryRecord === undefined
      ? null
      : DeveloperRepositoryCollectionArtifactV1Schema.parse(repositoryRecord.data);
  const threadMetadata =
    threadMetadataRecord === undefined
      ? null
      : DeveloperThreadMetadataArtifactV1Schema.parse(threadMetadataRecord.data);
  const commentMetadata =
    commentMetadataRecord === undefined
      ? null
      : DeveloperCommentMetadataArtifactV1Schema.parse(commentMetadataRecord.data);
  const signals =
    signalsRecord === undefined ? null : DeveloperSignalsArtifactV1Schema.parse(signalsRecord.data);
  const telemetry =
    telemetryRecord === undefined
      ? null
      : DeveloperSourceRunTelemetryArtifactV1Schema.parse(telemetryRecord.data);
  const evidence =
    evidenceRecord === undefined
      ? null
      : EvidenceFindingsArtifactV1Schema.parse(evidenceRecord.data);
  const ranking =
    rankingRecord === undefined
      ? null
      : RankedOpportunitiesArtifactV1Schema.parse(rankingRecord.data);

  if (
    plan === null ||
    repositories === null ||
    threadMetadata === null ||
    commentMetadata === null ||
    signals === null ||
    telemetry === null
  ) {
    const failed = runStatus === "failed" && /DEVELOPER|GITHUB/iu.test(failureCode ?? "");
    return (
      <section
        className={`rounded-3xl border p-6 sm:p-8 ${failed ? "border-rose-200 bg-rose-50" : "border-neutral-200 bg-neutral-50"}`}
        data-testid={failed ? "developer-intelligence-failure" : "developer-intelligence-running"}
      >
        <p className={`eyebrow ${failed ? "text-rose-700" : "text-neutral-500"}`}>
          C1-J.3 GitHub developer intelligence
        </p>
        <h2
          className={`mt-2 text-xl font-semibold ${failed ? "text-rose-950" : "text-neutral-950"}`}
        >
          {failed
            ? "Developer artifacts were rejected at a durable boundary"
            : "Collecting bounded public GitHub evidence"}
        </h2>
        <p
          className={`mt-3 max-w-3xl text-sm leading-6 ${failed ? "text-rose-900" : "text-neutral-600"}`}
        >
          {failed
            ? `Earlier discovery, hiring, community, and completed developer stages remain reusable. Repair the rejected developer sidecar and resume the same run. Failure: ${failureCode}.`
            : `Depth ${githubDepth}: up to ${maximumQueries} semantic queries, ${maximumRepositories} public repositories, and ${maximumThreadDrill} selected issue/PR thread drills.`}
        </p>
      </section>
    );
  }

  const developerMaterials =
    evidence?.materials.filter((material) =>
      [
        "github_repository",
        "github_thread",
        "github_comment",
        "github_release",
        "developer_signal",
      ].includes(material.kind),
    ) ?? [];
  const appliedContribution =
    ranking?.opportunities.filter((opportunity) => opportunity.developerContribution.applied)
      .length ?? 0;

  return (
    <section className="surface-card overflow-hidden" data-testid="developer-intelligence-view">
      <div className="border-b border-neutral-200 bg-neutral-50/70 px-6 py-5 sm:px-8">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="eyebrow">C1-J.3 GitHub developer intelligence</p>
            <h2 className="mt-2 text-xl font-semibold text-neutral-950">
              Public repositories, developer threads, selected comments, releases, and cautious
              signals
            </h2>
            <p className="mt-2 max-w-4xl text-sm leading-6 text-neutral-600">
              GitHub evidence is bounded and untrusted. It may strengthen problem and implementation
              context only; it does not prove representative demand, company or buyer identity,
              contact identity, budget, authority, or purchase intent. GitHub usernames and author
              associations remain attribution only. No private repositories, cloning, source/diff
              downloads, asset downloads, mutations, or developer/contact enrichment are used.
            </p>
          </div>
          <span className="fixture-badge">
            GitHub · {plan.policy.depth} · {telemetry.accessMode.replaceAll("_", " ")}
          </span>
        </div>
      </div>

      <dl className="grid gap-3 border-b border-neutral-200 p-5 sm:grid-cols-2 xl:grid-cols-8 sm:p-7">
        {[
          ["Queries", plan.summary.queriesSelected],
          ["Repositories", repositories.repositories.length],
          ["Threads", threadMetadata.threads.length],
          ["Drilled", telemetry.totals.threadsDrilled],
          ["Comments", telemetry.totals.commentsAccepted],
          ["Releases", telemetry.totals.releasesAccepted],
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

      <div className="grid gap-5 border-b border-neutral-200 p-5 sm:p-7 lg:grid-cols-2">
        <article className="rounded-3xl border border-neutral-200 bg-neutral-50 p-5">
          <p className="eyebrow">Selected public repositories</p>
          <div className="mt-3 grid gap-3" data-testid="developer-repository-list">
            {repositories.repositories.length === 0 ? (
              <p className="text-sm text-neutral-600">
                No public repository passed the bounded relevance and public-only checks.
              </p>
            ) : (
              repositories.repositories.map((repository) => (
                <div
                  className="rounded-2xl border border-neutral-200 bg-white p-4"
                  data-testid="developer-repository-card"
                  key={repository.repositoryId}
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <strong className="break-all text-sm text-neutral-950">
                      {repository.fullName}
                    </strong>
                    <span className="fixture-badge">public</span>
                    {repository.archived && <span className="fixture-badge">archived</span>}
                    {repository.fork && <span className="fixture-badge">fork</span>}
                  </div>
                  <p className="mt-2 text-xs leading-5 text-neutral-500">
                    {repository.primaryLanguage ?? "language unknown"} ·{" "}
                    {repository.releases.length} retained release(s)
                  </p>
                </div>
              ))
            )}
          </div>
        </article>

        <article className="rounded-3xl border border-neutral-200 bg-neutral-50 p-5">
          <p className="eyebrow">Selected issue / pull-request context</p>
          <div className="mt-3 grid gap-3" data-testid="developer-thread-list">
            {threadMetadata.threads.length === 0 ? (
              <p className="text-sm text-neutral-600">
                No public issue or pull request passed the local temporal/relevance window. This is
                a valid zero-result developer outcome, not fabricated evidence.
              </p>
            ) : (
              threadMetadata.threads.map((thread) => (
                <div
                  className="rounded-2xl border border-neutral-200 bg-white p-4"
                  data-testid="developer-thread-card"
                  key={thread.threadArtifactId}
                >
                  <div className="flex flex-wrap gap-2">
                    <span className="fixture-badge">{thread.threadKind.replaceAll("_", " ")}</span>
                    <span className="fixture-badge">#{thread.nativeNumber}</span>
                    <span className="fixture-badge">
                      relevance {thread.relevanceScore.toFixed(2)}
                    </span>
                    {thread.selectedForDrill && <span className="fixture-badge">drilled</span>}
                  </div>
                  <p className="mt-2 break-all text-xs text-neutral-500">
                    {thread.repositoryFullName}
                  </p>
                </div>
              ))
            )}
          </div>
        </article>
      </div>

      <div className="grid gap-4 border-b border-neutral-200 p-5 sm:p-7">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="eyebrow">Deterministic developer signals</p>
          <span className="fixture-badge">{developerSignalRuleVersion}</span>
        </div>
        {signals.signals.length === 0 ? (
          <p className="text-sm text-neutral-600">
            No qualifying developer signal was generated. Zero signals remain a valid bounded
            outcome.
          </p>
        ) : (
          signals.signals.map((signal) => (
            <article
              className="rounded-2xl border border-amber-200 bg-amber-50 p-4"
              data-testid="developer-signal-card"
              key={signal.signalId}
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <strong className="text-sm text-amber-950">
                  {signal.type.replaceAll("_", " ")}
                </strong>
                <div className="flex flex-wrap gap-2">
                  <span className="fixture-badge">confidence {signal.confidence.toFixed(2)}</span>
                  <span className="fixture-badge">{signal.independentRepositoryCount} repo(s)</span>
                  <span className="fixture-badge">{signal.independentThreadCount} thread(s)</span>
                </div>
              </div>
              <p className="mt-3 text-sm leading-6 text-amber-950">{signal.inference}</p>
              <p className="mt-2 text-xs leading-5 text-amber-900">
                {signal.limitations.join(" ")}
              </p>
            </article>
          ))
        )}
      </div>

      <div className="grid gap-4 border-b border-neutral-200 p-5 sm:p-7 md:grid-cols-3">
        <article className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4">
          <p className="eyebrow">Evidence retained</p>
          <strong className="mt-2 block text-2xl text-neutral-950">
            {number(developerMaterials.length)}
          </strong>
          <p className="mt-2 text-xs leading-5 text-neutral-500">
            Public repository/thread/comment/release/signal materials linked only to existing
            candidate entities.
          </p>
        </article>
        <article className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4">
          <p className="eyebrow">Ranking contribution</p>
          <strong className="mt-2 block text-2xl text-neutral-950">+1 / max</strong>
          <p className="mt-2 text-xs leading-5 text-neutral-500">
            Applied to {number(appliedContribution)} opportunity/opportunities only when a
            qualifying signal has at least two independent repositories and two threads.
          </p>
        </article>
        <article className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4">
          <p className="eyebrow">Identity boundary</p>
          <strong className="mt-2 block text-lg text-neutral-950">Developer identity unused</strong>
          <p className="mt-2 text-xs leading-5 text-neutral-500">
            {number(commentMetadata.comments.length)} retained comment metadata record(s); none can
            become buyer/contact identity evidence.
          </p>
        </article>
      </div>

      <div
        className="bg-neutral-950 px-6 py-5 text-sm text-neutral-200 sm:px-8"
        data-testid="developer-telemetry"
      >
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-6">
          <p>
            Access:{" "}
            <strong className="text-white">{telemetry.accessMode.replaceAll("_", " ")}</strong>
          </p>
          <p>
            Search requests:{" "}
            <strong className="text-white">{telemetry.totals.issueSearchRequests}</strong>
          </p>
          <p>
            Core/detail requests:{" "}
            <strong className="text-white">
              {telemetry.totals.repositoryMetadataRequests +
                telemetry.totals.issueDetailRequests +
                telemetry.totals.pullRequestDetailRequests}
            </strong>
          </p>
          <p>
            Rate-limit events:{" "}
            <strong className="text-white">{telemetry.totals.rateLimitEvents}</strong>
          </p>
          <p>
            Private rejected:{" "}
            <strong className="text-white">{telemetry.totals.privateResourcesRejected}</strong>
          </p>
          <p>
            Paid credits: <strong className="text-white">{telemetry.totals.paidCredits}</strong>
          </p>
        </div>
      </div>
    </section>
  );
}
