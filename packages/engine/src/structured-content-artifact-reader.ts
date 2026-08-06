import {
  CluvviError,
  LocalDiscoveryExecutionRecordV1Schema,
  StructuredContentValidationError,
  validateStructuredContentArtifactSet,
  type SearchResultsArtifactV2,
  type ValidatedExtractionArtifactSet,
  type ValidatedStructuredContentArtifactSet,
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
        code: code === "ENOENT" ? missingCode : "STRUCTURED_CONTENT_ARTIFACT_READ_FAILED",
        category: code === "ENOENT" ? "provider" : "storage",
        message:
          code === "ENOENT"
            ? `The standalone Discovery Engine did not create ${path.split(/[\\/]/).at(-1) ?? "a structured-content sidecar"}.`
            : "Cluvvi could not read a structured-content sidecar.",
        retryable: true,
        stage: "structured_parsing",
        context: {
          path,
          retrySafe: true,
          resumeSupported: true,
          discoveryReuseExpected: true,
          frontierReuseExpected: true,
          extractionReuseExpected: true,
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
        message: "A structured-content sidecar is not valid JSON.",
        retryable: true,
        stage: "structured_parsing",
        context: {
          path,
          retrySafe: true,
          resumeSupported: true,
          discoveryReuseExpected: true,
          frontierReuseExpected: true,
          extractionReuseExpected: true,
        },
        cause: error instanceof Error ? (error.stack ?? error.message) : String(error),
      },
      { cause: error },
    );
  }
}

async function markStructuredContentImported(path: string): Promise<void> {
  const current = LocalDiscoveryExecutionRecordV1Schema.parse(
    JSON.parse(await readFile(path, "utf8")) as unknown,
  );
  if (current.structuredContentImported && current.contentParseTelemetryImported) return;
  const updated = LocalDiscoveryExecutionRecordV1Schema.parse({
    ...current,
    structuredContentImported: true,
    contentParseTelemetryImported: true,
  });
  const temporaryPath = `${path}.${randomUUID()}.tmp`;
  await writeFile(temporaryPath, `${JSON.stringify(updated, null, 2)}\n`, {
    encoding: "utf8",
    flag: "wx",
  });
  await rename(temporaryPath, path);
}

export async function readValidatedStructuredContentArtifactSet(input: {
  runsDirectory: string;
  runId: string;
  searchResults: SearchResultsArtifactV2;
  extraction: ValidatedExtractionArtifactSet;
}): Promise<ValidatedStructuredContentArtifactSet> {
  const paths = discoveryExchangePaths(input.runsDirectory, input.runId);
  const [structuredContent, telemetry] = await Promise.all([
    readJson(
      paths.structuredContentPath,
      "STRUCTURED_CONTENT_MISSING",
      "STRUCTURED_CONTENT_INVALID_JSON",
    ),
    readJson(
      paths.contentParseTelemetryPath,
      "CONTENT_PARSE_TELEMETRY_MISSING",
      "CONTENT_PARSE_TELEMETRY_INVALID_JSON",
    ),
  ]);
  try {
    const validated = validateStructuredContentArtifactSet(
      input.searchResults,
      input.extraction.frontier,
      input.extraction.extractedContent,
      structuredContent,
      telemetry,
    );
    await markStructuredContentImported(paths.executionPath);
    return validated;
  } catch (error) {
    if (error instanceof StructuredContentValidationError) {
      const security =
        error.code.includes("PRIVATE_URL") ||
        error.code.includes("BINARY_DATA") ||
        error.code.includes("FORBIDDEN_FIELD");
      throw new CluvviError(
        {
          code: error.code,
          category: security ? "security" : "validation",
          message: error.message,
          retryable: !security,
          stage: "structured_parsing",
          context: {
            structuredContentPath: paths.structuredContentPath,
            contentParseTelemetryPath: paths.contentParseTelemetryPath,
            retrySafe: true,
            resumeSupported: true,
            discoveryReuseExpected: true,
            frontierReuseExpected: true,
            extractionReuseExpected: true,
          },
        },
        { cause: error },
      );
    }
    throw error;
  }
}
