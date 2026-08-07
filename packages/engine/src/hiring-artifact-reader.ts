import {
  CluvviError,
  HiringArtifactValidationError,
  LocalDiscoveryExecutionRecordV1Schema,
  type ExtractedContentArtifactV1,
  type SearchResultsArtifactV2,
  type StructuredContentArtifactV1,
} from "@cluvvi/core";
import {
  validateHiringArtifactSet,
  type ValidatedHiringArtifactSet,
} from "@cluvvi/core/hiring-validation";
import { randomUUID } from "node:crypto";
import { readFile, rename, writeFile } from "node:fs/promises";
import { discoveryExchangePaths } from "./discovery-exchange";

async function readJson(path: string, missingCode: string, invalidCode: string): Promise<unknown> {
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
        code: code === "ENOENT" ? missingCode : "HIRING_ARTIFACT_READ_FAILED",
        category: code === "ENOENT" ? "provider" : "storage",
        message:
          code === "ENOENT"
            ? `The standalone Discovery Engine did not create ${path.split(/[\\/]/).at(-1) ?? "a hiring sidecar"}.`
            : "Cluvvi could not read a hiring sidecar.",
        retryable: true,
        stage: "source_targeting",
        context: {
          path,
          retrySafe: true,
          resumeSupported: true,
          discoveryReuseExpected: true,
          frontierReuseExpected: true,
          extractionReuseExpected: true,
          structuredParsingReuseExpected: true,
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
        message: "A hiring sidecar is not valid JSON.",
        retryable: true,
        stage: "source_targeting",
        context: { path, retrySafe: true, resumeSupported: true, discoveryReuseExpected: true },
        cause: error instanceof Error ? (error.stack ?? error.message) : String(error),
      },
      { cause: error },
    );
  }
}

async function markHiringImported(path: string): Promise<void> {
  const current = LocalDiscoveryExecutionRecordV1Schema.parse(
    JSON.parse(await readFile(path, "utf8")) as unknown,
  );
  if (
    current.sourceTargetPlanImported &&
    current.jobCollectionImported &&
    current.hiringSignalsImported &&
    current.sourceAdapterTelemetryImported
  ) {
    return;
  }
  const updated = LocalDiscoveryExecutionRecordV1Schema.parse({
    ...current,
    sourceTargetPlanImported: true,
    jobCollectionImported: true,
    hiringSignalsImported: true,
    sourceAdapterTelemetryImported: true,
  });
  const temporaryPath = `${path}.${randomUUID()}.tmp`;
  await writeFile(temporaryPath, `${JSON.stringify(updated, null, 2)}\n`, {
    encoding: "utf8",
    flag: "wx",
  });
  await rename(temporaryPath, path);
}

export async function readValidatedHiringArtifactSet(input: {
  runsDirectory: string;
  runId: string;
  searchResults: SearchResultsArtifactV2;
  extractedContent?: ExtractedContentArtifactV1;
  structuredContent?: StructuredContentArtifactV1;
  providerPolicy: "free_only" | "balanced" | "paid_deep";
}): Promise<ValidatedHiringArtifactSet> {
  const paths = discoveryExchangePaths(input.runsDirectory, input.runId);
  const [sourceTargetPlan, jobCollection, hiringSignals, telemetry] = await Promise.all([
    readJson(
      paths.sourceTargetPlanPath,
      "SOURCE_TARGET_PLAN_MISSING",
      "SOURCE_TARGET_PLAN_INVALID_JSON",
    ),
    readJson(paths.jobCollectionPath, "JOB_COLLECTION_MISSING", "JOB_COLLECTION_INVALID_JSON"),
    readJson(paths.hiringSignalsPath, "HIRING_SIGNALS_MISSING", "HIRING_SIGNALS_INVALID_JSON"),
    readJson(
      paths.sourceAdapterTelemetryPath,
      "SOURCE_ADAPTER_TELEMETRY_MISSING",
      "SOURCE_ADAPTER_TELEMETRY_INVALID_JSON",
    ),
  ]);
  try {
    const validated = validateHiringArtifactSet({
      searchResults: input.searchResults,
      ...(input.extractedContent === undefined ? {} : { extractedContent: input.extractedContent }),
      ...(input.structuredContent === undefined
        ? {}
        : { structuredContent: input.structuredContent }),
      sourceTargetPlan,
      jobCollection,
      hiringSignals,
      telemetry,
      providerPolicy: input.providerPolicy,
    });
    await markHiringImported(paths.executionPath);
    return validated;
  } catch (error) {
    if (error instanceof HiringArtifactValidationError) {
      throw new CluvviError(
        {
          code: error.code,
          category:
            error.code.includes("PRIVATE") ||
            error.code.includes("FORBIDDEN") ||
            error.code.includes("PRIVATE_DATA")
              ? "security"
              : "validation",
          message: error.message,
          retryable: !error.code.includes("PRIVATE_DATA"),
          stage: "source_targeting",
          context: {
            sourceTargetPlanPath: paths.sourceTargetPlanPath,
            jobCollectionPath: paths.jobCollectionPath,
            hiringSignalsPath: paths.hiringSignalsPath,
            sourceAdapterTelemetryPath: paths.sourceAdapterTelemetryPath,
            retrySafe: true,
            resumeSupported: true,
            discoveryReuseExpected: true,
          },
        },
        { cause: error },
      );
    }
    throw error;
  }
}
