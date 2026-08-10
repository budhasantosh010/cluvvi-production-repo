import { defineConfig } from "@playwright/test";
import baseConfig from "./playwright.local.config";

const chromiumExecutable = process.env["CLUVVI_PLAYWRIGHT_CHROMIUM_EXECUTABLE"]?.trim();

export default defineConfig({
  ...baseConfig,
  testMatch: "cluvvi-video-specialized-intelligence.spec.ts",
  testIgnore: [],
  timeout: 120_000,
  expect: { timeout: 75_000 },
  use: {
    ...baseConfig.use,
    baseURL: process.env["CLUVVI_BROWSER_BASE_URL"] ?? "http://127.0.0.1:3100",
    ...(chromiumExecutable
      ? { launchOptions: { ...baseConfig.use?.launchOptions, executablePath: chromiumExecutable } }
      : {}),
  },
});
