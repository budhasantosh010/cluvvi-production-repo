import {
  EvidenceFindingsArtifactV1Schema,
  RankedOpportunitiesArtifactV1Schema,
  SpecializedFindingsArtifactV1Schema,
  SpecializedSignalsArtifactV1Schema,
  SpecializedSourceCandidateCollectionArtifactV1Schema,
  SpecializedSourceContextArtifactV1Schema,
  SpecializedSourcePlanArtifactV1Schema,
  SpecializedSourceRunTelemetryArtifactV1Schema,
  type ArtifactRecord,
  type CluvviSourceAdapterMode,
  type CluvviSourceFamily,
} from "@cluvvi/core";

interface SpecializedIntelligenceViewProps {
  artifacts: ArtifactRecord[];
  sourceAdapterMode: CluvviSourceAdapterMode;
  sourceFamilies: CluvviSourceFamily[];
  signalRuleVersion: string;
  contextRuleVersion: string;
  coverageVersion: string;
  registryVersion: string;
  runStatus: string;
  failureCode?: string;
}

function number(value: number): string {
  return new Intl.NumberFormat("en-US").format(value);
}

export function SpecializedIntelligenceView({
  artifacts,
  sourceAdapterMode,
  sourceFamilies,
  signalRuleVersion,
  contextRuleVersion,
  coverageVersion,
  registryVersion,
  runStatus,
  failureCode,
}: SpecializedIntelligenceViewProps) {
  if (sourceAdapterMode === "none" || !sourceFamilies.includes("specialized")) return null;

  const byType = (type: ArtifactRecord["artifactType"]) =>
    artifacts.find((artifact) => artifact.artifactType === type);
  const contextRecord = byType("specialized_source_context");
  const candidateRecord = byType("specialized_source_candidates");
  const planRecord = byType("specialized_source_plan");
  const findingsRecord = byType("specialized_findings");
  const signalsRecord = byType("specialized_signals");
  const telemetryRecord = byType("specialized_source_telemetry");
  const evidenceRecord = byType("evidence_findings");
  const rankingRecord = byType("ranked_opportunities");

  const context =
    contextRecord === undefined
      ? null
      : SpecializedSourceContextArtifactV1Schema.parse(contextRecord.data);
  const candidates =
    candidateRecord === undefined
      ? null
      : SpecializedSourceCandidateCollectionArtifactV1Schema.parse(candidateRecord.data);
  const plan =
    planRecord === undefined ? null : SpecializedSourcePlanArtifactV1Schema.parse(planRecord.data);
  const findings =
    findingsRecord === undefined
      ? null
      : SpecializedFindingsArtifactV1Schema.parse(findingsRecord.data);
  const signals =
    signalsRecord === undefined
      ? null
      : SpecializedSignalsArtifactV1Schema.parse(signalsRecord.data);
  const telemetry =
    telemetryRecord === undefined
      ? null
      : SpecializedSourceRunTelemetryArtifactV1Schema.parse(telemetryRecord.data);
  const evidence =
    evidenceRecord === undefined
      ? null
      : EvidenceFindingsArtifactV1Schema.parse(evidenceRecord.data);
  const ranking =
    rankingRecord === undefined
      ? null
      : RankedOpportunitiesArtifactV1Schema.parse(rankingRecord.data);

  if (
    context === null ||
    candidates === null ||
    plan === null ||
    findings === null ||
    signals === null ||
    telemetry === null
  ) {
    const failed =
      runStatus === "failed" && /SPECIALIZED|ARXIV|TECHMEME|DIGG/iu.test(failureCode ?? "");
    return (
      <section
        className={`rounded-3xl border p-6 sm:p-8 ${failed ? "border-rose-200 bg-rose-50" : "border-neutral-200 bg-neutral-50"}`}
        data-testid={
          failed ? "specialized-intelligence-failure" : "specialized-intelligence-running"
        }
      >
        <p className={`eyebrow ${failed ? "text-rose-700" : "text-neutral-500"}`}>
          C1-J.5 universal specialized source intelligence
        </p>
        <h2
          className={`mt-2 text-xl font-semibold ${failed ? "text-rose-950" : "text-neutral-950"}`}
        >
          {failed
            ? "Specialized-source artifacts were rejected at a durable boundary"
            : "Selecting known and dynamically discovered specialist sources"}
        </h2>
        <p
          className={`mt-3 max-w-3xl text-sm leading-6 ${failed ? "text-rose-900" : "text-neutral-600"}`}
        >
          {failed
            ? `Earlier completed stages remain reusable. Repair the rejected specialized sidecar and resume the same run. Failure: ${failureCode}.`
            : "Coverage is evaluated before and after bounded dynamic discovery. Dynamic candidates can use generic public routes only; they cannot inject executable adapters or arbitrary script paths."}
        </p>
      </section>
    );
  }

  const specializedMaterials =
    evidence?.materials.filter((material) =>
      ["specialized_finding", "specialized_signal"].includes(material.kind),
    ) ?? [];
  const appliedContribution =
    ranking?.opportunities.filter((opportunity) => opportunity.specializedContribution.applied)
      .length ?? 0;
  const allSelections = [...plan.knownSources, ...plan.selectedDynamicSources];
  const techPack = plan.selectedPacks.find(
    (pack) => pack.packId.includes("tech") || pack.packId.includes("ai"),
  );

  return (
    <section className="surface-card overflow-hidden" data-testid="specialized-intelligence-view">
      <div className="border-b border-neutral-200 bg-neutral-50/70 px-6 py-5 sm:px-8">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="eyebrow">C1-J.5 universal specialized source intelligence</p>
            <h2 className="mt-2 text-xl font-semibold text-neutral-950">
              Industry context, source packs, coverage gaps, dynamic discovery, and specialist
              findings
            </h2>
            <p className="mt-2 max-w-4xl text-sm leading-6 text-neutral-600">
              This is the top-level <strong>specialized</strong> family, not a research family.
              Source authority, publishers, authors, and organizations remain provenance only.
              Dynamic candidates are bounded to generic public routes and cannot add executable
              capability.
            </p>
          </div>
          <span className="fixture-badge">
            {plan.policy.mode} · registry {plan.registryVersion}
          </span>
        </div>
      </div>

      <dl className="grid gap-3 border-b border-neutral-200 p-5 sm:grid-cols-2 xl:grid-cols-8 sm:p-7">
        {[
          ["Packs", plan.selectedPacks.length],
          ["Known sources", plan.knownSources.length],
          ["Dynamic sources", plan.selectedDynamicSources.length],
          ["Candidates", candidates.summary.uniqueDomains],
          ["Findings", findings.findings.length],
          ["Signals", signals.signals.length],
          ["Failures", telemetry.sourceFailures],
          ["Paid", telemetry.paidCredits],
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
        <article
          className="rounded-3xl border border-neutral-200 bg-neutral-50 p-5"
          data-testid="specialized-context-card"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="eyebrow">Derived specialist context</p>
            <span className="fixture-badge">{contextRuleVersion}</span>
          </div>
          <div className="mt-4 grid gap-3">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-neutral-500">
                Industries
              </p>
              <p className="mt-1 text-sm text-neutral-900">
                {context.industries.map((item) => item.label).join(", ")}
              </p>
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-neutral-500">
                Geographies
              </p>
              <p className="mt-1 text-sm text-neutral-900">
                {context.geographies.map((item) => item.label).join(", ")}
              </p>
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-neutral-500">
                Desired signals
              </p>
              <p className="mt-1 text-sm text-neutral-900">
                {context.desiredSignals
                  .map((item) => item.signalType.replaceAll("_", " "))
                  .join(", ")}
              </p>
            </div>
          </div>
        </article>

        <article
          className="rounded-3xl border border-neutral-200 bg-neutral-50 p-5"
          data-testid="specialized-coverage-card"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="eyebrow">Coverage before → after</p>
            <span className="fixture-badge">{coverageVersion}</span>
          </div>
          <div className="mt-4 flex items-end gap-4">
            <strong className="text-4xl text-neutral-950">
              {Math.round(plan.coverageBeforeDiscovery.overallScore * 100)}%
            </strong>
            <span className="pb-1 text-neutral-400">→</span>
            <strong className="text-4xl text-neutral-950">
              {Math.round(plan.coverageAfterDiscovery.overallScore * 100)}%
            </strong>
          </div>
          <p className="mt-3 text-sm leading-6 text-neutral-600">
            Dynamic discovery:{" "}
            <strong>{plan.dynamicDiscoveryTriggered ? "triggered" : "not needed"}</strong>.{" "}
            {plan.discoveryQueries.length} bounded source-discovery query/queries were selected.
          </p>
          {plan.coverageBeforeDiscovery.signalCoverage.some((item) => item.gaps.length > 0) && (
            <div className="mt-3 text-xs leading-5 text-neutral-500">
              {plan.coverageBeforeDiscovery.signalCoverage
                .filter((item) => item.gaps.length > 0)
                .slice(0, 4)
                .map((item) => `${item.signalType.replaceAll("_", " ")}: ${item.gaps.join("; ")}`)
                .join(" · ")}
            </div>
          )}
        </article>
      </div>

      <div className="border-b border-neutral-200 p-5 sm:p-7" data-testid="specialized-source-list">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="eyebrow">Selected specialized sources</p>
          <span className="fixture-badge">registry digest {plan.registryDigest.slice(0, 12)}…</span>
        </div>
        <div className="mt-3 grid gap-3 lg:grid-cols-2">
          {allSelections.length === 0 ? (
            <p className="text-sm text-neutral-600">
              No specialist source passed the current bounded selection threshold.
            </p>
          ) : (
            allSelections.map((source) => (
              <article
                className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4"
                data-testid="specialized-source-card"
                key={source.selectionId}
              >
                <div className="flex flex-wrap gap-2">
                  <span className="fixture-badge">
                    {source.registered ? "registered" : "dynamic"}
                  </span>
                  <span className="fixture-badge">{source.sourceType.replaceAll("_", " ")}</span>
                  <span className="fixture-badge">
                    {source.authorityClass.replaceAll("_", " ")}
                  </span>
                  <span className="fixture-badge">score {source.score.toFixed(2)}</span>
                </div>
                <h3 className="mt-3 break-all text-sm font-semibold text-neutral-950">
                  {source.domain}
                </h3>
                <p className="mt-2 text-xs leading-5 text-neutral-500">
                  route: {source.selectedRoute.route.replaceAll("_", " ")} · signals:{" "}
                  {source.matchedSignals.map((signal) => signal.replaceAll("_", " ")).join(", ") ||
                    "none"}
                </p>
              </article>
            ))
          )}
        </div>
      </div>

      <div className="grid gap-5 border-b border-neutral-200 p-5 sm:p-7 lg:grid-cols-2">
        <article
          className="rounded-3xl border border-neutral-200 bg-neutral-50 p-5"
          data-testid="tech-ai-pack-card"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="eyebrow">Tech / AI Pack #1</p>
            <span className="fixture-badge">
              {techPack === undefined ? "not selected" : "selected"}
            </span>
          </div>
          <p className="mt-3 text-sm leading-6 text-neutral-700">
            Built-in dedicated routes are allowlisted for arXiv and Techmeme. Digg is optional and
            must degrade honestly when its CLI is not installed or lacks a supported
            machine-readable interface.
          </p>
          <dl className="mt-4 grid grid-cols-3 gap-3 text-center">
            <div className="rounded-2xl border border-neutral-200 bg-white p-3">
              <dt className="text-xs text-neutral-500">arXiv</dt>
              <dd className="mt-1 font-semibold">{telemetry.arxivRequests}</dd>
            </div>
            <div className="rounded-2xl border border-neutral-200 bg-white p-3">
              <dt className="text-xs text-neutral-500">Techmeme</dt>
              <dd className="mt-1 font-semibold">{telemetry.techmemeAttempts}</dd>
            </div>
            <div className="rounded-2xl border border-neutral-200 bg-white p-3">
              <dt className="text-xs text-neutral-500">Digg CLI</dt>
              <dd className="mt-1 font-semibold">{telemetry.diggProcessStarts}</dd>
            </div>
          </dl>
          {telemetry.warnings.length > 0 && (
            <p className="mt-3 text-xs leading-5 text-neutral-500">
              {telemetry.warnings.join(" ")}
            </p>
          )}
        </article>

        <article className="rounded-3xl border border-neutral-200 bg-neutral-50 p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="eyebrow">Candidate discovery</p>
            <span className="fixture-badge">{candidates.summary.candidatesAccepted} accepted</span>
          </div>
          <p className="mt-3 text-sm leading-6 text-neutral-700">
            {candidates.summary.searchResultsEvaluated} search result(s) were grouped into{" "}
            {candidates.summary.uniqueDomains} domain candidate(s). Dynamic candidates may use
            generic site search, feed, or page extraction only—never an arbitrary executable route.
          </p>
        </article>
      </div>

      <div className="border-b border-neutral-200 p-5 sm:p-7">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="eyebrow">Specialized findings and signals</p>
          <span className="fixture-badge">{signalRuleVersion}</span>
        </div>
        <div className="mt-3 grid gap-3 lg:grid-cols-2">
          {findings.findings.slice(0, 6).map((finding) => (
            <article
              className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4"
              data-testid="specialized-finding-card"
              key={finding.findingId}
            >
              <div className="flex flex-wrap gap-2">
                <span className="fixture-badge">{finding.findingType.replaceAll("_", " ")}</span>
                <span className="fixture-badge">{finding.authorityClass.replaceAll("_", " ")}</span>
              </div>
              <h3 className="mt-3 text-sm font-semibold text-neutral-950">{finding.title}</h3>
              <p className="mt-2 text-xs text-neutral-500">
                {finding.sourceDomain} · {finding.route.replaceAll("_", " ")}
              </p>
            </article>
          ))}
          {signals.signals.slice(0, 6).map((signal) => (
            <article
              className="rounded-2xl border border-amber-200 bg-amber-50 p-4"
              data-testid="specialized-signal-card"
              key={signal.signalId}
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <strong className="text-sm text-amber-950">
                  {signal.type.replaceAll("_", " ")}
                </strong>
                <span className="fixture-badge">
                  {signal.independentSourceCount} independent source(s)
                </span>
              </div>
              <p className="mt-3 text-sm leading-6 text-amber-950">{signal.inference}</p>
            </article>
          ))}
        </div>
      </div>

      <div className="grid gap-4 border-b border-neutral-200 p-5 sm:p-7 md:grid-cols-3">
        <article className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4">
          <p className="eyebrow">Evidence retained</p>
          <strong className="mt-2 block text-2xl text-neutral-950">
            {number(specializedMaterials.length)}
          </strong>
        </article>
        <article className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4">
          <p className="eyebrow">Ranking contribution</p>
          <strong className="mt-2 block text-2xl text-neutral-950">+1 / max</strong>
          <p className="mt-2 text-xs leading-5 text-neutral-500">
            Applied to {number(appliedContribution)} opportunity/opportunities only with
            corroborated mission-relevant evidence.
          </p>
        </article>
        <article className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4">
          <p className="eyebrow">Identity boundary</p>
          <strong className="mt-2 block text-lg text-neutral-950">
            Publisher/source identity only
          </strong>
        </article>
      </div>

      <div
        className="bg-neutral-950 px-6 py-5 text-sm text-neutral-200 sm:px-8"
        data-testid="specialized-telemetry"
      >
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-6">
          <p>
            Registry: <strong className="text-white">{registryVersion}</strong>
          </p>
          <p>
            Coverage:{" "}
            <strong className="text-white">
              {Math.round(telemetry.coverageBefore * 100)}% →{" "}
              {Math.round(telemetry.coverageAfter * 100)}%
            </strong>
          </p>
          <p>
            Discovery queries:{" "}
            <strong className="text-white">{telemetry.sourceDiscoveryQueries}</strong>
          </p>
          <p>
            Dynamic selected:{" "}
            <strong className="text-white">{telemetry.selectedDynamicSources}</strong>
          </p>
          <p>
            Source failures: <strong className="text-white">{telemetry.sourceFailures}</strong>
          </p>
          <p>
            Paid credits: <strong className="text-white">{telemetry.paidCredits}</strong>
          </p>
        </div>
      </div>
    </section>
  );
}
