import { existsSync, statSync } from "node:fs";
import { isAbsolute, normalize, resolve } from "node:path";

export interface LocalDiscoveryEngineConfig {
  projectPath: string;
  command: string;
  timeoutMs: number;
  keepExchangeFiles: boolean;
}

export type DiscoveryRuntimeConfig =
  { mode: "fixture" } | { mode: "local_discovery_engine"; local: LocalDiscoveryEngineConfig };

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

function pathIsDirectory(path: string): boolean {
  try {
    return statSync(path).isDirectory();
  } catch {
    return false;
  }
}

export function parseDiscoveryRuntimeConfig(
  environment: Readonly<Record<string, string | undefined>> = process.env,
): DiscoveryRuntimeConfig {
  const rawMode = configuredValue(environment, "CLUVVI_DISCOVERY_MODE") ?? "fixture";
  if (rawMode === "fixture") return { mode: "fixture" };
  if (rawMode !== "local_discovery_engine") {
    throw new DiscoveryRuntimeConfigurationError(
      "DISCOVERY_ENGINE_NOT_CONFIGURED",
      `Unsupported CLUVVI_DISCOVERY_MODE: ${rawMode}. Use fixture or local_discovery_engine.`,
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
    local: {
      projectPath,
      command,
      timeoutMs,
      keepExchangeFiles: parseKeepExchangeFiles(
        configuredValue(environment, "CLUVVI_DISCOVERY_KEEP_EXCHANGE_FILES"),
      ),
    },
  };
}
