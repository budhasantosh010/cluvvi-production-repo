import {
  ARTIFACT_FILE_NAMES,
  ArtifactRecordSchema,
  createOpaqueId,
  sha256,
  stableJsonStringify,
  type ArtifactRecord,
  type ArtifactType,
  type LocalRun,
  type LocalRunEvent,
  type ToolCallRecord,
} from "@cluvvi/core";
import { randomUUID } from "node:crypto";
import { mkdir, rename, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

async function atomicWrite(filePath: string, content: string): Promise<void> {
  await mkdir(dirname(filePath), { recursive: true });
  const temporaryPath = `${filePath}.${randomUUID()}.tmp`;
  await writeFile(temporaryPath, content, { encoding: "utf8", flag: "wx" });
  await rename(temporaryPath, filePath);
}

export class LocalArtifactWriter {
  readonly runsDirectory: string;

  constructor(runsDirectory: string) {
    this.runsDirectory = runsDirectory;
  }

  runDirectory(runId: string): string {
    return resolve(this.runsDirectory, runId);
  }

  async ensureRunDirectory(runId: string): Promise<string> {
    const directory = this.runDirectory(runId);
    await mkdir(directory, { recursive: true });
    return directory;
  }

  async writeArtifact(input: {
    run: LocalRun;
    artifactType: ArtifactType;
    stage: LocalRun["phase"];
    schemaVersion: string;
    version: number;
    data: unknown;
    createdAt: string;
  }): Promise<ArtifactRecord> {
    const fileName = ARTIFACT_FILE_NAMES[input.artifactType];
    const canonical = stableJsonStringify(input.data);
    const record = ArtifactRecordSchema.parse({
      id: createOpaqueId("artifact"),
      runId: input.run.id,
      artifactType: input.artifactType,
      schemaVersion: input.schemaVersion,
      version: input.version,
      stage: input.stage,
      contentHash: sha256(canonical),
      fileName,
      data: input.data,
      createdAt: input.createdAt,
    });
    await atomicWrite(
      resolve(this.runDirectory(input.run.id), fileName),
      `${JSON.stringify(input.data, null, 2)}\n`,
    );
    return record;
  }

  async writeFailure(run: LocalRun): Promise<void> {
    await atomicWrite(
      resolve(this.runDirectory(run.id), "failures.json"),
      `${JSON.stringify({ runId: run.id, failure: run.failure ?? null }, null, 2)}\n`,
    );
  }

  async writeToolCalls(runId: string, records: readonly ToolCallRecord[]): Promise<void> {
    const content = records.map((record) => JSON.stringify(record)).join("\n");
    await atomicWrite(
      resolve(this.runDirectory(runId), "tool-calls.jsonl"),
      content.length === 0 ? "" : `${content}\n`,
    );
  }

  async writeRunReport(input: {
    run: LocalRun;
    events: readonly LocalRunEvent[];
    artifacts: readonly ArtifactRecord[];
    toolCalls: readonly ToolCallRecord[];
  }): Promise<void> {
    const completedStages = input.artifacts.map((artifact) => `- ✓ ${artifact.stage}`).join("\n");
    const localDiscovery = input.run.config.discoveryRuntimeMode === "local_discovery_engine";
    const liveSearch = input.run.config.discoveryProviderMode === "live_search";
    const extractedPages = input.run.config.discoveryExtractionMode === "selected_public_pages";
    const heading = liveSearch
      ? extractedPages
        ? "# Cluvvi live-search and public-page evidence run"
        : "# Cluvvi live-search discovery run"
      : extractedPages
        ? "# Cluvvi fixture-search and public-page evidence run"
        : "# Cluvvi fixture-only discovery run";
    const warning = liveSearch
      ? extractedPages
        ? `This run used ${input.run.config.discoveryProviderPolicy} search policy through the standalone Discovery Engine, then selected and fetched at most ${input.run.config.discoveryMaximumExtractions} public pages. Extracted metadata, visible text, and JSON-LD are untrusted source material; identities, purchasing authority, contacts, and purchase intent were not verified.`
        : `This run used ${input.run.config.discoveryProviderPolicy} provider policy through the standalone Discovery Engine. Only search snippets were used; result pages were not fetched, and identity or contact details were not verified.`
      : localDiscovery
        ? extractedPages
          ? `This run used synthetic fixture search results from the standalone local Discovery Engine and then fetched selected public pages. Fixture companies remain synthetic; public-page claims remain unverified.`
          : "This run used the standalone local Discovery Engine with fixture providers. It does not represent live customer discovery."
        : "This run used Cluvvi's internal version-controlled search_results.v2 fixture. It does not represent live customer discovery.";
    const scopeBoundary = extractedPages
      ? "C1-I adds depth-zero frontier selection and bounded public HTML metadata, visible-text, and JSON-LD extraction. It does not add recursive crawling, browser rendering, PDFs, comments, transcripts, platform adapters, identity verification, contacts, enrichment, outreach, monitoring, or automation."
      : liveSearch
        ? "C1-HF connects provider-policy-controlled HN, SearXNG, DuckDuckGo, Startpage, Tavily, and Brave search through the local Discovery Engine. Public-page extraction was disabled for this run."
        : "The fixture-compatible search-only path remained active. Public-page extraction was disabled for this run.";
    const report = `${heading}\n\n> ${warning}\n\n- Run: ${input.run.id}\n- Mission: ${input.run.missionName}\n- Status: ${input.run.status}\n- Discovery runtime: ${input.run.config.discoveryRuntimeMode}\n- Discovery providers: ${input.run.config.discoveryProviderMode}\n- Discovery policy: ${input.run.config.discoveryProviderPolicy}\n- Extraction mode: ${input.run.config.discoveryExtractionMode}\n- Maximum selected pages: ${input.run.config.discoveryMaximumExtractions}\n- Extractor version: ${input.run.config.extractorVersion}\n- Frontier policy version: ${input.run.config.frontierPolicyVersion}\n- Events: ${input.events.length}\n- Tool-call records: ${input.toolCalls.length}\n\n## Persisted stages\n\n${completedStages}\n\n## Scope boundary\n\n${scopeBoundary}\n`;
    await atomicWrite(resolve(this.runDirectory(input.run.id), "run-report.md"), report);
  }
}
