import {
  ContentParseTelemetryV1Schema,
  StructuredContentArtifactV1Schema,
  type ArtifactRecord,
  type CluvviStructuredContentMode,
} from "@cluvvi/core";

interface StructuredContentViewProps {
  artifacts: ArtifactRecord[];
  structuredContentMode: CluvviStructuredContentMode;
  maximumStructuredResources: number;
  maximumDocumentResources: number;
  runStatus: string;
  failureCode?: string;
}

function number(value: number): string {
  return new Intl.NumberFormat("en-US").format(value);
}

function statusTone(outcome: string): string {
  if (outcome === "success") return "border-emerald-200 bg-emerald-50 text-emerald-800";
  if (outcome === "partial") return "border-amber-200 bg-amber-50 text-amber-900";
  if (outcome === "ocr_required" || outcome === "manual_required") {
    return "border-violet-200 bg-violet-50 text-violet-900";
  }
  return "border-rose-200 bg-rose-50 text-rose-900";
}

function StructuredTable({
  table,
}: {
  table: ReturnType<
    typeof StructuredContentArtifactV1Schema.parse
  >["items"][number]["tables"][number];
}) {
  const rows = [...table.headerRows, ...table.bodyRows];
  return (
    <div
      className="rounded-2xl border border-neutral-200 bg-white p-4"
      data-testid="structured-table"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-neutral-900">
            {table.caption ?? `Table ${table.sequence + 1}`}
          </p>
          <p className="mt-1 text-xs text-neutral-500">
            {table.rowCount} rows · {table.columnCount} columns
            {table.hasMergedCells ? " · merged cells normalized" : ""}
            {table.truncated ? " · truncated" : ""}
          </p>
        </div>
        <span className="fixture-badge">{table.tableId.slice(0, 18)}</span>
      </div>
      <div className="mt-3 max-h-72 max-w-full overflow-auto rounded-xl border border-neutral-200">
        <table className="min-w-max border-collapse text-left text-xs">
          <tbody>
            {rows.map((row, rowIndex) => (
              <tr
                className={rowIndex < table.headerRows.length ? "bg-neutral-100 font-semibold" : ""}
                key={`${table.tableId}-${rowIndex}`}
              >
                {Array.from({ length: table.columnCount }, (_, columnIndex) => (
                  <td
                    className="max-w-80 border border-neutral-200 px-3 py-2 align-top whitespace-pre-wrap break-words"
                    key={`${table.tableId}-${rowIndex}-${columnIndex}`}
                  >
                    {row[columnIndex] ?? ""}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {table.limitations.length > 0 && (
        <ul className="mt-3 grid gap-1 text-xs leading-5 text-neutral-500">
          {table.limitations.map((limitation) => (
            <li key={limitation}>• {limitation}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function StructuredContentView({
  artifacts,
  structuredContentMode,
  maximumStructuredResources,
  maximumDocumentResources,
  runStatus,
  failureCode,
}: StructuredContentViewProps) {
  if (structuredContentMode === "none") return null;
  const structuredRecord = artifacts.find(
    (artifact) => artifact.artifactType === "structured_content",
  );
  const telemetryRecord = artifacts.find(
    (artifact) => artifact.artifactType === "content_parse_telemetry",
  );
  const structured =
    structuredRecord === undefined
      ? null
      : StructuredContentArtifactV1Schema.parse(structuredRecord.data);
  const telemetry =
    telemetryRecord === undefined
      ? null
      : ContentParseTelemetryV1Schema.parse(telemetryRecord.data);

  if (structured === null) {
    const failed = runStatus === "failed" && failureCode?.includes("STRUCTURED") === true;
    return (
      <section
        className={`rounded-3xl border p-6 sm:p-8 ${
          failed ? "border-rose-200 bg-rose-50" : "border-neutral-200 bg-neutral-50"
        }`}
        data-testid={failed ? "structured-content-failure" : "structured-content-running"}
      >
        <p className={`eyebrow ${failed ? "text-rose-700" : "text-neutral-500"}`}>
          Structured content parsing
        </p>
        <h2
          className={`mt-2 text-xl font-semibold ${failed ? "text-rose-950" : "text-neutral-950"}`}
        >
          {failed ? "Structured artifacts were rejected" : "Parsing selected resources"}
        </h2>
        <p className={`mt-3 text-sm leading-6 ${failed ? "text-rose-900" : "text-neutral-600"}`}>
          {failed
            ? `Cluvvi preserved discovery, frontier, and extraction artifacts. Repair the structured sidecars and resume the same run. Failure: ${failureCode}.`
            : `Up to ${maximumStructuredResources} resources and ${maximumDocumentResources} documents are being normalized into bounded sections, tables, metadata, and footnotes.`}
        </p>
      </section>
    );
  }

  return (
    <section className="surface-card overflow-hidden" data-testid="structured-content-view">
      <div className="border-b border-neutral-200 bg-neutral-50/70 px-6 py-5 sm:px-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="eyebrow">C1-I.5 structured evidence</p>
            <h2 className="mt-2 text-xl font-semibold text-neutral-950">
              Parsed HTML and public documents
            </h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-neutral-600">
              Content is normalized as untrusted evidence. Macros, formulas, links, embedded
              instructions, and document assets are never executed.
            </p>
          </div>
          <span className="fixture-badge">{structured.parserPolicy.policyVersion}</span>
        </div>
      </div>

      <div className="grid gap-3 border-b border-neutral-200 p-5 sm:grid-cols-2 lg:grid-cols-4 sm:p-7">
        {[
          ["Selected", structured.summary.selectedResources],
          ["Successful", structured.summary.successfulParses],
          ["Partial", structured.summary.partialParses],
          [
            "Manual / OCR",
            structured.summary.manualRequiredResources + structured.summary.ocrRequiredResources,
          ],
          ["Documents", structured.summary.documentResources],
          ["Sections", structured.summary.totalSections],
          ["Tables", structured.summary.totalTables],
          ["Markdown characters", structured.summary.totalMarkdownCharacters],
        ].map(([label, value]) => (
          <div className="rounded-2xl border border-neutral-200 bg-white p-4" key={label}>
            <dt className="text-xs font-medium uppercase tracking-wide text-neutral-500">
              {label}
            </dt>
            <dd className="mt-2 text-xl font-semibold text-neutral-950">{number(Number(value))}</dd>
          </div>
        ))}
      </div>

      {telemetry !== null && (
        <div
          className="border-b border-neutral-200 bg-neutral-950 px-6 py-5 text-sm text-neutral-200 sm:px-8"
          data-testid="content-parse-telemetry-summary"
        >
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            <p>
              Worker starts:{" "}
              <strong className="text-white">{telemetry.totals.parserWorkerStarts}</strong>
            </p>
            <p>
              Worker failures:{" "}
              <strong className="text-white">{telemetry.totals.parserWorkerFailures}</strong>
            </p>
            <p>
              Downloaded:{" "}
              <strong className="text-white">
                {number(telemetry.totals.downloadedBytes)} bytes
              </strong>
            </p>
            <p>
              Runtime: <strong className="text-white">{number(telemetry.totalRuntimeMs)} ms</strong>
            </p>
          </div>
        </div>
      )}

      <div className="grid gap-5 p-5 sm:p-7" data-testid="structured-resource-list">
        {structured.items.map((item) => (
          <article
            className="min-w-0 rounded-3xl border border-neutral-200 bg-neutral-50 p-5"
            data-resource-kind={item.resourceKind}
            data-testid="structured-resource-card"
            key={item.structuredContentItemId}
          >
            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap gap-2">
                  <span
                    className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${statusTone(item.outcome)}`}
                  >
                    {item.outcome.replaceAll("_", " ")}
                  </span>
                  <span className="fixture-badge">{item.resourceKind.replaceAll("_", " ")}</span>
                  <span className="fixture-badge">
                    {item.parserProviderId.replaceAll("_", " ")}
                  </span>
                </div>
                <h3 className="mt-3 break-words text-lg font-semibold text-neutral-950">
                  {item.sourceMetadata.title ?? item.finalUrl ?? item.requestedUrl}
                </h3>
                <p className="mt-1 break-all text-xs text-neutral-500">
                  {item.finalUrl ?? item.requestedUrl}
                </p>
              </div>
              <dl className="grid shrink-0 grid-cols-2 gap-x-5 gap-y-1 text-xs text-neutral-600">
                <dt>Completeness</dt>
                <dd className="font-mono text-neutral-950">{item.quality.completeness}</dd>
                <dt>Structure score</dt>
                <dd className="font-mono text-neutral-950">
                  {item.quality.structurePreservationScore.toFixed(2)}
                </dd>
                <dt>Parser</dt>
                <dd className="font-mono text-neutral-950">{item.parserVersion}</dd>
                <dt>Content hash</dt>
                <dd className="font-mono text-neutral-950">
                  {item.contentHash?.slice(0, 12) ?? "none"}
                </dd>
              </dl>
            </div>

            {item.sections.length > 0 && (
              <div className="mt-5 grid gap-3" data-testid="structured-section-list">
                <p className="eyebrow">Sections · {item.sections.length}</p>
                {item.sections.slice(0, 40).map((section) => (
                  <details
                    className="rounded-2xl border border-neutral-200 bg-white p-4"
                    key={section.sectionId}
                  >
                    <summary className="cursor-pointer list-none text-sm font-semibold text-neutral-900">
                      <span className="mr-2 font-mono text-xs text-neutral-400">
                        {section.sequence + 1}
                      </span>
                      {section.heading ?? section.sectionType.replaceAll("_", " ")}
                    </summary>
                    <div className="mt-3 whitespace-pre-wrap break-words text-sm leading-6 text-neutral-700">
                      {section.markdown || section.text || "No visible section text."}
                    </div>
                    <p className="mt-3 break-all font-mono text-[11px] text-neutral-400">
                      {section.sectionId}
                      {section.parentSectionId === undefined
                        ? ""
                        : ` · parent ${section.parentSectionId}`}
                    </p>
                  </details>
                ))}
                {item.sections.length > 40 && (
                  <p className="text-xs text-neutral-500">
                    Showing the first 40 of {item.sections.length} sections. The complete validated
                    artifact remains available in the artifact inspector.
                  </p>
                )}
              </div>
            )}

            {item.tables.length > 0 && (
              <div className="mt-5 grid gap-3">
                <p className="eyebrow">Tables · {item.tables.length}</p>
                {item.tables.slice(0, 12).map((table) => (
                  <StructuredTable key={table.tableId} table={table} />
                ))}
              </div>
            )}

            {item.limitations.length > 0 && (
              <ul className="mt-5 grid gap-1 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-xs leading-5 text-amber-950">
                {item.limitations.map((limitation) => (
                  <li key={limitation}>• {limitation}</li>
                ))}
              </ul>
            )}
          </article>
        ))}
      </div>
    </section>
  );
}
