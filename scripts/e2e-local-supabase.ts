import "dotenv/config";
import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { createAdminClient, MissionCompileGateway, type Database } from "@cluvvi/database";
import { handleMissionCompileMessage } from "@cluvvi/core";
import { parseWorkerEnvironment } from "@cluvvi/config";

const environment = parseWorkerEnvironment(process.env);
const admin = createAdminClient(process.env);
const password = `Cluvvi-${randomUUID()}-A1!`;
const ownerEmail = `phase0-owner-${randomUUID()}@cluvvi.test`;
const outsiderEmail = `phase0-outsider-${randomUUID()}@cluvvi.test`;
const createdUserIds: string[] = [];
let workspaceId: string | undefined;

async function createSignedInClient(email: string) {
  const created = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (created.error || !created.data.user) {
    throw new Error(`Could not create E2E user: ${created.error?.message ?? "unknown"}`);
  }
  createdUserIds.push(created.data.user.id);

  const client = createClient<Database>(
    environment.NEXT_PUBLIC_SUPABASE_URL,
    environment.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
  const session = await client.auth.signInWithPassword({ email, password });
  if (session.error) {
    throw new Error(`Could not sign in E2E user: ${session.error.message}`);
  }
  return { client, user: created.data.user };
}

try {
  const owner = await createSignedInClient(ownerEmail);
  const outsider = await createSignedInClient(outsiderEmail);

  const workspace = await owner.client
    .from("workspaces")
    .insert({ name: "Cluvvi E2E", owner_user_id: owner.user.id, settings_json: {} })
    .select("*")
    .single();
  if (workspace.error) {
    throw new Error(`Workspace creation failed: ${workspace.error.message}`);
  }
  workspaceId = workspace.data.id;

  const mission = await owner.client
    .from("missions")
    .insert({
      workspace_id: workspace.data.id,
      name: "Find video teams with editing pressure",
      website_url: "https://cluvvi.example",
      raw_description: "An AI rough-cut editor for long-form talking-head video teams.",
      customer_outcome: "Publish long-form videos faster with less manual editing labor.",
      price_min: 99,
      price_max: 499,
      currency: "USD",
      geographies: ["United States"],
      desired_count: 20,
      exclusions: ["Short-form-only creators"],
      capacity_notes: null,
      status: "draft",
    })
    .select("*")
    .single();
  if (mission.error) {
    throw new Error(`Mission creation failed: ${mission.error.message}`);
  }

  const idempotencyKey = `e2e:${randomUUID()}`;
  const started = await owner.client.rpc("start_mission_run", {
    p_mission_id: mission.data.id,
    p_requested_count: 20,
    p_budget_usd: 25,
    p_idempotency_key: idempotencyKey,
  });
  if (started.error) {
    throw new Error(`Run start failed: ${started.error.message}`);
  }

  const repeated = await owner.client.rpc("start_mission_run", {
    p_mission_id: mission.data.id,
    p_requested_count: 20,
    p_budget_usd: 25,
    p_idempotency_key: idempotencyKey,
  });
  if (repeated.error || repeated.data.id !== started.data.id) {
    throw new Error("Run start idempotency failed");
  }

  const gateway = new MissionCompileGateway(admin);
  const [lease] = await gateway.lease({ quantity: 1, visibilityTimeoutSeconds: 60 });
  if (!lease) {
    throw new Error("No queue message was leased");
  }
  const processed = await handleMissionCompileMessage(lease, gateway);
  const duplicate = await handleMissionCompileMessage(lease, gateway);

  const run = await owner.client.from("runs").select("*").eq("id", started.data.id).single();
  const events = await owner.client
    .from("run_events")
    .select("*")
    .eq("run_id", started.data.id)
    .order("created_at");
  const outsiderWorkspaces = await outsider.client.from("workspaces").select("id");

  if (run.error || run.data.status !== "compiling") {
    throw new Error("Worker did not persist compiling state");
  }
  if (events.error || events.data.length !== 2) {
    throw new Error(`Expected two run events, received ${events.data?.length ?? 0}`);
  }
  if (outsiderWorkspaces.error || outsiderWorkspaces.data.length !== 0) {
    throw new Error("RLS allowed cross-workspace access");
  }
  if (processed.outcome !== "processed" || duplicate.outcome !== "duplicate") {
    throw new Error("Duplicate worker delivery was not handled idempotently");
  }

  console.log(
    JSON.stringify(
      {
        result: "passed",
        workspaceId: workspace.data.id,
        missionId: mission.data.id,
        runId: run.data.id,
        status: run.data.status,
        eventTypes: events.data.map((event) => event.event_type),
        firstWorkerOutcome: processed.outcome,
        duplicateWorkerOutcome: duplicate.outcome,
        outsiderVisibleWorkspaces: outsiderWorkspaces.data.length,
      },
      null,
      2,
    ),
  );
} finally {
  if (workspaceId) {
    await admin.from("workspaces").delete().eq("id", workspaceId);
  }
  for (const userId of createdUserIds) {
    await admin.auth.admin.deleteUser(userId);
  }
}
