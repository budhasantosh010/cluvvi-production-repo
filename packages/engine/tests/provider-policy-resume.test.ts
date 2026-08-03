import {
  BuyerMapArtifactV1Schema,
  LocalDiscoveryExecutionRecordV1Schema,
  MissionInputSchemaV1,
} from "@cluvvi/core";
import { SqliteCluvviStore } from "@cluvvi/storage";
import { cp, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { randomUUID } from "node:crypto";
import { afterEach, describe, expect, it } from "vitest";
import {
  CluvviEngine,
  LocalArtifactWriter,
  LocalProcessDiscoveryRuntime,
  RunExecutionError,
  createDefaultStageRegistry,
  discoveryExchangePaths,
} from "../src";

const cleanupDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(
    cleanupDirectories.splice(0).map((path) => rm(path, { recursive: true, force: true })),
  );
});

async function fixtureProject(mode: string) {
  const root = resolve(process.cwd(), ".cluvvi-test", randomUUID());
  const projectPath = resolve(root, "fake-discovery-engine");
  const runsDirectory = resolve(root, "runs");
  cleanupDirectories.push(root);
  await mkdir(root, { recursive: true });
  await cp(resolve(process.cwd(), "tests/fixtures/local-discovery-engine"), projectPath, {
    recursive: true,
  });
  await writeFile(resolve(projectPath, "behavior.json"), `${JSON.stringify({ mode })}\n`, "utf8");
  return { root, projectPath, runsDirectory };
}

const mission = MissionInputSchemaV1.parse({
  schemaVersion: "1.0",
  name: "Provider policy trace resume",
  description:
    "Find public evidence that creator businesses have video editing workflow and capacity problems.",
  customerOutcome: "Publish long-form content with less manual editing.",
  desiredOpportunities: 10,
});

describe("provider policy trace failure and resume", () => {
  it("preserves invalid diagnostics, blocks downstream work, and completes the same run after correction", async () => {
    const fixture = await fixtureProject("policy-trace-invalid-json");
    const store = new SqliteCluvviStore({
      databasePath: resolve(fixture.root, "cluvvi.sqlite"),
      migrationsDirectory: resolve(process.cwd(), "packages/storage/migrations"),
    });
    const artifactWriter = new LocalArtifactWriter(fixture.runsDirectory);
    const discoveryRuntime = new LocalProcessDiscoveryRuntime({
      config: {
        projectPath: fixture.projectPath,
        command: "pnpm",
        timeoutMs: 60_000,
        keepExchangeFiles: true,
        providerMode: "live_search",
        providerPolicy: "balanced",
        providerEnvironment: {},
      },
      runsDirectory: fixture.runsDirectory,
    });
    const engine = new CluvviEngine({
      store,
      artifactWriter,
      stages: createDefaultStageRegistry({ discoveryRuntime }),
      discoveryRuntimeMode: discoveryRuntime.mode,
      discoveryProviderMode: discoveryRuntime.providerMode,
      discoveryProviderPolicy: discoveryRuntime.providerPolicy,
      providerConfigurationFingerprint: discoveryRuntime.providerConfigurationFingerprint,
    });

    try {
      let runId = "";
      try {
        await engine.start({ mission, sourceFile: "test://provider-policy-trace" });
      } catch (error) {
        expect(error).toBeInstanceOf(RunExecutionError);
        runId = (error as RunExecutionError).runId;
      }
      expect(runId).not.toBe("");
      const failedRun = await store.getRun(runId);
      expect(failedRun?.status).toBe("failed");
      expect(failedRun?.failure?.code).toBe("PROVIDER_POLICY_TRACE_INVALID");
      expect(failedRun?.config.discoveryProviderPolicy).toBe("balanced");
      expect((await store.listArtifacts(runId)).map((artifact) => artifact.artifactType)).toEqual([
        "mission",
        "mission_understanding",
        "source_plan",
      ]);

      const paths = discoveryExchangePaths(fixture.runsDirectory, runId);
      expect(await readFile(paths.providerPolicyTracePath, "utf8")).toBe("{invalid-json");
      const failedExecution = LocalDiscoveryExecutionRecordV1Schema.parse(
        JSON.parse(await readFile(paths.executionPath, "utf8")) as unknown,
      );
      expect(failedExecution.errorCode).toBe("PROVIDER_POLICY_TRACE_INVALID");
      expect(failedExecution.providerPolicy).toBe("balanced");
      expect(failedExecution.providerPolicyTracePath).toBe(paths.providerPolicyTracePath);

      await writeFile(
        resolve(fixture.projectPath, "behavior.json"),
        `${JSON.stringify({ mode: "balanced-fallback" })}\n`,
        "utf8",
      );
      const resumed = await engine.resume(runId);
      expect(resumed.run.id).toBe(runId);
      expect(resumed.run.status).toBe("completed");
      expect(resumed.run.config.discoveryProviderPolicy).toBe("balanced");
      expect(
        BuyerMapArtifactV1Schema.parse(
          resumed.artifacts.find((artifact) => artifact.artifactType === "buyer_map")?.data,
        ).opportunities.length,
      ).toBeGreaterThan(0);
      expect((await readdir(resolve(paths.directory, "history"))).length).toBeGreaterThan(0);
      const completedExecution = LocalDiscoveryExecutionRecordV1Schema.parse(
        JSON.parse(await readFile(paths.executionPath, "utf8")) as unknown,
      );
      expect(completedExecution.success).toBe(true);
      expect(completedExecution.providerPolicyTraceImported).toBe(true);
    } finally {
      await store.close();
    }
  }, 30_000);
});
