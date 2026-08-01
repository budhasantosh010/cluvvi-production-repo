import baseConfig from "./playwright.local.config";
import { defineConfig } from "@playwright/test";

export default defineConfig({
  ...baseConfig,
  testMatch: "cluvvi-local-discovery-failure.spec.ts",
  testIgnore: [],
  timeout: 90_000,
});
