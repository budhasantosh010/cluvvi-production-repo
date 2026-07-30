import { CluvviError, type LocalRun } from "@cluvvi/core";

export class BudgetController {
  assertRunCanContinue(run: LocalRun, now = Date.now()): void {
    const elapsedMinutes = (now - Date.parse(run.startedAt)) / 60_000;
    if (elapsedMinutes > run.budget.maximumRuntimeMinutes) {
      throw new CluvviError({
        code: "RUN_RUNTIME_BUDGET_EXHAUSTED",
        category: "budget",
        message: `Run exceeded its ${run.budget.maximumRuntimeMinutes}-minute runtime budget.`,
        retryable: true,
        stage: run.phase,
        context: { elapsedMinutes },
      });
    }

    if (run.usage.costUsd > run.budget.maximumCostUsd) {
      throw new CluvviError({
        code: "RUN_COST_BUDGET_EXHAUSTED",
        category: "budget",
        message: `Run exceeded its $${run.budget.maximumCostUsd.toFixed(2)} cost budget.`,
        retryable: true,
        stage: run.phase,
      });
    }
  }
}
