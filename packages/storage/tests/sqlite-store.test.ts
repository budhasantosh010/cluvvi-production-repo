import {
  DEFAULT_RUN_BUDGET,
  EMPTY_RUN_USAGE,
  LocalMissionSchema,
  LocalRunSchema,
  LocalRunEventSchema,
  createOpaqueId,
} from "@cluvvi/core";
import { existsSync } from "node:fs";
import { rm } from "node:fs/promises";
import { resolve } from "node:path";
import { randomUUID } from "node:crypto";
import { afterEach, describe, expect, it } from "vitest";
import { SqliteCluvviStore } from "../src";

const cleanupDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(
    cleanupDirectories
      .splice(0)
      .map((directory) => rm(directory, { force: true, recursive: true })),
  );
});

function testDirectory(): string {
  const directory = resolve(process.cwd(), ".cluvvi-test", randomUUID());
  cleanupDirectories.push(directory);
  return directory;
}

describe("SqliteCluvviStore", () => {
  it("applies migrations and persists a run with its first event", async () => {
    const directory = testDirectory();
    const databasePath = resolve(directory, "cluvvi.sqlite");
    const store = new SqliteCluvviStore({
      databasePath,
      migrationsDirectory: resolve(process.cwd(), "packages/storage/migrations"),
    });
    const now = new Date().toISOString();
    const mission = LocalMissionSchema.parse({
      id: createOpaqueId("mission"),
      input: {
        schemaVersion: "1.0",
        name: "Storage test mission",
        description: "A sufficiently detailed description for the local storage contract test.",
      },
      sourceFile: "fixture.json",
      createdAt: now,
    });
    const run = LocalRunSchema.parse({
      id: createOpaqueId("run"),
      missionId: mission.id,
      missionName: mission.input.name,
      status: "created",
      phase: "mission",
      config: { engineVersion: "test", fixtureMode: true },
      budget: DEFAULT_RUN_BUDGET,
      usage: EMPTY_RUN_USAGE,
      startedAt: now,
      updatedAt: now,
    });
    const event = LocalRunEventSchema.parse({
      id: createOpaqueId("event"),
      runId: run.id,
      eventType: "run_created",
      phase: "mission",
      data: {},
      createdAt: now,
    });

    try {
      await store.initialize();
      await store.createRun(run, mission, event);
      expect(existsSync(databasePath)).toBe(true);
      expect(await store.getRun(run.id)).toEqual(run);
      expect(await store.getMission(run.id)).toEqual(mission);
      expect(await store.listRunEvents(run.id)).toEqual([event]);
    } finally {
      await store.close();
    }
  });
});
