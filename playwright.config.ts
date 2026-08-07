import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: "http://localhost:3100",
    trace: "on-first-retry",
  },
  webServer: {
    command: "pnpm --filter @cluvvi/web start",
    url: "http://localhost:3100/api/health",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: {
      PORT: "3100",
      NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54321",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "a".repeat(40),
      SUPABASE_SERVICE_ROLE_KEY: "s".repeat(40),
      APP_BASE_URL: "http://localhost:3100",
      DEFAULT_RUN_BUDGET_USD: "25",
      LOG_LEVEL: "info",
    },
  },
});
