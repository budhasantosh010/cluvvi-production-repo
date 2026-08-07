import {
  CluvviError,
  CommunityArtifactValidationError,
  LocalDiscoveryExecutionRecordV1Schema,
  type SearchResultsArtifactV2,
  type ValidatedCommunityAnalysisSet,
  type ValidatedCommunityArtifactSet,
  type ValidatedCommunityCommentManifestSet,
  type ValidatedCommunityCommentSet,
  type ValidatedCommunityPlanSet,
  type ValidatedCommunityThreadManifestSet,
  type ValidatedCommunityThreadSet,
  validateCommunityAnalysisArtifactSet,
  validateCommunityArtifactSet,
  validateCommunityCommentContextSet,
  validateCommunityCommentManifestSet,
  validateCommunityPlanArtifact,
  validateCommunityThreadContextSet,
  validateCommunityThreadManifestSet,
} from "@cluvvi/core";
import { randomUUID } from "node:crypto";
import { readFile, rename, writeFile } from "node:fs/promises";
import { isAbsolute, relative, resolve } from "node:path";
import { discoveryExchangePaths } from "./discovery-exchange";

type CommunityStage =
  | "community_planning"
  | "community_retrieval"
  | "community_thread_context"
  | "community_comment_retrieval"
  | "community_comment_context"
  | "community_analysis"
  | "community_source_telemetry";

async function readJson(
  path: string,
  missingCode: string,
  invalidCode: string,
  stage: CommunityStage,
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
        code: code === "ENOENT" ? missingCode : "COMMUNITY_ARTIFACT_READ_FAILED",
        category: code === "ENOENT" ? "provider" : "storage",
        message:
          code === "ENOENT"
            ? `The standalone Discovery Engine did not create ${path.split(/[\\/]/u).at(-1) ?? "a community artifact"}.`
            : "Cluvvi could not read a community artifact.",
        retryable: true,
        stage,
        context: {
          path,
          retrySafe: true,
          resumeSupported: true,
          discoveryReuseExpected: true,
          hiringReuseExpected: true,
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
        message: "A community artifact is not valid JSON.",
        retryable: true,
        stage,
        context: { path, retrySafe: true, resumeSupported: true, discoveryReuseExpected: true },
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
    throw new CommunityArtifactValidationError(
      "COMMUNITY_ARTIFACT_PATH_INVALID",
      "Community manifest path must be run-relative.",
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
    throw new CommunityArtifactValidationError(
      "COMMUNITY_ARTIFACT_PATH_INVALID",
      "Community manifest path escaped its approved run directory.",
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

function wrapValidation(error: unknown, stage: CommunityStage): never {
  if (error instanceof CommunityArtifactValidationError) {
    const security =
      error.code.includes("FORBIDDEN") || error.code.includes("PATH") || error.code.includes("URL");
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
  stage: CommunityStage;
}): Promise<unknown[]> {
  const entries =
    (input.manifest as { threadArtifacts?: Array<{ relativeArtifactPath?: unknown }> })
      .threadArtifacts ?? [];
  return Promise.all(
    entries.map(async (entry) => {
      if (typeof entry.relativeArtifactPath !== "string") {
        throw new CommunityArtifactValidationError(
          "THREAD_MANIFEST_INVALID",
          "Thread manifest path is missing.",
        );
      }
      return readJson(
        confinedArtifactPath({
          exchangeDirectory: input.exchangeDirectory,
          allowedDirectory: input.threadsDirectory,
          relativeArtifactPath: entry.relativeArtifactPath,
        }),
        "THREAD_ARTIFACT_MISSING",
        "THREAD_ARTIFACT_INVALID_JSON",
        input.stage,
      );
    }),
  );
}

async function loadComments(input: {
  exchangeDirectory: string;
  commentsDirectory: string;
  manifest: unknown;
  stage: CommunityStage;
}): Promise<unknown[]> {
  const entries =
    (input.manifest as { collections?: Array<{ relativeArtifactPath?: unknown }> }).collections ??
    [];
  return Promise.all(
    entries.map(async (entry) => {
      if (typeof entry.relativeArtifactPath !== "string") {
        throw new CommunityArtifactValidationError(
          "COMMENT_COLLECTION_MANIFEST_INVALID",
          "Comment collection path is missing.",
        );
      }
      return readJson(
        confinedArtifactPath({
          exchangeDirectory: input.exchangeDirectory,
          allowedDirectory: input.commentsDirectory,
          relativeArtifactPath: entry.relativeArtifactPath,
        }),
        "COMMENT_COLLECTION_MISSING",
        "COMMENT_COLLECTION_INVALID_JSON",
        input.stage,
      );
    }),
  );
}

export async function readValidatedCommunityPlan(input: {
  runsDirectory: string;
  runId: string;
  searchResults: SearchResultsArtifactV2;
}): Promise<ValidatedCommunityPlanSet> {
  const paths = discoveryExchangePaths(input.runsDirectory, input.runId);
  try {
    const plan = await readJson(
      paths.communitySourcePlanPath,
      "COMMUNITY_SOURCE_PLAN_MISSING",
      "COMMUNITY_SOURCE_PLAN_INVALID_JSON",
      "community_planning",
    );
    const validated = validateCommunityPlanArtifact({
      plan,
      requestId: input.searchResults.requestId,
    });
    await updateImportFlags(paths.executionPath, { communitySourcePlanImported: true });
    return validated;
  } catch (error) {
    return wrapValidation(error, "community_planning");
  }
}

export async function readValidatedCommunityThreadManifestSet(input: {
  runsDirectory: string;
  runId: string;
  searchResults: SearchResultsArtifactV2;
}): Promise<ValidatedCommunityThreadManifestSet> {
  const paths = discoveryExchangePaths(input.runsDirectory, input.runId);
  try {
    const [plan, threadManifest] = await Promise.all([
      readJson(
        paths.communitySourcePlanPath,
        "COMMUNITY_SOURCE_PLAN_MISSING",
        "COMMUNITY_SOURCE_PLAN_INVALID_JSON",
        "community_retrieval",
      ),
      readJson(
        paths.threadManifestPath,
        "THREAD_MANIFEST_MISSING",
        "THREAD_MANIFEST_INVALID_JSON",
        "community_retrieval",
      ),
    ]);
    const threads = await loadThreads({
      exchangeDirectory: paths.directory,
      threadsDirectory: paths.communityThreadsDirectory,
      manifest: threadManifest,
      stage: "community_retrieval",
    });
    const validated = validateCommunityThreadManifestSet({
      plan,
      threadManifest,
      threads,
      expectedRequestId: input.searchResults.requestId,
    });
    await updateImportFlags(paths.executionPath, {
      communitySourcePlanImported: true,
      threadManifestImported: true,
    });
    return validated;
  } catch (error) {
    return wrapValidation(error, "community_retrieval");
  }
}

export async function readValidatedCommunityThreads(input: {
  runsDirectory: string;
  runId: string;
  searchResults: SearchResultsArtifactV2;
}): Promise<ValidatedCommunityThreadSet> {
  const paths = discoveryExchangePaths(input.runsDirectory, input.runId);
  try {
    const threadSet = await readValidatedCommunityThreadManifestSet(input);
    const threadContext = await readJson(
      paths.communityThreadContextPath,
      "COMMUNITY_THREAD_CONTEXT_MISSING",
      "COMMUNITY_THREAD_CONTEXT_INVALID_JSON",
      "community_thread_context",
    );
    const validated = validateCommunityThreadContextSet({ threadSet, threadContext });
    await updateImportFlags(paths.executionPath, { communityThreadContextImported: true });
    return validated;
  } catch (error) {
    return wrapValidation(error, "community_thread_context");
  }
}

export async function readValidatedCommunityCommentManifestSet(input: {
  runsDirectory: string;
  runId: string;
  searchResults: SearchResultsArtifactV2;
}): Promise<ValidatedCommunityCommentManifestSet> {
  const paths = discoveryExchangePaths(input.runsDirectory, input.runId);
  try {
    const threadSet = await readValidatedCommunityThreads(input);
    const commentManifest = await readJson(
      paths.commentCollectionManifestPath,
      "COMMENT_COLLECTION_MANIFEST_MISSING",
      "COMMENT_COLLECTION_MANIFEST_INVALID_JSON",
      "community_comment_retrieval",
    );
    const commentCollections = await loadComments({
      exchangeDirectory: paths.directory,
      commentsDirectory: paths.communityCommentsDirectory,
      manifest: commentManifest,
      stage: "community_comment_retrieval",
    });
    const validated = validateCommunityCommentManifestSet({
      threadSet,
      commentManifest,
      commentCollections,
    });
    await updateImportFlags(paths.executionPath, { commentCollectionManifestImported: true });
    return validated;
  } catch (error) {
    return wrapValidation(error, "community_comment_retrieval");
  }
}

export async function readValidatedCommunityComments(input: {
  runsDirectory: string;
  runId: string;
  searchResults: SearchResultsArtifactV2;
}): Promise<ValidatedCommunityCommentSet> {
  const paths = discoveryExchangePaths(input.runsDirectory, input.runId);
  try {
    const commentSet = await readValidatedCommunityCommentManifestSet(input);
    const commentContext = await readJson(
      paths.communityCommentContextPath,
      "COMMUNITY_COMMENT_CONTEXT_MISSING",
      "COMMUNITY_COMMENT_CONTEXT_INVALID_JSON",
      "community_comment_context",
    );
    const validated = validateCommunityCommentContextSet({ commentSet, commentContext });
    await updateImportFlags(paths.executionPath, { communityCommentContextImported: true });
    return validated;
  } catch (error) {
    return wrapValidation(error, "community_comment_context");
  }
}

export async function readValidatedCommunityAnalysis(input: {
  runsDirectory: string;
  runId: string;
  searchResults: SearchResultsArtifactV2;
}): Promise<ValidatedCommunityAnalysisSet> {
  const paths = discoveryExchangePaths(input.runsDirectory, input.runId);
  try {
    const commentSet = await readValidatedCommunityComments(input);
    const signals = await readJson(
      paths.communitySignalsPath,
      "COMMUNITY_SIGNALS_MISSING",
      "COMMUNITY_SIGNALS_INVALID_JSON",
      "community_analysis",
    );
    const validated = validateCommunityAnalysisArtifactSet({
      ...commentSet,
      signals,
      requestId: input.searchResults.requestId,
    });
    await updateImportFlags(paths.executionPath, { communitySignalsImported: true });
    return validated;
  } catch (error) {
    return wrapValidation(error, "community_analysis");
  }
}

export async function readValidatedCommunityArtifactSet(input: {
  runsDirectory: string;
  runId: string;
  searchResults: SearchResultsArtifactV2;
}): Promise<ValidatedCommunityArtifactSet> {
  const paths = discoveryExchangePaths(input.runsDirectory, input.runId);
  try {
    const [
      plan,
      threadManifest,
      threadContext,
      commentManifest,
      commentContext,
      signals,
      telemetry,
    ] = await Promise.all([
      readJson(
        paths.communitySourcePlanPath,
        "COMMUNITY_SOURCE_PLAN_MISSING",
        "COMMUNITY_SOURCE_PLAN_INVALID_JSON",
        "community_source_telemetry",
      ),
      readJson(
        paths.threadManifestPath,
        "THREAD_MANIFEST_MISSING",
        "THREAD_MANIFEST_INVALID_JSON",
        "community_source_telemetry",
      ),
      readJson(
        paths.communityThreadContextPath,
        "COMMUNITY_THREAD_CONTEXT_MISSING",
        "COMMUNITY_THREAD_CONTEXT_INVALID_JSON",
        "community_source_telemetry",
      ),
      readJson(
        paths.commentCollectionManifestPath,
        "COMMENT_COLLECTION_MANIFEST_MISSING",
        "COMMENT_COLLECTION_MANIFEST_INVALID_JSON",
        "community_source_telemetry",
      ),
      readJson(
        paths.communityCommentContextPath,
        "COMMUNITY_COMMENT_CONTEXT_MISSING",
        "COMMUNITY_COMMENT_CONTEXT_INVALID_JSON",
        "community_source_telemetry",
      ),
      readJson(
        paths.communitySignalsPath,
        "COMMUNITY_SIGNALS_MISSING",
        "COMMUNITY_SIGNALS_INVALID_JSON",
        "community_source_telemetry",
      ),
      readJson(
        paths.communitySourceTelemetryPath,
        "COMMUNITY_SOURCE_TELEMETRY_MISSING",
        "COMMUNITY_SOURCE_TELEMETRY_INVALID_JSON",
        "community_source_telemetry",
      ),
    ]);
    const [threads, commentCollections] = await Promise.all([
      loadThreads({
        exchangeDirectory: paths.directory,
        threadsDirectory: paths.communityThreadsDirectory,
        manifest: threadManifest,
        stage: "community_source_telemetry",
      }),
      loadComments({
        exchangeDirectory: paths.directory,
        commentsDirectory: paths.communityCommentsDirectory,
        manifest: commentManifest,
        stage: "community_source_telemetry",
      }),
    ]);
    validateCommunityPlanArtifact({ plan, requestId: input.searchResults.requestId });
    const validated = validateCommunityArtifactSet({
      plan,
      threadManifest,
      threadContext,
      threads,
      commentManifest,
      commentContext,
      commentCollections,
      signals,
      telemetry,
    });
    await updateImportFlags(paths.executionPath, {
      communitySourcePlanImported: true,
      threadManifestImported: true,
      communityThreadContextImported: true,
      commentCollectionManifestImported: true,
      communityCommentContextImported: true,
      communitySignalsImported: true,
      communitySourceTelemetryImported: true,
    });
    return validated;
  } catch (error) {
    return wrapValidation(error, "community_source_telemetry");
  }
}
