import {
  LocalCluvviApplicationService,
  LocalRunner,
  type LocalDiagnostics,
} from "@cluvvi/application";
import type { MissionInputV1 } from "@cluvvi/core";
import { CluvviEngine, LocalArtifactWriter, createDefaultStageRegistry } from "@cluvvi/engine";
import { SqliteCluvviStore, type LocalCluvviPaths } from "@cluvvi/storage";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

const directories: string[] = [];

async function runtime() {
  const directory = await mkdtemp(resolve(tmpdir(), "cluvvi-c05-"));
  directories.push(directory);
  const paths: LocalCluvviPaths = {
    projectRoot: directory,
    cluvviDirectory: resolve(directory, ".cluvvi"),
    databasePath: resolve(directory, ".cluvvi", "cluvvi.sqlite"),
    runsDirectory: resolve(directory, ".cluvvi", "runs"),
    visualQaDirectory: resolve(directory, "visual_qa"),
  };
  const store = new SqliteCluvviStore({ databasePath: paths.databasePath });
  const artifactWriter = new LocalArtifactWriter(paths.runsDirectory);
  const service = new LocalCluvviApplicationService({ store, paths });
  return { paths, store, artifactWriter, service };
}

const mission: MissionInputV1 = {
  schemaVersion: "1.0",
  name: "Video editing SaaS discovery",
  website: "https://example.com",
  description:
    "AI-assisted video editing software that creates rough cuts for recurring long-form video teams.",
  customerOutcome: "Publish long-form videos faster with less manual editing.",
  price: {
    minimum: 100,
    maximum: 500,
    currency: "USD",
    billingPeriod: "monthly",
  },
  geographies: ["United States", "UAE"],
  desiredOpportunities: 20,
  exclusions: ["Hobby creators"],
  goodCustomerExamples: [],
  badCustomerExamples: [],
};

afterEach(async () => {
  await Promise.all(
    directories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })),
  );
});

describe("C0.5 local browser runtime", () => {
  it("creates one logical run for a duplicate submission and completes it through the shared engine", async () => {
    const { store, artifactWriter, service } = await runtime();
    try {
      const first = await service.createRun(mission, "browser-submission-0001");
      const duplicate = await service.createRun(mission, "browser-submission-0001");

      expect(first.created).toBe(true);
      expect(duplicate.created).toBe(false);
      expect(duplicate.view.run.id).toBe(first.view.run.id);
      expect(await store.listRunRequests(first.view.run.id)).toHaveLength(1);

      const runner = new LocalRunner({
        store,
        artifactWriter,
        engine: new CluvviEngine({
          store,
          artifactWriter,
          stages: createDefaultStageRegistry(),
        }),
        runnerId: "runner-test-main",
        hostname: "test-host",
        processId: 1001,
      });

      expect(await runner.startOnce()).toBe(true);
      expect(await runner.startOnce()).toBe(false);

      const completed = await service.getRun(first.view.run.id);
      expect(completed?.run.status).toBe("completed");
      expect(completed?.stages.every((stage) => stage.status === "completed")).toBe(true);
      expect(completed?.artifacts).toHaveLength(11);
      expect((completed?.artifacts[0]?.data as { fixture?: boolean }).fixture).toBe(true);
    } finally {
      await store.close();
    }
  });

  it("protects active leases, reclaims expired leases, and resumes a failed run without repeating successful stages", async () => {
    const { store, artifactWriter, service } = await runtime();
    try {
      const created = await service.createRun(mission, "browser-submission-lease-0001");
      const now = new Date("2026-07-30T16:00:00.000Z");
      const firstClaim = await store.claimNextRunRequest({
        runnerId: "runner-a",
        now: now.toISOString(),
        leaseExpiresAt: new Date(now.getTime() + 30_000).toISOString(),
      });
      expect(firstClaim?.attempt).toBe(1);
      expect(
        await store.claimNextRunRequest({
          runnerId: "runner-b",
          now: new Date(now.getTime() + 10_000).toISOString(),
          leaseExpiresAt: new Date(now.getTime() + 40_000).toISOString(),
        }),
      ).toBeNull();
      const reclaimed = await store.claimNextRunRequest({
        runnerId: "runner-b",
        now: new Date(now.getTime() + 31_000).toISOString(),
        leaseExpiresAt: new Date(now.getTime() + 61_000).toISOString(),
      });
      expect(reclaimed?.id).toBe(firstClaim?.id);
      expect(reclaimed?.attempt).toBe(2);
      await store.failRunRequest(
        reclaimed!.id,
        "runner-b",
        {
          code: "TEST_LEASE_RELEASE",
          category: "internal",
          message: "Release the reclaimed request for the execution test.",
          retryable: true,
        },
        new Date(now.getTime() + 31_500).toISOString(),
      );

      const retryRequest = await store.enqueueRunRequest({
        ...reclaimed!,
        id: `request_${crypto.randomUUID().replaceAll("-", "")}`,
        status: "pending",
        idempotencyKey: `retry-start:${created.view.run.id}`,
        claimedBy: undefined,
        claimedAt: undefined,
        leaseExpiresAt: undefined,
        attempt: 0,
        failure: undefined,
        completedAt: undefined,
        createdAt: new Date(now.getTime() + 32_000).toISOString(),
        updatedAt: new Date(now.getTime() + 32_000).toISOString(),
      });
      expect(retryRequest.status).toBe("pending");

      const failingRunner = new LocalRunner({
        store,
        artifactWriter,
        engine: new CluvviEngine({
          store,
          artifactWriter,
          stages: createDefaultStageRegistry(),
        }),
        runnerId: "runner-failure",
        hostname: "test-host",
        processId: 1002,
        failStage: "investigation",
      });
      expect(await failingRunner.startOnce()).toBe(true);
      expect((await service.getRun(created.view.run.id))?.run.status).toBe("failed");

      await service.requestResume(created.view.run.id);
      const resumeRunner = new LocalRunner({
        store,
        artifactWriter,
        engine: new CluvviEngine({
          store,
          artifactWriter,
          stages: createDefaultStageRegistry(),
        }),
        runnerId: "runner-resume",
        hostname: "test-host",
        processId: 1003,
      });
      expect(await resumeRunner.startOnce()).toBe(true);

      const resumed = await service.getRun(created.view.run.id);
      expect(resumed?.run.status).toBe("completed");
      expect(resumed?.events.filter((event) => event.eventType === "stage_reused")).toHaveLength(5);
      const investigationAttempts = (await store.listStageExecutions(created.view.run.id)).filter(
        (execution) => execution.stageName === "investigation",
      );
      expect(investigationAttempts).toHaveLength(2);

      const diagnostics: LocalDiagnostics = await service.getDiagnostics();
      expect(diagnostics.databaseInstanceId).toBeTruthy();
      expect(diagnostics.migrationVersion).toBe("003");
    } finally {
      await store.close();
    }
  });

  it("initializes storage for direct event and artifact reads", async () => {
    const { store, service } = await runtime();
    try {
      const missingRunId = "run_00000000000000000000000000000000";
      expect(await service.getRunEvents(missingRunId)).toEqual([]);
      expect(await service.getRunArtifact(missingRunId, "mission")).toBeNull();
    } finally {
      await store.close();
    }
  });

  it("rejects one-shot execution while another runner owns leadership", async () => {
    const { store, artifactWriter } = await runtime();
    try {
      await store.initialize();
      const now = new Date();
      expect(
        await store.acquireRunnerLeadership({
          runnerId: "runner-existing",
          now: now.toISOString(),
          leaseExpiresAt: new Date(now.getTime() + 20_000).toISOString(),
        }),
      ).toBe(true);
      const competingRunner = new LocalRunner({
        store,
        artifactWriter,
        engine: new CluvviEngine({
          store,
          artifactWriter,
          stages: createDefaultStageRegistry(),
        }),
        runnerId: "runner-one-shot",
        hostname: "test-host",
        processId: 1004,
      });
      await expect(competingRunner.startOnce()).rejects.toThrow(
        "Another Cluvvi local runner owns the SQLite leadership lease",
      );
    } finally {
      await store.releaseRunnerLeadership("runner-existing");
      await store.close();
    }
  });

  it("allows one active runner leadership lease and recovers only after expiry", async () => {
    const { store } = await runtime();
    try {
      await store.initialize();
      const now = new Date("2026-07-30T18:00:00.000Z");
      expect(
        await store.acquireRunnerLeadership({
          runnerId: "runner-leader-a",
          now: now.toISOString(),
          leaseExpiresAt: new Date(now.getTime() + 20_000).toISOString(),
        }),
      ).toBe(true);
      expect(
        await store.acquireRunnerLeadership({
          runnerId: "runner-leader-b",
          now: new Date(now.getTime() + 10_000).toISOString(),
          leaseExpiresAt: new Date(now.getTime() + 30_000).toISOString(),
        }),
      ).toBe(false);
      expect(
        await store.renewRunnerLeadership({
          runnerId: "runner-leader-b",
          now: new Date(now.getTime() + 10_000).toISOString(),
          leaseExpiresAt: new Date(now.getTime() + 30_000).toISOString(),
        }),
      ).toBe(false);
      expect(
        await store.renewRunnerLeadership({
          runnerId: "runner-leader-a",
          now: new Date(now.getTime() + 10_000).toISOString(),
          leaseExpiresAt: new Date(now.getTime() + 30_000).toISOString(),
        }),
      ).toBe(true);
      expect(
        await store.acquireRunnerLeadership({
          runnerId: "runner-leader-b",
          now: new Date(now.getTime() + 31_000).toISOString(),
          leaseExpiresAt: new Date(now.getTime() + 51_000).toISOString(),
        }),
      ).toBe(true);
      await store.releaseRunnerLeadership("runner-leader-b");
      expect(
        await store.acquireRunnerLeadership({
          runnerId: "runner-leader-c",
          now: new Date(now.getTime() + 32_000).toISOString(),
          leaseExpiresAt: new Date(now.getTime() + 52_000).toISOString(),
        }),
      ).toBe(true);
    } finally {
      await store.close();
    }
  });
});
