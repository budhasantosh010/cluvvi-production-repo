"use client";

import { useActionState } from "react";
import { createWorkspaceAction } from "@/app/actions";
import { INITIAL_ACTION_STATE } from "@/lib/action-state";
import { FormMessage } from "./form-message";
import { SubmitButton } from "./submit-button";

export function WorkspaceForm() {
  const [state, action] = useActionState(createWorkspaceAction, INITIAL_ACTION_STATE);

  return (
    <form action={action} className="mt-7 space-y-4">
      <label className="field-label">
        Workspace name
        <input
          autoFocus
          className="text-field"
          maxLength={80}
          name="name"
          placeholder="My company"
          required
        />
      </label>
      <p className="field-help">This keeps your missions and results together.</p>
      <FormMessage state={state} />
      <SubmitButton idleLabel="Create workspace" pendingLabel="Creating workspace…" />
    </form>
  );
}
