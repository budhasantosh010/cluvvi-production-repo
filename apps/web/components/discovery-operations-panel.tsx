"use client";

import type {
  CluvviExtractionMode,
  DiscoveryProviderMode,
  DiscoveryProviderPolicy,
} from "@cluvvi/core";
import { useState } from "react";

interface DiscoveryOperationsPanelProps {
  providerMode: DiscoveryProviderMode;
  providerPolicy: DiscoveryProviderPolicy;
  extractionMode: CluvviExtractionMode;
  maximumExtractions: number;
  runtimeMode: "fixture" | "local_discovery_engine";
  runnerAvailable: boolean;
}

export function DiscoveryOperationsPanel({
  providerMode,
  providerPolicy,
  extractionMode,
  maximumExtractions,
  runtimeMode,
  runnerAvailable,
}: DiscoveryOperationsPanelProps) {
  const [previewMode, setPreviewMode] = useState<CluvviExtractionMode>(extractionMode);
  const active = previewMode === extractionMode;
  const selected = previewMode === "selected_public_pages";

  return (
    <div className="grid gap-6">
      <section
        className="surface-card smooth-panel p-6 sm:p-8"
        data-testid="discovery-mode-selector"
      >
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="eyebrow">Runtime mode</p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight text-neutral-950">
              Search and extraction boundary
            </h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-neutral-600">
              The selector previews the two supported evidence modes. Runtime configuration remains
              process-owned and changes only after updating local environment variables and
              restarting the web and runner processes.
            </p>
          </div>
          <span
            className={`fixture-badge inline-flex shrink-0 self-start ${active ? "" : "opacity-70"}`}
          >
            {active ? "Active configuration" : "Preview only"}
          </span>
        </div>

        <label className="mt-6 block max-w-xl" htmlFor="extraction-mode-preview">
          <span className="field-label">Public-page evidence mode</span>
          <select
            id="extraction-mode-preview"
            className="field-input mt-2 w-full"
            value={previewMode}
            onChange={(event) => setPreviewMode(event.target.value as CluvviExtractionMode)}
          >
            <option value="none">Search only — provider snippets</option>
            <option value="selected_public_pages">
              Selected public pages — bounded metadata, visible text, JSON-LD
            </option>
          </select>
        </label>

        <div className="mt-6 grid gap-4 lg:grid-cols-2">
          <article
            className={`rounded-3xl border p-5 ${
              !selected
                ? "border-neutral-950 bg-neutral-950 text-white"
                : "border-neutral-200 bg-neutral-50 text-neutral-900"
            }`}
          >
            <p className={`eyebrow ${!selected ? "text-neutral-300" : ""}`}>Search only</p>
            <h3 className="mt-2 text-lg font-semibold">
              Provider snippets remain the evidence source
            </h3>
            <ul
              className={`mt-3 grid gap-2 text-sm leading-6 ${!selected ? "text-neutral-300" : "text-neutral-600"}`}
            >
              <li>• No result page fetches</li>
              <li>• C1-G, C1-H, and C1-HF compatibility remains unchanged</li>
              <li>• Evidence limitations explicitly say page context is unavailable</li>
            </ul>
          </article>
          <article
            className={`rounded-3xl border p-5 ${
              selected
                ? "border-neutral-950 bg-neutral-950 text-white"
                : "border-neutral-200 bg-neutral-50 text-neutral-900"
            }`}
          >
            <p className={`eyebrow ${selected ? "text-neutral-300" : ""}`}>Selected public pages</p>
            <h3 className="mt-2 text-lg font-semibold">
              Bounded page evidence with strict provenance
            </h3>
            <ul
              className={`mt-3 grid gap-2 text-sm leading-6 ${selected ? "text-neutral-300" : "text-neutral-600"}`}
            >
              <li>• At most {maximumExtractions} depth-zero pages per run</li>
              <li>• DNS-pinned SSRF-safe fetches and redirect revalidation</li>
              <li>• Raw HTML and secret-bearing fields are rejected</li>
              <li>• Page instructions remain untrusted source data</li>
            </ul>
          </article>
        </div>

        {!active && (
          <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-950">
            Previewing a mode that is not active. Set <code>CLUVVI_DISCOVERY_EXTRACTION_MODE</code>
            and restart the local application to use it for new runs.
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
            ["Runner", runnerAvailable ? "active" : "offline"],
          ].map(([label, value]) => (
            <div className="grid gap-2 px-6 py-5 md:grid-cols-[240px_minmax(0,1fr)]" key={label}>
              <dt className="text-sm font-medium text-neutral-500">{label}</dt>
              <dd className="font-mono text-sm text-neutral-900">{value}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="rounded-3xl border border-violet-200 bg-violet-50 p-6 sm:p-8">
        <p className="eyebrow text-violet-700">Hard scope boundary</p>
        <h2 className="mt-2 text-xl font-semibold text-violet-950">What C1-I still does not do</h2>
        <p className="mt-3 max-w-4xl text-sm leading-6 text-violet-900">
          No recursive crawling, browser or JavaScript rendering, PDFs or documents, comments or
          transcripts, platform adapters, identity verification, contacts, enrichment, outreach,
          monitoring, or workflow automation. Extraction does not prove a claim, identity, buyer
          role, budget, or purchase intent.
        </p>
      </section>
    </div>
  );
}
