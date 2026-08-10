import {
  CluvviError,
  LocalDiscoveryExecutionRecordV1Schema,
  SpecializedArtifactValidationError,
  type SearchResultsArtifactV2,
  type ValidatedSpecializedAnalysisSet,
  type ValidatedSpecializedArtifactSet,
  type ValidatedSpecializedCandidateSet,
  type ValidatedSpecializedContextSet,
  type ValidatedSpecializedFindingSet,
  type ValidatedSpecializedPlanSet,
  validateSpecializedAnalysisSet,
  validateSpecializedArtifactSet,
  validateSpecializedCandidateSet,
  validateSpecializedContextArtifact,
  validateSpecializedFindingSet,
  validateSpecializedPlanSet,
} from "@cluvvi/core";
import { randomUUID } from "node:crypto";
import { readFile, rename, writeFile } from "node:fs/promises";
import { discoveryExchangePaths } from "./discovery-exchange";

type SpecializedStage =
  | "specialized_context"
  | "specialized_candidate_discovery"
  | "specialized_planning"
  | "specialized_retrieval"
  | "specialized_analysis"
  | "specialized_source_telemetry";

async function readJson(
  path: string,
  missingCode: string,
  invalidCode: string,
  stage: SpecializedStage,
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
        code: code === "ENOENT" ? missingCode : "SPECIALIZED_ARTIFACT_READ_FAILED",
        category: code === "ENOENT" ? "provider" : "storage",
        message:
          code === "ENOENT"
            ? `The standalone Discovery Engine did not create ${path.split(/[\\/]/u).at(-1) ?? "a specialized artifact"}.`
            : "Cluvvi could not read a specialized-source artifact.",
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
          videoReuseExpected: true,
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
        message: "A specialized-source artifact is not valid JSON.",
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
          videoReuseExpected: true,
        },
        cause: error instanceof Error ? (error.stack ?? error.message) : String(error),
      },
      { cause: error },
    );
  }
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

function wrapValidation(error: unknown, stage: SpecializedStage): never {
  if (error instanceof SpecializedArtifactValidationError) {
    const security =
      error.code.includes("FORBIDDEN") ||
      error.code.includes("PRIVATE") ||
      error.code.includes("URL") ||
      error.code.includes("DOMAIN") ||
      error.code.includes("ROUTE") ||
      error.code.includes("ADAPTER") ||
      error.code.includes("REGISTRY");
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
          videoReuseExpected: true,
        },
      },
      { cause: error },
    );
  }
  throw error;
}

export async function readValidatedSpecializedContext(input: {
  runsDirectory: string;
  runId: string;
  searchResults: SearchResultsArtifactV2;
}): Promise<ValidatedSpecializedContextSet> {
  const paths = discoveryExchangePaths(input.runsDirectory, input.runId);
  try {
    const context = await readJson(
      paths.specializedSourceContextPath,
      "SPECIALIZED_SOURCE_CONTEXT_MISSING",
      "SPECIALIZED_SOURCE_CONTEXT_INVALID_JSON",
      "specialized_context",
    );
    const validated = validateSpecializedContextArtifact(context, input.searchResults.requestId);
    await updateImportFlags(paths.executionPath, { specializedSourceContextImported: true });
    return validated;
  } catch (error) {
    return wrapValidation(error, "specialized_context");
  }
}

export async function readValidatedSpecializedCandidates(input: {
  runsDirectory: string;
  runId: string;
  searchResults: SearchResultsArtifactV2;
}): Promise<ValidatedSpecializedCandidateSet> {
  const paths = discoveryExchangePaths(input.runsDirectory, input.runId);
  try {
    const contextSet = await readValidatedSpecializedContext(input);
    const candidates = await readJson(
      paths.specializedSourceCandidatesPath,
      "SPECIALIZED_SOURCE_CANDIDATES_MISSING",
      "SPECIALIZED_SOURCE_CANDIDATES_INVALID_JSON",
      "specialized_candidate_discovery",
    );
    const validated = validateSpecializedCandidateSet({ contextSet, candidates });
    await updateImportFlags(paths.executionPath, { specializedSourceCandidatesImported: true });
    return validated;
  } catch (error) {
    return wrapValidation(error, "specialized_candidate_discovery");
  }
}

export async function readValidatedSpecializedPlan(input: {
  runsDirectory: string;
  runId: string;
  searchResults: SearchResultsArtifactV2;
}): Promise<ValidatedSpecializedPlanSet> {
  const paths = discoveryExchangePaths(input.runsDirectory, input.runId);
  try {
    const candidateSet = await readValidatedSpecializedCandidates(input);
    const plan = await readJson(
      paths.specializedSourcePlanPath,
      "SPECIALIZED_SOURCE_PLAN_MISSING",
      "SPECIALIZED_SOURCE_PLAN_INVALID_JSON",
      "specialized_planning",
    );
    const validated = validateSpecializedPlanSet({ candidateSet, plan });
    await updateImportFlags(paths.executionPath, { specializedSourcePlanImported: true });
    return validated;
  } catch (error) {
    return wrapValidation(error, "specialized_planning");
  }
}

export async function readValidatedSpecializedFindings(input: {
  runsDirectory: string;
  runId: string;
  searchResults: SearchResultsArtifactV2;
}): Promise<ValidatedSpecializedFindingSet> {
  const paths = discoveryExchangePaths(input.runsDirectory, input.runId);
  try {
    const planSet = await readValidatedSpecializedPlan(input);
    const findings = await readJson(
      paths.specializedFindingsPath,
      "SPECIALIZED_FINDINGS_MISSING",
      "SPECIALIZED_FINDINGS_INVALID_JSON",
      "specialized_retrieval",
    );
    const validated = validateSpecializedFindingSet({ planSet, findings });
    await updateImportFlags(paths.executionPath, { specializedFindingsImported: true });
    return validated;
  } catch (error) {
    return wrapValidation(error, "specialized_retrieval");
  }
}

export async function readValidatedSpecializedAnalysis(input: {
  runsDirectory: string;
  runId: string;
  searchResults: SearchResultsArtifactV2;
}): Promise<ValidatedSpecializedAnalysisSet> {
  const paths = discoveryExchangePaths(input.runsDirectory, input.runId);
  try {
    const findingSet = await readValidatedSpecializedFindings(input);
    const signals = await readJson(
      paths.specializedSignalsPath,
      "SPECIALIZED_SIGNALS_MISSING",
      "SPECIALIZED_SIGNALS_INVALID_JSON",
      "specialized_analysis",
    );
    const validated = validateSpecializedAnalysisSet({ findingSet, signals });
    await updateImportFlags(paths.executionPath, { specializedSignalsImported: true });
    return validated;
  } catch (error) {
    return wrapValidation(error, "specialized_analysis");
  }
}

export async function readValidatedSpecializedArtifactSet(input: {
  runsDirectory: string;
  runId: string;
  searchResults: SearchResultsArtifactV2;
}): Promise<ValidatedSpecializedArtifactSet> {
  const paths = discoveryExchangePaths(input.runsDirectory, input.runId);
  try {
    const analysis = await readValidatedSpecializedAnalysis(input);
    const telemetry = await readJson(
      paths.specializedSourceTelemetryPath,
      "SPECIALIZED_SOURCE_TELEMETRY_MISSING",
      "SPECIALIZED_SOURCE_TELEMETRY_INVALID_JSON",
      "specialized_source_telemetry",
    );
    const validated = validateSpecializedArtifactSet({
      requestId: input.searchResults.requestId,
      context: analysis.context,
      candidates: analysis.candidates,
      plan: analysis.plan,
      findings: analysis.findings,
      signals: analysis.signals,
      telemetry,
    });
    await updateImportFlags(paths.executionPath, { specializedSourceTelemetryImported: true });
    return validated;
  } catch (error) {
    return wrapValidation(error, "specialized_source_telemetry");
  }
}
