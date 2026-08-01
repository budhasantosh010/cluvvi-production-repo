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
import { mkdir, rename, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { randomUUID } from "node:crypto";

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
    const report = `# Cluvvi Project B fixture run\n\n> This run validates the local C1-C through C1-F fixture pipeline. It contains synthetic companies and does not represent live customer discovery.\n\n- Run: ${input.run.id}\n- Mission: ${input.run.missionName}\n- Status: ${input.run.status}\n- Events: ${input.events.length}\n- Tool-call records: ${input.toolCalls.length}\n\n## Persisted stages\n\n${completedStages}\n\n## Next commercial step\n\nRun the cross-project V2 compatibility gate, then research an approved C1-G bridge or live provider separately.\n`;
    await atomicWrite(resolve(this.runDirectory(input.run.id), "run-report.md"), report);
  }
}
