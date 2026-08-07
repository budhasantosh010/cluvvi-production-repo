import { z } from "zod";
import type { ExtractedContentArtifactV1 } from "../extraction/extracted-content-v1";
import { canonicalDigest } from "../extraction/artifact-identity";
import type { StructuredContentArtifactV1 } from "../extraction/structured-content-v1";
import type { SearchResultsArtifactV2 } from "../search-results";
import {
  HiringSignalsArtifactV1Schema,
  JobCollectionArtifactV1Schema,
  SourceAdapterRunTelemetryV1Schema,
  SourceTargetPlanArtifactV1Schema,
  type HiringProviderIdV1,
  type HiringSignalsArtifactV1,
  type JobCollectionArtifactV1,
  type SourceAccessCategoryV1,
  type SourceAdapterRunTelemetryV1,
  type SourceTargetPlanArtifactV1,
} from "./hiring-artifacts";
import { HiringArtifactValidationError, validateDeterministicHiringArtifactIds } from "./identity";

const FORBIDDEN_KEYS = new Set([
  "candidate",
  "candidateid",
  "candidateemail",
  "applicant",
  "resume",
  "resumetext",
  "coverletter",
  "applicationpayload",
  "rawhtml",
  "requestheaders",
  "responseheaders",
  "cookies",
  "authorization",
  "environment",
  "apikey",
  "secret",
]);

const PROVIDER_ACCESS: Readonly<Record<HiringProviderIdV1, SourceAccessCategoryV1>> = {
  greenhouse_public_jobs: "keyless_free",
  ashby_public_jobs: "keyless_free",
  lever_public_jobs: "keyless_free",
  workable_public_jobs: "keyless_free",
  smartrecruiters_posting_api: "authenticated_free",
  jobposting_jsonld: "keyless_free",
  generic_careers_page: "keyless_free",
};

function fail(code: string, message: string): never {
  throw new HiringArtifactValidationError(code, message);
}

function parseArtifact<T>(schema: z.ZodType<T>, value: unknown, code: string): T {
  try {
    return schema.parse(value);
  } catch (error) {
    if (error instanceof z.ZodError) {
      const orphan = error.issues.find((issue) =>
        issue.message.startsWith("HIRING_ORPHAN_REFERENCE"),
      );
      if (orphan !== undefined) {
        fail("HIRING_ORPHAN_REFERENCE", orphan.message);
      }
      fail(code, error.issues.map((issue) => issue.message).join(" "));
    }
    throw error;
  }
}

function scanForbidden(value: unknown, path: string[] = []): void {
  if (Array.isArray(value)) {
    value.forEach((entry, index) => scanForbidden(entry, [...path, String(index)]));
    return;
  }
  if (value === null || typeof value !== "object") return;
  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    const normalized = key.replace(/[_-]/g, "").toLowerCase();
    if (FORBIDDEN_KEYS.has(normalized)) {
      fail(
        "HIRING_PRIVATE_DATA_REJECTED",
        `Hiring sidecars contain forbidden field ${[...path, key].join(".")}.`,
      );
    }
    scanForbidden(child, [...path, key]);
  }
}

function ipv4Octets(value: string): number[] | null {
  const parts = value.split(".");
  if (parts.length !== 4) return null;
  const octets = parts.map((part) => (/^\d{1,3}$/.test(part) ? Number(part) : Number.NaN));
  return octets.every((part) => Number.isInteger(part) && part >= 0 && part <= 255) ? octets : null;
}

function literalIpIsPrivate(hostname: string): boolean {
  const normalized = hostname.replace(/^\[|\]$/g, "").toLowerCase();
  const ipv4 = ipv4Octets(normalized);
  if (ipv4 !== null) {
    const [a = 0, b = 0] = ipv4;
    return (
      a === 0 ||
      a === 10 ||
      a === 127 ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 198 && (b === 18 || b === 19)) ||
      a >= 224
    );
  }
  if (!normalized.includes(":")) return false;
  if (normalized === "::" || normalized === "::1") return true;
  if (/^(?:fc|fd)/.test(normalized) || /^fe[89ab]/.test(normalized) || /^ff/.test(normalized)) {
    return true;
  }
  if (normalized.startsWith("2001:db8:")) return true;
  if (normalized.startsWith("::ffff:")) {
    const mapped = normalized.slice("::ffff:".length);
    return ipv4Octets(mapped) !== null && literalIpIsPrivate(mapped);
  }
  return false;
}

function assertPublicUrl(value: string, code: string): void {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    fail(code, "Hiring sidecars contain an invalid URL.");
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    fail(code, "Hiring sidecars may contain only HTTP or HTTPS URLs.");
  }
  const hostname = url.hostname.toLowerCase().replace(/\.$/, "");
  if (
    hostname === "localhost" ||
    hostname.endsWith(".localhost") ||
    hostname.endsWith(".local") ||
    hostname.endsWith(".internal") ||
    hostname === "metadata.google.internal" ||
    literalIpIsPrivate(hostname)
  ) {
    fail(code, "Hiring sidecars contain a private or local URL.");
  }
}

export interface ValidatedHiringArtifactSet {
  sourceTargetPlan: SourceTargetPlanArtifactV1;
  jobCollection: JobCollectionArtifactV1;
  hiringSignals: HiringSignalsArtifactV1;
  telemetry: SourceAdapterRunTelemetryV1;
}

export function validateHiringArtifactSet(input: {
  searchResults: SearchResultsArtifactV2;
  extractedContent?: ExtractedContentArtifactV1;
  structuredContent?: StructuredContentArtifactV1;
  sourceTargetPlan: unknown;
  jobCollection: unknown;
  hiringSignals: unknown;
  telemetry: unknown;
  providerPolicy?: "free_only" | "balanced" | "paid_deep";
}): ValidatedHiringArtifactSet {
  scanForbidden(input.sourceTargetPlan);
  scanForbidden(input.jobCollection);
  scanForbidden(input.hiringSignals);
  scanForbidden(input.telemetry);

  const sourceTargetPlan = parseArtifact(
    SourceTargetPlanArtifactV1Schema,
    input.sourceTargetPlan,
    "SOURCE_TARGET_PLAN_INVALID",
  );
  const jobCollection = parseArtifact(
    JobCollectionArtifactV1Schema,
    input.jobCollection,
    "JOB_COLLECTION_INVALID",
  );
  const hiringSignals = parseArtifact(
    HiringSignalsArtifactV1Schema,
    input.hiringSignals,
    "HIRING_SIGNALS_INVALID",
  );
  const telemetry = parseArtifact(
    SourceAdapterRunTelemetryV1Schema,
    input.telemetry,
    "SOURCE_ADAPTER_TELEMETRY_INVALID",
  );
  validateDeterministicHiringArtifactIds({
    sourceTargetPlan,
    jobCollection,
    hiringSignals,
    telemetry,
  });
  const requestId = input.searchResults.requestId;

  if (
    [
      sourceTargetPlan.requestId,
      jobCollection.requestId,
      hiringSignals.requestId,
      telemetry.requestId,
    ].some((value) => value !== requestId)
  ) {
    fail("SOURCE_TARGET_PLAN_MISMATCH", "Hiring sidecar request IDs do not agree.");
  }
  if (sourceTargetPlan.searchResultsDigest !== canonicalDigest(input.searchResults)) {
    fail(
      "SOURCE_TARGET_PLAN_MISMATCH",
      "The source-target plan search-results digest does not agree.",
    );
  }
  if (sourceTargetPlan.structuredContentArtifactId !== undefined) {
    if (input.structuredContent === undefined) {
      fail("SOURCE_TARGET_PLAN_MISMATCH", "The referenced structured content is missing.");
    }
    if (
      sourceTargetPlan.structuredContentArtifactId !== input.structuredContent.artifactId ||
      sourceTargetPlan.structuredContentDigest !== canonicalDigest(input.structuredContent)
    ) {
      fail("SOURCE_TARGET_PLAN_MISMATCH", "The structured-content reference does not agree.");
    }
  }
  if (
    jobCollection.sourceTargetPlanArtifactId !== sourceTargetPlan.artifactId ||
    jobCollection.sourceTargetPlanDigest !== canonicalDigest(sourceTargetPlan)
  ) {
    fail("JOB_COLLECTION_MISMATCH", "The job collection source-target reference does not agree.");
  }

  const searchIds = new Set(input.searchResults.results.map((result) => result.id));
  const extractionIds = new Set(
    (input.extractedContent?.items ?? []).map((item) => item.extractionItemId),
  );
  const structuredIds = new Set(
    (input.structuredContent?.items ?? []).map((item) => item.structuredContentItemId),
  );
  const targets = new Map(sourceTargetPlan.targets.map((target) => [target.targetId, target]));
  for (const target of sourceTargetPlan.targets) {
    target.candidateCareersUrls.forEach((url) =>
      assertPublicUrl(url, "SOURCE_TARGET_PLAN_INVALID"),
    );
    target.candidateBoardUrls.forEach((url) => assertPublicUrl(url, "SOURCE_TARGET_PLAN_INVALID"));
    if (target.officialWebsiteUrlHint !== undefined) {
      assertPublicUrl(target.officialWebsiteUrlHint, "SOURCE_TARGET_PLAN_INVALID");
    }
    for (const reference of target.evidenceReferences) {
      const exists =
        reference.artifactKind === "search_results.v2"
          ? searchIds.has(reference.itemId)
          : reference.artifactKind === "extracted_content.v1"
            ? extractionIds.has(reference.itemId)
            : structuredIds.has(reference.itemId);
      if (!exists) fail("HIRING_ORPHAN_REFERENCE", "A target evidence reference does not exist.");
    }
  }

  const boards = new Map(jobCollection.boards.map((board) => [board.boardId, board]));
  for (const board of jobCollection.boards) {
    if (!targets.has(board.targetId))
      fail("HIRING_ORPHAN_REFERENCE", "A board target does not exist.");
    assertPublicUrl(board.publicBoardUrl, "JOB_COLLECTION_INVALID");
    if (board.officialCareersPageUrl !== undefined) {
      assertPublicUrl(board.officialCareersPageUrl, "JOB_COLLECTION_INVALID");
    }
    if (PROVIDER_ACCESS[board.providerId] !== board.accessCategory) {
      fail(
        "JOB_COLLECTION_INVALID",
        "A board access category does not match the frozen provider registry.",
      );
    }
  }

  const jobs = new Map(jobCollection.jobs.map((job) => [job.jobId, job]));
  for (const job of jobCollection.jobs) {
    const board = boards.get(job.boardId);
    if (
      board === undefined ||
      board.targetId !== job.targetId ||
      board.providerId !== job.sourceProviderId ||
      !targets.has(job.targetId)
    ) {
      fail("HIRING_ORPHAN_REFERENCE", "A job board, provider, or target relationship is invalid.");
    }
    assertPublicUrl(job.jobUrl, "JOB_COLLECTION_INVALID");
    if (job.applicationUrl !== undefined)
      assertPublicUrl(job.applicationUrl, "JOB_COLLECTION_INVALID");
  }

  if (
    hiringSignals.jobCollectionArtifactId !== jobCollection.artifactId ||
    hiringSignals.jobCollectionDigest !== canonicalDigest(jobCollection)
  ) {
    fail("HIRING_SIGNALS_MISMATCH", "The hiring-signals job-collection reference does not agree.");
  }
  for (const company of hiringSignals.companies) {
    if (!targets.has(company.targetId)) {
      fail("HIRING_ORPHAN_REFERENCE", "A company hiring summary target does not exist.");
    }
  }
  for (const signal of hiringSignals.signals) {
    if (!targets.has(signal.targetId))
      fail("HIRING_ORPHAN_REFERENCE", "A hiring signal target does not exist.");
    const supportingBoards = new Set<string>();
    for (const jobId of signal.supportingJobIds) {
      const job = jobs.get(jobId);
      if (job === undefined || job.targetId !== signal.targetId) {
        fail(
          "HIRING_SIGNAL_REFERENCE_INVALID",
          "A supporting job is missing or belongs to another target.",
        );
      }
      supportingBoards.add(job.boardId);
    }
    if (signal.independentBoardCount !== supportingBoards.size) {
      fail("HIRING_SIGNAL_REFERENCE_INVALID", "A signal independent-board count does not agree.");
    }
  }

  if (
    telemetry.sourceTargetPlanArtifactId !== sourceTargetPlan.artifactId ||
    telemetry.jobCollectionArtifactId !== jobCollection.artifactId ||
    telemetry.hiringSignalsArtifactId !== hiringSignals.artifactId
  ) {
    fail("SOURCE_ADAPTER_TELEMETRY_MISMATCH", "Telemetry artifact references do not agree.");
  }
  if (
    telemetry.totals.signalsGenerated !== hiringSignals.signals.length ||
    telemetry.totals.acceptedJobs !== jobCollection.summary.acceptedJobs
  ) {
    fail("SOURCE_ADAPTER_TELEMETRY_MISMATCH", "Telemetry job or signal totals do not agree.");
  }
  if (input.providerPolicy === "free_only" && telemetry.totals.paidRequests !== 0) {
    fail("SOURCE_ADAPTER_TELEMETRY_INVALID", "Paid requests are forbidden under free_only.");
  }

  return { sourceTargetPlan, jobCollection, hiringSignals, telemetry };
}

export { scanForbidden as assertNoForbiddenHiringFields };
