import { MissionInputSchemaV1, RunPhaseSchema } from "@cluvvi/core";
import { RunExecutionError } from "@cluvvi/engine";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import type { ParsedArguments } from "../arguments";
import { stringFlag } from "../arguments";
import { printEvent } from "../output";
import { createLocalRuntime } from "../runtime";

export async function runCommand(arguments_: ParsedArguments): Promise<void> {
  const missionArgument = arguments_.positionals[0];
  if (missionArgument === undefined) {
    throw new Error("Usage: pnpm cluvvi run <mission.json> [--fail-stage investigation]");
  }
  const missionPath = resolve(missionArgument);
  const mission = MissionInputSchemaV1.parse(
    JSON.parse(await readFile(missionPath, "utf8")) as unknown,
  );
  const failStageValue = stringFlag(arguments_, "fail-stage");
  const failStage = failStageValue === undefined ? undefined : RunPhaseSchema.parse(failStageValue);
  const { store, engine, paths } = createLocalRuntime({ emit: printEvent });

  try {
    const result = await engine.start({
      mission,
      sourceFile: missionPath,
      ...(failStage === undefined ? {} : { failStage }),
    });
    console.log(`\nRun: ${result.run.id}`);
    console.log(`Status: ${result.run.status}`);
    console.log(`Report: ${resolve(paths.runsDirectory, result.run.id, "run-report.md")}`);
  } catch (error) {
    if (error instanceof RunExecutionError) {
      console.error(`\n${error.message}`);
    }
    throw error;
  } finally {
    await store.close();
  }
}
