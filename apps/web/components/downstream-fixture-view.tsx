import {
  BuyerMapArtifactV1Schema,
  EvidenceFindingsArtifactV1Schema,
  IdentityEnrichmentArtifactV1Schema,
  RankedOpportunitiesArtifactV1Schema,
  type ArtifactRecord,
  type DiscoveryProviderMode,
  type DiscoveryRuntimeMode,
  type EvidenceFindingV1,
} from "@cluvvi/core";

interface DownstreamFixtureViewProps {
  artifacts: ArtifactRecord[];
  discoveryRuntimeMode: DiscoveryRuntimeMode;
  discoveryProviderMode: DiscoveryProviderMode;
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

function citationLabel(materialKind: string | undefined): string {
  if (materialKind === "structured_section") return "Structured section";
  if (materialKind === "structured_table") return "Structured table";
  if (materialKind === "structured_metadata") return "Document metadata";
  if (materialKind === "structured_footnote") return "Structured footnote";
  if (materialKind === "extracted_page_text") return "Extracted public page";
  if (materialKind === "extracted_metadata") return "Page metadata";
  if (materialKind === "extracted_json_ld") return "Public JSON-LD";
  if (materialKind === "public_job_posting") return "Observed public job";
  if (materialKind === "hiring_signal") return "Cautious hiring signal";
  if (materialKind === "reddit_thread") return "Public Reddit thread";
  if (materialKind === "reddit_comment") return "Selected Reddit comment";
  if (materialKind === "community_signal") return "Cautious community signal";
  if (materialKind === "github_repository") return "Public GitHub repository";
  if (materialKind === "github_thread") return "Public GitHub thread";
  if (materialKind === "github_comment") return "Selected GitHub comment";
  if (materialKind === "github_release") return "Published GitHub release";
  if (materialKind === "developer_signal") return "Cautious developer signal";
  return "Search snippet";
}

export function DownstreamFixtureView({
  artifacts,
  discoveryRuntimeMode,
  discoveryProviderMode,
}: DownstreamFixtureViewProps) {
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
  const structuredEvidence = evidence.evidenceSourceMode.includes("structured");
  const extractedEvidence = structuredEvidence || evidence.evidenceSourceMode.includes("extracted");
  const hiringEvidence = evidence.evidenceSourceMode.includes("hiring_intelligence");
  const communityEvidence = evidence.evidenceSourceMode.includes("community_intelligence");
  const developerEvidence = evidence.evidenceSourceMode.includes("developer_intelligence");
  const videoEvidence =
    evidence.evidenceSourceMode.includes("video_intelligence") ||
    evidence.materials.some(
      (material) => material.kind === "video_signal" || material.kind.startsWith("youtube_"),
    );
  const specializedEvidence =
    evidence.evidenceSourceMode.includes("specialized_intelligence") ||
    evidence.materials.some(
      (material) =>
        material.kind === "specialized_finding" || material.kind === "specialized_signal",
    );
  const localDiscovery = discoveryRuntimeMode === "local_discovery_engine";
  const liveDiscovery = discoveryProviderMode === "live_search";
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
            <p className="eyebrow">
              {liveDiscovery
                ? "Live search · deterministic local analysis"
                : localDiscovery
                  ? "Local Discovery Engine bridge"
                  : "Project B fixture pipeline"}
            </p>
            <h2
              id="buyer-map-heading"
              className="mt-2 text-2xl font-semibold tracking-tight text-neutral-950"
            >
              {liveDiscovery
                ? "Live-search Buyer Map"
                : localDiscovery
                  ? "Local-engine Fixture Buyer Map"
                  : "Fixture Buyer Map"}
            </h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-neutral-600">
              {liveDiscovery ? (
                <>
                  Cluvvi validated live <code>search_results.v2</code> and provider telemetry from
                  the standalone Discovery Engine, then ran deterministic Evidence, Identity,
                  Ranking, and Buyer Map logic.{" "}
                  {structuredEvidence
                    ? "Selected public HTML and documents contributed bounded sections, tables, metadata, and footnotes as untrusted evidence with complete provenance. "
                    : extractedEvidence
                      ? "Selected public-page metadata, visible text, and JSON-LD were included as untrusted evidence with complete provenance. "
                      : "Only provider snippets were used; result pages were not fetched. "}
                  {hiringEvidence
                    ? "Observed public job postings and deterministic hiring signals are also shown as bounded, untrusted evidence; they do not prove budget, expansion, replacement hiring, approved projects, or purchase intent. "
                    : ""}
                  {communityEvidence
                    ? "Sampled public Reddit threads, selected comments, and deterministic community signals are shown as anecdotal context; they do not prove representative demand, buyer identity, budget, authority, or purchase intent. "
                    : ""}
                  Buyer identity and contact routes remain hypotheses for manual verification.
                </>
              ) : localDiscovery ? (
                <>
                  Cluvvi validated <code>search_results.v2</code> returned by the standalone local
                  Discovery Engine in fixture-provider mode, then ran Evidence, Identity, Ranking,
                  and Buyer Map. This is not live customer discovery.
                </>
              ) : (
                <>
                  Cluvvi validated a version-controlled <code>search_results.v2</code> fixture
                  through Evidence, Identity, Ranking, and Buyer Map. Every company and URL below is
                  synthetic.
                </>
              )}
            </p>
          </div>
          <span className="fixture-badge inline-flex shrink-0 self-start">
            {communityEvidence
              ? hiringEvidence
                ? "Public hiring + community evidence"
                : "Public Reddit evidence · anecdotal"
              : hiringEvidence
                ? liveDiscovery
                  ? "Live search + public hiring evidence"
                  : "Public hiring evidence · manual verification"
                : liveDiscovery
                  ? structuredEvidence
                    ? "Live search + structured evidence"
                    : extractedEvidence
                      ? "Live search + page evidence"
                      : "Live snippets · manual verification"
                  : localDiscovery
                    ? structuredEvidence
                      ? "Fixture search + structured evidence"
                      : extractedEvidence
                        ? "Fixture search + public pages"
                        : "Local engine · fixture providers"
                    : "Synthetic · no live discovery"}
          </span>
        </div>
      </div>

      <div className="grid gap-8 p-6 sm:p-8">
        <dl className="grid gap-3 sm:grid-cols-2 xl:grid-cols-10">
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
          <div className="metric-card">
            <dt>Structured citations</dt>
            <dd>{buyerMap.summary.structuredEvidenceCitationCount}</dd>
          </div>
          <div className="metric-card" data-testid="buyer-map-public-job-count">
            <dt>Public job citations</dt>
            <dd>{buyerMap.summary.publicJobCitationCount}</dd>
          </div>
          <div className="metric-card" data-testid="buyer-map-hiring-signal-count">
            <dt>Hiring signal citations</dt>
            <dd>{buyerMap.summary.hiringSignalCitationCount}</dd>
          </div>
          <div className="metric-card" data-testid="buyer-map-reddit-thread-count">
            <dt>Reddit thread citations</dt>
            <dd>{buyerMap.summary.redditThreadCitationCount}</dd>
          </div>
          <div className="metric-card" data-testid="buyer-map-reddit-comment-count">
            <dt>Reddit comment citations</dt>
            <dd>{buyerMap.summary.redditCommentCitationCount}</dd>
          </div>
          <div className="metric-card" data-testid="buyer-map-community-signal-count">
            <dt>Community signal citations</dt>
            <dd>{buyerMap.summary.communitySignalCitationCount}</dd>
          </div>
          <div className="metric-card" data-testid="buyer-map-github-repository-count">
            <dt>GitHub repository citations</dt>
            <dd>{buyerMap.summary.githubRepositoryCitationCount}</dd>
          </div>
          <div className="metric-card" data-testid="buyer-map-github-thread-count">
            <dt>GitHub thread citations</dt>
            <dd>{buyerMap.summary.githubThreadCitationCount}</dd>
          </div>
          <div className="metric-card" data-testid="buyer-map-github-comment-count">
            <dt>GitHub comment citations</dt>
            <dd>{buyerMap.summary.githubCommentCitationCount}</dd>
          </div>
          <div className="metric-card" data-testid="buyer-map-github-release-count">
            <dt>GitHub release citations</dt>
            <dd>{buyerMap.summary.githubReleaseCitationCount}</dd>
          </div>
          <div className="metric-card" data-testid="buyer-map-developer-signal-count">
            <dt>Developer signal citations</dt>
            <dd>{buyerMap.summary.developerSignalCitationCount}</dd>
          </div>
          <div className="metric-card" data-testid="buyer-map-video-count">
            <dt>Video citations</dt>
            <dd>{buyerMap.summary.videoCitationCount}</dd>
          </div>
          <div className="metric-card" data-testid="buyer-map-video-signal-count">
            <dt>Video signal citations</dt>
            <dd>{buyerMap.summary.videoSignalCitationCount}</dd>
          </div>
          <div className="metric-card" data-testid="buyer-map-specialized-finding-count">
            <dt>Specialized finding citations</dt>
            <dd>{buyerMap.summary.specializedFindingCitationCount}</dd>
          </div>
          <div className="metric-card" data-testid="buyer-map-specialized-signal-count">
            <dt>Specialized signal citations</dt>
            <dd>{buyerMap.summary.specializedSignalCitationCount}</dd>
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
                {liveDiscovery
                  ? "Ranked live-search opportunities"
                  : "Ranked fixture opportunities"}
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
                        {ranking !== undefined && communityEvidence && (
                          <div
                            className="mt-2 rounded-xl border border-violet-200 bg-violet-50 p-3 text-xs leading-5 text-violet-950"
                            data-testid="buyer-map-community-ranking"
                          >
                            <strong>
                              Community contribution: +{ranking.communityContribution.points} / 1
                              max
                            </strong>
                            <p className="mt-1">{ranking.communityContribution.rationale}</p>
                            <p className="mt-1 text-violet-700">
                              {ranking.communityContribution.independentThreadCount} independent
                              thread(s) · maximum 8% of positive score
                            </p>
                          </div>
                        )}
                        {ranking !== undefined && developerEvidence && (
                          <div
                            className="mt-2 rounded-xl border border-sky-200 bg-sky-50 p-3 text-xs leading-5 text-sky-950"
                            data-testid="buyer-map-developer-ranking"
                          >
                            <strong>
                              Developer contribution: +{ranking.developerContribution.points} / 1
                              max
                            </strong>
                            <p className="mt-1">{ranking.developerContribution.rationale}</p>
                            <p className="mt-1 text-sky-700">
                              {ranking.developerContribution.independentRepositoryCount} independent
                              repo(s) · {ranking.developerContribution.independentThreadCount}{" "}
                              independent thread(s) · maximum 8% of positive score
                            </p>
                          </div>
                        )}
                        {ranking !== undefined && videoEvidence && (
                          <div
                            className="mt-2 rounded-xl border border-fuchsia-200 bg-fuchsia-50 p-3 text-xs leading-5 text-fuchsia-950"
                            data-testid="buyer-map-video-ranking"
                          >
                            <strong>
                              Video contribution: +{ranking.videoContribution.points} / 1 max
                            </strong>
                            <p className="mt-1">{ranking.videoContribution.rationale}</p>
                            <p className="mt-1 text-fuchsia-700">
                              {ranking.videoContribution.independentVideoCount} independent video(s)
                              · {ranking.videoContribution.independentChannelCount} independent
                              channel(s) · maximum 8% of positive score
                            </p>
                          </div>
                        )}
                        {ranking !== undefined && specializedEvidence && (
                          <div
                            className="mt-2 rounded-xl border border-teal-200 bg-teal-50 p-3 text-xs leading-5 text-teal-950"
                            data-testid="buyer-map-specialized-ranking"
                          >
                            <strong>
                              Specialized contribution: +{ranking.specializedContribution.points} /
                              1 max
                            </strong>
                            <p className="mt-1">{ranking.specializedContribution.rationale}</p>
                            <p className="mt-1 text-teal-700">
                              {ranking.specializedContribution.independentSourceCount} independent
                              source(s) · maximum 8% of positive score
                            </p>
                          </div>
                        )}
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
                          <span>·</span>
                          <span data-testid="buyer-map-provenance-badge">
                            {citationLabel(citation.materialKind)}
                          </span>
                        </div>
                        <p className="mt-2 text-sm leading-6 text-neutral-800">
                          {citation.summary}
                        </p>
                        <code className="mt-2 block break-all text-[11px] text-neutral-500">
                          {citation.sourceUrl}
                        </code>
                        {(citation.sectionId !== undefined ||
                          citation.tableId !== undefined ||
                          citation.parserVersion !== undefined) && (
                          <p className="mt-2 break-all font-mono text-[10px] text-neutral-500">
                            {citation.headingPath?.join(" › ") ?? ""}
                            {citation.sectionId === undefined
                              ? ""
                              : ` · section ${citation.sectionId}`}
                            {citation.tableId === undefined ? "" : ` · table ${citation.tableId}`}
                            {citation.parserVersion === undefined
                              ? ""
                              : ` · parser ${citation.parserVersion}`}
                          </p>
                        )}
                        {(citation.materialKind === "reddit_thread" ||
                          citation.materialKind === "reddit_comment" ||
                          citation.materialKind === "community_signal") && (
                          <div
                            className="mt-3 grid gap-1 rounded-xl border border-violet-200 bg-violet-50/70 p-3 text-[11px] leading-5 text-violet-950"
                            data-testid="buyer-map-community-provenance"
                          >
                            <p className="break-words">
                              {citation.subreddit === undefined
                                ? "Public Reddit"
                                : `r/${citation.subreddit}`}
                              {citation.relevanceScore === undefined
                                ? ""
                                : ` · relevance ${citation.relevanceScore.toFixed(2)}`}
                              {citation.redditLocalScore === undefined
                                ? ""
                                : ` · local score ${citation.redditLocalScore.toFixed(2)}`}
                            </p>
                            {citation.communitySignalType !== undefined && (
                              <p>Signal: {citation.communitySignalType.replaceAll("_", " ")}</p>
                            )}
                            {citation.engagementObservationSource !== undefined && (
                              <p>
                                Engagement:{" "}
                                {citation.engagementObservationSource.replaceAll("_", " ")}
                                {citation.engagementStalePossible ? " · possibly stale" : ""}
                              </p>
                            )}
                            <p className="text-violet-700">
                              Sampled public discussion is anecdotal. It does not prove
                              representative demand, buyer identity, budget, authority, or purchase
                              intent.
                            </p>
                          </div>
                        )}
                        {(citation.materialKind === "github_repository" ||
                          citation.materialKind === "github_thread" ||
                          citation.materialKind === "github_comment" ||
                          citation.materialKind === "github_release" ||
                          citation.materialKind === "developer_signal") && (
                          <div
                            className="mt-3 grid gap-1 rounded-xl border border-sky-200 bg-sky-50/70 p-3 text-[11px] leading-5 text-sky-950"
                            data-testid="buyer-map-developer-provenance"
                          >
                            <p className="break-words">
                              {citation.repositoryFullName ?? "Public GitHub"}
                              {citation.developerThreadKind === undefined
                                ? ""
                                : ` · ${citation.developerThreadKind.replaceAll("_", " ")}`}
                              {citation.developerThreadNumber === undefined
                                ? ""
                                : ` #${citation.developerThreadNumber}`}
                            </p>
                            {citation.developerSignalType !== undefined && (
                              <p>Signal: {citation.developerSignalType.replaceAll("_", " ")}</p>
                            )}
                            {citation.releaseTagName !== undefined && (
                              <p>
                                Release: {citation.releaseTagName}
                                {citation.releasePrerelease ? " · prerelease" : ""}
                              </p>
                            )}
                            {(citation.independentRepositoryCount !== undefined ||
                              citation.independentThreadCount !== undefined) && (
                              <p>
                                Support: {citation.independentRepositoryCount ?? 0} repo(s) ·{" "}
                                {citation.independentThreadCount ?? 0} thread(s)
                              </p>
                            )}
                            <p className="text-sky-700">
                              Public GitHub context is bounded and untrusted. Usernames and author
                              associations are attribution only; this evidence does not prove buyer
                              identity, contact identity, representative demand, budget, authority,
                              or purchase intent.
                            </p>
                          </div>
                        )}
                        {(citation.materialKind === "public_job_posting" ||
                          citation.materialKind === "hiring_signal") && (
                          <div
                            className="mt-3 grid gap-1 rounded-xl border border-neutral-200/80 bg-white/60 p-3 text-[11px] leading-5 text-neutral-700"
                            data-testid="buyer-map-hiring-provenance"
                          >
                            <p className="break-words">
                              Provider:{" "}
                              <strong>{citation.hiringProviderId ?? "derived signal"}</strong>
                              {citation.accessCategory === undefined
                                ? ""
                                : ` · ${citation.accessCategory.replaceAll("_", " ")}`}
                            </p>
                            {citation.companyName !== undefined && (
                              <p className="break-words">Company: {citation.companyName}</p>
                            )}
                            {citation.roleFamily !== undefined && (
                              <p className="break-words">
                                Role: {citation.roleFamily.replaceAll("_", " ")}
                                {citation.seniority === undefined
                                  ? ""
                                  : ` · ${citation.seniority.replaceAll("_", " ")}`}
                              </p>
                            )}
                            {citation.technologyMentions !== undefined &&
                              citation.technologyMentions.length > 0 && (
                                <p className="break-words">
                                  Explicit technologies: {citation.technologyMentions.join(", ")}
                                </p>
                              )}
                            {citation.confidence !== undefined && (
                              <p>Signal confidence: {citation.confidence.toFixed(2)}</p>
                            )}
                            <p className="text-neutral-500">
                              Hiring evidence is current public evidence only; it is not proof of
                              budget or purchase intent.
                            </p>
                          </div>
                        )}
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
