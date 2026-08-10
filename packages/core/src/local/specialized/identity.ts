import {
  canonicalDigest,
  deterministicArtifactId,
  sha256Hex,
} from "../extraction/artifact-identity";
import type {
  SpecializedFindingsArtifactV1,
  SpecializedSignalsArtifactV1,
  SpecializedSourceCandidateCollectionArtifactV1,
  SpecializedSourceContextArtifactV1,
  SpecializedSourcePlanArtifactV1,
  SpecializedSourceRunTelemetryArtifactV1,
} from "./specialized-artifacts";

function deterministicId<T extends { requestId: string; artifactKind: string }>(
  artifact: Omit<T, "artifactId">,
): string {
  return deterministicArtifactId(artifact.requestId, artifact.artifactKind, artifact);
}

export const specializedArtifactDigest = canonicalDigest;
export const deterministicSpecializedContextId = (
  artifact: Omit<SpecializedSourceContextArtifactV1, "artifactId">,
): string => deterministicId(artifact);
export const deterministicSpecializedCandidatesId = (
  artifact: Omit<SpecializedSourceCandidateCollectionArtifactV1, "artifactId">,
): string => deterministicId(artifact);
export const deterministicSpecializedPlanId = (
  artifact: Omit<SpecializedSourcePlanArtifactV1, "artifactId">,
): string => deterministicId(artifact);
export const deterministicSpecializedFindingsId = (
  artifact: Omit<SpecializedFindingsArtifactV1, "artifactId">,
): string => deterministicId(artifact);
export const deterministicSpecializedSignalsId = (
  artifact: Omit<SpecializedSignalsArtifactV1, "artifactId">,
): string => deterministicId(artifact);
export const deterministicSpecializedTelemetryId = (
  artifact: Omit<SpecializedSourceRunTelemetryArtifactV1, "artifactId">,
): string => deterministicId(artifact);

export function deterministicSpecializedSelectionId(input: {
  requestId: string;
  sourceId?: string;
  candidateId?: string;
  domain: string;
}): string {
  return `specialized_selection_${sha256Hex(
    [
      input.requestId,
      input.sourceId ?? "",
      input.candidateId ?? "",
      input.domain.trim().toLowerCase(),
    ].join("\n"),
  )}`;
}
