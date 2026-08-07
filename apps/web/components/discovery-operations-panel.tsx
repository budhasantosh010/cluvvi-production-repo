"use client";

import type {
  CluvviExtractionMode,
  CluvviSourceAdapterMode,
  CluvviSourceFamily,
  CluvviStructuredContentMode,
  DiscoveryProviderMode,
  DiscoveryProviderPolicy,
} from "@cluvvi/core";
import { useState } from "react";

interface DiscoveryOperationsPanelProps {
  providerMode: DiscoveryProviderMode;
  providerPolicy: DiscoveryProviderPolicy;
  extractionMode: CluvviExtractionMode;
  maximumExtractions: number;
  structuredContentMode: CluvviStructuredContentMode;
  maximumStructuredResources: number;
  maximumDocumentResources: number;
  sourceAdapterMode: CluvviSourceAdapterMode;
  sourceFamilies: CluvviSourceFamily[];
  maximumHiringTargets: number;
  maximumHiringBoardsPerTarget: number;
  maximumHiringJobsPerBoard: number;
  maximumHiringJobsTotal: number;
  runtimeMode: "fixture" | "local_discovery_engine";
  runnerAvailable: boolean;
}

export function DiscoveryOperationsPanel({
  providerMode,
  providerPolicy,
  extractionMode,
  maximumExtractions,
  structuredContentMode,
  maximumStructuredResources,
  maximumDocumentResources,
  sourceAdapterMode,
  sourceFamilies,
  maximumHiringTargets,
  maximumHiringBoardsPerTarget,
  maximumHiringJobsPerBoard,
  maximumHiringJobsTotal,
  runtimeMode,
  runnerAvailable,
}: DiscoveryOperationsPanelProps) {
  const [previewExtractionMode, setPreviewExtractionMode] =
    useState<CluvviExtractionMode>(extractionMode);
  const [previewStructuredMode, setPreviewStructuredMode] =
    useState<CluvviStructuredContentMode>(structuredContentMode);
  const [previewSourceAdapterMode, setPreviewSourceAdapterMode] =
    useState<CluvviSourceAdapterMode>(sourceAdapterMode);
  const active =
    previewExtractionMode === extractionMode &&
    previewStructuredMode === structuredContentMode &&
    previewSourceAdapterMode === sourceAdapterMode;
  const selectedPages = previewExtractionMode === "selected_public_pages";
  const selectedStructured = previewStructuredMode === "selected_resources";
  const selectedHiring = previewSourceAdapterMode === "selected_sources";

  return (
    <div className="grid gap-6">
      <section
        className="surface-card smooth-panel min-w-0 overflow-hidden p-6 sm:p-8"
        data-testid="discovery-mode-selector"
      >
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="eyebrow">Runtime mode</p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight text-neutral-950">
              Search, extraction, and structured evidence
            </h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-neutral-600">
              These selectors preview the supported evidence boundaries. Active configuration
              remains process-owned and changes only after local environment updates and a
              web/runner restart.
            </p>
          </div>
          <span
            className={`fixture-badge inline-flex shrink-0 self-start ${active ? "" : "opacity-70"}`}
          >
            {active ? "Active configuration" : "Preview only"}
          </span>
        </div>

        <div className="mt-6 grid gap-4 lg:grid-cols-3">
          <label className="block min-w-0" htmlFor="extraction-mode-preview">
            <span className="field-label">Public-page extraction</span>
            <select
              id="extraction-mode-preview"
              className="field-input mt-2 w-full min-w-0 max-w-full"
              value={previewExtractionMode}
              onChange={(event) => {
                const value = event.target.value as CluvviExtractionMode;
                setPreviewExtractionMode(value);
                if (value === "none") setPreviewStructuredMode("none");
              }}
            >
              <option value="none">Search only — provider snippets</option>
              <option value="selected_public_pages">
                Selected public resources — bounded SSRF-safe fetches
              </option>
            </select>
          </label>
          <label className="block min-w-0" htmlFor="structured-mode-preview">
            <span className="field-label">Structured content parsing</span>
            <select
              id="structured-mode-preview"
              className="field-input mt-2 w-full min-w-0 max-w-full"
              value={previewStructuredMode}
              disabled={!selectedPages}
              onChange={(event) =>
                setPreviewStructuredMode(event.target.value as CluvviStructuredContentMode)
              }
            >
              <option value="none">Disabled — retain C1-I evidence</option>
              <option value="selected_resources">
                Selected resources — sections, tables, metadata, footnotes
              </option>
            </select>
          </label>
          <label className="block min-w-0" htmlFor="source-adapter-mode-preview">
            <span className="field-label">Public source adapters</span>
            <select
              id="source-adapter-mode-preview"
              className="field-input mt-2 w-full min-w-0 max-w-full"
              value={previewSourceAdapterMode}
              onChange={(event) =>
                setPreviewSourceAdapterMode(event.target.value as CluvviSourceAdapterMode)
              }
            >
              <option value="none">Disabled — no source-family sidecars</option>
              <option value="selected_sources">Hiring — public ATS and careers evidence</option>
            </select>
          </label>
        </div>

        <div className="mt-6 grid gap-4 xl:grid-cols-4">
          <article
            className={`min-w-0 overflow-hidden rounded-3xl border p-5 ${
              !selectedPages
                ? "border-neutral-950 bg-neutral-950 text-white"
                : "border-neutral-200 bg-neutral-50 text-neutral-900"
            }`}
          >
            <p className={`eyebrow ${!selectedPages ? "text-neutral-300" : ""}`}>Search only</p>
            <h3 className="mt-2 text-lg font-semibold">Provider snippets</h3>
            <ul
              className={`mt-3 grid gap-2 text-sm leading-6 ${!selectedPages ? "text-neutral-300" : "text-neutral-600"}`}
            >
              <li>• No result resource fetches</li>
              <li>• C1-G, C1-H, and C1-HF compatibility remains unchanged</li>
              <li>• Missing page context is explicit</li>
            </ul>
          </article>
          <article
            className={`min-w-0 overflow-hidden rounded-3xl border p-5 ${
              selectedPages && !selectedStructured
                ? "border-neutral-950 bg-neutral-950 text-white"
                : "border-neutral-200 bg-neutral-50 text-neutral-900"
            }`}
          >
            <p
              className={`eyebrow ${selectedPages && !selectedStructured ? "text-neutral-300" : ""}`}
            >
              C1-I extraction
            </p>
            <h3 className="mt-2 text-lg font-semibold">Visible page evidence</h3>
            <ul
              className={`mt-3 grid gap-2 text-sm leading-6 ${selectedPages && !selectedStructured ? "text-neutral-300" : "text-neutral-600"}`}
            >
              <li>• At most {maximumExtractions} depth-zero resources</li>
              <li>• Metadata, visible text, and recognized JSON-LD</li>
              <li>• Raw HTML and private URLs are rejected</li>
            </ul>
          </article>
          <article
            className={`min-w-0 overflow-hidden rounded-3xl border p-5 ${
              selectedStructured
                ? "border-neutral-950 bg-neutral-950 text-white"
                : "border-neutral-200 bg-neutral-50 text-neutral-900"
            }`}
            data-testid="structured-mode-card"
          >
            <p className={`eyebrow ${selectedStructured ? "text-neutral-300" : ""}`}>
              C1-I.5 structured
            </p>
            <h3 className="mt-2 text-lg font-semibold">HTML and document structure</h3>
            <ul
              className={`mt-3 grid gap-2 text-sm leading-6 ${selectedStructured ? "text-neutral-300" : "text-neutral-600"}`}
            >
              <li>• At most {maximumStructuredResources} structured resources</li>
              <li>• At most {maximumDocumentResources} document-parser workers</li>
              <li>• Sections, tables, metadata, links, and footnotes</li>
              <li className="break-words">
                • PDF / Office / OpenDocument / RTF / EPUB / CSV support
              </li>
              <li>• Macros, formulas, links, and instructions never execute</li>
            </ul>
          </article>
          <article
            className={`min-w-0 overflow-hidden rounded-3xl border p-5 ${
              selectedHiring
                ? "border-neutral-950 bg-neutral-950 text-white"
                : "border-neutral-200 bg-neutral-50 text-neutral-900"
            }`}
            data-testid="hiring-mode-card"
          >
            <p className={`eyebrow ${selectedHiring ? "text-neutral-300" : ""}`}>C1-J hiring</p>
            <h3 className="mt-2 text-lg font-semibold">Public ATS intelligence</h3>
            <ul
              className={`mt-3 grid gap-2 text-sm leading-6 ${selectedHiring ? "text-neutral-300" : "text-neutral-600"}`}
            >
              <li>• At most {maximumHiringTargets} target companies</li>
              <li>• At most {maximumHiringBoardsPerTarget} boards per target</li>
              <li>• At most {maximumHiringJobsPerBoard} jobs per board</li>
              <li>• At most {maximumHiringJobsTotal} jobs total</li>
              <li>• No candidate data, applications, or private ATS APIs</li>
            </ul>
          </article>
        </div>

        {!active && (
          <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-950">
            Preview only. Set <code>CLUVVI_DISCOVERY_EXTRACTION_MODE</code>,
            <code className="ml-1">CLUVVI_DISCOVERY_STRUCTURED_CONTENT_MODE</code>, and
            <code className="ml-1">CLUVVI_DISCOVERY_SOURCE_ADAPTER_MODE</code>, then restart the
            local application for new runs.
          </div>
        )}
      </section>

      <section className="surface-card overflow-hidden" data-testid="discovery-runtime-summary">
        <div className="border-b border-neutral-200 bg-neutral-50/70 px-6 py-5 sm:px-8">
          <p className="eyebrow">Active local configuration</p>
          <h2 className="mt-2 text-xl font-semibold text-neutral-950">Operational summary</h2>
        </div>
        <dl className="divide-y divide-neutral-100">
          {[
            ["Runtime", runtimeMode.replaceAll("_", " ")],
            ["Search provider mode", providerMode.replaceAll("_", " ")],
            ["Provider policy", providerPolicy.replaceAll("_", " ")],
            ["Extraction mode", extractionMode.replaceAll("_", " ")],
            ["Maximum selected pages", String(maximumExtractions)],
            ["Structured mode", structuredContentMode.replaceAll("_", " ")],
            ["Maximum structured resources", String(maximumStructuredResources)],
            ["Maximum document resources", String(maximumDocumentResources)],
            ["Source-adapter mode", sourceAdapterMode.replaceAll("_", " ")],
            ["Source families", sourceFamilies.join(", ") || "none"],
            ["Maximum hiring targets", String(maximumHiringTargets)],
            ["Maximum boards per target", String(maximumHiringBoardsPerTarget)],
            ["Maximum jobs per board", String(maximumHiringJobsPerBoard)],
            ["Maximum hiring jobs total", String(maximumHiringJobsTotal)],
            ["Structured parser policy", "structured_parser_policy@1.0.0"],
            ["AnyDoc parser", "@firecrawl/anydoc@0.1.6"],
            ["HTML renderer", "sanitized_html_to_gfm@1.0.0"],
            ["Runner", runnerAvailable ? "active" : "offline"],
          ].map(([label, value]) => (
            <div className="grid gap-2 px-6 py-5 md:grid-cols-[240px_minmax(0,1fr)]" key={label}>
              <dt className="text-sm font-medium text-neutral-500">{label}</dt>
              <dd className="break-all font-mono text-sm text-neutral-900">{value}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="rounded-3xl border border-violet-200 bg-violet-50 p-6 sm:p-8">
        <p className="eyebrow text-violet-700">Hard scope boundary</p>
        <h2 className="mt-2 text-xl font-semibold text-violet-950">What C1-J still does not do</h2>
        <p className="mt-3 max-w-4xl text-sm leading-6 text-violet-900">
          No recursive crawling, browser or JavaScript rendering, OCR execution, comments or
          transcripts, platform adapters, identity verification, contacts, enrichment, outreach,
          monitoring, or workflow automation. Parsing a document does not prove a claim, identity,
          buyer role, budget, or purchase intent.
        </p>
      </section>
    </div>
  );
}
