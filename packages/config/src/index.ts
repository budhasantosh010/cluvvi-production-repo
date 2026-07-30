import { z } from "zod";

const publicEnvironmentSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(20),
});

const serverEnvironmentSchema = publicEnvironmentSchema.extend({
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(20),
  APP_BASE_URL: z.url().default("http://localhost:3000"),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace"]).default("info"),
  DEFAULT_RUN_BUDGET_USD: z.coerce.number().positive().max(100_000).default(25),
});

const workerEnvironmentSchema = serverEnvironmentSchema.extend({
  WORKER_POLL_INTERVAL_MS: z.coerce.number().int().min(250).max(60_000).default(2_000),
  WORKER_HEALTH_PORT: z.coerce.number().int().min(1_024).max(65_535).default(3_001),
});

export type PublicEnvironment = z.infer<typeof publicEnvironmentSchema>;
export type ServerEnvironment = z.infer<typeof serverEnvironmentSchema>;
export type WorkerEnvironment = z.infer<typeof workerEnvironmentSchema>;
export type EnvironmentInput = Readonly<Record<string, string | undefined>>;

export function parsePublicEnvironment(environment: EnvironmentInput): PublicEnvironment {
  return publicEnvironmentSchema.parse(environment);
}

export function parseServerEnvironment(environment: EnvironmentInput): ServerEnvironment {
  return serverEnvironmentSchema.parse(environment);
}

export function parseWorkerEnvironment(environment: EnvironmentInput): WorkerEnvironment {
  return workerEnvironmentSchema.parse(environment);
}

export function environmentCapabilities(environment: EnvironmentInput): {
  supabaseConfigured: boolean;
  workerConfigured: boolean;
} {
  return {
    supabaseConfigured: publicEnvironmentSchema.safeParse(environment).success,
    workerConfigured: workerEnvironmentSchema.safeParse(environment).success,
  };
}
