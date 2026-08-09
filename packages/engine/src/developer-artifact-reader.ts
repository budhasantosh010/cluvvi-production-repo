import {
  CluvviError,
  DeveloperArtifactValidationError,
  LocalDiscoveryExecutionRecordV1Schema,
  type SearchResultsArtifactV2,
  type ValidatedDeveloperAnalysisSet,
  type ValidatedDeveloperArtifactSet,
  type ValidatedDeveloperCommentManifestSet,
  type ValidatedDeveloperCommentSet,
  type ValidatedDeveloperPlanSet,
  type ValidatedDeveloperRepositorySet,
  type ValidatedDeveloperThreadManifestSet,
  type ValidatedDeveloperThreadSet,
  validateDeveloperAnalysisSet,
  validateDeveloperArtifactSet,
  validateDeveloperCommentManifestSet,
  validateDeveloperCommentMetadataSet,
  validateDeveloperPlanArtifact,
  validateDeveloperRepositorySet,
  validateDeveloperThreadManifestSet,
  validateDeveloperThreadMetadataSet,
} from "@cluvvi/core";
import { randomUUID } from "node:crypto";
import { readFile, rename, writeFile } from "node:fs/promises";
import { isAbsolute, relative, resolve } from "node:path";
import { discoveryExchangePaths } from "./discovery-exchange";

type DeveloperStage =
  | "developer_planning"
  | "developer_repository_retrieval"
  | "developer_thread_retrieval"
  | "developer_thread_context"
  | "developer_comment_retrieval"
  | "developer_comment_context"
  | "developer_analysis"
  | "developer_source_telemetry";

async function readJson(
  path: string,
  missingCode: string,
  invalidCode: string,
  stage: DeveloperStage,
): Promise<unknown> {
  let content: string;
  try {
    content = await readFile(path, "utf8");
  } catch (error) {
    const code =
      error !== null && typeof error === "object" && "code" in error
        ? (error as { code?: unknown }).code
        : undefined;
    throw new CluvviError(
      {
        code: code === "ENOENT" ? missingCode : "DEVELOPER_ARTIFACT_READ_FAILED",
        category: code === "ENOENT" ? "provider" : "storage",
        message:
          code === "ENOENT"
            ? `The standalone Discovery Engine did not create ${path.split(/[\\/]/u).at(-1) ?? "a developer artifact"}.`
            : "Cluvvi could not read a developer artifact.",
        retryable: true,
        stage,
        context: {
          path,
          retrySafe: true,
          resumeSupported: true,
          discoveryReuseExpected: true,
          hiringReuseExpected: true,
          communityReuseExpected: true,
        },
        cause: error instanceof Error ? (error.stack ?? error.message) : String(error),
      },
      { cause: error },
    );
  }
  try {
    return JSON.parse(content) as unknown;
  } catch (error) {
    throw new CluvviError(
      {
        code: invalidCode,
        category: "validation",
        message: "A developer artifact is not valid JSON.",
        retryable: true,
        stage,
        context: {
          path,
          retrySafe: true,
          resumeSupported: true,
          discoveryReuseExpected: true,
          hiringReuseExpected: true,
          communityReuseExpected: true,
        },
        cause: error instanceof Error ? (error.stack ?? error.message) : String(error),
      },
      { cause: error },
    );
  }
}

function confinedArtifactPath(input: {
  exchangeDirectory: string;
  allowedDirectory: string;
  relativeArtifactPath: string;
}): string {
  if (isAbsolute(input.relativeArtifactPath)) {
    throw new DeveloperArtifactValidationError(
      "DEVELOPER_ARTIFACT_PATH_INVALID",
      "Developer manifest path must be run-relative.",
    );
  }
  const full = resolve(input.exchangeDirectory, input.relativeArtifactPath);
  const exchangeRelative = relative(input.exchangeDirectory, full);
  const allowedRelative = relative(input.allowedDirectory, full);
  if (
    exchangeRelative.startsWith("..") ||
    isAbsolute(exchangeRelative) ||
    allowedRelative.startsWith("..") ||
    isAbsolute(allowedRelative)
  ) {
    throw new DeveloperArtifactValidationError(
      "DEVELOPER_ARTIFACT_PATH_INVALID",
      "Developer manifest path escaped its approved run directory.",
    );
  }
  return full;
}

async function updateImportFlags(path: string, flags: Record<string, boolean>): Promise<void> {
  const current = LocalDiscoveryExecutionRecordV1Schema.parse(
    JSON.parse(await readFile(path, "utf8")) as unknown,
  );
  const updated = LocalDiscoveryExecutionRecordV1Schema.parse({ ...current, ...flags });
  const temporaryPath = `${path}.${randomUUID()}.tmp`;
  await writeFile(temporaryPath, `${JSON.stringify(updated, null, 2)}\n`, {
    encoding: "utf8",
    flag: "wx",
  });
  await rename(temporaryPath, path);
}

function wrapValidation(error: unknown, stage: DeveloperStage): never {
  if (error instanceof DeveloperArtifactValidationError) {
    const security =
      error.code.includes("PRIVATE") ||
      error.code.includes("FORBIDDEN") ||
      error.code.includes("PATH") ||
      error.code.includes("URL");
    throw new CluvviError(
      {
        code: error.code,
        category: security ? "security" : "validation",
        message: error.message,
        retryable: !security,
        stage,
        context: {
          retrySafe: !security,
          resumeSupported: true,
          discoveryReuseExpected: true,
          hiringReuseExpected: true,
          communityReuseExpected: true,
        },
      },
      { cause: error },
    );
  }
  throw error;
}

async function loadThreads(input: {
  exchangeDirectory: string;
  threadsDirectory: string;
  manifest: unknown;
  stage: DeveloperStage;
}): Promise<unknown[]> {
  const entries =
    (input.manifest as { threadArtifacts?: Array<{ relativeArtifactPath?: unknown }> })
      .threadArtifacts ?? [];
  return Promise.all(
    entries.map(async (entry) => {
      if (typeof entry.relativeArtifactPath !== "string") {
        throw new DeveloperArtifactValidationError(
          "DEVELOPER_THREAD_MANIFEST_INVALID",
          "Developer thread manifest path is missing.",
        );
      }
      return readJson(
        confinedArtifactPath({
          exchangeDirectory: input.exchangeDirectory,
          allowedDirectory: input.threadsDirectory,
          relativeArtifactPath: entry.relativeArtifactPath,
        }),
        "DEVELOPER_THREAD_MISSING",
        "DEVELOPER_THREAD_INVALID_JSON",
        input.stage,
      );
    }),
  );
}

async function loadComments(input: {
  exchangeDirectory: string;
  commentsDirectory: string;
  manifest: unknown;
  stage: DeveloperStage;
}): Promise<unknown[]> {
  const entries =
    (input.manifest as { collections?: Array<{ relativeArtifactPath?: unknown }> }).collections ??
    [];
  return Promise.all(
    entries.map(async (entry) => {
      if (typeof entry.relativeArtifactPath !== "string") {
        throw new DeveloperArtifactValidationError(
          "DEVELOPER_COMMENT_MANIFEST_INVALID",
          "Developer comment manifest path is missing.",
        );
      }
      return readJson(
        confinedArtifactPath({
          exchangeDirectory: input.exchangeDirectory,
          allowedDirectory: input.commentsDirectory,
          relativeArtifactPath: entry.relativeArtifactPath,
        }),
        "DEVELOPER_COMMENT_COLLECTION_MISSING",
        "DEVELOPER_COMMENT_COLLECTION_INVALID_JSON",
        input.stage,
      );
    }),
  );
}

export async function readValidatedDeveloperPlan(input: {
  runsDirectory: string;
  runId: string;
  searchResults: SearchResultsArtifactV2;
}): Promise<ValidatedDeveloperPlanSet> {
  const paths = discoveryExchangePaths(input.runsDirectory, input.runId);
  try {
    const plan = await readJson(
      paths.developerSourcePlanPath,
      "DEVELOPER_SOURCE_PLAN_MISSING",
      "DEVELOPER_SOURCE_PLAN_INVALID_JSON",
      "developer_planning",
    );
    const validated = validateDeveloperPlanArtifact(plan, input.searchResults.requestId);
    await updateImportFlags(paths.executionPath, { developerSourcePlanImported: true });
    return validated;
  } catch (error) {
    return wrapValidation(error, "developer_planning");
  }
}

export async function readValidatedDeveloperRepositories(input: {
  runsDirectory: string;
  runId: string;
  searchResults: SearchResultsArtifactV2;
}): Promise<ValidatedDeveloperRepositorySet> {
  const paths = discoveryExchangePaths(input.runsDirectory, input.runId);
  try {
    const planSet = await readValidatedDeveloperPlan(input);
    const repositoryCollection = await readJson(
      paths.developerRepositoryCollectionPath,
      "DEVELOPER_REPOSITORY_COLLECTION_MISSING",
      "DEVELOPER_REPOSITORY_COLLECTION_INVALID_JSON",
      "developer_repository_retrieval",
    );
    const validated = validateDeveloperRepositorySet({
      plan: planSet.plan,
      repositoryCollection,
      expectedRequestId: input.searchResults.requestId,
    });
    await updateImportFlags(paths.executionPath, { developerRepositoryCollectionImported: true });
    return validated;
  } catch (error) {
    return wrapValidation(error, "developer_repository_retrieval");
  }
}

export async function readValidatedDeveloperThreadManifestSet(input: {
  runsDirectory: string;
  runId: string;
  searchResults: SearchResultsArtifactV2;
}): Promise<ValidatedDeveloperThreadManifestSet> {
  const paths = discoveryExchangePaths(input.runsDirectory, input.runId);
  try {
    const repositorySet = await readValidatedDeveloperRepositories(input);
    const threadManifest = await readJson(
      paths.developerThreadManifestPath,
      "DEVELOPER_THREAD_MANIFEST_MISSING",
      "DEVELOPER_THREAD_MANIFEST_INVALID_JSON",
      "developer_thread_retrieval",
    );
    const threads = await loadThreads({
      exchangeDirectory: paths.directory,
      threadsDirectory: paths.developerThreadsDirectory,
      manifest: threadManifest,
      stage: "developer_thread_retrieval",
    });
    const validated = validateDeveloperThreadManifestSet({
      repositorySet,
      threadManifest,
      threads,
    });
    await updateImportFlags(paths.executionPath, { developerThreadManifestImported: true });
    return validated;
  } catch (error) {
    return wrapValidation(error, "developer_thread_retrieval");
  }
}

export async function readValidatedDeveloperThreads(input: {
  runsDirectory: string;
  runId: string;
  searchResults: SearchResultsArtifactV2;
}): Promise<ValidatedDeveloperThreadSet> {
  const paths = discoveryExchangePaths(input.runsDirectory, input.runId);
  try {
    const threadSet = await readValidatedDeveloperThreadManifestSet(input);
    const threadMetadata = await readJson(
      paths.developerThreadMetadataPath,
      "DEVELOPER_THREAD_METADATA_MISSING",
      "DEVELOPER_THREAD_METADATA_INVALID_JSON",
      "developer_thread_context",
    );
    const validated = validateDeveloperThreadMetadataSet({ threadSet, threadMetadata });
    await updateImportFlags(paths.executionPath, { developerThreadMetadataImported: true });
    return validated;
  } catch (error) {
    return wrapValidation(error, "developer_thread_context");
  }
}

export async function readValidatedDeveloperCommentManifestSet(input: {
  runsDirectory: string;
  runId: string;
  searchResults: SearchResultsArtifactV2;
}): Promise<ValidatedDeveloperCommentManifestSet> {
  const paths = discoveryExchangePaths(input.runsDirectory, input.runId);
  try {
    const threadSet = await readValidatedDeveloperThreads(input);
    const commentManifest = await readJson(
      paths.developerCommentCollectionManifestPath,
      "DEVELOPER_COMMENT_MANIFEST_MISSING",
      "DEVELOPER_COMMENT_MANIFEST_INVALID_JSON",
      "developer_comment_retrieval",
    );
    const commentCollections = await loadComments({
      exchangeDirectory: paths.directory,
      commentsDirectory: paths.developerCommentsDirectory,
      manifest: commentManifest,
      stage: "developer_comment_retrieval",
    });
    const validated = validateDeveloperCommentManifestSet({
      threadSet,
      commentManifest,
      commentCollections,
    });
    await updateImportFlags(paths.executionPath, {
      developerCommentCollectionManifestImported: true,
    });
    return validated;
  } catch (error) {
    return wrapValidation(error, "developer_comment_retrieval");
  }
}

export async function readValidatedDeveloperComments(input: {
  runsDirectory: string;
  runId: string;
  searchResults: SearchResultsArtifactV2;
}): Promise<ValidatedDeveloperCommentSet> {
  const paths = discoveryExchangePaths(input.runsDirectory, input.runId);
  try {
    const commentSet = await readValidatedDeveloperCommentManifestSet(input);
    const commentMetadata = await readJson(
      paths.developerCommentMetadataPath,
      "DEVELOPER_COMMENT_METADATA_MISSING",
      "DEVELOPER_COMMENT_METADATA_INVALID_JSON",
      "developer_comment_context",
    );
    const validated = validateDeveloperCommentMetadataSet({ commentSet, commentMetadata });
    await updateImportFlags(paths.executionPath, { developerCommentMetadataImported: true });
    return validated;
  } catch (error) {
    return wrapValidation(error, "developer_comment_context");
  }
}

export async function readValidatedDeveloperAnalysis(input: {
  runsDirectory: string;
  runId: string;
  searchResults: SearchResultsArtifactV2;
}): Promise<ValidatedDeveloperAnalysisSet> {
  const paths = discoveryExchangePaths(input.runsDirectory, input.runId);
  try {
    const commentSet = await readValidatedDeveloperComments(input);
    const signals = await readJson(
      paths.developerSignalsPath,
      "DEVELOPER_SIGNALS_MISSING",
      "DEVELOPER_SIGNALS_INVALID_JSON",
      "developer_analysis",
    );
    const validated = validateDeveloperAnalysisSet({ commentSet, signals });
    await updateImportFlags(paths.executionPath, { developerSignalsImported: true });
    return validated;
  } catch (error) {
    return wrapValidation(error, "developer_analysis");
  }
}

export async function readValidatedDeveloperArtifactSet(input: {
  runsDirectory: string;
  runId: string;
  searchResults: SearchResultsArtifactV2;
}): Promise<ValidatedDeveloperArtifactSet> {
  const paths = discoveryExchangePaths(input.runsDirectory, input.runId);
  try {
    const analysis = await readValidatedDeveloperAnalysis(input);
    const telemetry = await readJson(
      paths.developerSourceTelemetryPath,
      "DEVELOPER_SOURCE_TELEMETRY_MISSING",
      "DEVELOPER_SOURCE_TELEMETRY_INVALID_JSON",
      "developer_source_telemetry",
    );
    const validated = validateDeveloperArtifactSet({
      ...analysis,
      telemetry,
      expectedRequestId: input.searchResults.requestId,
    });
    await updateImportFlags(paths.executionPath, {
      developerSourcePlanImported: true,
      developerRepositoryCollectionImported: true,
      developerThreadManifestImported: true,
      developerThreadMetadataImported: true,
      developerCommentCollectionManifestImported: true,
      developerCommentMetadataImported: true,
      developerSignalsImported: true,
      developerSourceTelemetryImported: true,
    });
    return validated;
  } catch (error) {
    return wrapValidation(error, "developer_source_telemetry");
  }
}
