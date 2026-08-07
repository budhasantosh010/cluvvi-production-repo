import {
  CluvviError,
  ExtractionArtifactValidationError,
  LocalDiscoveryExecutionRecordV1Schema,
  validateExtractionArtifactSet,
  type SearchResultsArtifactV2,
  type ValidatedExtractionArtifactSet,
} from "@cluvvi/core";
import { randomUUID } from "node:crypto";
import { readFile, rename, writeFile } from "node:fs/promises";
import { discoveryExchangePaths } from "./discovery-exchange";

async function readJson(path: string, missingCode: string, invalidCode: string): Promise<unknown> {
  let content: string;
  try {
    content = await readFile(path, "utf8");
  } catch (error) {
    const code =
      error !== null &&
      typeof error === "object" &&
      "code" in error &&
      typeof (error as { code?: unknown }).code === "string"
        ? (error as { code: string }).code
        : undefined;
    throw new CluvviError(
      {
        code: code === "ENOENT" ? missingCode : "EXTRACTION_ARTIFACT_READ_FAILED",
        category: code === "ENOENT" ? "provider" : "storage",
        message:
          code === "ENOENT"
            ? `The standalone Discovery Engine did not create ${path.split(/[\\/]/).at(-1) ?? "an extraction sidecar"}.`
            : "Cluvvi could not read an extraction sidecar.",
        retryable: true,
        stage: "frontier",
        context: { path, retrySafe: true, resumeSupported: true, discoveryReuseExpected: true },
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
        message: "An extraction sidecar is not valid JSON.",
        retryable: true,
        stage: "frontier",
        context: { path, retrySafe: true, resumeSupported: true, discoveryReuseExpected: true },
        cause: error instanceof Error ? (error.stack ?? error.message) : String(error),
      },
      { cause: error },
    );
  }
}

async function markExtractionImported(path: string): Promise<void> {
  const current = LocalDiscoveryExecutionRecordV1Schema.parse(
    JSON.parse(await readFile(path, "utf8")) as unknown,
  );
  if (
    current.frontierImported &&
    current.extractedContentImported &&
    current.extractionTelemetryImported
  ) {
    return;
  }
  const updated = LocalDiscoveryExecutionRecordV1Schema.parse({
    ...current,
    frontierImported: true,
    extractedContentImported: true,
    extractionTelemetryImported: true,
  });
  const temporaryPath = `${path}.${randomUUID()}.tmp`;
  await writeFile(temporaryPath, `${JSON.stringify(updated, null, 2)}\n`, {
    encoding: "utf8",
    flag: "wx",
  });
  await rename(temporaryPath, path);
}

export async function readValidatedExtractionArtifactSet(input: {
  runsDirectory: string;
  runId: string;
  searchResults: SearchResultsArtifactV2;
}): Promise<ValidatedExtractionArtifactSet> {
  const paths = discoveryExchangePaths(input.runsDirectory, input.runId);
  // Preserve deterministic failure precedence across companion files. A missing frontier
  // must win before content, and missing content must win before telemetry, rather than
  // depending on which Promise rejects first on the local filesystem.
  const frontier = await readJson(
    paths.frontierPath,
    "CRAWL_FRONTIER_MISSING",
    "CRAWL_FRONTIER_INVALID_JSON",
  );
  const extractedContent = await readJson(
    paths.extractedContentPath,
    "EXTRACTED_CONTENT_MISSING",
    "EXTRACTED_CONTENT_INVALID_JSON",
  );
  const telemetry = await readJson(
    paths.extractionTelemetryPath,
    "EXTRACTION_TELEMETRY_MISSING",
    "EXTRACTION_TELEMETRY_INVALID_JSON",
  );
  try {
    const validated = validateExtractionArtifactSet(
      input.searchResults,
      frontier,
      extractedContent,
      telemetry,
    );
    await markExtractionImported(paths.executionPath);
    return validated;
  } catch (error) {
    if (error instanceof ExtractionArtifactValidationError) {
      throw new CluvviError(
        {
          code: error.code,
          category:
            error.code.includes("PRIVATE_URL") || error.code.includes("FORBIDDEN_FIELD")
              ? "security"
              : "validation",
          message: error.message,
          retryable: !error.code.includes("PRIVATE_URL"),
          stage: "frontier",
          context: {
            frontierPath: paths.frontierPath,
            extractedContentPath: paths.extractedContentPath,
            extractionTelemetryPath: paths.extractionTelemetryPath,
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
