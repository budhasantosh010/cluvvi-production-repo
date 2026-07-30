import type { Database } from "@cluvvi/database";
import type { SupabaseClient, User } from "@supabase/supabase-js";

export class AuthenticationRequiredError extends Error {
  constructor() {
    super("Authentication required.");
    this.name = "AuthenticationRequiredError";
  }
}

export async function requireUser(client: SupabaseClient<Database>): Promise<User> {
  const { data, error } = await client.auth.getUser();

  if (error) {
    throw new AuthenticationRequiredError();
  }

  return data.user;
}
