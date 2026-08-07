import { DiscoveryOperationsPanel } from "@/components/discovery-operations-panel";
import { getWebLocalRuntime } from "@/lib/server/local-runtime";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function DiscoveryOperationsPage() {
  const { service } = await getWebLocalRuntime();
  const diagnostics = await service.getDiagnostics();
  return (
    <main className="mx-auto w-full max-w-6xl px-5 py-10 sm:px-8 sm:py-14">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="eyebrow">Operations</p>
          <h1 className="mt-3 text-4xl font-semibold tracking-tight text-neutral-950">
            Discovery and public-source evidence
          </h1>
          <p className="mt-3 max-w-3xl text-base leading-7 text-neutral-600">
            Review the active search policy, extraction and structured-content boundaries, public
            hiring source adapters, bounded budgets, runner state, and the limitations that remain
            true for every new run.
          </p>
        </div>
        <Link className="button-secondary shrink-0" href="/">
          Start a run
        </Link>
      </div>

      <div className="mt-8">
        <DiscoveryOperationsPanel
          providerMode={diagnostics.discoveryProviderMode}
          providerPolicy={diagnostics.discoveryProviderPolicy}
          extractionMode={diagnostics.discoveryExtractionMode}
          maximumExtractions={diagnostics.discoveryMaximumExtractions}
          structuredContentMode={diagnostics.discoveryStructuredContentMode}
          maximumStructuredResources={diagnostics.discoveryMaximumStructuredResources}
          maximumDocumentResources={diagnostics.discoveryMaximumDocumentResources}
          sourceAdapterMode={diagnostics.discoverySourceAdapterMode}
          sourceFamilies={diagnostics.discoverySourceFamilies}
          maximumHiringTargets={diagnostics.discoveryMaximumHiringTargets}
          maximumHiringBoardsPerTarget={diagnostics.discoveryMaximumHiringBoardsPerTarget}
          maximumHiringJobsPerBoard={diagnostics.discoveryMaximumHiringJobsPerBoard}
          maximumHiringJobsTotal={diagnostics.discoveryMaximumHiringJobsTotal}
          runtimeMode={diagnostics.discoveryRuntimeMode}
          runnerAvailable={diagnostics.runner.available}
        />
      </div>

      <div className="mt-8 flex flex-wrap gap-4 text-sm">
        <Link
          className="text-neutral-600 underline underline-offset-4 hover:text-neutral-950"
          href="/settings/local"
        >
          Read-only local diagnostics
        </Link>
        <Link
          className="text-neutral-600 underline underline-offset-4 hover:text-neutral-950"
          href="/runs"
        >
          Inspect durable runs
        </Link>
      </div>
    </main>
  );
}
