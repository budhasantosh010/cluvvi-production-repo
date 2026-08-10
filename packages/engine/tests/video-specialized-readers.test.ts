import { randomUUID } from "node:crypto";
import { mkdir, rm } from "node:fs/promises";
import { resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { discoveryExchangePaths } from "../src/discovery-exchange";
import { loadProjectBPipelineFixture } from "../src/discovery-fixtures";
import { readValidatedVideoPlan } from "../src/video-artifact-reader";
import { readValidatedSpecializedContext } from "../src/specialized-artifact-reader";

const cleanup: string[] = [];
afterEach(async () => {
  await Promise.all(cleanup.splice(0).map((path) => rm(path, { recursive: true, force: true })));
});

async function emptyExchange(): Promise<{ runsDirectory: string; runId: string }> {
  const runsDirectory = resolve(process.cwd(), ".cluvvi-test", `j45-readers-${randomUUID()}`);
  const runId = `run_${randomUUID().replaceAll("-", "")}`;
  cleanup.push(runsDirectory);
  await mkdir(discoveryExchangePaths(runsDirectory, runId).directory, { recursive: true });
  return { runsDirectory, runId };
}

describe("C1-J.4/J.5 staged artifact readers", () => {
  it("reports a missing video plan at video_planning", async () => {
    const exchange = await emptyExchange();
    await expect(
      readValidatedVideoPlan({
        ...exchange,
        searchResults: loadProjectBPipelineFixture(),
      }),
    ).rejects.toMatchObject({
      failure: { code: "VIDEO_SOURCE_PLAN_MISSING", stage: "video_planning" },
    });
  });

  it("reports a missing specialized context at specialized_context", async () => {
    const exchange = await emptyExchange();
    await expect(
      readValidatedSpecializedContext({
        ...exchange,
        searchResults: loadProjectBPipelineFixture(),
      }),
    ).rejects.toMatchObject({
      failure: { code: "SPECIALIZED_SOURCE_CONTEXT_MISSING", stage: "specialized_context" },
    });
  });
});
