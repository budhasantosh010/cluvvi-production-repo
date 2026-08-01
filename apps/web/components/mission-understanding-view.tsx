import {
  FixtureArtifactEnvelopeSchema,
  MissionUnderstandingArtifactV1Schema,
  type ArtifactRecord,
  type MissionUnderstandingArtifactV1,
} from "@cluvvi/core";

interface MissionUnderstandingViewProps {
  artifact: ArtifactRecord;
}

function formatConfidence(value: number): string {
  return `${Math.round(value * 100)}%`;
}

function priorityClass(priority: "high" | "medium" | "low"): string {
  if (priority === "high") return "border-emerald-200 bg-emerald-50 text-emerald-800";
  if (priority === "medium") return "border-amber-200 bg-amber-50 text-amber-800";
  return "border-neutral-200 bg-neutral-100 text-neutral-600";
}

function parseUnderstanding(artifact: ArtifactRecord): MissionUnderstandingArtifactV1 | null {
  const envelope = FixtureArtifactEnvelopeSchema.safeParse(artifact.data);
  if (!envelope.success) return null;
  const understanding = MissionUnderstandingArtifactV1Schema.safeParse(envelope.data.data);
  return understanding.success ? understanding.data : null;
}

export function MissionUnderstandingView({ artifact }: MissionUnderstandingViewProps) {
  const understanding = parseUnderstanding(artifact);
  if (understanding === null) return null;

  const buyerLabels = new Map(
    understanding.buyerHypotheses.map((buyer) => [buyer.id, buyer.label] as const),
  );
  const priorityQueries = [
    ...understanding.searchQueries.filter((query) => query.priority === "high"),
    ...understanding.searchQueries.filter((query) => query.priority !== "high"),
  ].slice(0, 12);

  return (
    <section
      className="surface-card overflow-hidden"
      data-testid="mission-understanding"
      aria-labelledby="mission-understanding-heading"
    >
      <div className="border-b border-neutral-200 bg-neutral-50/70 px-6 py-5 sm:px-8">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="eyebrow">Deterministic market plan</p>
            <h2
              id="mission-understanding-heading"
              className="mt-2 text-2xl font-semibold tracking-tight text-neutral-950"
            >
              Mission understanding
            </h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-neutral-600">
              Cluvvi understood your market and generated a search plan locally. These planned
              queries were not sent to external sources. Project B uses a separate synthetic V2
              fixture to exercise the downstream pipeline.
            </p>
          </div>
          <span className="fixture-badge inline-flex shrink-0 self-start">
            Local · no live data
          </span>
        </div>
      </div>

      <div className="grid gap-8 p-6 sm:p-8">
        <section aria-labelledby="product-understanding-heading">
          <p className="eyebrow">Product understanding</p>
          <h3
            id="product-understanding-heading"
            className="mt-2 text-xl font-semibold text-neutral-950"
          >
            {understanding.productUnderstanding.productCategory}
          </h3>
          <p className="mt-3 max-w-4xl text-base leading-7 text-neutral-700">
            {understanding.productUnderstanding.conciseValueProposition}
          </p>
          <dl className="mt-5 grid gap-3 sm:grid-cols-3">
            <div className="metric-card">
              <dt>Likely sales motion</dt>
              <dd className="capitalize">
                {understanding.productUnderstanding.likelySalesMotion.replaceAll("_", " ")}
              </dd>
            </div>
            <div className="metric-card">
              <dt>Category confidence</dt>
              <dd>{formatConfidence(understanding.productUnderstanding.confidence)}</dd>
            </div>
            <div className="metric-card">
              <dt>Planned queries</dt>
              <dd>{understanding.searchQueries.length}</dd>
            </div>
          </dl>
        </section>

        <section aria-labelledby="buyer-hypotheses-heading">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="eyebrow">Best buyer hypotheses</p>
              <h3 id="buyer-hypotheses-heading" className="mt-2 text-xl font-semibold">
                Who may feel this problem most
              </h3>
            </div>
            <span className="text-xs text-neutral-500">
              Planning hypotheses · separate fixture evidence appears below
            </span>
          </div>
          <div className="mt-5 grid gap-4 lg:grid-cols-2">
            {understanding.buyerHypotheses.map((buyer) => (
              <article
                key={buyer.id}
                className="rounded-2xl border border-neutral-200 bg-white p-5"
              >
                <div className="flex items-start justify-between gap-4">
                  <h4 className="font-semibold text-neutral-950">{buyer.label}</h4>
                  <span className="text-xs font-medium text-neutral-500">
                    {formatConfidence(buyer.confidence)}
                  </span>
                </div>
                <p className="mt-2 text-sm leading-6 text-neutral-600">
                  {buyer.whyTheyMightNeedIt}
                </p>
                <div className="mt-4 grid gap-3 text-xs sm:grid-cols-2">
                  <div>
                    <strong className="text-neutral-700">Likely buyers</strong>
                    <p className="mt-1 leading-5 text-neutral-500">
                      {buyer.likelyBuyerTitles.join(" · ")}
                    </p>
                  </div>
                  <div>
                    <strong className="text-neutral-700">Likely users</strong>
                    <p className="mt-1 leading-5 text-neutral-500">
                      {buyer.likelyUserTitles.join(" · ")}
                    </p>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="grid gap-6 lg:grid-cols-2">
          <div aria-labelledby="pain-keywords-heading">
            <p className="eyebrow">Pain keywords</p>
            <h3 id="pain-keywords-heading" className="mt-2 text-lg font-semibold">
              Language worth listening for
            </h3>
            <div className="mt-4 flex flex-wrap gap-2">
              {understanding.painKeywords.map((keyword) => (
                <span
                  key={keyword}
                  className="rounded-full border border-neutral-200 bg-neutral-50 px-3 py-1.5 text-xs text-neutral-700"
                >
                  {keyword}
                </span>
              ))}
            </div>
          </div>
          <div aria-labelledby="workarounds-heading">
            <p className="eyebrow">Competitors and workarounds</p>
            <h3 id="workarounds-heading" className="mt-2 text-lg font-semibold">
              Existing solutions to watch
            </h3>
            <div className="mt-4 flex flex-wrap gap-2">
              {understanding.competitorOrWorkaroundKeywords.map((keyword) => (
                <span
                  key={keyword}
                  className="rounded-full border border-violet-200 bg-violet-50 px-3 py-1.5 text-xs text-violet-800"
                >
                  {keyword}
                </span>
              ))}
            </div>
          </div>
        </section>

        <section aria-labelledby="source-plan-heading">
          <p className="eyebrow">Source plan</p>
          <h3 id="source-plan-heading" className="mt-2 text-xl font-semibold">
            Where Cluvvi should look next
          </h3>
          <div className="mt-4 divide-y divide-neutral-100 rounded-2xl border border-neutral-200 bg-white">
            {understanding.sourcePlan.map((source) => (
              <div
                key={source.sourceType}
                className="grid gap-2 px-4 py-4 sm:grid-cols-[160px_90px_minmax(0,1fr)] sm:items-center sm:px-5"
              >
                <strong className="text-sm capitalize text-neutral-900">
                  {source.sourceType.replaceAll("_", " ")}
                </strong>
                <span
                  className={`w-fit rounded-full border px-2 py-1 text-[10px] font-semibold uppercase tracking-wide ${priorityClass(source.priority)}`}
                >
                  {source.priority}
                </span>
                <p className="text-sm leading-6 text-neutral-600">{source.reason}</p>
              </div>
            ))}
          </div>
        </section>

        <section aria-labelledby="search-plan-heading">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="eyebrow">Search query plan</p>
              <h3 id="search-plan-heading" className="mt-2 text-xl font-semibold">
                Queries reserved for a future approved live bridge
              </h3>
            </div>
            <span className="text-xs text-neutral-500">
              Showing 12 of {understanding.searchQueries.length}
            </span>
          </div>
          <ol className="mt-4 grid gap-3" data-testid="mission-search-queries">
            {priorityQueries.map((query, index) => (
              <li
                key={query.id}
                className="grid gap-3 rounded-2xl border border-neutral-200 bg-neutral-50/60 p-4 sm:grid-cols-[28px_minmax(0,1fr)_auto] sm:items-start"
              >
                <span className="grid size-7 place-items-center rounded-full bg-white text-xs font-semibold text-neutral-500 shadow-sm">
                  {index + 1}
                </span>
                <div className="min-w-0">
                  <p className="break-words font-mono text-xs leading-6 text-neutral-900">
                    {query.query}
                  </p>
                  <p className="mt-1 text-xs text-neutral-500">
                    {query.buyerHypothesisId === undefined
                      ? "Cross-segment"
                      : (buyerLabels.get(query.buyerHypothesisId) ?? "Buyer hypothesis")}
                    {query.intentSignal === undefined
                      ? ""
                      : ` · ${query.intentSignal.replaceAll("_", " ")}`}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2 sm:justify-end">
                  <span className="rounded-full border border-neutral-200 bg-white px-2 py-1 text-[10px] capitalize text-neutral-600">
                    {query.sourceType.replaceAll("_", " ")}
                  </span>
                  <span
                    className={`rounded-full border px-2 py-1 text-[10px] font-semibold uppercase ${priorityClass(query.priority)}`}
                  >
                    {query.priority}
                  </span>
                </div>
              </li>
            ))}
          </ol>
        </section>

        <section className="grid gap-6 lg:grid-cols-2">
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5">
            <p className="eyebrow text-amber-800">Risks and unknowns</p>
            <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-6 text-amber-950">
              {understanding.risksAndUnknowns.map((risk) => (
                <li key={risk}>{risk}</li>
              ))}
            </ul>
          </div>
          <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-5">
            <p className="eyebrow">Next steps</p>
            <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm leading-6 text-neutral-700">
              {understanding.nextSteps.map((step) => (
                <li key={step}>{step}</li>
              ))}
            </ol>
          </div>
        </section>
      </div>
    </section>
  );
}
