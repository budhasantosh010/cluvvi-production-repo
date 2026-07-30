import { defineConfig } from "@playwright/test";
import { existsSync } from "node:fs";

const browserCandidates = [
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
  "C:\\Users\\Lenovo\\AppData\\Local\\Microsoft\\Edge\\Application\\msedge.exe",
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Users\\Lenovo\\AppData\\Local\\Google\\Chrome\\Application\\chrome.exe",
];
const executablePath = browserCandidates.find(existsSync);
if (executablePath === undefined) {
  throw new Error("No supported local Chromium browser was found for Cluvvi visual QA.");
}

export default defineConfig({
  testDir: "./tests/browser-local",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: "list",
  timeout: 60_000,
  use: {
    baseURL: "http://localhost:3100",
    browserName: "chromium",
    launchOptions: { executablePath },
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
});
