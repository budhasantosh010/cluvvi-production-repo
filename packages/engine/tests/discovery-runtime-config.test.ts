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

function expectConfigurationCode(operation: () => unknown, code: string): void {
  try {
    operation();
    throw new Error("Expected configuration parsing to fail.");
  } catch (error) {
    expect(error).toBeInstanceOf(DiscoveryRuntimeConfigurationError);
    expect((error as DiscoveryRuntimeConfigurationError).code).toBe(code);
  }
}

describe("discovery runtime configuration", () => {
  it("defaults to the internal fixture runtime", () => {
    expect(parseDiscoveryRuntimeConfig({})).toEqual({
      mode: "fixture",
      providerMode: "fixture_only",
    });
  });

  it("validates a complete local fixture-provider configuration", async () => {
    const projectPath = await fakeProject();
    expect(
      parseDiscoveryRuntimeConfig({
        CLUVVI_DISCOVERY_MODE: "local_discovery_engine",
        CLUVVI_DISCOVERY_ENGINE_PATH: projectPath,
        CLUVVI_DISCOVERY_ENGINE_COMMAND: "pnpm",
        CLUVVI_DISCOVERY_ENGINE_TIMEOUT_MS: "60000",
        CLUVVI_DISCOVERY_KEEP_EXCHANGE_FILES: "true",
      }),
    ).toEqual({
      mode: "local_discovery_engine",
      providerMode: "fixture_only",
      local: {
        projectPath,
        command: "pnpm",
        timeoutMs: 60_000,
        keepExchangeFiles: true,
        providerMode: "fixture_only",
        providerEnvironment: {},
      },
    });
  });

  it("allows explicit live mode and forwards only known provider settings", async () => {
    const projectPath = await fakeProject();
    const environment = {
      CLUVVI_DISCOVERY_MODE: "local_discovery_engine",
      CLUVVI_DISCOVERY_PROVIDER_MODE: "live_search",
      CLUVVI_DISCOVERY_ENGINE_PATH: projectPath,
      CLUVVI_DISCOVERY_ENGINE_COMMAND: "pnpm",
      DISCOVERY_TAVILY_API_KEY: "secret-tavily",
      DISCOVERY_BRAVE_API_KEY: "secret-brave",
      DISCOVERY_BROAD_PROVIDER_STRATEGY: "fanout",
      DISCOVERY_LIVE_MAX_QUERIES: "2",
      UNRELATED_SECRET: "must-not-pass",
    };
    const parsed = parseDiscoveryRuntimeConfig(environment);
    expect(parsed.mode).toBe("local_discovery_engine");
    if (parsed.mode !== "local_discovery_engine") throw new Error("Expected local mode.");
    expect(parsed.providerMode).toBe("live_search");
    expect(parsed.local.providerEnvironment).toEqual({
      DISCOVERY_TAVILY_API_KEY: "secret-tavily",
      DISCOVERY_BRAVE_API_KEY: "secret-brave",
      DISCOVERY_BROAD_PROVIDER_STRATEGY: "fanout",
      DISCOVERY_LIVE_MAX_QUERIES: "2",
    });
    expect(parsed.local.providerEnvironment).not.toHaveProperty("UNRELATED_SECRET");
    expect(allowedDiscoveryProviderEnvironment(environment)).not.toHaveProperty("UNRELATED_SECRET");
    expect(publicDiscoveryProviderEnvironment(parsed.local.providerEnvironment)).toEqual({
      DISCOVERY_TAVILY_API_KEY: true,
      DISCOVERY_BRAVE_API_KEY: true,
      DISCOVERY_BROAD_PROVIDER_STRATEGY: "fanout",
      DISCOVERY_LIVE_MAX_QUERIES: "2",
    });
  });

  it("rejects live provider mode without the local process runtime", () => {
    expectConfigurationCode(
      () =>
        parseDiscoveryRuntimeConfig({
          CLUVVI_DISCOVERY_PROVIDER_MODE: "live_search",
        }),
      "DISCOVERY_ENGINE_NOT_CONFIGURED",
    );
  });

  it("rejects unsupported provider modes", async () => {
    const projectPath = await fakeProject();
    expectConfigurationCode(
      () =>
        parseDiscoveryRuntimeConfig({
          CLUVVI_DISCOVERY_MODE: "local_discovery_engine",
          CLUVVI_DISCOVERY_PROVIDER_MODE: "automatic",
          CLUVVI_DISCOVERY_ENGINE_PATH: projectPath,
          CLUVVI_DISCOVERY_ENGINE_COMMAND: "pnpm",
        }),
      "LOCAL_DISCOVERY_PROVIDER_MODE_INVALID",
    );
  });

  it("rejects missing or relative local project paths", () => {
    expectConfigurationCode(
      () =>
        parseDiscoveryRuntimeConfig({
          CLUVVI_DISCOVERY_MODE: "local_discovery_engine",
          CLUVVI_DISCOVERY_ENGINE_COMMAND: "pnpm",
        }),
      "LOCAL_DISCOVERY_PATH_MISSING",
    );
    expectConfigurationCode(
      () =>
        parseDiscoveryRuntimeConfig({
          CLUVVI_DISCOVERY_MODE: "local_discovery_engine",
          CLUVVI_DISCOVERY_ENGINE_PATH: "../relative",
          CLUVVI_DISCOVERY_ENGINE_COMMAND: "pnpm",
        }),
      "LOCAL_DISCOVERY_PATH_MISSING",
    );
  });

  it("rejects absent package metadata and command configuration", async () => {
    const noPackagePath = resolve(process.cwd(), ".cluvvi-test", randomUUID());
    cleanupDirectories.push(noPackagePath);
    await mkdir(noPackagePath, { recursive: true });
    expectConfigurationCode(
      () =>
        parseDiscoveryRuntimeConfig({
          CLUVVI_DISCOVERY_MODE: "local_discovery_engine",
          CLUVVI_DISCOVERY_ENGINE_PATH: noPackagePath,
          CLUVVI_DISCOVERY_ENGINE_COMMAND: "pnpm",
        }),
      "LOCAL_DISCOVERY_PACKAGE_MISSING",
    );

    const projectPath = await fakeProject();
    expectConfigurationCode(
      () =>
        parseDiscoveryRuntimeConfig({
          CLUVVI_DISCOVERY_MODE: "local_discovery_engine",
          CLUVVI_DISCOVERY_ENGINE_PATH: projectPath,
        }),
      "LOCAL_DISCOVERY_COMMAND_MISSING",
    );
  });

  it("enforces bounded integer timeouts", async () => {
    const projectPath = await fakeProject();
    for (const timeout of ["999", "300001", "1.5", "not-a-number"]) {
      expectConfigurationCode(
        () =>
          parseDiscoveryRuntimeConfig({
            CLUVVI_DISCOVERY_MODE: "local_discovery_engine",
            CLUVVI_DISCOVERY_ENGINE_PATH: projectPath,
            CLUVVI_DISCOVERY_ENGINE_COMMAND: "pnpm",
            CLUVVI_DISCOVERY_ENGINE_TIMEOUT_MS: timeout,
          }),
        "LOCAL_DISCOVERY_TIMEOUT_INVALID",
      );
    }
  });
});
