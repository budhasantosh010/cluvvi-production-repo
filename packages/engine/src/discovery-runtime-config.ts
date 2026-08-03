import type { DiscoveryProviderMode, DiscoveryProviderPolicy } from "@cluvvi/core";
import { existsSync, statSync } from "node:fs";
import { isAbsolute, normalize, resolve } from "node:path";

export const DISCOVERY_PROVIDER_ENV_ALLOWLIST = [
  "DISCOVERY_LIVE_PROVIDERS",
  "DISCOVERY_HTTP_TIMEOUT_MS",
  "DISCOVERY_HTTP_MAX_ATTEMPTS",
  "DISCOVERY_HTTP_CONCURRENCY",
  "DISCOVERY_LIVE_MAX_QUERIES",
  "DISCOVERY_MAX_RESULTS_PER_PROVIDER",
  "DISCOVERY_HN_ALGOLIA_MAX_REQUESTS_PER_RUN",
  "DISCOVERY_HN_FIREBASE_MAX_ITEMS_PER_RUN",
  "DISCOVERY_SEARXNG_URL",
  "DISCOVERY_SEARXNG_TIMEOUT_MS",
  "DISCOVERY_SEARXNG_MAX_REQUESTS_PER_RUN",
  "DISCOVERY_DDG_ENABLED",
  "DISCOVERY_DDG_TIMEOUT_MS",
  "DISCOVERY_DDG_MAX_REQUESTS_PER_RUN",
  "DISCOVERY_STARTPAGE_ENABLED",
  "DISCOVERY_STARTPAGE_TIMEOUT_MS",
  "DISCOVERY_STARTPAGE_MAX_REQUESTS_PER_RUN",
  "DISCOVERY_FREE_SEARCH_MIN_RESULTS",
  "DISCOVERY_FREE_SEARCH_MIN_UNIQUE_DOMAINS",
  "DISCOVERY_FREE_SEARCH_MAX_DUPLICATE_RATIO",
  "DISCOVERY_FREE_SEARCH_MIN_RELEVANT_RATIO",
  "DISCOVERY_FREE_SEARCH_MAX_HTML_BYTES",
  "DISCOVERY_FREE_SEARCH_MAX_JSON_BYTES",
  "DISCOVERY_TAVILY_MAX_REQUESTS_PER_RUN",
  "DISCOVERY_BRAVE_MAX_REQUESTS_PER_RUN",
  "DISCOVERY_TAVILY_SEARCH_DEPTH",
  "DISCOVERY_BROAD_PROVIDER_STRATEGY",
] as const;

export type DiscoveryProviderEnvironmentKey = (typeof DISCOVERY_PROVIDER_ENV_ALLOWLIST)[number];

export interface LocalDiscoveryEngineConfig {
  projectPath: string;
  command: string;
  timeoutMs: number;
  keepExchangeFiles: boolean;
  providerMode: DiscoveryProviderMode;
  providerPolicy: DiscoveryProviderPolicy;
  providerEnvironment: Record<string, string | undefined>;
}

export type DiscoveryRuntimeConfig =
  | { mode: "fixture"; providerMode: "fixture_only"; providerPolicy: "free_only" }
  | {
      mode: "local_discovery_engine";
      providerMode: DiscoveryProviderMode;
      providerPolicy: DiscoveryProviderPolicy;
      local: LocalDiscoveryEngineConfig;
    };

export class DiscoveryRuntimeConfigurationError extends Error {
  readonly code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = "DiscoveryRuntimeConfigurationError";
    this.code = code;
  }
}

const MIN_TIMEOUT_MS = 1_000;
const MAX_TIMEOUT_MS = 300_000;
const DEFAULT_TIMEOUT_MS = 60_000;

function configuredValue(
  environment: Readonly<Record<string, string | undefined>>,
  key: string,
): string | undefined {
  const value = environment[key]?.trim();
  return value === undefined || value.length === 0 ? undefined : value;
}

function parseKeepExchangeFiles(value: string | undefined): boolean {
  if (value === undefined) return false;
  if (["true", "1", "yes"].includes(value.toLowerCase())) return true;
  if (["false", "0", "no"].includes(value.toLowerCase())) return false;
  throw new DiscoveryRuntimeConfigurationError(
    "LOCAL_DISCOVERY_KEEP_EXCHANGE_FILES_INVALID",
    "CLUVVI_DISCOVERY_KEEP_EXCHANGE_FILES must be true or false.",
  );
}

function parseProviderMode(value: string | undefined): DiscoveryProviderMode {
  const mode = value ?? "fixture_only";
  if (mode === "fixture_only" || mode === "live_search") return mode;
  throw new DiscoveryRuntimeConfigurationError(
    "LOCAL_DISCOVERY_PROVIDER_MODE_INVALID",
    "CLUVVI_DISCOVERY_PROVIDER_MODE must be fixture_only or live_search.",
  );
}

function parseProviderPolicy(value: string | undefined): DiscoveryProviderPolicy {
  const policy = value ?? "free_only";
  if (policy === "free_only" || policy === "balanced" || policy === "paid_deep") return policy;
  throw new DiscoveryRuntimeConfigurationError(
    "LOCAL_DISCOVERY_PROVIDER_POLICY_INVALID",
    "CLUVVI_DISCOVERY_PROVIDER_POLICY must be free_only, balanced, or paid_deep.",
  );
}

function pathIsDirectory(path: string): boolean {
  try {
    return statSync(path).isDirectory();
  } catch {
    return false;
  }
}

export function allowedDiscoveryProviderEnvironment(
  environment: Readonly<Record<string, string | undefined>>,
): Record<string, string | undefined> {
  const allowed: Record<string, string | undefined> = {};
  for (const key of DISCOVERY_PROVIDER_ENV_ALLOWLIST) {
    const value = environment[key];
    if (value !== undefined) allowed[key] = value;
  }
  return allowed;
}

export function publicDiscoveryProviderEnvironment(
  environment: Readonly<Record<string, string | undefined>>,
): Record<string, string> {
  const publicValues: Record<string, string> = {};
  for (const key of DISCOVERY_PROVIDER_ENV_ALLOWLIST) {
    const value = environment[key];
    if (value !== undefined) publicValues[key] = value;
  }
  return publicValues;
}

export function parseDiscoveryRuntimeConfig(
  environment: Readonly<Record<string, string | undefined>> = process.env,
): DiscoveryRuntimeConfig {
  const rawMode = configuredValue(environment, "CLUVVI_DISCOVERY_MODE") ?? "fixture";
  const providerMode = parseProviderMode(
    configuredValue(environment, "CLUVVI_DISCOVERY_PROVIDER_MODE"),
  );
  const providerPolicy = parseProviderPolicy(
    configuredValue(environment, "CLUVVI_DISCOVERY_PROVIDER_POLICY"),
  );
  if (rawMode === "fixture") {
    if (providerMode !== "fixture_only") {
      throw new DiscoveryRuntimeConfigurationError(
        "DISCOVERY_ENGINE_NOT_CONFIGURED",
        "CLUVVI_DISCOVERY_PROVIDER_MODE=live_search requires CLUVVI_DISCOVERY_MODE=local_discovery_engine.",
      );
    }
    return { mode: "fixture", providerMode: "fixture_only", providerPolicy: "free_only" };
  }
  if (rawMode !== "local_discovery_engine") {
    throw new DiscoveryRuntimeConfigurationError(
      "DISCOVERY_ENGINE_NOT_CONFIGURED",
      `Unsupported CLUVVI_DISCOVERY_MODE: ${rawMode}. Use fixture or local_discovery_engine.`,
    );
  }
  if (providerMode === "fixture_only" && providerPolicy !== "free_only") {
    throw new DiscoveryRuntimeConfigurationError(
      "LOCAL_DISCOVERY_PROVIDER_POLICY_INVALID",
      "balanced and paid_deep require CLUVVI_DISCOVERY_PROVIDER_MODE=live_search.",
    );
  }

  const configuredPath = configuredValue(environment, "CLUVVI_DISCOVERY_ENGINE_PATH");
  if (configuredPath === undefined || !isAbsolute(configuredPath)) {
    throw new DiscoveryRuntimeConfigurationError(
      "LOCAL_DISCOVERY_PATH_MISSING",
      "CLUVVI_DISCOVERY_ENGINE_PATH must be an absolute path in local_discovery_engine mode.",
    );
  }
  const projectPath = normalize(configuredPath);
  if (!existsSync(projectPath) || !pathIsDirectory(projectPath)) {
    throw new DiscoveryRuntimeConfigurationError(
      "DISCOVERY_ENGINE_PATH_NOT_FOUND",
      `The configured standalone Discovery Engine path does not exist: ${projectPath}`,
    );
  }
  if (!existsSync(resolve(projectPath, "package.json"))) {
    throw new DiscoveryRuntimeConfigurationError(
      "LOCAL_DISCOVERY_PACKAGE_MISSING",
      `The configured standalone Discovery Engine path has no package.json: ${projectPath}`,
    );
  }

  const command = configuredValue(environment, "CLUVVI_DISCOVERY_ENGINE_COMMAND");
  if (command === undefined) {
    throw new DiscoveryRuntimeConfigurationError(
      "LOCAL_DISCOVERY_COMMAND_MISSING",
      "CLUVVI_DISCOVERY_ENGINE_COMMAND is required in local_discovery_engine mode.",
    );
  }

  const timeoutValue =
    configuredValue(environment, "CLUVVI_DISCOVERY_ENGINE_TIMEOUT_MS") ??
    String(DEFAULT_TIMEOUT_MS);
  const timeoutMs = Number(timeoutValue);
  if (!Number.isInteger(timeoutMs) || timeoutMs < MIN_TIMEOUT_MS || timeoutMs > MAX_TIMEOUT_MS) {
    throw new DiscoveryRuntimeConfigurationError(
      "LOCAL_DISCOVERY_TIMEOUT_INVALID",
      `CLUVVI_DISCOVERY_ENGINE_TIMEOUT_MS must be an integer from ${MIN_TIMEOUT_MS} to ${MAX_TIMEOUT_MS}.`,
    );
  }

  return {
    mode: "local_discovery_engine",
    providerMode,
    providerPolicy,
    local: {
      projectPath,
      command,
      timeoutMs,
      providerMode,
      providerPolicy,
      providerEnvironment: allowedDiscoveryProviderEnvironment(environment),
      keepExchangeFiles: parseKeepExchangeFiles(
        configuredValue(environment, "CLUVVI_DISCOVERY_KEEP_EXCHANGE_FILES"),
      ),
    },
  };
}
