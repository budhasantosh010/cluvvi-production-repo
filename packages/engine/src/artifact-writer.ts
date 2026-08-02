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
    const heading = liveSearch
      ? "# Cluvvi live-search discovery run"
      : "# Cluvvi fixture-only discovery run";
    const warning = liveSearch
      ? "This run used live search snippets from the standalone Discovery Engine. Search-result pages were not crawled or deeply extracted, and identity or contact details were not verified. Downstream Evidence, Identity, Ranking, and Buyer Map logic remains deterministic and local."
      : localDiscovery
        ? "This run used the standalone local Discovery Engine with fixture providers. It does not represent live customer discovery."
        : "This run used Cluvvi's internal version-controlled search_results.v2 fixture. It does not represent live customer discovery.";
    const scopeBoundary = liveSearch
      ? "C1-H connects opt-in live HN, Tavily, and Brave search providers through the local Discovery Engine. C1-I crawling, page extraction, contact enrichment, and outreach were not started."
      : "C1-G proves the local file-and-process bridge with fixture providers only. Live providers require explicit C1-H configuration; C1-I crawlers/extractors were not started.";
    const report = `${heading}\n\n> ${warning}\n\n- Run: ${input.run.id}\n- Mission: ${input.run.missionName}\n- Status: ${input.run.status}\n- Discovery runtime: ${input.run.config.discoveryRuntimeMode}\n- Discovery providers: ${input.run.config.discoveryProviderMode}\n- Events: ${input.events.length}\n- Tool-call records: ${input.toolCalls.length}\n\n## Persisted stages\n\n${completedStages}\n\n## Scope boundary\n\n${scopeBoundary}\n`;
    await atomicWrite(resolve(this.runDirectory(input.run.id), "run-report.md"), report);
  }
}
