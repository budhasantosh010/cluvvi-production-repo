import {
  CluvviError,
  LIVE_DISCOVERY_PROVIDER_IDS,
  LiveProviderRunTelemetryV1Schema,
  LocalDiscoveryExecutionRecordV1Schema,
  ProviderPolicyTraceV1Schema,
  SearchResultsArtifactV2Schema,
  type LiveProviderRunTelemetryV1,
  type LocalDiscoveryExecutionRecordV1,
  type ProviderPolicyTraceV1,
  type SearchResultsArtifactV2,
  type ValidatedExtractionArtifactSet,
  type ValidatedStructuredContentArtifactSet,
} from "@cluvvi/core";
import type { ValidatedHiringArtifactSet } from "@cluvvi/core/hiring-validation";
import { createHash, randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import { createWriteStream, existsSync } from "node:fs";
import { access, mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { delimiter, dirname, isAbsolute, resolve } from "node:path";
import { finished } from "node:stream/promises";
import { setTimeout as delay } from "node:timers/promises";
import {
  publicDiscoveryProviderEnvironment,
  type LocalDiscoveryEngineConfig,
} from "./discovery-runtime-config";
import {
  DISCOVERY_EXCHANGE_FILE_NAMES,
  discoveryExchangePaths,
  type DiscoveryExchangePaths,
} from "./discovery-exchange";
import type { DiscoveryRuntime, DiscoveryRuntimeExecutionInput } from "./discovery-runtime";
import { readValidatedExtractionArtifactSet } from "./extraction-artifact-reader";
import { readValidatedHiringArtifactSet } from "./hiring-artifact-reader";
import { readValidatedStructuredContentArtifactSet } from "./structured-content-artifact-reader";

interface ChildOutcome {
  exitCode: number | null;
  error?: Error;
}

function safeChildEnvironment(
  environment: NodeJS.ProcessEnv,
  providerEnvironment: Readonly<Record<string, string | undefined>> = {},
): NodeJS.ProcessEnv {
  const safe: NodeJS.ProcessEnv = {
    CI: "1",
    NO_COLOR: "1",
    NODE_ENV: environment["NODE_ENV"] ?? "production",
  };
  for (const key of [
    "PATH",
    "Path",
    "PATHEXT",
    "SystemRoot",
    "SYSTEMROOT",
    "WINDIR",
    "TEMP",
    "TMP",
    "HOME",
    "USERPROFILE",
    "APPDATA",
    "LOCALAPPDATA",
    "PNPM_HOME",
  ]) {
    const value = environment[key];
    if (value !== undefined) safe[key] = value;
  }
  for (const [key, value] of Object.entries(providerEnvironment)) {
    if (value !== undefined) safe[key] = value;
  }
  return safe;
}

interface SpawnInvocation {
  command: string;
  arguments: string[];
}

function resolveSpawnInvocation(
  configuredCommand: string,
  arguments_: string[],
  environment: NodeJS.ProcessEnv,
): SpawnInvocation {
  if (process.platform !== "win32") {
    return { command: configuredCommand, arguments: arguments_ };
  }

  const normalizedCommand = configuredCommand.trim().replace(/^"|"$/g, "");
  const lowerCommand = normalizedCommand.toLowerCase();
  if (!(
    lowerCommand === "pnpm" ||
    lowerCommand === "pnpm.cmd" ||
    lowerCommand.endsWith("\\pnpm.cmd")
  )) {
    return { command: normalizedCommand, arguments: arguments_ };
  }

  let shimPath: string | undefined;
  if (isAbsolute(normalizedCommand) && existsSync(normalizedCommand)) {
    shimPath = normalizedCommand;
  } else {
    const pathValue = environment["Path"] ?? environment["PATH"] ?? "";
    for (const directory of pathValue.split(delimiter)) {
      if (directory.trim().length === 0) continue;
      const candidate = resolve(directory, "pnpm.cmd");
      if (existsSync(candidate)) {
        shimPath = candidate;
        break;
      }
    }
  }

  if (shimPath === undefined) {
    return { command: normalizedCommand, arguments: arguments_ };
  }
  const pnpmCli = resolve(dirname(shimPath), "node_modules", "pnpm", "bin", "pnpm.cjs");
  if (!existsSync(pnpmCli)) {
    return { command: normalizedCommand, arguments: arguments_ };
  }
  return { command: process.execPath, arguments: [pnpmCli, ...arguments_] };
}

async function pathExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

async function writeAtomically(path: string, content: string | Buffer): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  const temporaryPath = `${path}.${randomUUID()}.tmp`;
  await writeFile(temporaryPath, content, { flag: "wx" });
  await rename(temporaryPath, path);
}

async function archivePreviousExchange(paths: DiscoveryExchangePaths): Promise<void> {
  const existing: string[] = [];
  for (const name of DISCOVERY_EXCHANGE_FILE_NAMES) {
    const path = resolve(paths.directory, name);
    if (await pathExists(path)) existing.push(path);
  }
  if (existing.length === 0) return;
  const archiveDirectory = resolve(paths.directory, "history", randomUUID());
  await mkdir(archiveDirectory, { recursive: true });
  for (const path of existing) {
    await rename(path, resolve(archiveDirectory, path.split(/[\\/]/).at(-1) ?? randomUUID()));
  }
}

async function readProjectCommitSha(
  projectPath: string,
  environment: NodeJS.ProcessEnv,
): Promise<string | undefined> {
  return await new Promise<string | undefined>((resolveCommit) => {
    const child = spawn("git", ["rev-parse", "HEAD"], {
      cwd: projectPath,
      env: safeChildEnvironment(environment),
      shell: false,
      windowsHide: true,
      stdio: ["ignore", "pipe", "ignore"],
    });
    let output = "";
    const timer = setTimeout(() => {
      child.kill();
      resolveCommit(undefined);
    }, 5_000);
    child.stdout.on("data", (chunk: Buffer) => {
      if (output.length < 256) output += chunk.toString("utf8");
    });
    child.once("error", () => {
      clearTimeout(timer);
      resolveCommit(undefined);
    });
    child.once("close", (code) => {
      clearTimeout(timer);
      const sha = output.trim().toLowerCase();
      resolveCommit(code === 0 && /^[a-f0-9]{40}$/.test(sha) ? sha : undefined);
    });
  });
}

async function terminateProcessTree(processId: number | undefined): Promise<void> {
  if (processId === undefined) return;
  if (process.platform === "win32") {
    await new Promise<void>((resolveTermination) => {
      const killer = spawn("taskkill", ["/PID", String(processId), "/T", "/F"], {
        env: safeChildEnvironment(process.env),
        shell: false,
        windowsHide: true,
        stdio: "ignore",
      });
      killer.once("error", () => resolveTermination());
      killer.once("close", () => resolveTermination());
    });
    return;
  }
  try {
    process.kill(-processId, "SIGTERM");
  } catch {
    try {
      process.kill(processId, "SIGTERM");
    } catch {
      return;
    }
  }
  await delay(1_000);
  try {
    process.kill(-processId, "SIGKILL");
  } catch {
    try {
      process.kill(processId, "SIGKILL");
    } catch {
      // The child already exited.
    }
  }
}

function failureCategory(
  code: string,
): "configuration" | "validation" | "provider" | "timeout" | "storage" | "security" | "internal" {
  if (code === "DISCOVERY_ENGINE_TIMEOUT") return "timeout";
  if (code === "DISCOVERY_ENGINE_ARTIFACT_PERSISTENCE_FAILED") return "storage";
  if (
    code === "DISCOVERY_ENGINE_UNEXPECTED_PROVIDER" ||
    code === "DISCOVERY_ENGINE_PROVIDER_MODE_MISMATCH"
  ) {
    return "security";
  }
  if (
    code === "DISCOVERY_ENGINE_OUTPUT_INVALID_JSON" ||
    code === "DISCOVERY_ENGINE_SCHEMA_MISMATCH" ||
    code === "DISCOVERY_ENGINE_REQUEST_ID_MISMATCH" ||
    code === "DISCOVERY_ENGINE_TELEMETRY_INVALID_JSON" ||
    code === "DISCOVERY_ENGINE_TELEMETRY_SCHEMA_MISMATCH" ||
    code === "DISCOVERY_ENGINE_TELEMETRY_REQUEST_ID_MISMATCH" ||
    code === "DISCOVERY_ENGINE_USAGE_MISMATCH" ||
    code === "PROVIDER_POLICY_TRACE_INVALID" ||
    code === "PROVIDER_POLICY_TRACE_MISMATCH" ||
    code === "FREE_ONLY_POLICY_VIOLATION"
  ) {
    return "validation";
  }
  if (
    code === "DISCOVERY_ENGINE_COMMAND_FAILED" ||
    code === "DISCOVERY_ENGINE_OUTPUT_MISSING" ||
    code === "DISCOVERY_ENGINE_TELEMETRY_MISSING" ||
    code === "PROVIDER_POLICY_TRACE_MISSING"
  ) {
    return "provider";
  }
  if (code === "DISCOVERY_ENGINE_CANCELLED") return "internal";
  return "configuration";
}

interface ProviderValidationFailure {
  code: string;
  message: string;
}

function providerIdsFor(artifact: SearchResultsArtifactV2): string[] {
  return [
    ...new Set([
      ...artifact.summary.providersUsed,
      ...artifact.providerBreakdown.map((provider) => provider.providerId),
      ...artifact.results.map((result) => result.providerId),
    ]),
  ];
}

function validateFixtureProviderOutput(
  artifact: SearchResultsArtifactV2,
): ProviderValidationFailure | undefined {
  const providerIds = providerIdsFor(artifact);
  const fixtureOnly =
    providerIds.length > 0 &&
    artifact.summary.paidCreditsUsed === 0 &&
    artifact.providerBreakdown.every((provider) => provider.providerCategory === "fixture") &&
    artifact.results.every((result) => result.providerCategory === "fixture");
  return fixtureOnly
    ? undefined
    : {
        code: "DISCOVERY_ENGINE_UNEXPECTED_PROVIDER",
        message:
          "Fixture-provider mode rejected Discovery Engine output that used live providers or paid credits.",
      };
}

function validateLiveProviderOutput(
  artifact: SearchResultsArtifactV2,
  telemetry: LiveProviderRunTelemetryV1,
): ProviderValidationFailure | undefined {
  const providerIds = providerIdsFor(artifact);
  const allowed = new Set<string>(LIVE_DISCOVERY_PROVIDER_IDS);
  if (providerIds.length === 0 || providerIds.some((providerId) => !allowed.has(providerId))) {
    return {
      code: "DISCOVERY_ENGINE_UNEXPECTED_PROVIDER",
      message: "Live-provider mode received an unsupported or missing Discovery Engine provider.",
    };
  }
  if (
    artifact.providerBreakdown.some(
      (provider) =>
        !(["free", "paid"] as const).includes(provider.providerCategory as "free" | "paid"),
    ) ||
    artifact.results.some(
      (result) => !(["free", "paid"] as const).includes(result.providerCategory as "free" | "paid"),
    )
  ) {
    return {
      code: "DISCOVERY_ENGINE_UNEXPECTED_PROVIDER",
      message: "Live-provider mode rejected fixture or manual provider categories.",
    };
  }
  if (artifact.summary.paidCreditsUsed !== telemetry.usage.tavilyCredits) {
    return {
      code: "DISCOVERY_ENGINE_USAGE_MISMATCH",
      message:
        "The Discovery Engine artifact paid-credit total does not match its provider telemetry.",
    };
  }
  return undefined;
}

function validateProviderPolicy(input: {
  artifact: SearchResultsArtifactV2;
  telemetry: LiveProviderRunTelemetryV1;
  trace: ProviderPolicyTraceV1;
  policy: LocalDiscoveryEngineConfig["providerPolicy"];
}): ProviderValidationFailure | undefined {
  const paidProviderIds = new Set<string>(["tavily_search", "brave_web_search"]);
  const allowedProviderIds = new Set<string>(LIVE_DISCOVERY_PROVIDER_IDS);

  if (input.trace.providerPolicy !== input.policy) {
    return {
      code: "PROVIDER_POLICY_TRACE_MISMATCH",
      message: `The provider policy trace reported ${input.trace.providerPolicy}, expected ${input.policy}.`,
    };
  }

  for (const query of input.trace.queries) {
    const ordered = query.attempts.every((attempt, index) => attempt.order === index + 1);
    if (!ordered || query.attempts.some((attempt) => !allowedProviderIds.has(attempt.providerId))) {
      return {
        code: "PROVIDER_POLICY_TRACE_MISMATCH",
        message:
          "The provider policy trace contains an unknown provider or invalid execution order.",
      };
    }
  }

  const paidTelemetry = input.telemetry.providerExecutions.filter((execution) =>
    paidProviderIds.has(execution.providerId),
  );
  const paidTelemetryAttempted = paidTelemetry.some((execution) => execution.attempts > 0);
  const paidTraceAttempts = input.trace.queries.flatMap((query) =>
    query.attempts.filter((attempt) => attempt.paid && attempt.attempted),
  );
  const paidArtifactPresent =
    providerIdsFor(input.artifact).some((providerId) => paidProviderIds.has(providerId)) ||
    input.artifact.providerBreakdown.some((provider) => provider.providerCategory === "paid") ||
    input.artifact.results.some((result) => result.providerCategory === "paid");
  const paidActuallyAttempted =
    paidTelemetryAttempted || paidTraceAttempts.length > 0 || paidArtifactPresent;

  if (input.trace.paidProviderAttempted !== paidActuallyAttempted) {
    return {
      code: "PROVIDER_POLICY_TRACE_MISMATCH",
      message: "The paid-provider flag does not agree with provider telemetry and results.",
    };
  }

  const tavilyAttempted = input.telemetry.providerExecutions.some(
    (execution) => execution.providerId === "tavily_search" && execution.attempts > 0,
  );
  const braveAttempted = input.telemetry.providerExecutions.some(
    (execution) => execution.providerId === "brave_web_search" && execution.attempts > 0,
  );
  if (
    input.telemetry.usage.tavilyRequests > 0 !== tavilyAttempted ||
    input.telemetry.usage.braveRequests > 0 !== braveAttempted
  ) {
    return {
      code: "DISCOVERY_ENGINE_USAGE_MISMATCH",
      message: "Paid-provider request usage does not agree with provider execution telemetry.",
    };
  }

  if (input.policy === "free_only") {
    const freeOnlyViolation =
      paidTelemetry.length > 0 ||
      paidArtifactPresent ||
      input.artifact.summary.paidCreditsUsed > 0 ||
      input.telemetry.usage.tavilyRequests > 0 ||
      input.telemetry.usage.tavilyCredits > 0 ||
      input.telemetry.usage.braveRequests > 0 ||
      input.trace.paidProviderAttempted ||
      input.trace.paidFallbackUsed ||
      paidTraceAttempts.length > 0 ||
      input.trace.queries.some(
        (query) =>
          query.finalDecision === "paid_fallback_used" || query.paidFallbackReason !== undefined,
      );
    if (freeOnlyViolation) {
      return {
        code: "FREE_ONLY_POLICY_VIOLATION",
        message:
          "Free-only discovery rejected paid provider telemetry, results, fallback, or usage.",
      };
    }
    return undefined;
  }

  const attemptedTraceKeys = new Set(
    input.trace.queries.flatMap((query) =>
      query.attempts
        .filter((attempt) => attempt.attempted)
        .map((attempt) => `${query.queryId}:${attempt.providerId}`),
    ),
  );
  const missingTraceExecution = input.telemetry.providerExecutions.some(
    (execution) =>
      execution.operation === "search" &&
      execution.attempts > 0 &&
      !attemptedTraceKeys.has(`${execution.queryId}:${execution.providerId}`),
  );
  if (missingTraceExecution) {
    return {
      code: "PROVIDER_POLICY_TRACE_MISMATCH",
      message:
        "Provider execution telemetry contains a search attempt missing from the policy trace.",
    };
  }

  const paidFallbackQueries = input.trace.queries.filter((query) =>
    query.attempts.some((attempt) => attempt.paid && attempt.attempted),
  );

  if (input.policy === "balanced") {
    for (const query of paidFallbackQueries) {
      const firstPaidIndex = query.attempts.findIndex(
        (attempt) => attempt.paid && attempt.attempted,
      );
      const earlierFree = query.attempts
        .slice(0, firstPaidIndex)
        .filter((attempt) => !attempt.paid);
      const insufficientFreeCoverage = earlierFree.some(
        (attempt) =>
          attempt.skippedReason !== undefined ||
          attempt.safeFailureCode !== undefined ||
          ["zero_results", "insufficient_coverage", "failed", "budget_exhausted"].includes(
            attempt.outcome,
          ),
      );
      const freeAfterPaid = query.attempts
        .slice(firstPaidIndex + 1)
        .some((attempt) => !attempt.paid && attempt.attempted);
      if (
        firstPaidIndex <= 0 ||
        earlierFree.length === 0 ||
        !insufficientFreeCoverage ||
        freeAfterPaid ||
        query.finalDecision !== "paid_fallback_used" ||
        query.paidFallbackReason === undefined
      ) {
        return {
          code: "PROVIDER_POLICY_TRACE_MISMATCH",
          message:
            "Balanced discovery requires an insufficient free-provider ladder and a persisted fallback reason before paid execution.",
        };
      }
    }
    const paidFallbackUsed = paidFallbackQueries.length > 0;
    if (input.trace.paidFallbackUsed !== paidFallbackUsed) {
      return {
        code: "PROVIDER_POLICY_TRACE_MISMATCH",
        message: "The balanced paid-fallback flag does not match the provider ladder.",
      };
    }
    if (
      !paidFallbackUsed &&
      input.trace.queries.some((query) => query.finalDecision === "paid_fallback_used")
    ) {
      return {
        code: "PROVIDER_POLICY_TRACE_MISMATCH",
        message: "Balanced discovery reported paid fallback without a paid provider attempt.",
      };
    }
    return undefined;
  }

  if (
    input.trace.paidFallbackUsed &&
    paidFallbackQueries.some((query) => query.paidFallbackReason === undefined)
  ) {
    return {
      code: "PROVIDER_POLICY_TRACE_MISMATCH",
      message: "Paid-deep fallback usage must include a reason when it is reported as fallback.",
    };
  }
  return undefined;
}

export class LocalProcessDiscoveryRuntime implements DiscoveryRuntime {
  readonly mode = "local_discovery_engine" as const;
  readonly providerMode: LocalDiscoveryEngineConfig["providerMode"];
  readonly providerPolicy: LocalDiscoveryEngineConfig["providerPolicy"];
  readonly extractionMode: "none" | "selected_public_pages";
  readonly maximumExtractions: number;
  readonly structuredContentMode: "none" | "selected_resources";
  readonly maximumStructuredResources: number;
  readonly maximumDocumentResources: number;
  readonly sourceAdapterMode: "none" | "selected_sources";
  readonly sourceFamilies: readonly "hiring"[];
  readonly maximumHiringTargets: number;
  readonly maximumHiringBoardsPerTarget: number;
  readonly maximumHiringJobsPerBoard: number;
  readonly maximumHiringJobsTotal: number;
  readonly hiringSignalRuleVersion: string;
  readonly hiringTaxonomyVersion: string;
  readonly hiringTechnologyLexiconVersion: string;
  readonly extractorVersion: string;
  readonly frontierPolicyVersion: string;
  readonly structuredParserPolicyVersion: string;
  readonly anydocParserVersion: string;
  readonly htmlMarkdownRendererVersion: string;
  readonly extractionQualityEvaluatorVersion: string;
  readonly providerConfigurationFingerprint: string;
  readonly extractionConfigurationFingerprint: string;
  readonly structuredConfigurationFingerprint: string;
  readonly sourceAdapterConfigurationFingerprint: string;
  readonly #config: LocalDiscoveryEngineConfig;
  readonly #runsDirectory: string;
  readonly #now: () => string;
  readonly #environment: NodeJS.ProcessEnv;

  constructor(input: {
    config: LocalDiscoveryEngineConfig;
    runsDirectory: string;
    now?: () => string;
    environment?: NodeJS.ProcessEnv;
  }) {
    this.#config = input.config;
    this.#runsDirectory = input.runsDirectory;
    this.#now = input.now ?? (() => new Date().toISOString());
    this.#environment = input.environment ?? process.env;
    this.providerMode = this.#config.providerMode;
    this.providerPolicy = this.#config.providerPolicy;
    this.extractionMode = this.#config.extractionMode ?? "none";
    this.maximumExtractions = this.#config.maximumExtractions ?? 8;
    this.structuredContentMode = this.#config.structuredContentMode ?? "none";
    this.maximumStructuredResources = this.#config.maximumStructuredResources ?? 8;
    this.maximumDocumentResources = this.#config.maximumDocumentResources ?? 4;
    this.sourceAdapterMode = this.#config.sourceAdapterMode ?? "none";
    this.sourceFamilies = this.#config.sourceFamilies ?? [];
    this.maximumHiringTargets = this.#config.maximumHiringTargets ?? 10;
    this.maximumHiringBoardsPerTarget = this.#config.maximumHiringBoardsPerTarget ?? 4;
    this.maximumHiringJobsPerBoard = this.#config.maximumHiringJobsPerBoard ?? 250;
    this.maximumHiringJobsTotal = this.#config.maximumHiringJobsTotal ?? 2_000;
    this.hiringSignalRuleVersion = this.#config.hiringSignalRuleVersion ?? "hiring_signals@1.0.0";
    this.hiringTaxonomyVersion = this.#config.hiringTaxonomyVersion ?? "hiring_taxonomy@1.0.0";
    this.hiringTechnologyLexiconVersion =
      this.#config.hiringTechnologyLexiconVersion ?? "hiring_technology_lexicon@1.0.0";
    this.extractorVersion = this.#config.extractorVersion ?? "basic_public_html_extractor@1.0.0";
    this.frontierPolicyVersion = this.#config.frontierPolicyVersion ?? "frontier_policy@1.0.0";
    this.structuredParserPolicyVersion =
      this.#config.structuredParserPolicyVersion ?? "structured_parser_policy@1.0.0";
    this.anydocParserVersion = this.#config.anydocParserVersion ?? "@firecrawl/anydoc@0.1.6";
    this.htmlMarkdownRendererVersion =
      this.#config.htmlMarkdownRendererVersion ?? "sanitized_html_to_gfm@1.0.0";
    this.extractionQualityEvaluatorVersion =
      this.#config.extractionQualityEvaluatorVersion ?? "extraction_quality@1.0.0";
    const publicEnvironment = publicDiscoveryProviderEnvironment(this.#config.providerEnvironment);
    const structuredEnvironmentKey = (key: string) =>
      key.startsWith("DISCOVERY_STRUCTURED_") ||
      key.startsWith("DISCOVERY_DOCUMENT_") ||
      key.startsWith("DISCOVERY_MARKDOWN_") ||
      key.startsWith("DISCOVERY_SECTIONS_") ||
      key.startsWith("DISCOVERY_TABLES_") ||
      key.startsWith("DISCOVERY_TABLE_") ||
      key.startsWith("DISCOVERY_LINKS_") ||
      key.startsWith("DISCOVERY_FOOTNOTES_") ||
      key.startsWith("DISCOVERY_ASSETS_") ||
      key.startsWith("DISCOVERY_HTML_MARKDOWN_") ||
      key.startsWith("DISCOVERY_ANYDOC_");
    const hiringEnvironmentKey = (key: string) => key.startsWith("DISCOVERY_HIRING_");
    const providerEnvironment = Object.fromEntries(
      Object.entries(publicEnvironment).filter(
        ([key]) =>
          !key.startsWith("DISCOVERY_EXTRACTION_") &&
          !structuredEnvironmentKey(key) &&
          !hiringEnvironmentKey(key),
      ),
    );
    const extractionEnvironment = Object.fromEntries(
      Object.entries(publicEnvironment).filter(([key]) => key.startsWith("DISCOVERY_EXTRACTION_")),
    );
    const structuredEnvironment = Object.fromEntries(
      Object.entries(publicEnvironment).filter(([key]) => structuredEnvironmentKey(key)),
    );
    const hiringEnvironment = Object.fromEntries(
      Object.entries(publicEnvironment).filter(([key]) => hiringEnvironmentKey(key)),
    );
    this.providerConfigurationFingerprint = createHash("sha256")
      .update(
        JSON.stringify({
          runtimeMode: this.mode,
          providerMode: this.providerMode,
          providerPolicy: this.providerPolicy,
          projectPath: this.#config.projectPath,
          command: this.#config.command,
          timeoutMs: this.#config.timeoutMs,
          keepExchangeFiles: this.#config.keepExchangeFiles,
          providerEnvironment,
        }),
      )
      .digest("hex");
    this.extractionConfigurationFingerprint = createHash("sha256")
      .update(
        JSON.stringify({
          runtimeMode: this.mode,
          extractionMode: this.extractionMode,
          maximumExtractions: this.maximumExtractions,
          extractorVersion: this.extractorVersion,
          frontierPolicyVersion: this.frontierPolicyVersion,
          extractionEnvironment,
        }),
      )
      .digest("hex");
    this.structuredConfigurationFingerprint = createHash("sha256")
      .update(
        JSON.stringify({
          runtimeMode: this.mode,
          structuredContentMode: this.structuredContentMode,
          maximumStructuredResources: this.maximumStructuredResources,
          maximumDocumentResources: this.maximumDocumentResources,
          structuredParserPolicyVersion: this.structuredParserPolicyVersion,
          anydocParserVersion: this.anydocParserVersion,
          htmlMarkdownRendererVersion: this.htmlMarkdownRendererVersion,
          extractionQualityEvaluatorVersion: this.extractionQualityEvaluatorVersion,
          structuredEnvironment,
        }),
      )
      .digest("hex");
    this.sourceAdapterConfigurationFingerprint = createHash("sha256")
      .update(
        JSON.stringify({
          runtimeMode: this.mode,
          sourceAdapterMode: this.sourceAdapterMode,
          sourceFamilies: this.sourceFamilies,
          maximumHiringTargets: this.maximumHiringTargets,
          maximumHiringBoardsPerTarget: this.maximumHiringBoardsPerTarget,
          maximumHiringJobsPerBoard: this.maximumHiringJobsPerBoard,
          maximumHiringJobsTotal: this.maximumHiringJobsTotal,
          hiringSignalRuleVersion: this.hiringSignalRuleVersion,
          hiringTaxonomyVersion: this.hiringTaxonomyVersion,
          hiringTechnologyLexiconVersion: this.hiringTechnologyLexiconVersion,
          hiringEnvironment,
        }),
      )
      .digest("hex");
  }

  async readExtractionArtifactSet(input: {
    runId: string;
    searchResults: SearchResultsArtifactV2;
  }) {
    return readValidatedExtractionArtifactSet({
      runsDirectory: this.#runsDirectory,
      runId: input.runId,
      searchResults: input.searchResults,
    });
  }

  async readStructuredContentArtifactSet(input: {
    runId: string;
    searchResults: SearchResultsArtifactV2;
    extraction?: ValidatedExtractionArtifactSet;
  }) {
    const extraction =
      input.extraction ??
      (await this.readExtractionArtifactSet({
        runId: input.runId,
        searchResults: input.searchResults,
      }));
    return readValidatedStructuredContentArtifactSet({
      runsDirectory: this.#runsDirectory,
      runId: input.runId,
      searchResults: input.searchResults,
      extraction,
    });
  }

  async readHiringArtifactSet(input: {
    runId: string;
    searchResults: SearchResultsArtifactV2;
    extraction?: ValidatedExtractionArtifactSet;
    structured?: ValidatedStructuredContentArtifactSet;
  }): Promise<ValidatedHiringArtifactSet> {
    const extraction =
      input.extraction ??
      (this.extractionMode === "selected_public_pages"
        ? await this.readExtractionArtifactSet({
            runId: input.runId,
            searchResults: input.searchResults,
          })
        : undefined);
    const structured =
      input.structured ??
      (this.structuredContentMode === "selected_resources"
        ? await this.readStructuredContentArtifactSet({
            runId: input.runId,
            searchResults: input.searchResults,
            ...(extraction === undefined ? {} : { extraction }),
          })
        : undefined);
    return readValidatedHiringArtifactSet({
      runsDirectory: this.#runsDirectory,
      runId: input.runId,
      searchResults: input.searchResults,
      ...(extraction === undefined ? {} : { extractedContent: extraction.extractedContent }),
      ...(structured === undefined ? {} : { structuredContent: structured.structuredContent }),
      providerPolicy: this.providerPolicy,
    });
  }

  async execute(input: DiscoveryRuntimeExecutionInput): Promise<SearchResultsArtifactV2> {
    const paths = discoveryExchangePaths(this.#runsDirectory, input.runId);
    const arguments_ = [
      "discover",
      paths.requestPath,
      "--provider-mode",
      this.providerMode,
      ...(this.providerMode === "live_search" ? ["--provider-policy", this.providerPolicy] : []),
      "--extraction-mode",
      this.extractionMode,
      ...(this.extractionMode === "selected_public_pages"
        ? ["--max-extractions", String(this.maximumExtractions)]
        : []),
      "--structured-content-mode",
      this.structuredContentMode,
      ...(this.structuredContentMode === "selected_resources"
        ? [
            "--max-structured-resources",
            String(this.maximumStructuredResources),
            "--max-document-resources",
            String(this.maximumDocumentResources),
          ]
        : []),
      "--source-adapter-mode",
      this.sourceAdapterMode,
      ...(this.sourceAdapterMode === "selected_sources"
        ? [
            "--source-families",
            this.sourceFamilies.join(","),
            "--max-hiring-targets",
            String(this.maximumHiringTargets),
            "--max-hiring-boards-per-target",
            String(this.maximumHiringBoardsPerTarget),
            "--max-hiring-jobs-per-board",
            String(this.maximumHiringJobsPerBoard),
          ]
        : []),
      "--output",
      paths.outputPath,
    ];
    try {
      await mkdir(paths.directory, { recursive: true });
      await archivePreviousExchange(paths);
      await writeAtomically(paths.requestPath, `${JSON.stringify(input.request, null, 2)}\n`);
    } catch (error) {
      throw new CluvviError(
        {
          code: "DISCOVERY_ENGINE_ARTIFACT_PERSISTENCE_FAILED",
          category: "storage",
          message: "Cluvvi could not prepare the local Discovery Engine exchange files.",
          retryable: true,
          stage: "discovery",
          context: { exchangeDirectory: paths.directory, retrySafe: true, resumeSupported: true },
          cause: error instanceof Error ? (error.stack ?? error.message) : String(error),
        },
        { cause: error },
      );
    }

    const startedAt = this.#now();
    const startedAtMs = Date.parse(startedAt);
    const projectCommitSha = await readProjectCommitSha(
      this.#config.projectPath,
      this.#environment,
    );
    const stdout = createWriteStream(paths.stdoutPath, { flags: "w" });
    const stderr = createWriteStream(paths.stderrPath, { flags: "w" });
    const childEnvironment = safeChildEnvironment(
      this.#environment,
      this.#config.providerEnvironment,
    );
    const invocation = resolveSpawnInvocation(this.#config.command, arguments_, childEnvironment);
    let child;
    try {
      child = spawn(invocation.command, invocation.arguments, {
        cwd: this.#config.projectPath,
        env: childEnvironment,
        shell: false,
        windowsHide: true,
        detached: process.platform !== "win32",
        stdio: ["ignore", "pipe", "pipe"],
      });
      child.stdout.pipe(stdout);
      child.stderr.pipe(stderr);
    } catch (error) {
      stdout.end();
      stderr.end();
      return await this.#fail({
        input,
        paths,
        arguments_,
        startedAt,
        startedAtMs,
        projectCommitSha,
        exitCode: undefined,
        timedOut: false,
        cancelled: false,
        code: "DISCOVERY_ENGINE_COMMAND_FAILED",
        message: "The configured standalone Discovery Engine command could not be started.",
        cause: error,
      });
    }

    const terminationState = {
      timedOut: false,
      cancelled: input.signal?.aborted ?? false,
    };
    let terminationPromise: Promise<void> | undefined;
    const requestTermination = (reason: "timeout" | "cancelled") => {
      if (reason === "timeout") terminationState.timedOut = true;
      if (reason === "cancelled") terminationState.cancelled = true;
      terminationPromise ??= terminateProcessTree(child.pid);
    };
    if (terminationState.cancelled) requestTermination("cancelled");

    const timeout = setTimeout(() => requestTermination("timeout"), this.#config.timeoutMs);
    const onAbort = () => requestTermination("cancelled");
    input.signal?.addEventListener("abort", onAbort, { once: true });
    let checkingCancellation = false;
    const cancellationPoll =
      input.shouldCancel === undefined
        ? undefined
        : setInterval(() => {
            if (checkingCancellation) return;
            checkingCancellation = true;
            void input
              .shouldCancel?.()
              .then((shouldCancel) => {
                if (shouldCancel) requestTermination("cancelled");
              })
              .finally(() => {
                checkingCancellation = false;
              });
          }, 250);

    const outcome = await new Promise<ChildOutcome>((resolveOutcome) => {
      let settled = false;
      const settle = (value: ChildOutcome) => {
        if (settled) return;
        settled = true;
        resolveOutcome(value);
      };
      child.once("error", (error) => settle({ exitCode: null, error }));
      child.once("close", (exitCode) => settle({ exitCode }));
    });

    clearTimeout(timeout);
    if (cancellationPoll !== undefined) clearInterval(cancellationPoll);
    input.signal?.removeEventListener("abort", onAbort);
    await terminationPromise;
    const streamResults = await Promise.allSettled([finished(stdout), finished(stderr)]);
    const streamError = streamResults.find((result) => result.status === "rejected");
    if (streamError !== undefined && outcome.error === undefined) {
      return await this.#fail({
        input,
        paths,
        arguments_,
        startedAt,
        startedAtMs,
        projectCommitSha,
        exitCode: outcome.exitCode ?? undefined,
        timedOut: terminationState.timedOut,
        cancelled: terminationState.cancelled,
        code: "DISCOVERY_ENGINE_ARTIFACT_PERSISTENCE_FAILED",
        message: "Cluvvi could not persist local Discovery Engine process logs.",
        cause: streamError.reason,
      });
    }

    if (terminationState.cancelled) {
      return await this.#fail({
        input,
        paths,
        arguments_,
        startedAt,
        startedAtMs,
        projectCommitSha,
        exitCode: outcome.exitCode ?? undefined,
        timedOut: false,
        cancelled: true,
        code: "DISCOVERY_ENGINE_CANCELLED",
        message: "The local Discovery Engine run was cancelled before completion.",
        cause: outcome.error,
      });
    }
    if (terminationState.timedOut) {
      return await this.#fail({
        input,
        paths,
        arguments_,
        startedAt,
        startedAtMs,
        projectCommitSha,
        exitCode: outcome.exitCode ?? undefined,
        timedOut: true,
        cancelled: false,
        code: "DISCOVERY_ENGINE_TIMEOUT",
        message: `The local Discovery Engine exceeded the ${this.#config.timeoutMs} ms timeout.`,
        cause: outcome.error,
      });
    }
    if (outcome.error !== undefined || outcome.exitCode !== 0) {
      return await this.#fail({
        input,
        paths,
        arguments_,
        startedAt,
        startedAtMs,
        projectCommitSha,
        exitCode: outcome.exitCode ?? undefined,
        timedOut: false,
        cancelled: false,
        code: "DISCOVERY_ENGINE_COMMAND_FAILED",
        message: `The local Discovery Engine exited unsuccessfully${outcome.exitCode === null ? "" : ` with code ${outcome.exitCode}`}.`,
        cause: outcome.error,
      });
    }
    if (!(await pathExists(paths.outputPath))) {
      return await this.#fail({
        input,
        paths,
        arguments_,
        startedAt,
        startedAtMs,
        projectCommitSha,
        exitCode: 0,
        timedOut: false,
        cancelled: false,
        code: "DISCOVERY_ENGINE_OUTPUT_MISSING",
        message:
          "The local Discovery Engine exited successfully but did not create search_results.v2.",
      });
    }

    let untrusted: unknown;
    try {
      const exactBytes = await readFile(paths.outputPath);
      untrusted = JSON.parse(exactBytes.toString("utf8")) as unknown;
    } catch (error) {
      return await this.#fail({
        input,
        paths,
        arguments_,
        startedAt,
        startedAtMs,
        projectCommitSha,
        exitCode: 0,
        timedOut: false,
        cancelled: false,
        code: "DISCOVERY_ENGINE_OUTPUT_INVALID_JSON",
        message: "The local Discovery Engine output is not valid JSON.",
        cause: error,
      });
    }

    const validation = SearchResultsArtifactV2Schema.safeParse(untrusted);
    if (!validation.success) {
      const issue = validation.error.issues[0];
      return await this.#fail({
        input,
        paths,
        arguments_,
        startedAt,
        startedAtMs,
        projectCommitSha,
        exitCode: 0,
        timedOut: false,
        cancelled: false,
        code: "DISCOVERY_ENGINE_SCHEMA_MISMATCH",
        message: `The local Discovery Engine output does not satisfy search_results.v2${issue === undefined ? "." : `: ${issue.path.join(".")} ${issue.message}`}`,
      });
    }
    const artifact = validation.data;
    if (artifact.requestId !== input.request.requestId) {
      return await this.#fail({
        input,
        paths,
        arguments_,
        startedAt,
        startedAtMs,
        projectCommitSha,
        exitCode: 0,
        timedOut: false,
        cancelled: false,
        code: "DISCOVERY_ENGINE_REQUEST_ID_MISMATCH",
        message: `The local Discovery Engine returned requestId ${artifact.requestId}, expected ${input.request.requestId}.`,
      });
    }

    let providerTelemetry: LiveProviderRunTelemetryV1 | undefined;
    if (this.providerMode === "live_search") {
      if (!(await pathExists(paths.providerTelemetryPath))) {
        return await this.#fail({
          input,
          paths,
          arguments_,
          startedAt,
          startedAtMs,
          projectCommitSha,
          exitCode: 0,
          timedOut: false,
          cancelled: false,
          code: "DISCOVERY_ENGINE_TELEMETRY_MISSING",
          message: "The live Discovery Engine run did not create its provider telemetry sidecar.",
        });
      }
      let untrustedTelemetry: unknown;
      try {
        untrustedTelemetry = JSON.parse(
          (await readFile(paths.providerTelemetryPath)).toString("utf8"),
        ) as unknown;
      } catch (error) {
        return await this.#fail({
          input,
          paths,
          arguments_,
          startedAt,
          startedAtMs,
          projectCommitSha,
          exitCode: 0,
          timedOut: false,
          cancelled: false,
          code: "DISCOVERY_ENGINE_TELEMETRY_INVALID_JSON",
          message: "The live Discovery Engine provider telemetry is not valid JSON.",
          cause: error,
        });
      }
      const telemetryValidation = LiveProviderRunTelemetryV1Schema.safeParse(untrustedTelemetry);
      if (!telemetryValidation.success) {
        const issue = telemetryValidation.error.issues[0];
        return await this.#fail({
          input,
          paths,
          arguments_,
          startedAt,
          startedAtMs,
          projectCommitSha,
          exitCode: 0,
          timedOut: false,
          cancelled: false,
          code: "DISCOVERY_ENGINE_TELEMETRY_SCHEMA_MISMATCH",
          message: `The provider telemetry does not satisfy live_provider_run_telemetry.v1${
            issue === undefined ? "." : `: ${issue.path.join(".")} ${issue.message}`
          }`,
        });
      }
      providerTelemetry = telemetryValidation.data;
      if (providerTelemetry.requestId !== input.request.requestId) {
        return await this.#fail({
          input,
          paths,
          arguments_,
          startedAt,
          startedAtMs,
          projectCommitSha,
          exitCode: 0,
          timedOut: false,
          cancelled: false,
          code: "DISCOVERY_ENGINE_TELEMETRY_REQUEST_ID_MISMATCH",
          message: `The provider telemetry returned requestId ${providerTelemetry.requestId}, expected ${input.request.requestId}.`,
        });
      }
      if (providerTelemetry.providerMode !== this.providerMode) {
        return await this.#fail({
          input,
          paths,
          arguments_,
          startedAt,
          startedAtMs,
          projectCommitSha,
          exitCode: 0,
          timedOut: false,
          cancelled: false,
          code: "DISCOVERY_ENGINE_PROVIDER_MODE_MISMATCH",
          message: `The provider telemetry reported ${providerTelemetry.providerMode}, expected ${this.providerMode}.`,
        });
      }
    }

    let providerPolicyTrace: ProviderPolicyTraceV1 | undefined;
    if (this.providerMode === "live_search") {
      if (!(await pathExists(paths.providerPolicyTracePath))) {
        return await this.#fail({
          input,
          paths,
          arguments_,
          startedAt,
          startedAtMs,
          projectCommitSha,
          exitCode: 0,
          timedOut: false,
          cancelled: false,
          code: "PROVIDER_POLICY_TRACE_MISSING",
          message:
            "The live Discovery Engine run did not create its provider policy trace sidecar.",
        });
      }
      let untrustedTrace: unknown;
      try {
        untrustedTrace = JSON.parse(
          (await readFile(paths.providerPolicyTracePath)).toString("utf8"),
        ) as unknown;
      } catch (error) {
        return await this.#fail({
          input,
          paths,
          arguments_,
          startedAt,
          startedAtMs,
          projectCommitSha,
          exitCode: 0,
          timedOut: false,
          cancelled: false,
          code: "PROVIDER_POLICY_TRACE_INVALID",
          message: "The live Discovery Engine provider policy trace is not valid JSON.",
          cause: error,
        });
      }
      const traceValidation = ProviderPolicyTraceV1Schema.safeParse(untrustedTrace);
      if (!traceValidation.success) {
        const issue = traceValidation.error.issues[0];
        return await this.#fail({
          input,
          paths,
          arguments_,
          startedAt,
          startedAtMs,
          projectCommitSha,
          exitCode: 0,
          timedOut: false,
          cancelled: false,
          code: "PROVIDER_POLICY_TRACE_INVALID",
          message: `The provider policy trace does not satisfy provider_policy_trace.v1${
            issue === undefined ? "." : `: ${issue.path.join(".")} ${issue.message}`
          }`,
        });
      }
      providerPolicyTrace = traceValidation.data;
      if (providerPolicyTrace.requestId !== input.request.requestId) {
        return await this.#fail({
          input,
          paths,
          arguments_,
          startedAt,
          startedAtMs,
          projectCommitSha,
          exitCode: 0,
          timedOut: false,
          cancelled: false,
          code: "PROVIDER_POLICY_TRACE_MISMATCH",
          message: `The provider policy trace returned requestId ${providerPolicyTrace.requestId}, expected ${input.request.requestId}.`,
        });
      }
    }

    const providerValidation =
      this.providerMode === "fixture_only"
        ? validateFixtureProviderOutput(artifact)
        : providerTelemetry === undefined
          ? {
              code: "DISCOVERY_ENGINE_TELEMETRY_MISSING",
              message:
                "The live Discovery Engine run completed without validated provider telemetry.",
            }
          : validateLiveProviderOutput(artifact, providerTelemetry);
    const policyValidation =
      this.providerMode === "live_search" &&
      providerTelemetry !== undefined &&
      providerPolicyTrace !== undefined
        ? validateProviderPolicy({
            artifact,
            telemetry: providerTelemetry,
            trace: providerPolicyTrace,
            policy: this.providerPolicy,
          })
        : undefined;
    const finalValidation = providerValidation ?? policyValidation;
    if (finalValidation !== undefined) {
      return await this.#fail({
        input,
        paths,
        arguments_,
        startedAt,
        startedAtMs,
        projectCommitSha,
        exitCode: 0,
        timedOut: false,
        cancelled: false,
        code: finalValidation.code,
        message: finalValidation.message,
      });
    }
    const providerIds = providerIdsFor(artifact);

    const completedAt = this.#now();
    const record = LocalDiscoveryExecutionRecordV1Schema.parse({
      schemaVersion: "1.0",
      artifactKind: "local_discovery_execution.v1",
      runId: input.runId,
      requestId: input.request.requestId,
      projectPath: this.#config.projectPath,
      ...(projectCommitSha === undefined ? {} : { projectCommitSha }),
      command: this.#config.command,
      arguments: arguments_,
      providerMode: this.providerMode,
      providerPolicy: this.providerPolicy,
      extractionMode: this.extractionMode,
      maximumExtractions: this.maximumExtractions,
      structuredContentMode: this.structuredContentMode,
      maximumStructuredResources: this.maximumStructuredResources,
      maximumDocumentResources: this.maximumDocumentResources,
      sourceAdapterMode: this.sourceAdapterMode,
      sourceFamilies: [...this.sourceFamilies],
      maximumHiringTargets: this.maximumHiringTargets,
      maximumHiringBoardsPerTarget: this.maximumHiringBoardsPerTarget,
      maximumHiringJobsPerBoard: this.maximumHiringJobsPerBoard,
      maximumHiringJobsTotal: this.maximumHiringJobsTotal,
      hiringSignalRuleVersion: this.hiringSignalRuleVersion,
      hiringTaxonomyVersion: this.hiringTaxonomyVersion,
      hiringTechnologyLexiconVersion: this.hiringTechnologyLexiconVersion,
      structuredParserPolicyVersion: this.structuredParserPolicyVersion,
      anydocParserVersion: this.anydocParserVersion,
      htmlMarkdownRendererVersion: this.htmlMarkdownRendererVersion,
      extractionQualityEvaluatorVersion: this.extractionQualityEvaluatorVersion,
      startedAt,
      completedAt,
      durationMs: Math.max(0, Date.parse(completedAt) - startedAtMs),
      exitCode: 0,
      timedOut: false,
      cancelled: false,
      requestPath: paths.requestPath,
      outputPath: paths.outputPath,
      stdoutPath: paths.stdoutPath,
      stderrPath: paths.stderrPath,
      ...(providerTelemetry === undefined
        ? { providerTelemetryImported: false, providerPolicyTraceImported: false }
        : {
            providerTelemetryPath: paths.providerTelemetryPath,
            providerTelemetryImported: true,
            providerPolicyTracePath: paths.providerPolicyTracePath,
            providerPolicyTraceImported: providerPolicyTrace !== undefined,
            providerConfigurationFingerprint: providerTelemetry.configurationFingerprint,
            providerUsage: providerTelemetry.usage,
            providerWarnings: providerTelemetry.warnings,
          }),
      ...(this.extractionMode === "selected_public_pages"
        ? {
            frontierPath: paths.frontierPath,
            frontierImported: false,
            extractedContentPath: paths.extractedContentPath,
            extractedContentImported: false,
            extractionTelemetryPath: paths.extractionTelemetryPath,
            extractionTelemetryImported: false,
          }
        : {
            frontierImported: false,
            extractedContentImported: false,
            extractionTelemetryImported: false,
          }),
      ...(this.structuredContentMode === "selected_resources"
        ? {
            structuredContentPath: paths.structuredContentPath,
            structuredContentImported: false,
            contentParseTelemetryPath: paths.contentParseTelemetryPath,
            contentParseTelemetryImported: false,
          }
        : {
            structuredContentImported: false,
            contentParseTelemetryImported: false,
          }),
      ...(this.sourceAdapterMode === "selected_sources"
        ? {
            sourceTargetPlanPath: paths.sourceTargetPlanPath,
            sourceTargetPlanImported: false,
            jobCollectionPath: paths.jobCollectionPath,
            jobCollectionImported: false,
            hiringSignalsPath: paths.hiringSignalsPath,
            hiringSignalsImported: false,
            sourceAdapterTelemetryPath: paths.sourceAdapterTelemetryPath,
            sourceAdapterTelemetryImported: false,
            sourceAdapterConfigurationFingerprint: this.sourceAdapterConfigurationFingerprint,
          }
        : {
            sourceTargetPlanImported: false,
            jobCollectionImported: false,
            hiringSignalsImported: false,
            sourceAdapterTelemetryImported: false,
          }),
      providerIds,
      success: true,
    });
    try {
      await writeAtomically(paths.executionPath, `${JSON.stringify(record, null, 2)}\n`);
      if (!this.#config.keepExchangeFiles) {
        await Promise.all([
          rm(paths.stdoutPath, { force: true }),
          rm(paths.stderrPath, { force: true }),
        ]);
      }
    } catch (error) {
      throw new CluvviError(
        {
          code: "DISCOVERY_ENGINE_ARTIFACT_PERSISTENCE_FAILED",
          category: "storage",
          message: "Cluvvi validated discovery output but could not persist bridge provenance.",
          retryable: true,
          stage: "discovery",
          context: {
            executionRecordPath: paths.executionPath,
            retrySafe: true,
            resumeSupported: true,
          },
          cause: error instanceof Error ? (error.stack ?? error.message) : String(error),
        },
        { cause: error },
      );
    }
    return artifact;
  }

  async #fail(input: {
    input: DiscoveryRuntimeExecutionInput;
    paths: DiscoveryExchangePaths;
    arguments_: string[];
    startedAt: string;
    startedAtMs: number;
    projectCommitSha?: string | undefined;
    exitCode?: number | undefined;
    timedOut: boolean;
    cancelled: boolean;
    code: string;
    message: string;
    cause?: unknown | undefined;
  }): Promise<never> {
    const completedAt = this.#now();
    const recordInput = {
      schemaVersion: "1.0" as const,
      artifactKind: "local_discovery_execution.v1" as const,
      runId: input.input.runId,
      requestId: input.input.request.requestId,
      projectPath: this.#config.projectPath,
      ...(input.projectCommitSha === undefined ? {} : { projectCommitSha: input.projectCommitSha }),
      command: this.#config.command,
      arguments: input.arguments_,
      providerMode: this.providerMode,
      providerPolicy: this.providerPolicy,
      extractionMode: this.extractionMode,
      maximumExtractions: this.maximumExtractions,
      structuredContentMode: this.structuredContentMode,
      maximumStructuredResources: this.maximumStructuredResources,
      maximumDocumentResources: this.maximumDocumentResources,
      sourceAdapterMode: this.sourceAdapterMode,
      sourceFamilies: [...this.sourceFamilies],
      maximumHiringTargets: this.maximumHiringTargets,
      maximumHiringBoardsPerTarget: this.maximumHiringBoardsPerTarget,
      maximumHiringJobsPerBoard: this.maximumHiringJobsPerBoard,
      maximumHiringJobsTotal: this.maximumHiringJobsTotal,
      hiringSignalRuleVersion: this.hiringSignalRuleVersion,
      hiringTaxonomyVersion: this.hiringTaxonomyVersion,
      hiringTechnologyLexiconVersion: this.hiringTechnologyLexiconVersion,
      structuredParserPolicyVersion: this.structuredParserPolicyVersion,
      anydocParserVersion: this.anydocParserVersion,
      htmlMarkdownRendererVersion: this.htmlMarkdownRendererVersion,
      extractionQualityEvaluatorVersion: this.extractionQualityEvaluatorVersion,
      startedAt: input.startedAt,
      completedAt,
      durationMs: Math.max(0, Date.parse(completedAt) - input.startedAtMs),
      ...(input.exitCode === undefined ? {} : { exitCode: input.exitCode }),
      timedOut: input.timedOut,
      cancelled: input.cancelled,
      requestPath: input.paths.requestPath,
      outputPath: input.paths.outputPath,
      stdoutPath: input.paths.stdoutPath,
      stderrPath: input.paths.stderrPath,
      ...(this.providerMode === "live_search"
        ? {
            providerTelemetryPath: input.paths.providerTelemetryPath,
            providerTelemetryImported: false,
            providerPolicyTracePath: input.paths.providerPolicyTracePath,
            providerPolicyTraceImported: false,
          }
        : { providerTelemetryImported: false, providerPolicyTraceImported: false }),
      ...(this.extractionMode === "selected_public_pages"
        ? {
            frontierPath: input.paths.frontierPath,
            frontierImported: false,
            extractedContentPath: input.paths.extractedContentPath,
            extractedContentImported: false,
            extractionTelemetryPath: input.paths.extractionTelemetryPath,
            extractionTelemetryImported: false,
          }
        : {
            frontierImported: false,
            extractedContentImported: false,
            extractionTelemetryImported: false,
          }),
      ...(this.structuredContentMode === "selected_resources"
        ? {
            structuredContentPath: input.paths.structuredContentPath,
            structuredContentImported: false,
            contentParseTelemetryPath: input.paths.contentParseTelemetryPath,
            contentParseTelemetryImported: false,
          }
        : {
            structuredContentImported: false,
            contentParseTelemetryImported: false,
          }),
      ...(this.sourceAdapterMode === "selected_sources"
        ? {
            sourceTargetPlanPath: input.paths.sourceTargetPlanPath,
            sourceTargetPlanImported: false,
            jobCollectionPath: input.paths.jobCollectionPath,
            jobCollectionImported: false,
            hiringSignalsPath: input.paths.hiringSignalsPath,
            hiringSignalsImported: false,
            sourceAdapterTelemetryPath: input.paths.sourceAdapterTelemetryPath,
            sourceAdapterTelemetryImported: false,
            sourceAdapterConfigurationFingerprint: this.sourceAdapterConfigurationFingerprint,
          }
        : {
            sourceTargetPlanImported: false,
            jobCollectionImported: false,
            hiringSignalsImported: false,
            sourceAdapterTelemetryImported: false,
          }),
      success: false,
      errorCode: input.code,
      errorMessage: input.message,
    } satisfies LocalDiscoveryExecutionRecordV1;
    try {
      const record = LocalDiscoveryExecutionRecordV1Schema.parse(recordInput);
      await writeAtomically(input.paths.executionPath, `${JSON.stringify(record, null, 2)}\n`);
    } catch {
      // The primary bridge error remains authoritative when diagnostics cannot be written.
    }
    throw new CluvviError(
      {
        code: input.code,
        category: failureCategory(input.code),
        message: input.message,
        retryable: ![
          "DISCOVERY_ENGINE_UNEXPECTED_PROVIDER",
          "DISCOVERY_ENGINE_PROVIDER_MODE_MISMATCH",
          "DISCOVERY_ENGINE_USAGE_MISMATCH",
        ].includes(input.code),
        stage: "discovery",
        context: {
          executionRecordPath: input.paths.executionPath,
          requestPath: input.paths.requestPath,
          outputPath: input.paths.outputPath,
          ...(this.providerMode === "live_search"
            ? {
                providerTelemetryPath: input.paths.providerTelemetryPath,
                providerPolicyTracePath: input.paths.providerPolicyTracePath,
              }
            : {}),
          ...(this.extractionMode === "selected_public_pages"
            ? {
                frontierPath: input.paths.frontierPath,
                extractedContentPath: input.paths.extractedContentPath,
                extractionTelemetryPath: input.paths.extractionTelemetryPath,
              }
            : {}),
          ...(this.structuredContentMode === "selected_resources"
            ? {
                structuredContentPath: input.paths.structuredContentPath,
                contentParseTelemetryPath: input.paths.contentParseTelemetryPath,
              }
            : {}),
          stdoutPath: input.paths.stdoutPath,
          stderrPath: input.paths.stderrPath,
          retrySafe: ![
            "DISCOVERY_ENGINE_UNEXPECTED_PROVIDER",
            "DISCOVERY_ENGINE_PROVIDER_MODE_MISMATCH",
            "DISCOVERY_ENGINE_USAGE_MISMATCH",
          ].includes(input.code),
          resumeSupported: true,
        },
        ...(input.cause === undefined
          ? {}
          : {
              cause:
                input.cause instanceof Error
                  ? (input.cause.stack ?? input.cause.message)
                  : String(input.cause),
            }),
      },
      { cause: input.cause },
    );
  }
}
