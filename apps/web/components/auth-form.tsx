"use client";

import { useActionState, useState } from "react";
import { signInAction, signUpAction } from "@/app/actions";
import { INITIAL_ACTION_STATE } from "@/lib/action-state";
import { FormMessage } from "./form-message";
import { SubmitButton } from "./submit-button";

export function AuthForm() {
  const [mode, setMode] = useState<"sign-in" | "sign-up">("sign-in");
  const action = mode === "sign-in" ? signInAction : signUpAction;
  const [state, formAction] = useActionState(action, INITIAL_ACTION_STATE);

  return (
    <div className="space-y-6">
      <div>
        <p className="eyebrow">Buyer discovery, without guessing</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-neutral-950">
          {mode === "sign-in" ? "Welcome back" : "Create your Cluvvi account"}
        </h1>
        <p className="mt-2 text-sm leading-6 text-neutral-600">
          {mode === "sign-in"
            ? "Continue to your customer-discovery missions."
            : "Start with one product and one clear customer mission."}
        </p>
      </div>

      <form action={formAction} className="space-y-4">
        <label className="field-label">
          Email
          <input autoComplete="email" className="text-field" name="email" required type="email" />
        </label>
        <label className="field-label">
          Password
          <input
            autoComplete={mode === "sign-in" ? "current-password" : "new-password"}
            className="text-field"
            minLength={8}
            name="password"
            required
            type="password"
          />
        </label>
        <FormMessage state={state} />
        <SubmitButton
          idleLabel={mode === "sign-in" ? "Sign in" : "Create account"}
          pendingLabel={mode === "sign-in" ? "Signing in…" : "Creating account…"}
        />
      </form>

      <button
        className="text-sm font-medium text-neutral-700 underline decoration-neutral-300 underline-offset-4 hover:text-neutral-950"
        onClick={() => setMode(mode === "sign-in" ? "sign-up" : "sign-in")}
        type="button"
      >
        {mode === "sign-in" ? "New here? Create an account" : "Already have an account? Sign in"}
      </button>
    </div>
  );
}
