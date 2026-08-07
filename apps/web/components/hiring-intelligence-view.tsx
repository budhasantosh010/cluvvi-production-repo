import {
  HiringSignalsArtifactV1Schema,
  JobCollectionArtifactV1Schema,
  SourceAdapterRunTelemetryV1Schema,
  SourceTargetPlanArtifactV1Schema,
  type ArtifactRecord,
  type CluvviSourceAdapterMode,
  type CluvviSourceFamily,
} from "@cluvvi/core";

interface HiringIntelligenceViewProps {
  artifacts: ArtifactRecord[];
  sourceAdapterMode: CluvviSourceAdapterMode;
  sourceFamilies: CluvviSourceFamily[];
  maximumTargets: number;
  maximumBoardsPerTarget: number;
  maximumJobsPerBoard: number;
  maximumJobsTotal: number;
  runStatus: string;
  failureCode?: string;
}

function tone(value: string): string {
  if (["success", "validated"].includes(value))
    return "border-emerald-200 bg-emerald-50 text-emerald-800";
  if (["partial", "auth_missing", "manual_required", "low_confidence"].includes(value)) {
    return "border-amber-200 bg-amber-50 text-amber-900";
  }
  return "border-rose-200 bg-rose-50 text-rose-900";
}

function number(value: number): string {
  return new Intl.NumberFormat("en-US").format(value);
}

export function HiringIntelligenceView({
  artifacts,
  sourceAdapterMode,
  sourceFamilies,
  maximumTargets,
  maximumBoardsPerTarget,
  maximumJobsPerBoard,
  maximumJobsTotal,
  runStatus,
  failureCode,
}: HiringIntelligenceViewProps) {
  if (sourceAdapterMode === "none" || !sourceFamilies.includes("hiring")) return null;
  const planRecord = artifacts.find((artifact) => artifact.artifactType === "source_target_plan");
  const jobsRecord = artifacts.find((artifact) => artifact.artifactType === "job_collection");
  const signalsRecord = artifacts.find((artifact) => artifact.artifactType === "hiring_signals");
  const telemetryRecord = artifacts.find(
    (artifact) => artifact.artifactType === "source_adapter_telemetry",
  );
  const plan =
    planRecord === undefined ? null : SourceTargetPlanArtifactV1Schema.parse(planRecord.data);
  const jobs =
    jobsRecord === undefined ? null : JobCollectionArtifactV1Schema.parse(jobsRecord.data);
  const signals =
    signalsRecord === undefined ? null : HiringSignalsArtifactV1Schema.parse(signalsRecord.data);
  const telemetry =
    telemetryRecord === undefined
      ? null
      : SourceAdapterRunTelemetryV1Schema.parse(telemetryRecord.data);

  if (plan === null || jobs === null || signals === null || telemetry === null) {
    const failed =
      runStatus === "failed" &&
      /SOURCE_TARGET|JOB_COLLECTION|HIRING|SOURCE_ADAPTER/iu.test(failureCode ?? "");
    return (
      <section
        className={`rounded-3xl border p-6 sm:p-8 ${
          failed ? "border-rose-200 bg-rose-50" : "border-neutral-200 bg-neutral-50"
        }`}
        data-testid={failed ? "hiring-intelligence-failure" : "hiring-intelligence-running"}
      >
        <p className={`eyebrow ${failed ? "text-rose-700" : "text-neutral-500"}`}>
          C1-J public hiring intelligence
        </p>
        <h2
          className={`mt-2 text-xl font-semibold ${failed ? "text-rose-950" : "text-neutral-950"}`}
        >
          {failed ? "Hiring artifacts were rejected" : "Collecting bounded public hiring evidence"}
        </h2>
        <p
          className={`mt-3 max-w-3xl text-sm leading-6 ${failed ? "text-rose-900" : "text-neutral-600"}`}
        >
          {failed
            ? `Earlier durable search work remains reusable. Repair the four hiring sidecars and resume the same run. Failure: ${failureCode}.`
            : `Up to ${maximumTargets} companies, ${maximumBoardsPerTarget} boards per company, ${maximumJobsPerBoard} jobs per board, and ${maximumJobsTotal} jobs total are being evaluated.`}
        </p>
      </section>
    );
  }

  const boardById = new Map(jobs.boards.map((board) => [board.boardId, board]));
  return (
    <section className="surface-card overflow-hidden" data-testid="hiring-intelligence-view">
      <div className="border-b border-neutral-200 bg-neutral-50/70 px-6 py-5 sm:px-8">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="eyebrow">C1-J public hiring intelligence</p>
            <h2 className="mt-2 text-xl font-semibold text-neutral-950">
              Public ATS jobs and cautious hiring signals
            </h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-neutral-600">
              Every job and derived signal is untrusted public evidence. It does not prove budget,
              expansion, replacement hiring, an approved project, a person&apos;s identity,
              purchasing authority, or purchase intent.
            </p>
          </div>
          <span className="fixture-badge">Hiring · selected sources</span>
        </div>
      </div>

      <dl className="grid gap-3 border-b border-neutral-200 p-5 sm:grid-cols-2 xl:grid-cols-6 sm:p-7">
        {[
          ["Targets", plan.summary.targetsSelected],
          ["Boards", jobs.summary.boardsValidated],
          ["Active jobs", jobs.summary.activeJobs],
          ["Signals", signals.summary.signalsGenerated],
          ["Keyless requests", telemetry.totals.keylessRequests],
          ["Paid requests", telemetry.totals.paidRequests],
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
        data-testid="hiring-target-list"
      >
        {plan.targets.map((target) => {
          const targetBoards = jobs.boards.filter((board) => board.targetId === target.targetId);
          const targetJobs = jobs.jobs.filter((job) => job.targetId === target.targetId);
          const targetSignals = signals.signals.filter(
            (signal) => signal.targetId === target.targetId,
          );
          return (
            <article
              className="min-w-0 rounded-3xl border border-neutral-200 bg-neutral-50 p-5"
              data-testid="hiring-target-card"
              key={target.targetId}
            >
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap gap-2">
                    <span
                      className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${tone(target.status)}`}
                    >
                      {target.status.replaceAll("_", " ")}
                    </span>
                    <span className="fixture-badge">confidence {target.confidence.toFixed(2)}</span>
                  </div>
                  <h3 className="mt-3 text-lg font-semibold text-neutral-950">
                    {target.companyNameHint}
                  </h3>
                  <p className="mt-1 break-all text-xs text-neutral-500">
                    {target.companyDomainHint ?? "No confirmed public domain"}
                  </p>
                </div>
                <dl className="grid shrink-0 grid-cols-3 gap-3 text-center text-xs">
                  <div>
                    <dt className="text-neutral-500">Boards</dt>
                    <dd className="mt-1 text-base font-semibold">{targetBoards.length}</dd>
                  </div>
                  <div>
                    <dt className="text-neutral-500">Jobs</dt>
                    <dd className="mt-1 text-base font-semibold">{targetJobs.length}</dd>
                  </div>
                  <div>
                    <dt className="text-neutral-500">Signals</dt>
                    <dd className="mt-1 text-base font-semibold">{targetSignals.length}</dd>
                  </div>
                </dl>
              </div>

              <div className="mt-5 grid gap-3 lg:grid-cols-2" data-testid="hiring-board-list">
                {targetBoards.map((board) => (
                  <div
                    className="rounded-2xl border border-neutral-200 bg-white p-4"
                    key={board.boardId}
                  >
                    <div className="flex flex-wrap gap-2">
                      <span
                        className={`rounded-full border px-2 py-1 text-xs font-semibold ${tone(board.status)}`}
                      >
                        {board.status.replaceAll("_", " ")}
                      </span>
                      <span className="fixture-badge">{board.providerId.replaceAll("_", " ")}</span>
                      <span className="fixture-badge">
                        {board.accessCategory.replaceAll("_", " ")}
                      </span>
                    </div>
                    <p className="mt-3 break-all text-xs text-neutral-600">
                      {board.publicBoardUrl}
                    </p>
                    <p className="mt-2 text-xs text-neutral-500">
                      Relationship confidence {board.relationshipConfidence.toFixed(2)}
                    </p>
                  </div>
                ))}
              </div>

              {targetJobs.length > 0 && (
                <div className="mt-5 grid gap-3" data-testid="public-job-list">
                  <p className="eyebrow">Observed public jobs</p>
                  {targetJobs.slice(0, 50).map((job) => {
                    const board = boardById.get(job.boardId);
                    return (
                      <details
                        className="rounded-2xl border border-neutral-200 bg-white p-4"
                        key={job.jobId}
                      >
                        <summary className="cursor-pointer list-none">
                          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                            <div className="min-w-0">
                              <p className="font-semibold text-neutral-950">{job.title}</p>
                              <p className="mt-1 text-xs text-neutral-500">
                                {[job.department, job.roleFamily, job.seniority, job.workplaceType]
                                  .filter(Boolean)
                                  .join(" · ")}
                              </p>
                            </div>
                            <span className="fixture-badge">
                              {board?.providerId ?? job.sourceProviderId}
                            </span>
                          </div>
                        </summary>
                        <div className="mt-4 grid gap-3 text-sm text-neutral-700">
                          <p>{job.descriptionText ?? "No public description text was retained."}</p>
                          <p>
                            <strong>Locations:</strong>{" "}
                            {job.locations.map((location) => location.rawText).join(", ") ||
                              "Not specified"}
                          </p>
                          <p>
                            <strong>Technologies:</strong>{" "}
                            {job.technologyMentions
                              .map((mention) => mention.canonicalName)
                              .join(", ") || "None detected"}
                          </p>
                          <a
                            className="break-all underline"
                            href={job.jobUrl}
                            rel="noreferrer"
                            target="_blank"
                          >
                            {job.jobUrl}
                          </a>
                          {job.limitations.length > 0 && (
                            <p className="text-xs text-neutral-500">{job.limitations.join(" ")}</p>
                          )}
                        </div>
                      </details>
                    );
                  })}
                </div>
              )}

              {targetSignals.length > 0 && (
                <div className="mt-5 grid gap-3" data-testid="hiring-signal-list">
                  <p className="eyebrow">Cautious derived signals</p>
                  {targetSignals.map((signal) => (
                    <div
                      className="rounded-2xl border border-amber-200 bg-amber-50 p-4"
                      key={signal.signalId}
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <strong className="text-sm text-amber-950">
                          {signal.type.replaceAll("_", " ")}
                        </strong>
                        <span className="fixture-badge">
                          confidence {signal.confidence.toFixed(2)}
                        </span>
                      </div>
                      <p className="mt-3 text-sm leading-6 text-amber-950">{signal.inference}</p>
                      <ul className="mt-3 grid gap-1 text-xs text-amber-900">
                        {signal.observedFacts.map((fact) => (
                          <li key={fact}>• {fact}</li>
                        ))}
                        {signal.limitations.map((limitation) => (
                          <li key={limitation}>• {limitation}</li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              )}
            </article>
          );
        })}
      </div>

      <div
        className="grid gap-3 border-b border-neutral-200 bg-white p-5 sm:grid-cols-2 sm:p-7 xl:grid-cols-3"
        data-testid="hiring-provider-ladder"
      >
        {telemetry.attempts.map((attempt, index) => (
          <article
            className="min-w-0 rounded-2xl border border-neutral-200 bg-neutral-50 p-4"
            data-provider={attempt.adapterId}
            data-outcome={attempt.outcome}
            key={`${attempt.adapterId}-${attempt.boardId ?? "none"}-${index}`}
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <strong className="break-words text-sm text-neutral-950">
                {attempt.adapterId.replaceAll("_", " ")}
              </strong>
              <span
                className={`rounded-full border px-2 py-1 text-xs font-semibold ${tone(attempt.outcome)}`}
              >
                {attempt.outcome.replaceAll("_", " ")}
              </span>
            </div>
            <p className="mt-2 text-xs text-neutral-500">
              {attempt.accessCategory.replaceAll("_", " ")} · {attempt.requests} request(s) ·{" "}
              {attempt.acceptedItems} accepted item(s)
            </p>
            {attempt.skippedReason !== undefined && (
              <p className="mt-2 text-xs leading-5 text-amber-800">{attempt.skippedReason}</p>
            )}
            {attempt.safeFailureMessage !== undefined && (
              <p className="mt-2 text-xs leading-5 text-rose-800">
                {attempt.safeFailureCode}: {attempt.safeFailureMessage}
              </p>
            )}
          </article>
        ))}
      </div>

      <div
        className="bg-neutral-950 px-6 py-5 text-sm text-neutral-200 sm:px-8"
        data-testid="hiring-telemetry"
      >
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <p>
            Authenticated-free requests:{" "}
            <strong className="text-white">{telemetry.totals.authenticatedFreeRequests}</strong>
          </p>
          <p>
            Failed requests:{" "}
            <strong className="text-white">{telemetry.totals.requestsFailed}</strong>
          </p>
          <p>
            Duplicates removed:{" "}
            <strong className="text-white">{telemetry.totals.duplicateJobs}</strong>
          </p>
          <p>
            Runtime: <strong className="text-white">{number(telemetry.totalRuntimeMs)} ms</strong>
          </p>
        </div>
        {telemetry.warnings.length > 0 && (
          <p className="mt-3 text-xs text-neutral-400">{telemetry.warnings.join(" ")}</p>
        )}
      </div>
    </section>
  );
}
