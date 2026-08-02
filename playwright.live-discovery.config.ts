import baseConfig from "./playwright.local.config";
import { defineConfig } from "@playwright/test";

export default defineConfig({
  ...baseConfig,
  testMatch: "cluvvi-live-discovery.spec.ts",
  testIgnore: [],
  timeout: 120_000,
});
