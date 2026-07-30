import {
  CreateMissionInputSchema,
  CreateWorkspaceInputSchema,
  StartRunInputSchema,
  type CreateMissionInput,
  type CreateWorkspaceInput,
  type StartRunInput,
} from "@cluvvi/core";
import type { Database, MissionRow, RunRow, WorkspaceRow } from "@cluvvi/database";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireUser } from "./auth";

export class PersistenceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PersistenceError";
  }
}

export async function createWorkspace(
  client: SupabaseClient<Database>,
  input: CreateWorkspaceInput,
): Promise<WorkspaceRow> {
  const user = await requireUser(client);
  const parsed = CreateWorkspaceInputSchema.parse(input);
  const { data, error } = await client
    .from("workspaces")
    .insert({ name: parsed.name, owner_user_id: user.id, settings_json: {} })
    .select("*")
    .single();

  if (error) {
    throw new PersistenceError(`Could not create workspace: ${error.message}`);
  }

  return data;
}

export async function createMission(
  client: SupabaseClient<Database>,
  input: CreateMissionInput,
): Promise<MissionRow> {
  await requireUser(client);
  const parsed = CreateMissionInputSchema.parse(input);
  const { data, error } = await client
    .from("missions")
    .insert({
      workspace_id: parsed.workspaceId,
      name: parsed.name,
      website_url: parsed.websiteUrl,
      raw_description: parsed.rawDescription,
      customer_outcome: parsed.customerOutcome,
      price_min: parsed.priceMin,
      price_max: parsed.priceMax,
      currency: parsed.currency,
      geographies: parsed.geographies,
      desired_count: parsed.desiredCount,
      exclusions: parsed.exclusions,
      capacity_notes: parsed.capacityNotes,
      status: "draft",
    })
    .select("*")
    .single();

  if (error) {
    throw new PersistenceError(`Could not create mission: ${error.message}`);
  }

  return data;
}

export async function startMissionRun(
  client: SupabaseClient<Database>,
  input: StartRunInput,
): Promise<RunRow> {
  await requireUser(client);
  const parsed = StartRunInputSchema.parse(input);
  const { data, error } = await client.rpc("start_mission_run", {
    p_mission_id: parsed.missionId,
    p_requested_count: parsed.requestedCount,
    p_budget_usd: parsed.budgetUsd,
    p_idempotency_key: parsed.idempotencyKey,
  });

  if (error) {
    throw new PersistenceError(`Could not start run: ${error.message}`);
  }

  return data;
}
