import { ORDERED_RUN_PHASES, type StageExecution } from "@cluvvi/core";
import type { ParsedArguments } from "../arguments";
import { createLocalRuntime } from "../runtime";

function latestByStage(executions: readonly StageExecution[]): Map<string, StageExecution> {
  const latest = new Map<string, StageExecution>();
  for (const execution of executions) {
    const current = latest.get(execution.stageName);
    if (current === undefined || execution.attempt >= current.attempt) {
      latest.set(execution.stageName, execution);
    }
  }
  return latest;
}

export async function statusCommand(arguments_: ParsedArguments): Promise<void> {
  const runId = arguments_.positionals[0];
  if (runId === undefined) {
    throw new Error("Usage: pnpm cluvvi status <run-id>");
  }
  const { store } = createLocalRuntime();
  try {
    await store.initialize();
    const run = await store.getRun(runId);
    if (run === null) {
      throw new Error(`Run ${runId} was not found.`);
    }
    const executions = latestByStage(await store.listStageExecutions(runId));
    console.log(`Run: ${run.id}`);
    console.log(`Mission: ${run.missionName}`);
    console.log(`Status: ${run.status}`);
    console.log(`Started: ${run.startedAt}\n`);
    console.log("Stages:");
    for (const phase of ORDERED_RUN_PHASES) {
      const execution = executions.get(phase);
      const marker =
        execution?.status === "completed"
          ? "✓"
          : execution?.status === "failed"
            ? "!"
            : run.phase === phase && run.status === "running"
              ? "→"
              : "○";
      console.log(
        `${marker} ${phase}${execution === undefined ? "" : ` (attempt ${execution.attempt})`}`,
      );
    }
    console.log("\nBudget:");
    console.log(
      `Estimated cost     $${run.usage.costUsd.toFixed(2)} / $${run.budget.maximumCostUsd.toFixed(2)}`,
    );
    console.log(`Search calls       ${run.usage.searchCalls} / ${run.budget.maximumSearchCalls}`);
    console.log(`Fetch calls        ${run.usage.fetchCalls} / ${run.budget.maximumFetchCalls}`);
    if (run.failure !== undefined) {
      console.log(`\nFailure: ${run.failure.code} — ${run.failure.message}`);
    }
  } finally {
    await store.close();
  }
}
