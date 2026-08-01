import {
  BuyerMapArtifactV1Schema,
  EvidenceFindingsArtifactV1Schema,
  IdentityEnrichmentArtifactV1Schema,
  RankedOpportunitiesArtifactV1Schema,
  type ArtifactRecord,
  type EvidenceFindingV1,
} from "@cluvvi/core";

interface DownstreamFixtureViewProps {
  artifacts: ArtifactRecord[];
}

function artifactData(artifacts: ArtifactRecord[], artifactType: ArtifactRecord["artifactType"]) {
  return artifacts.find((artifact) => artifact.artifactType === artifactType)?.data;
}

function findingTone(finding: EvidenceFindingV1): string {
  if (!finding.positive) return "border-red-200 bg-red-50 text-red-950";
  if (finding.stale || finding.strength === "weak") {
    return "border-amber-200 bg-amber-50 text-amber-950";
  }
  return "border-emerald-200 bg-emerald-50 text-emerald-950";
}

function confidenceTone(confidence: "low" | "medium" | "high"): string {
  if (confidence === "high") return "border-emerald-200 bg-emerald-50 text-emerald-800";
  if (confidence === "medium") return "border-amber-200 bg-amber-50 text-amber-800";
  return "border-neutral-200 bg-neutral-100 text-neutral-700";
}

export function DownstreamFixtureView({ artifacts }: DownstreamFixtureViewProps) {
  const evidenceResult = EvidenceFindingsArtifactV1Schema.safeParse(
    artifactData(artifacts, "evidence_findings"),
  );
  const identityResult = IdentityEnrichmentArtifactV1Schema.safeParse(
    artifactData(artifacts, "identity_enrichment"),
  );
  const rankedResult = RankedOpportunitiesArtifactV1Schema.safeParse(
    artifactData(artifacts, "ranked_opportunities"),
  );
  const buyerMapResult = BuyerMapArtifactV1Schema.safeParse(artifactData(artifacts, "buyer_map"));

  if (
    !evidenceResult.success ||
    !identityResult.success ||
    !rankedResult.success ||
    !buyerMapResult.success
  ) {
    return null;
  }

  const evidence = evidenceResult.data;
  const identity = identityResult.data;
  const ranked = rankedResult.data;
  const buyerMap = buyerMapResult.data;
  const rankingByEntity = new Map(
    ranked.opportunities.map((opportunity) => [opportunity.entityKey, opportunity] as const),
  );

  return (
    <section
      className="surface-card overflow-hidden"
      data-testid="project-b-fixture-pipeline"
      aria-labelledby="buyer-map-heading"
    >
      <div className="border-b border-neutral-200 bg-neutral-50/70 px-6 py-5 sm:px-8">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="eyebrow">Project B fixture pipeline</p>
            <h2
              id="buyer-map-heading"
              className="mt-2 text-2xl font-semibold tracking-tight text-neutral-950"
            >
              Fixture Buyer Map
            </h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-neutral-600">
              Cluvvi validated a version-controlled <code>search_results.v2</code> fixture through
              Evidence, Identity, Ranking, and Buyer Map. Every company and URL below is synthetic.
            </p>
          </div>
          <span className="fixture-badge inline-flex shrink-0 self-start">
            Synthetic · no live discovery
          </span>
        </div>
      </div>

      <div className="grid gap-8 p-6 sm:p-8">
        <dl className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <div className="metric-card">
            <dt>Ranked opportunities</dt>
            <dd>{buyerMap.summary.rankedOpportunityCount}</dd>
          </div>
          <div className="metric-card">
            <dt>Positive findings</dt>
            <dd>{buyerMap.summary.positiveEvidenceCount}</dd>
          </div>
          <div className="metric-card">
            <dt>Negative findings</dt>
            <dd>{buyerMap.summary.negativeEvidenceCount}</dd>
          </div>
          <div className="metric-card">
            <dt>Coverage gaps</dt>
            <dd>{buyerMap.summary.coverageGapCount}</dd>
          </div>
        </dl>

        <section aria-labelledby="ranked-fixture-opportunities-heading">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="eyebrow">Deterministic ranking</p>
              <h3
                id="ranked-fixture-opportunities-heading"
                className="mt-2 text-xl font-semibold text-neutral-950"
              >
                Ranked fixture opportunities
              </h3>
            </div>
            <span className="text-xs text-neutral-500">
              Transparent scorecard · not purchase prediction
            </span>
          </div>

          <div className="mt-5 grid gap-5" data-testid="buyer-map-opportunities">
            {buyerMap.opportunities.map((opportunity) => {
              const ranking = rankingByEntity.get(opportunity.entityKey);
              return (
                <article
                  key={opportunity.rankedOpportunityId}
                  className="rounded-3xl border border-neutral-200 bg-white p-5 shadow-sm sm:p-6"
                  data-testid="buyer-map-opportunity"
                >
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="grid size-8 place-items-center rounded-full bg-neutral-950 text-sm font-semibold text-white">
                          {opportunity.rank}
                        </span>
                        <span
                          className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide ${confidenceTone(opportunity.confidence)}`}
                        >
                          {opportunity.confidence} confidence
                        </span>
                      </div>
                      <h4 className="mt-3 text-xl font-semibold text-neutral-950">
                        {opportunity.companyName}
                      </h4>
                      {opportunity.companyDomain !== undefined && (
                        <code className="mt-1 block break-all text-xs text-neutral-500">
                          {opportunity.companyDomain}
                        </code>
                      )}
                      <p className="mt-3 max-w-3xl text-sm leading-6 text-neutral-700">
                        {opportunity.whyItMayBeWorthContacting}
                      </p>
                    </div>
                    <div className="rounded-2xl bg-neutral-950 px-5 py-4 text-white lg:min-w-32 lg:text-right">
                      <span className="block text-xs uppercase tracking-wide text-neutral-400">
                        Score
                      </span>
                      <strong className="mt-1 block text-3xl">{opportunity.score}</strong>
                    </div>
                  </div>

                  <div className="mt-5 grid gap-4 lg:grid-cols-2">
                    <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4">
                      <p className="eyebrow">Likely buyer route</p>
                      <p className="mt-2 text-sm font-semibold text-neutral-950">
                        {opportunity.likelyDepartment}
                      </p>
                      <p className="mt-2 text-sm leading-6 text-neutral-600">
                        {opportunity.likelyDecisionMakerTitles.join(" · ")}
                      </p>
                      <p className="mt-3 text-xs font-medium text-neutral-800">
                        {opportunity.manualContactRoute.label}
                      </p>
                      <p className="mt-1 text-xs leading-5 text-neutral-500">
                        {opportunity.manualContactRoute.instructions}
                      </p>
                      {opportunity.manualContactRoute.url !== undefined && (
                        <code className="mt-2 block break-all text-[11px] text-neutral-500">
                          {opportunity.manualContactRoute.url}
                        </code>
                      )}
                    </div>

                    <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4">
                      <p className="eyebrow">Score breakdown</p>
                      <div className="mt-3 grid gap-2">
                        {ranking?.scoreComponents.map((component) => (
                          <div
                            key={component.key}
                            className="flex items-start justify-between gap-4 text-xs"
                          >
                            <span className="leading-5 text-neutral-600">
                              {component.key.replaceAll("_", " ")}
                            </span>
                            <strong
                              className={
                                component.points < 0
                                  ? "text-red-700"
                                  : component.points > 0
                                    ? "text-emerald-700"
                                    : "text-neutral-400"
                              }
                            >
                              {component.points > 0 ? "+" : ""}
                              {component.points}
                            </strong>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="mt-5 grid gap-3" data-testid="buyer-map-evidence">
                    {opportunity.evidence.map((citation) => (
                      <div
                        key={citation.evidenceFindingId}
                        className={`rounded-2xl border p-4 ${
                          citation.positive
                            ? citation.strength === "weak"
                              ? "border-amber-200 bg-amber-50"
                              : "border-emerald-200 bg-emerald-50"
                            : "border-red-200 bg-red-50"
                        }`}
                      >
                        <div className="flex flex-wrap items-center gap-2 text-[10px] font-semibold uppercase tracking-wide">
                          <span>{citation.positive ? "Positive" : "Negative"}</span>
                          <span>·</span>
                          <span>{citation.strength}</span>
                          <span>·</span>
                          <span>{citation.signalType.replaceAll("_", " ")}</span>
                        </div>
                        <p className="mt-2 text-sm leading-6 text-neutral-800">
                          {citation.summary}
                        </p>
                        <code className="mt-2 block break-all text-[11px] text-neutral-500">
                          {citation.sourceUrl}
                        </code>
                      </div>
                    ))}
                  </div>

                  {opportunity.risks.length > 0 && (
                    <div className="mt-5 rounded-2xl border border-red-200 bg-red-50 p-4">
                      <p className="eyebrow text-red-700">Risks</p>
                      <ul className="mt-2 list-disc space-y-1 pl-5 text-xs leading-5 text-red-950">
                        {opportunity.risks.map((risk) => (
                          <li key={risk}>{risk}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        </section>

        <section className="grid gap-5 xl:grid-cols-2">
          <div className="rounded-3xl border border-neutral-200 bg-white p-5 sm:p-6">
            <p className="eyebrow">Evidence ledger</p>
            <h3 className="mt-2 text-lg font-semibold text-neutral-950">
              Positive, weak, stale, and negative findings
            </h3>
            <div className="mt-4 grid max-h-[520px] gap-3 overflow-y-auto pr-1">
              {evidence.findings.map((finding) => (
                <article
                  key={finding.id}
                  className={`rounded-2xl border p-4 ${findingTone(finding)}`}
                >
                  <div className="flex flex-wrap gap-2 text-[10px] font-semibold uppercase tracking-wide">
                    <span>{finding.positive ? "Positive" : "Negative"}</span>
                    <span>·</span>
                    <span>{finding.strength}</span>
                    {finding.stale && (
                      <>
                        <span>·</span>
                        <span>Stale</span>
                      </>
                    )}
                  </div>
                  <p className="mt-2 text-sm font-medium leading-6">{finding.summary}</p>
                  <p className="mt-1 text-xs leading-5 opacity-80">{finding.supportingText}</p>
                  <code className="mt-2 block break-all text-[10px] opacity-70">
                    {finding.sourceUrl}
                  </code>
                </article>
              ))}
            </div>
          </div>

          <div className="rounded-3xl border border-neutral-200 bg-white p-5 sm:p-6">
            <p className="eyebrow">Identity hypotheses</p>
            <h3 className="mt-2 text-lg font-semibold text-neutral-950">
              Roles only — no fabricated people or private contacts
            </h3>
            <div className="mt-4 grid gap-3">
              {identity.hypotheses.map((hypothesis) => (
                <article
                  key={hypothesis.id}
                  className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h4 className="font-semibold text-neutral-950">{hypothesis.companyName}</h4>
                      <p className="mt-1 text-xs text-neutral-500">{hypothesis.likelyDepartment}</p>
                    </div>
                    <span
                      className={`rounded-full border px-2 py-1 text-[10px] font-semibold uppercase ${confidenceTone(hypothesis.confidence)}`}
                    >
                      {hypothesis.confidence}
                    </span>
                  </div>
                  <p className="mt-3 text-sm leading-6 text-neutral-700">
                    {hypothesis.likelyDecisionMakerTitles.join(" · ")}
                  </p>
                  <p className="mt-2 text-xs leading-5 text-neutral-500">{hypothesis.rationale}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="grid gap-5 lg:grid-cols-2">
          <div className="rounded-3xl border border-amber-200 bg-amber-50 p-5 sm:p-6">
            <p className="eyebrow text-amber-800">Coverage gaps</p>
            <div className="mt-3 grid gap-3" data-testid="buyer-map-coverage-gaps">
              {buyerMap.coverageGaps.map((gap) => (
                <div key={gap.sourceZone}>
                  <h3 className="text-sm font-semibold capitalize text-amber-950">
                    {gap.sourceZone.replaceAll("_", " ")}
                  </h3>
                  <p className="mt-1 text-xs leading-5 text-amber-900">{gap.reason}</p>
                  <p className="mt-1 text-xs font-medium leading-5 text-amber-950">
                    {gap.suggestedAction}
                  </p>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-3xl border border-neutral-200 bg-neutral-50 p-5 sm:p-6">
            <p className="eyebrow">Warnings and limitations</p>
            <ul className="mt-3 list-disc space-y-2 pl-5 text-xs leading-5 text-neutral-700">
              {[...new Set([...buyerMap.warnings, ...buyerMap.confidenceLimitations])].map(
                (warning) => (
                  <li key={warning}>{warning}</li>
                ),
              )}
            </ul>
          </div>
        </section>
      </div>
    </section>
  );
}
