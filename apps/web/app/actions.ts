"use server";

import { CreateWorkspaceInputSchema, StartRunInputSchema } from "@cluvvi/core";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { actionError } from "@/lib/action-errors";
import type { ActionState } from "@/lib/action-state";
import { createMission, createWorkspace, startMissionRun } from "@/lib/server/commands";
import { missionInputFromFormData } from "@/lib/server/form-parsers";
import { createServerSupabaseClient } from "@/lib/supabase/server";

const credentialsSchema = z.object({
  email: z.email(),
  password: z.string().min(8, "Password must contain at least 8 characters."),
});

function credentialsFromFormData(formData: FormData) {
  return credentialsSchema.parse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
}

export async function signInAction(
  _previousState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    const credentials = credentialsFromFormData(formData);
    const client = await createServerSupabaseClient();
    const { error } = await client.auth.signInWithPassword(credentials);
    if (error) {
      throw new Error(error.message);
    }
  } catch (error) {
    return actionError(error);
  }

  redirect("/dashboard");
}

export async function signUpAction(
  _previousState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    const credentials = credentialsFromFormData(formData);
    const client = await createServerSupabaseClient();
    const { error } = await client.auth.signUp(credentials);
    if (error) {
      throw new Error(error.message);
    }
  } catch (error) {
    return actionError(error);
  }

  redirect("/dashboard");
}

export async function signOutAction(): Promise<void> {
  const client = await createServerSupabaseClient();
  await client.auth.signOut();
  redirect("/sign-in");
}

export async function createWorkspaceAction(
  _previousState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    const input = CreateWorkspaceInputSchema.parse({ name: formData.get("name") });
    const client = await createServerSupabaseClient();
    await createWorkspace(client, input);
  } catch (error) {
    return actionError(error);
  }

  revalidatePath("/dashboard");
  redirect("/dashboard");
}

export async function createMissionAction(
  _previousState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  let missionId: string;
  try {
    const client = await createServerSupabaseClient();
    const mission = await createMission(client, missionInputFromFormData(formData));
    missionId = mission.id;
  } catch (error) {
    return actionError(error);
  }

  revalidatePath("/dashboard");
  redirect(`/dashboard/missions/${missionId}`);
}

export async function startRunAction(
  _previousState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  let runId: string;
  try {
    const input = StartRunInputSchema.parse({
      missionId: formData.get("missionId"),
      requestedCount: Number(formData.get("requestedCount")),
      budgetUsd: Number(formData.get("budgetUsd")),
      idempotencyKey: formData.get("idempotencyKey"),
    });
    const client = await createServerSupabaseClient();
    const run = await startMissionRun(client, input);
    runId = run.id;
  } catch (error) {
    return actionError(error);
  }

  revalidatePath("/dashboard");
  redirect(`/dashboard/runs/${runId}`);
}
