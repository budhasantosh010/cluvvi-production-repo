import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const client = await createServerSupabaseClient();
  const { data } = await client.auth.getUser();
  redirect(data.user ? "/dashboard" : "/sign-in");
}
