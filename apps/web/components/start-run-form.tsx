"use client";

import { useActionState } from "react";
import { startRunAction } from "@/app/actions";
import { INITIAL_ACTION_STATE } from "@/lib/action-state";
import { FormMessage } from "./form-message";
import { SubmitButton } from "./submit-button";

export function StartRunForm({
  missionId,
  requestedCount,
  idempotencyKey,
  defaultBudgetUsd,
}: {
  missionId: string;
  requestedCount: number;
  idempotencyKey: string;
  defaultBudgetUsd: number;
}) {
  const [state, action] = useActionState(startRunAction, INITIAL_ACTION_STATE);

  return (
    <form action={action} className="space-y-4">
      <input name="missionId" type="hidden" value={missionId} />
      <input name="requestedCount" type="hidden" value={requestedCount} />
      <input name="idempotencyKey" type="hidden" value={idempotencyKey} />
      <label className="field-label">
        Maximum run budget
        <div className="relative">
          <span className="pointer-events-none absolute inset-y-0 left-4 flex items-center text-neutral-500">
            $
          </span>
          <input
            className="text-field pl-8"
            defaultValue={defaultBudgetUsd}
            max="100000"
            min="1"
            name="budgetUsd"
            required
            step="0.01"
            type="number"
          />
        </div>
        <span className="field-help">Cluvvi will stop safely before exceeding this amount.</span>
      </label>
      <FormMessage state={state} />
      <SubmitButton idleLabel="Start finding customers" pendingLabel="Starting securely…" />
    </form>
  );
}
