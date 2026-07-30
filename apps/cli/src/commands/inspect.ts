import type { LocalRunPhase } from "@cluvvi/core";
import { RunPhaseSchema } from "@cluvvi/core";
import type { ParsedArguments } from "../arguments";
import { stringFlag } from "../arguments";
import { printJson } from "../output";
import { createLocalRuntime } from "../runtime";

export async function inspectCommand(arguments_: ParsedArguments): Promise<void> {
  const runId = arguments_.positionals[0];
  if (runId === undefined) {
    throw new Error("Usage: pnpm cluvvi inspect <run-id> [--stage investigation] [--errors]");
  }
  const stageValue = stringFlag(arguments_, "stage");
  const stage: LocalRunPhase | undefined =
    stageValue === undefined ? undefined : RunPhaseSchema.parse(stageValue);
  const errorsOnly = arguments_.flags.has("errors");
  const { store } = createLocalRuntime();
  try {
    await store.initialize();
    const run = await store.getRun(runId);
    if (run === null) {
      throw new Error(`Run ${runId} was not found.`);
    }
    const mission = await store.getMission(runId);
    const artifacts = await store.listArtifacts(runId);
    const executions = await store.listStageExecutions(runId);
    const events = await store.listRunEvents(runId);
    const toolCalls = await store.listToolCalls(runId);

    if (errorsOnly) {
      printJson({
        runId,
        failure: run.failure ?? null,
        failedExecutions: executions.filter((execution) => execution.status === "failed"),
        failedEvents: events.filter((event) => event.eventType === "stage_failed"),
      });
      return;
    }

    if (stage !== undefined) {
      printJson({
        runId,
        stage,
        executions: executions.filter((execution) => execution.stageName === stage),
        artifacts: artifacts.filter((artifact) => artifact.stage === stage),
        toolCalls: toolCalls.filter((record) => record.stageName === stage),
      });
      return;
    }

    printJson({ run, mission, artifacts, executions, events, toolCalls });
  } finally {
    await store.close();
  }
}
