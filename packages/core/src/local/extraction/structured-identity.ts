import { canonicalJson, deterministicArtifactId, sha256Hex } from "./artifact-identity";
import type { ContentParseTelemetryV1 } from "./content-parse-telemetry-v1.js";
import type { StructuredContentArtifactV1 } from "./structured-content-v1.js";

export function structuredArtifactIdentityContent(
  artifact: Omit<StructuredContentArtifactV1, "artifactId">,
): unknown {
  return {
    requestId: artifact.requestId,
    artifactKind: artifact.artifactKind,
    searchResultsDigest: artifact.searchResultsDigest,
    frontierDigest: artifact.frontierDigest,
    parserPolicyVersion: artifact.parserPolicy.policyVersion,
    items: artifact.items.map((item) => ({
      ...item,
      fetchedAt: undefined,
      parsedAt: undefined,
    })),
    summary: { ...artifact.summary, totalRuntimeMs: 0 },
    coverage: artifact.coverage,
    warnings: artifact.warnings,
  };
}

export function deterministicStructuredArtifactId(
  artifact: Omit<StructuredContentArtifactV1, "artifactId">,
): string {
  const basis = [
    artifact.requestId,
    artifact.artifactKind,
    artifact.searchResultsDigest,
    artifact.frontierDigest,
    artifact.parserPolicy.policyVersion,
    canonicalJson(structuredArtifactIdentityContent(artifact)),
  ].join("\n");
  return `artifact_${sha256Hex(basis)}`;
}

export function contentParseTelemetryIdentityContent(
  artifact: Omit<ContentParseTelemetryV1, "artifactId">,
): unknown {
  return {
    ...artifact,
    startedAt: undefined,
    completedAt: undefined,
    totalRuntimeMs: 0,
    attempts: artifact.attempts.map((attempt) => ({ ...attempt, durationMs: 0 })),
  };
}

export function deterministicContentParseTelemetryId(
  artifact: Omit<ContentParseTelemetryV1, "artifactId">,
): string {
  return deterministicArtifactId(
    artifact.requestId,
    artifact.artifactKind,
    contentParseTelemetryIdentityContent(artifact),
  );
}
