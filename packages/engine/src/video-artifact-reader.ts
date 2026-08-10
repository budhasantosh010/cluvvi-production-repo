import {
  CluvviError,
  LocalDiscoveryExecutionRecordV1Schema,
  VideoArtifactValidationError,
  type SearchResultsArtifactV2,
  type ValidatedVideoAnalysisSet,
  type ValidatedVideoArtifactSet,
  type ValidatedVideoCollectionSet,
  type ValidatedVideoCommentSet,
  type ValidatedVideoPlanSet,
  type ValidatedVideoTranscriptSet,
  validateVideoAnalysisSet,
  validateVideoArtifactSet,
  validateVideoCollectionSet,
  validateVideoCommentSet,
  validateVideoPlanArtifact,
  validateVideoTranscriptSet,
} from "@cluvvi/core";
import { randomUUID } from "node:crypto";
import { readFile, rename, writeFile } from "node:fs/promises";
import { isAbsolute, relative, resolve } from "node:path";
import { discoveryExchangePaths } from "./discovery-exchange";

type VideoStage =
  | "video_planning"
  | "video_retrieval"
  | "video_transcript_retrieval"
  | "video_comment_retrieval"
  | "video_analysis"
  | "video_source_telemetry";

async function readJson(
  path: string,
  missingCode: string,
  invalidCode: string,
  stage: VideoStage,
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
        code: code === "ENOENT" ? missingCode : "VIDEO_ARTIFACT_READ_FAILED",
        category: code === "ENOENT" ? "provider" : "storage",
        message:
          code === "ENOENT"
            ? `The standalone Discovery Engine did not create ${path.split(/[\\/]/u).at(-1) ?? "a video artifact"}.`
            : "Cluvvi could not read a video artifact.",
        retryable: true,
        stage,
        context: {
          path,
          retrySafe: true,
          resumeSupported: true,
          discoveryReuseExpected: true,
          hiringReuseExpected: true,
          communityReuseExpected: true,
          developerReuseExpected: true,
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
        message: "A video artifact is not valid JSON.",
        retryable: true,
        stage,
        context: {
          path,
          retrySafe: true,
          resumeSupported: true,
          discoveryReuseExpected: true,
          hiringReuseExpected: true,
          communityReuseExpected: true,
          developerReuseExpected: true,
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
    throw new VideoArtifactValidationError(
      "VIDEO_ARTIFACT_PATH_INVALID",
      "Video manifest path must be run-relative.",
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
    throw new VideoArtifactValidationError(
      "VIDEO_ARTIFACT_PATH_INVALID",
      "Video manifest path escaped its approved run directory.",
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

function wrapValidation(error: unknown, stage: VideoStage): never {
  if (error instanceof VideoArtifactValidationError) {
    const security =
      error.code.includes("FORBIDDEN") ||
      error.code.includes("PATH") ||
      error.code.includes("URL") ||
      error.code.includes("RESTRICTED");
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
          developerReuseExpected: true,
        },
      },
      { cause: error },
    );
  }
  throw error;
}

async function loadTranscriptFiles(input: {
  exchangeDirectory: string;
  transcriptsDirectory: string;
  manifest: unknown;
  stage: VideoStage;
}): Promise<unknown[]> {
  const entries =
    (input.manifest as { entries?: Array<{ relativeArtifactPath?: unknown }> }).entries ?? [];
  return Promise.all(
    entries.map(async (entry) => {
      if (typeof entry.relativeArtifactPath !== "string") {
        throw new VideoArtifactValidationError(
          "VIDEO_TRANSCRIPT_MANIFEST_INVALID",
          "Transcript manifest path is missing.",
        );
      }
      return readJson(
        confinedArtifactPath({
          exchangeDirectory: input.exchangeDirectory,
          allowedDirectory: input.transcriptsDirectory,
          relativeArtifactPath: entry.relativeArtifactPath,
        }),
        "VIDEO_TRANSCRIPT_MISSING",
        "VIDEO_TRANSCRIPT_INVALID_JSON",
        input.stage,
      );
    }),
  );
}

async function loadCommentFiles(input: {
  exchangeDirectory: string;
  commentsDirectory: string;
  manifest: unknown;
  stage: VideoStage;
}): Promise<unknown[]> {
  const entries =
    (input.manifest as { entries?: Array<{ relativeArtifactPath?: unknown }> }).entries ?? [];
  return Promise.all(
    entries.map(async (entry) => {
      if (typeof entry.relativeArtifactPath !== "string") {
        throw new VideoArtifactValidationError(
          "VIDEO_COMMENT_MANIFEST_INVALID",
          "Video comment manifest path is missing.",
        );
      }
      return readJson(
        confinedArtifactPath({
          exchangeDirectory: input.exchangeDirectory,
          allowedDirectory: input.commentsDirectory,
          relativeArtifactPath: entry.relativeArtifactPath,
        }),
        "VIDEO_COMMENT_COLLECTION_MISSING",
        "VIDEO_COMMENT_COLLECTION_INVALID_JSON",
        input.stage,
      );
    }),
  );
}

export async function readValidatedVideoPlan(input: {
  runsDirectory: string;
  runId: string;
  searchResults: SearchResultsArtifactV2;
}): Promise<ValidatedVideoPlanSet> {
  const paths = discoveryExchangePaths(input.runsDirectory, input.runId);
  try {
    const plan = await readJson(
      paths.videoSourcePlanPath,
      "VIDEO_SOURCE_PLAN_MISSING",
      "VIDEO_SOURCE_PLAN_INVALID_JSON",
      "video_planning",
    );
    const validated = validateVideoPlanArtifact(plan, input.searchResults.requestId);
    await updateImportFlags(paths.executionPath, { videoSourcePlanImported: true });
    return validated;
  } catch (error) {
    return wrapValidation(error, "video_planning");
  }
}

export async function readValidatedVideoCollection(input: {
  runsDirectory: string;
  runId: string;
  searchResults: SearchResultsArtifactV2;
}): Promise<ValidatedVideoCollectionSet> {
  const paths = discoveryExchangePaths(input.runsDirectory, input.runId);
  try {
    const planSet = await readValidatedVideoPlan(input);
    const collection = await readJson(
      paths.videoCollectionPath,
      "VIDEO_COLLECTION_MISSING",
      "VIDEO_COLLECTION_INVALID_JSON",
      "video_retrieval",
    );
    const validated = validateVideoCollectionSet({ planSet, collection });
    await updateImportFlags(paths.executionPath, { videoCollectionImported: true });
    return validated;
  } catch (error) {
    return wrapValidation(error, "video_retrieval");
  }
}

export async function readValidatedVideoTranscripts(input: {
  runsDirectory: string;
  runId: string;
  searchResults: SearchResultsArtifactV2;
}): Promise<ValidatedVideoTranscriptSet> {
  const paths = discoveryExchangePaths(input.runsDirectory, input.runId);
  try {
    const collectionSet = await readValidatedVideoCollection(input);
    const transcriptManifest = await readJson(
      paths.transcriptManifestPath,
      "VIDEO_TRANSCRIPT_MANIFEST_MISSING",
      "VIDEO_TRANSCRIPT_MANIFEST_INVALID_JSON",
      "video_transcript_retrieval",
    );
    const transcripts = await loadTranscriptFiles({
      exchangeDirectory: paths.directory,
      transcriptsDirectory: paths.videoTranscriptsDirectory,
      manifest: transcriptManifest,
      stage: "video_transcript_retrieval",
    });
    const validated = validateVideoTranscriptSet({
      collectionSet,
      transcriptManifest,
      transcripts,
    });
    await updateImportFlags(paths.executionPath, { transcriptManifestImported: true });
    return validated;
  } catch (error) {
    return wrapValidation(error, "video_transcript_retrieval");
  }
}

export async function readValidatedVideoComments(input: {
  runsDirectory: string;
  runId: string;
  searchResults: SearchResultsArtifactV2;
}): Promise<ValidatedVideoCommentSet> {
  const paths = discoveryExchangePaths(input.runsDirectory, input.runId);
  try {
    const transcriptSet = await readValidatedVideoTranscripts(input);
    const commentManifest = await readJson(
      paths.videoCommentManifestPath,
      "VIDEO_COMMENT_MANIFEST_MISSING",
      "VIDEO_COMMENT_MANIFEST_INVALID_JSON",
      "video_comment_retrieval",
    );
    const commentCollections = await loadCommentFiles({
      exchangeDirectory: paths.directory,
      commentsDirectory: paths.videoCommentsDirectory,
      manifest: commentManifest,
      stage: "video_comment_retrieval",
    });
    const validated = validateVideoCommentSet({
      transcriptSet,
      commentManifest,
      commentCollections,
    });
    await updateImportFlags(paths.executionPath, { videoCommentManifestImported: true });
    return validated;
  } catch (error) {
    return wrapValidation(error, "video_comment_retrieval");
  }
}

export async function readValidatedVideoAnalysis(input: {
  runsDirectory: string;
  runId: string;
  searchResults: SearchResultsArtifactV2;
}): Promise<ValidatedVideoAnalysisSet> {
  const paths = discoveryExchangePaths(input.runsDirectory, input.runId);
  try {
    const commentSet = await readValidatedVideoComments(input);
    const signals = await readJson(
      paths.videoSignalsPath,
      "VIDEO_SIGNALS_MISSING",
      "VIDEO_SIGNALS_INVALID_JSON",
      "video_analysis",
    );
    const validated = validateVideoAnalysisSet({ commentSet, signals });
    await updateImportFlags(paths.executionPath, { videoSignalsImported: true });
    return validated;
  } catch (error) {
    return wrapValidation(error, "video_analysis");
  }
}

export async function readValidatedVideoArtifactSet(input: {
  runsDirectory: string;
  runId: string;
  searchResults: SearchResultsArtifactV2;
}): Promise<ValidatedVideoArtifactSet> {
  const paths = discoveryExchangePaths(input.runsDirectory, input.runId);
  try {
    const analysis = await readValidatedVideoAnalysis(input);
    const telemetry = await readJson(
      paths.videoSourceTelemetryPath,
      "VIDEO_SOURCE_TELEMETRY_MISSING",
      "VIDEO_SOURCE_TELEMETRY_INVALID_JSON",
      "video_source_telemetry",
    );
    const validated = validateVideoArtifactSet({
      requestId: input.searchResults.requestId,
      plan: analysis.plan,
      collection: analysis.collection,
      transcriptManifest: analysis.transcriptManifest,
      transcripts: analysis.transcripts,
      commentManifest: analysis.commentManifest,
      commentCollections: analysis.commentCollections,
      signals: analysis.signals,
      telemetry,
    });
    await updateImportFlags(paths.executionPath, { videoSourceTelemetryImported: true });
    return validated;
  } catch (error) {
    return wrapValidation(error, "video_source_telemetry");
  }
}
