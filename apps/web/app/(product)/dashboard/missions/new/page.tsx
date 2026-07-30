import { redirect } from "next/navigation";
import { MissionForm } from "@/components/mission-form";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export default async function NewMissionPage({
  searchParams,
}: {
  searchParams: Promise<{ workspace?: string }>;
}) {
  const { workspace: requestedWorkspaceId } = await searchParams;
  const client = await createServerSupabaseClient();
  const { data: workspaces } = await client
    .from("workspaces")
    .select("id, name")
    .order("created_at");
  const workspace = workspaces?.find((item) => item.id === requestedWorkspaceId) ?? workspaces?.[0];

  if (!workspace) {
    redirect("/dashboard");
  }

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-8">
        <p className="eyebrow">Step 2 of 3 · {workspace.name}</p>
        <h1 className="mt-3 text-4xl font-semibold tracking-[-0.035em]">
          Describe one product clearly.
        </h1>
        <p className="mt-3 max-w-2xl text-base leading-7 text-neutral-600">
          Cluvvi will use this as the boundary for every later buyer decision. Specific input
          protects result quality.
        </p>
      </div>
      <MissionForm workspaceId={workspace.id} />
    </div>
  );
}
