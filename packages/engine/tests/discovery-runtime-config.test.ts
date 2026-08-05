import { randomUUID } from "node:crypto";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  DiscoveryRuntimeConfigurationError,
  allowedDiscoveryProviderEnvironment,
  parseDiscoveryRuntimeConfig,
  publicDiscoveryProviderEnvironment,
} from "../src/discovery-runtime-config";

const cleanupDirectories: string[] = [];
afterEach(async () => {
  await Promise.all(
    cleanupDirectories.splice(0).map((path) => rm(path, { recursive: true, force: true })),
  );
});

async function fakeProject(): Promise<string> {
  const path = resolve(process.cwd(), ".cluvvi-test", randomUUID());
  cleanupDirectories.push(path);
  await mkdir(path, { recursive: true });
  await writeFile(resolve(path, "package.json"), "{}\n", "utf8");
  return path;
}

function expectCode(operation: () => unknown, code: string): void {
  try {
    operation();
    throw new Error("Expected configuration parsing to fail.");
  } catch (error) {
    expect(error).toBeInstanceOf(DiscoveryRuntimeConfigurationError);
    expect((error as DiscoveryRuntimeConfigurationError).code).toBe(code);
  }
}

describe("discovery runtime configuration", () => {
  it("defaults fixture runtime, fixture providers, and free-only policy", () => {
    expect(parseDiscoveryRuntimeConfig({})).toEqual({
      mode: "fixture",
      providerMode: "fixture_only",
      providerPolicy: "free_only",
      extractionMode: "none",
      maximumExtractions: 8,
      extractorVersion: "basic_public_html_extractor@1.0.0",
      frontierPolicyVersion: "frontier_policy@1.0.0",
    });
  });

  it("validates local fixture configuration", async () => {
    const projectPath = await fakeProject();
    expect(
      parseDiscoveryRuntimeConfig({
        CLUVVI_DISCOVERY_MODE: "local_discovery_engine",
        CLUVVI_DISCOVERY_ENGINE_PATH: projectPath,
        CLUVVI_DISCOVERY_ENGINE_COMMAND: "pnpm",
      }),
    ).toMatchObject({
      mode: "local_discovery_engine",
      providerMode: "fixture_only",
      providerPolicy: "free_only",
      local: { projectPath, providerMode: "fixture_only", providerPolicy: "free_only" },
    });
  });

  it.each(["free_only", "balanced", "paid_deep"] as const)(
    "parses live policy %s and forwards only known non-secret settings",
    async (policy) => {
      const projectPath = await fakeProject();
      const environment = {
        CLUVVI_DISCOVERY_MODE: "local_discovery_engine",
        CLUVVI_DISCOVERY_PROVIDER_MODE: "live_search",
        CLUVVI_DISCOVERY_PROVIDER_POLICY: policy,
        CLUVVI_DISCOVERY_ENGINE_PATH: projectPath,
        CLUVVI_DISCOVERY_ENGINE_COMMAND: "pnpm",
        DISCOVERY_TAVILY_API_KEY: "must-not-pass",
        DISCOVERY_BRAVE_API_KEY: "must-not-pass",
        DISCOVERY_BROAD_PROVIDER_STRATEGY: "fanout",
        DISCOVERY_SEARXNG_URL: "https://search.example.test",
        DISCOVERY_FREE_SEARCH_MIN_RESULTS: "5",
        UNRELATED_SECRET: "must-not-pass",
      };
      const parsed = parseDiscoveryRuntimeConfig(environment);
      if (parsed.mode !== "local_discovery_engine") throw new Error("Expected local mode.");
      expect(parsed.providerMode).toBe("live_search");
      expect(parsed.providerPolicy).toBe(policy);
      expect(parsed.local.providerEnvironment).toEqual({
        DISCOVERY_BROAD_PROVIDER_STRATEGY: "fanout",
        DISCOVERY_SEARXNG_URL: "https://search.example.test",
        DISCOVERY_FREE_SEARCH_MIN_RESULTS: "5",
      });
      expect(allowedDiscoveryProviderEnvironment(environment)).not.toHaveProperty(
        "DISCOVERY_TAVILY_API_KEY",
      );
      expect(publicDiscoveryProviderEnvironment(parsed.local.providerEnvironment)).toEqual(
        parsed.local.providerEnvironment,
      );
    },
  );

  it("rejects live policy outside local live mode", async () => {
    expectCode(
      () => parseDiscoveryRuntimeConfig({ CLUVVI_DISCOVERY_PROVIDER_MODE: "live_search" }),
      "DISCOVERY_ENGINE_NOT_CONFIGURED",
    );
    const projectPath = await fakeProject();
    expectCode(
      () =>
        parseDiscoveryRuntimeConfig({
          CLUVVI_DISCOVERY_MODE: "local_discovery_engine",
          CLUVVI_DISCOVERY_PROVIDER_POLICY: "balanced",
          CLUVVI_DISCOVERY_ENGINE_PATH: projectPath,
          CLUVVI_DISCOVERY_ENGINE_COMMAND: "pnpm",
        }),
      "LOCAL_DISCOVERY_PROVIDER_POLICY_INVALID",
    );
  });

  it("rejects invalid provider mode and policy", async () => {
    const projectPath = await fakeProject();
    expectCode(
      () =>
        parseDiscoveryRuntimeConfig({
          CLUVVI_DISCOVERY_MODE: "local_discovery_engine",
          CLUVVI_DISCOVERY_PROVIDER_MODE: "automatic",
          CLUVVI_DISCOVERY_ENGINE_PATH: projectPath,
          CLUVVI_DISCOVERY_ENGINE_COMMAND: "pnpm",
        }),
      "LOCAL_DISCOVERY_PROVIDER_MODE_INVALID",
    );
    expectCode(
      () =>
        parseDiscoveryRuntimeConfig({
          CLUVVI_DISCOVERY_MODE: "local_discovery_engine",
          CLUVVI_DISCOVERY_PROVIDER_MODE: "live_search",
          CLUVVI_DISCOVERY_PROVIDER_POLICY: "automatic",
          CLUVVI_DISCOVERY_ENGINE_PATH: projectPath,
          CLUVVI_DISCOVERY_ENGINE_COMMAND: "pnpm",
        }),
      "LOCAL_DISCOVERY_PROVIDER_POLICY_INVALID",
    );
  });

  it("parses opt-in selected public-page extraction and forwards only safe extraction settings", async () => {
    const projectPath = await fakeProject();
    const config = parseDiscoveryRuntimeConfig({
      CLUVVI_DISCOVERY_MODE: "local_discovery_engine",
      CLUVVI_DISCOVERY_ENGINE_PATH: projectPath,
      CLUVVI_DISCOVERY_ENGINE_COMMAND: "pnpm",
      CLUVVI_DISCOVERY_EXTRACTION_MODE: "selected_public_pages",
      CLUVVI_DISCOVERY_MAX_EXTRACTIONS: "5",
      DISCOVERY_EXTRACTION_TIMEOUT_MS: "9000",
      DISCOVERY_EXTRACTION_MAX_HTML_BYTES: "750000",
      DISCOVERY_EXTRACTION_MAX_CONCURRENCY: "2",
      DISCOVERY_EXTRACTION_MAX_DOMAIN_CONCURRENCY: "1",
      DISCOVERY_EXTRACTION_MAX_REDIRECTS: "4",
      DISCOVERY_EXTRACTION_MAX_TEXT_CHARACTERS: "40000",
      DISCOVERY_EXTRACTION_MIN_USEFUL_CHARACTERS: "150",
      DISCOVERY_EXTRACTION_ROBOTS_FAILURE_POLICY: "allow_with_warning",
      DISCOVERY_EXTRACTION_USER_AGENT: "CluvviTest/1.0",
      TAVILY_API_KEY: "must-not-forward",
    });
    expect(config).toMatchObject({
      mode: "local_discovery_engine",
      extractionMode: "selected_public_pages",
      maximumExtractions: 5,
      local: {
        extractionMode: "selected_public_pages",
        maximumExtractions: 5,
        providerEnvironment: {
          DISCOVERY_EXTRACTION_TIMEOUT_MS: "9000",
          DISCOVERY_EXTRACTION_MAX_HTML_BYTES: "750000",
          DISCOVERY_EXTRACTION_MAX_CONCURRENCY: "2",
          DISCOVERY_EXTRACTION_MAX_DOMAIN_CONCURRENCY: "1",
          DISCOVERY_EXTRACTION_MAX_REDIRECTS: "4",
          DISCOVERY_EXTRACTION_MAX_TEXT_CHARACTERS: "40000",
          DISCOVERY_EXTRACTION_MIN_USEFUL_CHARACTERS: "150",
          DISCOVERY_EXTRACTION_ROBOTS_FAILURE_POLICY: "allow_with_warning",
          DISCOVERY_EXTRACTION_USER_AGENT: "CluvviTest/1.0",
        },
      },
    });
    if (config.mode !== "local_discovery_engine") throw new Error("Expected local config.");
    expect(config.local.providerEnvironment).not.toHaveProperty("TAVILY_API_KEY");
  });

  it("rejects extraction in the internal fixture runtime and invalid extraction limits", async () => {
    expectCode(
      () =>
        parseDiscoveryRuntimeConfig({
          CLUVVI_DISCOVERY_EXTRACTION_MODE: "selected_public_pages",
        }),
      "DISCOVERY_ENGINE_NOT_CONFIGURED",
    );
    const projectPath = await fakeProject();
    expectCode(
      () =>
        parseDiscoveryRuntimeConfig({
          CLUVVI_DISCOVERY_MODE: "local_discovery_engine",
          CLUVVI_DISCOVERY_ENGINE_PATH: projectPath,
          CLUVVI_DISCOVERY_ENGINE_COMMAND: "pnpm",
          CLUVVI_DISCOVERY_EXTRACTION_MODE: "recursive",
        }),
      "LOCAL_DISCOVERY_EXTRACTION_MODE_INVALID",
    );
    expectCode(
      () =>
        parseDiscoveryRuntimeConfig({
          CLUVVI_DISCOVERY_MODE: "local_discovery_engine",
          CLUVVI_DISCOVERY_ENGINE_PATH: projectPath,
          CLUVVI_DISCOVERY_ENGINE_COMMAND: "pnpm",
          CLUVVI_DISCOVERY_MAX_EXTRACTIONS: "101",
        }),
      "LOCAL_DISCOVERY_MAX_EXTRACTIONS_INVALID",
    );
  });

  it("rejects missing paths, package metadata, commands, and invalid timeouts", async () => {
    expectCode(
      () => parseDiscoveryRuntimeConfig({ CLUVVI_DISCOVERY_MODE: "local_discovery_engine" }),
      "LOCAL_DISCOVERY_PATH_MISSING",
    );
    const noPackage = resolve(process.cwd(), ".cluvvi-test", randomUUID());
    cleanupDirectories.push(noPackage);
    await mkdir(noPackage, { recursive: true });
    expectCode(
      () =>
        parseDiscoveryRuntimeConfig({
          CLUVVI_DISCOVERY_MODE: "local_discovery_engine",
          CLUVVI_DISCOVERY_ENGINE_PATH: noPackage,
          CLUVVI_DISCOVERY_ENGINE_COMMAND: "pnpm",
        }),
      "LOCAL_DISCOVERY_PACKAGE_MISSING",
    );
    const projectPath = await fakeProject();
    expectCode(
      () =>
        parseDiscoveryRuntimeConfig({
          CLUVVI_DISCOVERY_MODE: "local_discovery_engine",
          CLUVVI_DISCOVERY_ENGINE_PATH: projectPath,
        }),
      "LOCAL_DISCOVERY_COMMAND_MISSING",
    );
    expectCode(
      () =>
        parseDiscoveryRuntimeConfig({
          CLUVVI_DISCOVERY_MODE: "local_discovery_engine",
          CLUVVI_DISCOVERY_ENGINE_PATH: projectPath,
          CLUVVI_DISCOVERY_ENGINE_COMMAND: "pnpm",
          CLUVVI_DISCOVERY_ENGINE_TIMEOUT_MS: "999",
        }),
      "LOCAL_DISCOVERY_TIMEOUT_INVALID",
    );
  });
});
