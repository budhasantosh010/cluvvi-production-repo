import {
  CluvviError,
  LocalDiscoveryExecutionRecordV1Schema,
  SearchResultsArtifactV2Schema,
  type LocalDiscoveryExecutionRecordV1,
  type SearchResultsArtifactV2,
} from "@cluvvi/core";
import { randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import { createWriteStream, existsSync } from "node:fs";
import { access, mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { delimiter, dirname, isAbsolute, resolve } from "node:path";
import { finished } from "node:stream/promises";
import { setTimeout as delay } from "node:timers/promises";
import type { LocalDiscoveryEngineConfig } from "./discovery-runtime-config";
import type { DiscoveryRuntime, DiscoveryRuntimeExecutionInput } from "./discovery-runtime";

const EXCHANGE_FILE_NAMES = [
  "discovery-request.v1.json",
  "search-results.v2.json",
  "discovery-stdout.log",
  "discovery-stderr.log",
  "discovery-execution.json",
] as const;

interface ExchangePaths {
  directory: string;
  requestPath: string;
  outputPath: string;
  stdoutPath: string;
  stderrPath: string;
  executionPath: string;
}

interface ChildOutcome {
  exitCode: number | null;
  error?: Error;
}

function safeChildEnvironment(environment: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
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
  if (!(lowerCommand === "pnpm" || lowerCommand.endsWith("\\pnpm.cmd"))) {
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

async function archivePreviousExchange(paths: ExchangePaths): Promise<void> {
  const existing: string[] = [];
  for (const name of EXCHANGE_FILE_NAMES) {
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
  if (code === "DISCOVERY_ENGINE_UNEXPECTED_PROVIDER") return "security";
  if (
    code === "DISCOVERY_ENGINE_OUTPUT_INVALID_JSON" ||
    code === "DISCOVERY_ENGINE_SCHEMA_MISMATCH" ||
    code === "DISCOVERY_ENGINE_REQUEST_ID_MISMATCH"
  ) {
    return "validation";
  }
  if (code === "DISCOVERY_ENGINE_COMMAND_FAILED" || code === "DISCOVERY_ENGINE_OUTPUT_MISSING") {
    return "provider";
  }
  if (code === "DISCOVERY_ENGINE_CANCELLED") return "internal";
  return "configuration";
}

export class LocalProcessDiscoveryRuntime implements DiscoveryRuntime {
  readonly mode = "local_discovery_engine" as const;
  readonly providerConfigurationFingerprint: string;
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
    this.providerConfigurationFingerprint = [
      this.mode,
      this.#config.projectPath,
      this.#config.command,
      this.#config.timeoutMs,
      this.#config.keepExchangeFiles,
    ].join(":");
  }

  async execute(input: DiscoveryRuntimeExecutionInput): Promise<SearchResultsArtifactV2> {
    const paths = this.#paths(input.runId);
    const arguments_ = ["discover", paths.requestPath, "--output", paths.outputPath];
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
    const childEnvironment = safeChildEnvironment(this.#environment);
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

    const providerIds = [
      ...new Set([
        ...artifact.summary.providersUsed,
        ...artifact.providerBreakdown.map((provider) => provider.providerId),
      ]),
    ];
    const fixtureOnly =
      providerIds.length > 0 &&
      artifact.summary.paidCreditsUsed === 0 &&
      artifact.providerBreakdown.every((provider) => provider.providerCategory === "fixture") &&
      artifact.results.every((result) => result.providerCategory === "fixture");
    if (!fixtureOnly) {
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
        code: "DISCOVERY_ENGINE_UNEXPECTED_PROVIDER",
        message:
          "C1-G rejected Discovery Engine output that was not fixture-only or used paid credits.",
      });
    }

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

  #paths(runId: string): ExchangePaths {
    const directory = resolve(this.#runsDirectory, runId, "discovery-exchange");
    return {
      directory,
      requestPath: resolve(directory, "discovery-request.v1.json"),
      outputPath: resolve(directory, "search-results.v2.json"),
      stdoutPath: resolve(directory, "discovery-stdout.log"),
      stderrPath: resolve(directory, "discovery-stderr.log"),
      executionPath: resolve(directory, "discovery-execution.json"),
    };
  }

  async #fail(input: {
    input: DiscoveryRuntimeExecutionInput;
    paths: ExchangePaths;
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
        retryable: input.code !== "DISCOVERY_ENGINE_UNEXPECTED_PROVIDER",
        stage: "discovery",
        context: {
          executionRecordPath: input.paths.executionPath,
          requestPath: input.paths.requestPath,
          outputPath: input.paths.outputPath,
          stdoutPath: input.paths.stdoutPath,
          stderrPath: input.paths.stderrPath,
          retrySafe: input.code !== "DISCOVERY_ENGINE_UNEXPECTED_PROVIDER",
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
