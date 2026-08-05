import {
  CrawlFrontierArtifactV1Schema,
  EvidenceFindingsArtifactV1Schema,
  ExtractedContentArtifactV1Schema,
  ExtractionRunTelemetryV1Schema,
  type ArtifactRecord,
  type CluvviExtractionMode,
} from "@cluvvi/core";

interface ExtractionEvidenceViewProps {
  artifacts: ArtifactRecord[];
  extractionMode: CluvviExtractionMode;
  maximumExtractions: number;
  runStatus: string;
  failureCode?: string;
}

function artifactData(artifacts: ArtifactRecord[], artifactType: ArtifactRecord["artifactType"]) {
  return artifacts.find((artifact) => artifact.artifactType === artifactType)?.data;
}

function number(value: number): string {
  return new Intl.NumberFormat("en-US").format(value);
}

function outcomeTone(outcome: string): string {
  if (outcome === "success") return "border-emerald-200 bg-emerald-50 text-emerald-900";
  if (outcome === "partial") return "border-amber-200 bg-amber-50 text-amber-900";
  if (outcome === "blocked") return "border-violet-200 bg-violet-50 text-violet-900";
  if (outcome === "manual_required") return "border-blue-200 bg-blue-50 text-blue-900";
  return "border-red-200 bg-red-50 text-red-900";
}

function statusCopy(input: {
  successful: number;
  partial: number;
  failed: number;
  blocked: number;
  selected: number;
}): { title: string; detail: string; tone: string } {
  if (input.selected === 0) {
    return {
      title: "No public pages selected",
      detail:
        "The frontier found no eligible pages inside the configured safety and priority limits.",
      tone: "border-neutral-200 bg-neutral-50 text-neutral-800",
    };
  }
  if (input.successful === 0 && input.partial === 0) {
    return {
      title: "All selected pages failed safely",
      detail:
        "Search results remain available, but Cluvvi did not invent page evidence. Review the recorded failure codes or resume after the source problem is corrected.",
      tone: "border-red-200 bg-red-50 text-red-900",
    };
  }
  if (input.failed > 0 || input.blocked > 0 || input.partial > 0) {
    return {
      title: "Partial public-page coverage",
      detail:
        "Cluvvi preserved successful evidence and recorded every failed, blocked, or partial page separately.",
      tone: "border-amber-200 bg-amber-50 text-amber-900",
    };
  }
  return {
    title: "Selected public pages extracted",
    detail:
      "The standalone Discovery Engine returned bounded metadata, visible text, and JSON-LD for the selected pages.",
    tone: "border-emerald-200 bg-emerald-50 text-emerald-900",
  };
}

export function ExtractionEvidenceView({
  artifacts,
  extractionMode,
  maximumExtractions,
  runStatus,
  failureCode,
}: ExtractionEvidenceViewProps) {
  if (extractionMode === "none") {
    return (
      <section
        className="surface-card smooth-panel p-6 sm:p-8"
        data-testid="extraction-disabled"
        aria-labelledby="extraction-disabled-heading"
      >
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="eyebrow">Public-page extraction</p>
            <h2
              id="extraction-disabled-heading"
              className="mt-2 text-2xl font-semibold tracking-tight text-neutral-950"
            >
              Search-only mode
            </h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-neutral-600">
              Cluvvi used provider snippets only. No result page was fetched, parsed, or added as
              extracted evidence. This keeps the C1-G, C1-H, and C1-HF workflow unchanged.
            </p>
          </div>
          <span className="fixture-badge inline-flex shrink-0 self-start">Extraction disabled</span>
        </div>
      </section>
    );
  }

  const frontierResult = CrawlFrontierArtifactV1Schema.safeParse(
    artifactData(artifacts, "crawl_frontier"),
  );
  const extractedResult = ExtractedContentArtifactV1Schema.safeParse(
    artifactData(artifacts, "extracted_content"),
  );
  const telemetryResult = ExtractionRunTelemetryV1Schema.safeParse(
    artifactData(artifacts, "extraction_telemetry"),
  );
  const evidenceResult = EvidenceFindingsArtifactV1Schema.safeParse(
    artifactData(artifacts, "evidence_findings"),
  );

  if (!frontierResult.success) {
    const failed = runStatus === "failed";
    return (
      <section
        className="surface-card smooth-panel p-6 sm:p-8"
        data-testid={failed ? "extraction-failed-before-import" : "extraction-pending"}
        aria-live="polite"
      >
        <p className="eyebrow">Public-page extraction</p>
        <h2 className="mt-2 text-2xl font-semibold tracking-tight text-neutral-950">
          {failed
            ? "Extraction companion artifacts were not accepted"
            : "Building the crawl frontier"}
        </h2>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-neutral-600">
          {failed
            ? "Search output remains durable. Cluvvi stopped before downstream evidence use because an extraction sidecar was missing, malformed, unsafe, or inconsistent."
            : `The standalone Discovery Engine is selecting at most ${maximumExtractions} public pages under the configured frontier, robots, network, and response-size limits.`}
        </p>
        {failureCode !== undefined && (
          <code className="mt-4 inline-flex rounded-full border border-red-200 bg-red-50 px-3 py-1 text-xs font-semibold text-red-800">
            {failureCode}
          </code>
        )}
      </section>
    );
  }

  const frontier = frontierResult.data;
  if (!extractedResult.success || !telemetryResult.success) {
    const failed = runStatus === "failed";
    return (
      <section
        className="surface-card overflow-hidden"
        data-testid={failed ? "extraction-import-failed" : "extraction-in-progress"}
      >
        <div className="border-b border-neutral-200 bg-neutral-50/70 px-6 py-5 sm:px-8">
          <p className="eyebrow">Deterministic crawl frontier</p>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight text-neutral-950">
            {frontier.summary.selected} public pages selected
          </h2>
          <p className="mt-2 text-sm leading-6 text-neutral-600">
            {failed
              ? "The frontier is durable and reusable. The extraction content or telemetry sidecar was not accepted, so search and frontier work can be reused on resume."
              : "Fetching and validating selected public pages through the standalone Discovery Engine."}
          </p>
        </div>
        <div className="grid gap-3 p-6 sm:grid-cols-3 sm:p-8">
          <div className="metric-card">
            <span>Evaluated</span>
            <strong>{frontier.summary.candidatesEvaluated}</strong>
          </div>
          <div className="metric-card">
            <span>Selected</span>
            <strong>{frontier.summary.selected}</strong>
          </div>
          <div className="metric-card">
            <span>Skipped or blocked</span>
            <strong>{frontier.summary.skipped + frontier.summary.blocked}</strong>
          </div>
        </div>
      </section>
    );
  }

  const extracted = extractedResult.data;
  const telemetry = telemetryResult.data;
  const evidence = evidenceResult.success ? evidenceResult.data : undefined;
  const status = statusCopy({
    successful: extracted.summary.successfulExtractions,
    partial: extracted.summary.partialExtractions,
    failed: extracted.summary.failedExtractions,
    blocked: extracted.summary.blockedUrls,
    selected: extracted.summary.selectedUrls,
  });
  const itemByFrontier = new Map(
    extracted.items.map((item) => [item.frontierItemId, item] as const),
  );
  const fetchByFrontier = new Map(
    telemetry.fetches.map((fetch) => [fetch.frontierItemId, fetch] as const),
  );
  const selectedItems = frontier.items.filter((item) => item.status === "selected");
  const extractedMaterialCount =
    evidence?.materials.filter((material) => material.kind !== "search_snippet").length ?? 0;

  return (
    <section
      className="surface-card overflow-hidden"
      data-testid="extraction-evidence-view"
      aria-labelledby="extraction-evidence-heading"
    >
      <div className="border-b border-neutral-200 bg-neutral-50/70 px-6 py-5 sm:px-8">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="eyebrow">C1-I · bounded public-page extraction</p>
            <h2
              id="extraction-evidence-heading"
              className="mt-2 text-2xl font-semibold tracking-tight text-neutral-950"
            >
              Extracted evidence coverage
            </h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-neutral-600">
              Selected public pages were fetched through DNS-pinned, redirect-validated,
              SSRF-restricted HTTP. Cluvvi stored normalized metadata, visible text, and bounded
              JSON-LD only—never raw HTML, cookies, authorization headers, or a child environment.
            </p>
          </div>
          <span className="fixture-badge inline-flex shrink-0 self-start">
            Max {maximumExtractions} pages · depth 0
          </span>
        </div>
        <div className={`mt-5 rounded-2xl border p-4 text-sm leading-6 ${status.tone}`}>
          <strong className="block">{status.title}</strong>
          <span>{status.detail}</span>
        </div>
      </div>

      <div className="grid gap-8 p-6 sm:p-8">
        <dl className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <div className="metric-card">
            <dt>Evaluated</dt>
            <dd>{frontier.summary.candidatesEvaluated}</dd>
          </div>
          <div className="metric-card">
            <dt>Selected</dt>
            <dd>{frontier.summary.selected}</dd>
          </div>
          <div className="metric-card">
            <dt>Successful</dt>
            <dd>{extracted.summary.successfulExtractions}</dd>
          </div>
          <div className="metric-card">
            <dt>Failed or blocked</dt>
            <dd>{extracted.summary.failedExtractions + extracted.summary.blockedUrls}</dd>
          </div>
          <div className="metric-card">
            <dt>Evidence materials</dt>
            <dd>{extractedMaterialCount}</dd>
          </div>
        </dl>

        <div className="grid gap-4 lg:grid-cols-3">
          <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4">
            <p className="eyebrow">Network and limits</p>
            <dl className="mt-3 grid gap-2 text-sm">
              <div className="flex justify-between gap-4">
                <dt className="text-neutral-500">Attempted requests</dt>
                <dd className="font-semibold text-neutral-900">
                  {telemetry.totals.attemptedRequests}
                </dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-neutral-500">Retries</dt>
                <dd className="font-semibold text-neutral-900">{telemetry.totals.retries}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-neutral-500">Redirects</dt>
                <dd className="font-semibold text-neutral-900">{telemetry.totals.redirects}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-neutral-500">Runtime</dt>
                <dd className="font-semibold text-neutral-900">{telemetry.totalRuntimeMs} ms</dd>
              </div>
            </dl>
          </div>
          <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4">
            <p className="eyebrow">Bounded content</p>
            <dl className="mt-3 grid gap-2 text-sm">
              <div className="flex justify-between gap-4">
                <dt className="text-neutral-500">Downloaded</dt>
                <dd className="font-semibold text-neutral-900">
                  {number(extracted.summary.downloadedBytes)} bytes
                </dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-neutral-500">Extracted text</dt>
                <dd className="font-semibold text-neutral-900">
                  {number(extracted.summary.extractedCharacters)} chars
                </dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-neutral-500">Types</dt>
                <dd className="text-right font-semibold text-neutral-900">
                  {extracted.coverage.extractionTypes.join(" · ") || "none"}
                </dd>
              </div>
            </dl>
          </div>
          <div className="rounded-2xl border border-violet-200 bg-violet-50 p-4 text-violet-950">
            <p className="eyebrow text-violet-700">Trust boundary</p>
            <p className="mt-3 text-sm font-semibold">Untrusted public source data</p>
            <p className="mt-2 text-xs leading-5 text-violet-800">
              Page instructions, role changes, tool requests, and secret requests remain quoted
              data. Evidence prompts explicitly forbid following them.
            </p>
          </div>
        </div>

        <section aria-labelledby="selected-pages-heading">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="eyebrow">Frontier and page outcomes</p>
              <h3
                id="selected-pages-heading"
                className="mt-2 text-xl font-semibold text-neutral-950"
              >
                Selected public pages
              </h3>
            </div>
            <span className="text-xs text-neutral-500">
              Each URL remains tied to its search result and frontier item
            </span>
          </div>
          <div className="mt-5 grid gap-4" data-testid="extraction-page-list">
            {selectedItems.map((frontierItem) => {
              const item = itemByFrontier.get(frontierItem.frontierItemId);
              const fetch = fetchByFrontier.get(frontierItem.frontierItemId);
              const outcome = item?.outcome ?? "failed";
              const title = item?.metadata?.title ?? frontierItem.domain ?? "Selected public page";
              return (
                <article
                  key={frontierItem.frontierItemId}
                  className="rounded-3xl border border-neutral-200 bg-white p-5 shadow-sm sm:p-6"
                  data-testid="extraction-page-card"
                >
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide ${outcomeTone(outcome)}`}
                        >
                          {outcome.replaceAll("_", " ")}
                        </span>
                        <span className="rounded-full border border-neutral-200 bg-neutral-100 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-neutral-700">
                          priority {frontierItem.priority.toFixed(2)}
                        </span>
                        <span className="rounded-full border border-violet-200 bg-violet-50 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-violet-800">
                          untrusted source
                        </span>
                      </div>
                      <h4 className="mt-3 text-lg font-semibold text-neutral-950">{title}</h4>
                      {frontierItem.canonicalUrl !== undefined && (
                        <a
                          href={frontierItem.canonicalUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="mt-2 block break-all text-xs font-medium text-blue-700 underline decoration-blue-200 underline-offset-4"
                        >
                          {frontierItem.canonicalUrl}
                        </a>
                      )}
                    </div>
                    <dl className="grid min-w-56 gap-2 text-xs">
                      <div className="flex justify-between gap-4">
                        <dt className="text-neutral-500">HTTP</dt>
                        <dd className="font-semibold text-neutral-900">
                          {item?.http?.statusCode ?? fetch?.statusCode ?? "—"}
                        </dd>
                      </div>
                      <div className="flex justify-between gap-4">
                        <dt className="text-neutral-500">Robots</dt>
                        <dd className="text-right font-semibold text-neutral-900">
                          {fetch?.robotsDecision.replaceAll("_", " ") ?? "not recorded"}
                        </dd>
                      </div>
                      <div className="flex justify-between gap-4">
                        <dt className="text-neutral-500">Characters</dt>
                        <dd className="font-semibold text-neutral-900">
                          {number(item?.text?.characterCount ?? 0)}
                        </dd>
                      </div>
                    </dl>
                  </div>

                  {item?.text !== undefined && (
                    <div className="mt-5 rounded-2xl border border-neutral-200 bg-neutral-50 p-4">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="eyebrow">Visible-text preview</p>
                        <code className="text-[10px] text-neutral-500">
                          sha256:{item.text.contentHash.slice(0, 12)}…
                        </code>
                      </div>
                      <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-neutral-700">
                        {item.text.content.slice(0, 420)}
                        {item.text.content.length > 420 ? "…" : ""}
                      </p>
                    </div>
                  )}

                  {(item?.failureCode !== undefined || fetch?.safeFailureCode !== undefined) && (
                    <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-900">
                      <code className="font-semibold">
                        {item?.failureCode ?? fetch?.safeFailureCode}
                      </code>
                      <p className="mt-1 text-xs leading-5 text-red-800">
                        {item?.safeFailureMessage ?? fetch?.safeFailureMessage}
                      </p>
                    </div>
                  )}

                  <div className="mt-4 flex flex-wrap gap-2 text-[11px] text-neutral-600">
                    {(item?.extractionTypes ?? []).map((type) => (
                      <span
                        key={type}
                        className="rounded-full border border-neutral-200 px-2.5 py-1"
                      >
                        {type.replaceAll("_", " ")}
                      </span>
                    ))}
                    <span className="rounded-full border border-neutral-200 px-2.5 py-1 font-mono">
                      result:{frontierItem.sourceResultId.slice(0, 14)}…
                    </span>
                    <span className="rounded-full border border-neutral-200 px-2.5 py-1 font-mono">
                      frontier:{frontierItem.frontierItemId.slice(0, 14)}…
                    </span>
                  </div>
                </article>
              );
            })}
          </div>
        </section>

        {(extracted.warnings.length > 0 || telemetry.warnings.length > 0) && (
          <section
            className="rounded-2xl border border-amber-200 bg-amber-50 p-5"
            aria-label="Extraction warnings"
          >
            <p className="eyebrow text-amber-800">Warnings and limitations</p>
            <ul className="mt-3 grid gap-2 text-sm leading-6 text-amber-950">
              {[
                ...new Set([
                  ...extracted.warnings,
                  ...telemetry.warnings,
                  ...extracted.coverage.limitations,
                ]),
              ].map((warning) => (
                <li key={warning}>• {warning}</li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </section>
  );
}
