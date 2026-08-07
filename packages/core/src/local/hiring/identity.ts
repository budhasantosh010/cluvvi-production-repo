import { canonicalDigest, deterministicArtifactId } from "../extraction/artifact-identity";
import type {
  HiringSignalsArtifactV1,
  JobCollectionArtifactV1,
  SourceAdapterRunTelemetryV1,
  SourceTargetPlanArtifactV1,
} from "./hiring-artifacts";

function withoutArtifactId<T extends { artifactId: string }>(value: T): Omit<T, "artifactId"> {
  return Object.fromEntries(Object.entries(value).filter(([key]) => key !== "artifactId")) as Omit<
    T,
    "artifactId"
  >;
}

export function deterministicSourceTargetPlanId(
  artifact: Omit<SourceTargetPlanArtifactV1, "artifactId">,
): string {
  return deterministicArtifactId(artifact.requestId, artifact.artifactKind, artifact);
}

export function deterministicJobCollectionId(
  artifact: Omit<JobCollectionArtifactV1, "artifactId">,
): string {
  return deterministicArtifactId(artifact.requestId, artifact.artifactKind, artifact);
}

export function deterministicHiringSignalsId(
  artifact: Omit<HiringSignalsArtifactV1, "artifactId">,
): string {
  return deterministicArtifactId(artifact.requestId, artifact.artifactKind, artifact);
}

export function deterministicSourceAdapterTelemetryId(
  artifact: Omit<SourceAdapterRunTelemetryV1, "artifactId">,
): string {
  return deterministicArtifactId(artifact.requestId, artifact.artifactKind, artifact);
}

export function validateDeterministicHiringArtifactIds(input: {
  sourceTargetPlan: SourceTargetPlanArtifactV1;
  jobCollection: JobCollectionArtifactV1;
  hiringSignals: HiringSignalsArtifactV1;
  telemetry: SourceAdapterRunTelemetryV1;
}): void {
  if (
    input.sourceTargetPlan.artifactId !==
    deterministicSourceTargetPlanId(withoutArtifactId(input.sourceTargetPlan))
  ) {
    throw new HiringArtifactValidationError(
      "SOURCE_TARGET_PLAN_INVALID",
      "The source target plan deterministic artifact ID does not agree.",
    );
  }
  if (
    input.jobCollection.artifactId !==
    deterministicJobCollectionId(withoutArtifactId(input.jobCollection))
  ) {
    throw new HiringArtifactValidationError(
      "JOB_COLLECTION_INVALID",
      "The job collection deterministic artifact ID does not agree.",
    );
  }
  if (
    input.hiringSignals.artifactId !==
    deterministicHiringSignalsId(withoutArtifactId(input.hiringSignals))
  ) {
    throw new HiringArtifactValidationError(
      "HIRING_SIGNALS_INVALID",
      "The hiring signals deterministic artifact ID does not agree.",
    );
  }
  if (
    input.telemetry.artifactId !==
    deterministicSourceAdapterTelemetryId(withoutArtifactId(input.telemetry))
  ) {
    throw new HiringArtifactValidationError(
      "SOURCE_ADAPTER_TELEMETRY_INVALID",
      "The source-adapter telemetry deterministic artifact ID does not agree.",
    );
  }
}

export function hiringArtifactDigests(input: {
  sourceTargetPlan: SourceTargetPlanArtifactV1;
  jobCollection: JobCollectionArtifactV1;
  hiringSignals: HiringSignalsArtifactV1;
  telemetry: SourceAdapterRunTelemetryV1;
}) {
  return {
    sourceTargetPlan: canonicalDigest(input.sourceTargetPlan),
    jobCollection: canonicalDigest(input.jobCollection),
    hiringSignals: canonicalDigest(input.hiringSignals),
    telemetry: canonicalDigest(input.telemetry),
  };
}

export class HiringArtifactValidationError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = "HiringArtifactValidationError";
    this.code = code;
  }
}
