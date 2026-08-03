import { defineConfig } from "@playwright/test";
import baseConfig from "./playwright.local.config";

export default defineConfig({
  ...baseConfig,
  testMatch: "cluvvi-free-live-discovery.spec.ts",
  testIgnore: [],
  timeout: 120_000,
});
