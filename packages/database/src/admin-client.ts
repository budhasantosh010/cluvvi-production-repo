import { parseWorkerEnvironment } from "@cluvvi/config";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./types";

export function createAdminClient(
  environment: NodeJS.ProcessEnv = process.env,
): SupabaseClient<Database> {
  const parsed = parseWorkerEnvironment(environment);

  return createClient<Database>(parsed.NEXT_PUBLIC_SUPABASE_URL, parsed.SUPABASE_SERVICE_ROLE_KEY, {
    auth: {
      autoRefreshToken: false,
      detectSessionInUrl: false,
      persistSession: false,
    },
    global: {
      headers: { "X-Client-Info": "cluvvi-worker/0.0.0" },
    },
  });
}
