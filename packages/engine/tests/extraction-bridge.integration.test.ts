import {
  BuyerMapArtifactV1Schema,
  CrawlFrontierArtifactV1Schema,
  EvidenceFindingsArtifactV1Schema,
  ExtractedContentArtifactV1Schema,
  ExtractionRunTelemetryV1Schema,
  MissionInputSchemaV1,
  SearchResultsArtifactV2Schema,
} from "@cluvvi/core";
import { SqliteCluvviStore } from "@cluvvi/storage";
import { randomUUID } from "node:crypto";
import { access, readFile, rm } from "node:fs/promises";
import { resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  CluvviEngine,
  LocalArtifactWriter,
  LocalProcessDiscoveryRuntime,
  RunExecutionError,
  createDefaultStageRegistry,
} from "../src";

const cleanupDirectories: string[] = [];
const controlledProject = resolve(process.cwd(), "tests/fixtures/local-discovery-engine");

async function exists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

afterEach(async () => {
  await Promise.all(
    cleanupDirectories.splice(0).map((path) => rm(path, { recursive: true, force: true })),
  );
});

function runtime(behavior: string) {
  const root = resolve(process.cwd(), ".cluvvi-test", randomUUID());
  cleanupDirectories.push(root);
  const runsDirectory = resolve(root, "runs");
  const store = new SqliteCluvviStore({
    databasePath: resolve(root, "cluvvi.sqlite"),
    migrationsDirectory: resolve(process.cwd(), "packages/storage/migrations"),
  });
  const artifactWriter = new LocalArtifactWriter(runsDirectory);
  const discoveryRuntime = new LocalProcessDiscoveryRuntime({
    config: {
      projectPath: controlledProject,
      command: "pnpm",
      timeoutMs: 60_000,
      keepExchangeFiles: true,
      providerMode: "fixture_only",
      providerPolicy: "free_only",
      extractionMode: "selected_public_pages",
      maximumExtractions: 2,
      extractorVersion: "basic_public_html_extractor@1.0.0",
      frontierPolicyVersion: "frontier_policy@1.0.0",
      providerEnvironment: {
        CLUVVI_TEST_BEHAVIOR: JSON.stringify({ mode: behavior }),
      },
    },
    runsDirectory,
  });
  const engine = new CluvviEngine({
    store,
    artifactWriter,
    stages: createDefaultStageRegistry({ discoveryRuntime }),
    discoveryRuntimeMode: discoveryRuntime.mode,
    discoveryProviderMode: discoveryRuntime.providerMode,
    discoveryProviderPolicy: discoveryRuntime.providerPolicy,
    discoveryExtractionMode: discoveryRuntime.extractionMode,
    discoveryMaximumExtractions: discoveryRuntime.maximumExtractions,
    extractorVersion: discoveryRuntime.extractorVersion,
    frontierPolicyVersion: discoveryRuntime.frontierPolicyVersion,
    providerConfigurationFingerprint: discoveryRuntime.providerConfigurationFingerprint,
    extractionConfigurationFingerprint: discoveryRuntime.extractionConfigurationFingerprint,
  });
  return { root, runsDirectory, store, engine };
}

const mission = MissionInputSchemaV1.parse({
  schemaVersion: "1.0",
  name: "Controlled C1-I extraction",
  description:
    "Find businesses showing public evidence of manual video editing work and approval delays.",
  customerOutcome: "Reduce repetitive editing and approval work.",
  desiredOpportunities: 12,
  exclusions: ["fully staffed internal production teams"],
});

describe("C1-I controlled extraction bridge", () => {
  it("persists all companion artifacts and carries extracted provenance into Evidence and Buyer Map", async () => {
    const fixture = runtime("extraction-success");
    try {
      const result = await fixture.engine.start({
        mission,
        sourceFile: "integration://controlled-c1-i-success",
      });
      expect(result.run.status).toBe("completed");
      expect(result.run.config.discoveryExtractionMode).toBe("selected_public_pages");
      expect(result.run.config.discoveryMaximumExtractions).toBe(2);
      expect(result.artifacts).toHaveLength(14);

      const search = SearchResultsArtifactV2Schema.parse(
        result.artifacts.find((entry) => entry.artifactType === "search_results")?.data,
      );
      const frontier = CrawlFrontierArtifactV1Schema.parse(
        result.artifacts.find((entry) => entry.artifactType === "crawl_frontier")?.data,
      );
      const extracted = ExtractedContentArtifactV1Schema.parse(
        result.artifacts.find((entry) => entry.artifactType === "extracted_content")?.data,
      );
      const telemetry = ExtractionRunTelemetryV1Schema.parse(
        result.artifacts.find((entry) => entry.artifactType === "extraction_telemetry")?.data,
      );
      expect(frontier.requestId).toBe(search.requestId);
      expect(frontier.summary.selected).toBe(2);
      expect(extracted.summary.successfulExtractions).toBe(2);
      expect(telemetry.totals.successfulRequests).toBe(2);
      expect(extracted.items.map((item) => item.trustClassification)).toHaveLength(2);

      const evidence = EvidenceFindingsArtifactV1Schema.parse(
        result.artifacts.find((entry) => entry.artifactType === "evidence_findings")?.data,
      );
      expect(evidence.evidenceSourceMode).toBe("snippet_plus_extracted_public_pages");
      expect(evidence.materials.some((entry) => entry.kind === "extracted_page_text")).toBe(true);
      expect(
        evidence.findings.some(
          (finding) => finding.provenance.trustClassification === "untrusted_public_content",
        ),
      ).toBe(true);

      const buyerMap = BuyerMapArtifactV1Schema.parse(
        result.artifacts.find((entry) => entry.artifactType === "buyer_map")?.data,
      );
      expect(buyerMap.evidenceSourceMode).toBe("snippet_plus_extracted_public_pages");
      expect(buyerMap.summary.extractedEvidenceCitationCount).toBeGreaterThan(0);
      expect(
        buyerMap.opportunities.some((opportunity) =>
          opportunity.evidence.some(
            (citation) => citation.trustClassification === "untrusted_public_content",
          ),
        ),
      ).toBe(true);
      expect(JSON.stringify(result.artifacts)).not.toMatch(/rawHtml|authorization|cookies/u);
    } finally {
      await fixture.store.close();
    }
  }, 30_000);

  it("resumes extraction on the same run while reusing search and the persisted frontier", async () => {
    const fixture = runtime("extraction-success");
    let runId = "";
    try {
      await expect(
        fixture.engine.start({
          mission,
          sourceFile: "integration://controlled-c1-i-resume",
          failStage: "extraction",
        }),
      ).rejects.toBeInstanceOf(RunExecutionError);
      const runs = await fixture.store.listRuns(1);
      runId = runs[0]?.id ?? "";
      expect(runId).not.toBe("");
      const before = await fixture.store.listStageExecutions(runId);
      expect(
        before.filter((entry) => entry.stageName === "discovery" && entry.status === "completed"),
      ).toHaveLength(1);
      expect(
        before.filter((entry) => entry.stageName === "frontier" && entry.status === "completed"),
      ).toHaveLength(1);
      expect(
        before.filter((entry) => entry.stageName === "extraction" && entry.status === "failed"),
      ).toHaveLength(1);
      const executionPath = resolve(
        fixture.runsDirectory,
        runId,
        "discovery-exchange/discovery-execution.json",
      );
      const originalExecution = await readFile(executionPath, "utf8");

      const resumed = await fixture.engine.resume(runId);
      expect(resumed.run.status).toBe("completed");
      const after = await fixture.store.listStageExecutions(runId);
      expect(
        after.filter((entry) => entry.stageName === "discovery" && entry.status === "completed"),
      ).toHaveLength(1);
      expect(
        after.filter((entry) => entry.stageName === "frontier" && entry.status === "completed"),
      ).toHaveLength(1);
      expect(
        after.filter((entry) => entry.stageName === "extraction" && entry.status === "completed"),
      ).toHaveLength(1);
      expect(await readFile(executionPath, "utf8")).toBe(originalExecution);
      expect(
        await exists(resolve(fixture.runsDirectory, runId, "discovery-exchange/history")),
      ).toBe(false);
      const events = await fixture.store.listRunEvents(runId);
      expect(
        events.some((event) => event.eventType === "stage_reused" && event.phase === "discovery"),
      ).toBe(true);
      expect(
        events.some((event) => event.eventType === "stage_reused" && event.phase === "frontier"),
      ).toBe(true);
    } finally {
      await fixture.store.close();
    }
  }, 30_000);

  it("preserves an honest all-failed extraction outcome without inventing page evidence", async () => {
    const fixture = runtime("extraction-all-failed");
    try {
      const result = await fixture.engine.start({
        mission,
        sourceFile: "integration://controlled-c1-i-all-failed",
      });
      expect(result.run.status).toBe("completed");
      const extracted = ExtractedContentArtifactV1Schema.parse(
        result.artifacts.find((entry) => entry.artifactType === "extracted_content")?.data,
      );
      expect(extracted.summary.failedExtractions).toBe(extracted.summary.selectedUrls);
      expect(extracted.summary.successfulExtractions).toBe(0);
      const evidence = EvidenceFindingsArtifactV1Schema.parse(
        result.artifacts.find((entry) => entry.artifactType === "evidence_findings")?.data,
      );
      expect(evidence.materials.some((entry) => entry.kind === "extracted_page_text")).toBe(false);
      expect(evidence.warnings.join(" ")).toMatch(/failed safely/u);
    } finally {
      await fixture.store.close();
    }
  }, 30_000);

  it.each([
    ["extraction-private-url", "EXTRACTED_CONTENT_PRIVATE_URL"],
    ["extraction-raw-html", "EXTRACTED_CONTENT_FORBIDDEN_FIELD"],
    ["extraction-bad-hash", "EXTRACTED_CONTENT_HASH_MISMATCH"],
    ["extraction-missing-content", "EXTRACTED_CONTENT_MISSING"],
  ] as const)(
    "rejects %s with %s after preserving search output",
    async (behavior, code) => {
      const fixture = runtime(behavior);
      try {
        let caught: unknown;
        try {
          await fixture.engine.start({
            mission,
            sourceFile: `integration://controlled-${behavior}`,
          });
        } catch (error) {
          caught = error;
        }
        expect(caught).toBeInstanceOf(RunExecutionError);
        const runId = (caught as RunExecutionError).runId;
        const run = await fixture.store.getRun(runId);
        expect(run?.status).toBe("failed");
        expect(run?.failure?.code).toBe(code);
        expect(await fixture.store.getLatestArtifact(runId, "search_results")).not.toBeNull();
        expect(await fixture.store.getLatestArtifact(runId, "crawl_frontier")).toBeNull();
        expect(
          await exists(
            resolve(fixture.runsDirectory, runId, "discovery-exchange/search-results.v2.json"),
          ),
        ).toBe(true);
      } finally {
        await fixture.store.close();
      }
    },
    30_000,
  );
});
