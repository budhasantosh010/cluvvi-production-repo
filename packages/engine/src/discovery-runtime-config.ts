import type {
  CluvviExtractionMode,
  DiscoveryProviderMode,
  DiscoveryProviderPolicy,
} from "@cluvvi/core";
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
  "DISCOVERY_EXTRACTION_MAX_URLS_PER_QUERY",
  "DISCOVERY_EXTRACTION_MAX_URLS_PER_DOMAIN",
  "DISCOVERY_EXTRACTION_MIN_PRIORITY",
  "DISCOVERY_EXTRACTION_TIMEOUT_MS",
  "DISCOVERY_EXTRACTION_MAX_ATTEMPTS",
  "DISCOVERY_EXTRACTION_MAX_CONCURRENCY",
  "DISCOVERY_EXTRACTION_MAX_DOMAIN_CONCURRENCY",
  "DISCOVERY_EXTRACTION_MIN_DOMAIN_DELAY_MS",
  "DISCOVERY_EXTRACTION_MAX_REDIRECTS",
  "DISCOVERY_EXTRACTION_MAX_HTML_BYTES",
  "DISCOVERY_EXTRACTION_MAX_TEXT_CHARACTERS",
  "DISCOVERY_EXTRACTION_MIN_USEFUL_CHARACTERS",
  "DISCOVERY_EXTRACTION_RESPECT_ROBOTS",
  "DISCOVERY_EXTRACTION_ROBOTS_FAILURE_POLICY",
  "DISCOVERY_EXTRACTION_USER_AGENT",
] as const;

export type DiscoveryProviderEnvironmentKey = (typeof DISCOVERY_PROVIDER_ENV_ALLOWLIST)[number];

export const CLUVVI_EXTRACTOR_VERSION = "basic_public_html_extractor@1.0.0";
export const CLUVVI_FRONTIER_POLICY_VERSION = "frontier_policy@1.0.0";

export interface LocalDiscoveryEngineConfig {
  projectPath: string;
  command: string;
  timeoutMs: number;
  keepExchangeFiles: boolean;
  providerMode: DiscoveryProviderMode;
  providerPolicy: DiscoveryProviderPolicy;
  extractionMode?: CluvviExtractionMode;
  maximumExtractions?: number;
  extractorVersion?: string;
  frontierPolicyVersion?: string;
  providerEnvironment: Record<string, string | undefined>;
}

export type DiscoveryRuntimeConfig =
  | {
      mode: "fixture";
      providerMode: "fixture_only";
      providerPolicy: "free_only";
      extractionMode: "none";
      maximumExtractions: number;
      extractorVersion: string;
      frontierPolicyVersion: string;
    }
  | {
      mode: "local_discovery_engine";
      providerMode: DiscoveryProviderMode;
      providerPolicy: DiscoveryProviderPolicy;
      extractionMode: CluvviExtractionMode;
      maximumExtractions: number;
      extractorVersion: string;
      frontierPolicyVersion: string;
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
const DEFAULT_MAX_EXTRACTIONS = 8;

function configuredValue(
  environment: Readonly<Record<string, string | undefined>>,
  key: string,
): string | undefined {
  const value = environment[key]?.trim();
  return value === undefined || value.length === 0 ? undefined : value;
}

function parseBoolean(value: string | undefined, key: string, fallback: boolean): boolean {
  if (value === undefined) return fallback;
  if (["true", "1", "yes"].includes(value.toLowerCase())) return true;
  if (["false", "0", "no"].includes(value.toLowerCase())) return false;
  throw new DiscoveryRuntimeConfigurationError(`${key}_INVALID`, `${key} must be true or false.`);
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

function parseExtractionMode(value: string | undefined): CluvviExtractionMode {
  const mode = value ?? "none";
  if (mode === "none" || mode === "selected_public_pages") return mode;
  throw new DiscoveryRuntimeConfigurationError(
    "LOCAL_DISCOVERY_EXTRACTION_MODE_INVALID",
    "CLUVVI_DISCOVERY_EXTRACTION_MODE must be none or selected_public_pages.",
  );
}

function parseMaximumExtractions(value: string | undefined): number {
  if (value === undefined) return DEFAULT_MAX_EXTRACTIONS;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 100) {
    throw new DiscoveryRuntimeConfigurationError(
      "LOCAL_DISCOVERY_MAX_EXTRACTIONS_INVALID",
      "CLUVVI_DISCOVERY_MAX_EXTRACTIONS must be an integer from 1 to 100.",
    );
  }
  return parsed;
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
  const extractionMode = parseExtractionMode(
    configuredValue(environment, "CLUVVI_DISCOVERY_EXTRACTION_MODE"),
  );
  const maximumExtractions = parseMaximumExtractions(
    configuredValue(environment, "CLUVVI_DISCOVERY_MAX_EXTRACTIONS"),
  );

  if (rawMode === "fixture") {
    if (providerMode !== "fixture_only" || extractionMode !== "none") {
      throw new DiscoveryRuntimeConfigurationError(
        "DISCOVERY_ENGINE_NOT_CONFIGURED",
        "Live search or public-page extraction requires CLUVVI_DISCOVERY_MODE=local_discovery_engine.",
      );
    }
    return {
      mode: "fixture",
      providerMode: "fixture_only",
      providerPolicy: "free_only",
      extractionMode: "none",
      maximumExtractions,
      extractorVersion: CLUVVI_EXTRACTOR_VERSION,
      frontierPolicyVersion: CLUVVI_FRONTIER_POLICY_VERSION,
    };
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
    extractionMode,
    maximumExtractions,
    extractorVersion: CLUVVI_EXTRACTOR_VERSION,
    frontierPolicyVersion: CLUVVI_FRONTIER_POLICY_VERSION,
    local: {
      projectPath,
      command,
      timeoutMs,
      providerMode,
      providerPolicy,
      extractionMode,
      maximumExtractions,
      extractorVersion: CLUVVI_EXTRACTOR_VERSION,
      frontierPolicyVersion: CLUVVI_FRONTIER_POLICY_VERSION,
      providerEnvironment: allowedDiscoveryProviderEnvironment(environment),
      keepExchangeFiles: parseBoolean(
        configuredValue(environment, "CLUVVI_DISCOVERY_KEEP_EXCHANGE_FILES"),
        "CLUVVI_DISCOVERY_KEEP_EXCHANGE_FILES",
        false,
      ),
    },
  };
}
