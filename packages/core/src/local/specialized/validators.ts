import {
  SpecializedFindingsArtifactV1Schema,
  SpecializedSignalsArtifactV1Schema,
  SpecializedSourceCandidateCollectionArtifactV1Schema,
  SpecializedSourceContextArtifactV1Schema,
  SpecializedSourcePlanArtifactV1Schema,
  SpecializedSourceRunTelemetryArtifactV1Schema,
  type SpecializedFindingsArtifactV1,
  type SpecializedSignalsArtifactV1,
  type SpecializedSourceCandidateCollectionArtifactV1,
  type SpecializedSourceContextArtifactV1,
  type SpecializedSourcePlanArtifactV1,
  type SpecializedSourceRunTelemetryArtifactV1,
} from "./specialized-artifacts";
import {
  deterministicSpecializedCandidatesId,
  deterministicSpecializedContextId,
  deterministicSpecializedFindingsId,
  deterministicSpecializedPlanId,
  deterministicSpecializedSignalsId,
  deterministicSpecializedTelemetryId,
} from "./identity";

export const SPECIALIZED_DEDICATED_ADAPTER_ALLOWLIST = new Set([
  "arxiv_public_api",
  "techmeme_public_archive",
  "digg_ai_clusters",
]);

const FORBIDDEN_FIELD =
  /(?:^|_)(?:authorization|token|password|cookie|cookies|proxy|privateResource|privateUrl|rawResponseHeaders|rawBody|environment|command|binaryPath|shellArguments|accessToken|refreshToken|emailAddress|phoneNumber)(?:$|_)/iu;

export class SpecializedArtifactValidationError extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "SpecializedArtifactValidationError";
  }
}

function fail(code: string, message: string): never {
  throw new SpecializedArtifactValidationError(code, message);
}

function scanForbidden(value: unknown, path = "artifact"): void {
  if (Array.isArray(value)) {
    value.forEach((entry, index) => scanForbidden(entry, `${path}[${String(index)}]`));
    return;
  }
  if (value === null || typeof value !== "object") return;
  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    if (FORBIDDEN_FIELD.test(key)) {
      fail("SPECIALIZED_FORBIDDEN_FIELD", `Forbidden imported field at ${path}.${key}.`);
    }
    scanForbidden(child, `${path}.${key}`);
  }
}

function withoutArtifactId<T extends { artifactId: string }>(value: T): Omit<T, "artifactId"> {
  return Object.fromEntries(Object.entries(value).filter(([key]) => key !== "artifactId")) as Omit<
    T,
    "artifactId"
  >;
}

function candidateArtifactIdMatches(
  candidates: SpecializedSourceCandidateCollectionArtifactV1,
): boolean {
  const withoutId = withoutArtifactId(candidates);
  if (candidates.artifactId === deterministicSpecializedCandidatesId(withoutId)) return true;

  // Project A's pinned C1-J.5 runner snapshots the candidate ID before later dedicated-adapter
  // degradation warnings are appended to the same warnings array by reference. Accept only that
  // narrow compatibility shape: every substantive field must be identical and the persisted ID
  // must match one prefix of the final warning list.
  for (let length = 0; length < candidates.warnings.length; length += 1) {
    if (
      candidates.artifactId ===
      deterministicSpecializedCandidatesId({
        ...withoutId,
        warnings: candidates.warnings.slice(0, length),
      })
    ) {
      return true;
    }
  }
  return false;
}

function parseArtifact<T>(schema: { parse(value: unknown): T }, value: unknown, code: string): T {
  try {
    return schema.parse(value);
  } catch (error) {
    if (error instanceof SpecializedArtifactValidationError) throw error;
    fail(code, error instanceof Error ? error.message : "Specialized artifact validation failed.");
  }
}

function publicHttpsUrl(value: string): boolean {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:") return false;
    const host = url.hostname.toLowerCase();
    if (
      host === "localhost" ||
      host.endsWith(".localhost") ||
      /^127\./u.test(host) ||
      /^10\./u.test(host) ||
      /^192\.168\./u.test(host) ||
      /^169\.254\./u.test(host) ||
      /^172\.(?:1[6-9]|2\d|3[01])\./u.test(host) ||
      host === "::1"
    ) {
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

function sameDeclaredDomain(urlValue: string, domain: string): boolean {
  try {
    const host = new URL(urlValue).hostname.replace(/^www\./u, "").toLowerCase();
    const normalized = domain.replace(/^www\./u, "").toLowerCase();
    return host === normalized || host.endsWith(`.${normalized}`);
  } catch {
    return false;
  }
}

function assertRequestId(requestId: string, artifacts: Array<{ requestId: string }>): void {
  if (artifacts.some((artifact) => artifact.requestId !== requestId)) {
    fail(
      "SPECIALIZED_REQUEST_MISMATCH",
      "All imported specialized artifacts must belong to one discovery request.",
    );
  }
}

function validateSelectionRoutes(
  selections: SpecializedSourcePlanArtifactV1["knownSources"],
  kind: "known" | "dynamic",
): void {
  for (const selection of selections) {
    if (kind === "known") {
      if (!selection.registered || selection.sourceId === undefined) {
        fail(
          "SPECIALIZED_PLAN_INVALID",
          "Known specialized selections must be registered sources.",
        );
      }
    } else if (
      selection.registered ||
      selection.candidateId === undefined ||
      selection.selectedRoute.route === "dedicated_adapter"
    ) {
      fail(
        "SPECIALIZED_DYNAMIC_ROUTE_INVALID",
        "Dynamic specialized selections must remain unregistered and cannot invent dedicated adapters.",
      );
    }
    if (
      selection.selectedRoute.route === "dedicated_adapter" &&
      !SPECIALIZED_DEDICATED_ADAPTER_ALLOWLIST.has(selection.selectedRoute.adapterId)
    ) {
      fail(
        "SPECIALIZED_DEDICATED_ADAPTER_INVALID",
        "Specialized plan references an unapproved dedicated adapter.",
      );
    }
    if (
      selection.selectedRoute.route === "generic_feed" &&
      !sameDeclaredDomain(selection.selectedRoute.feedUrl, selection.domain)
    ) {
      fail(
        "SPECIALIZED_FEED_DOMAIN_MISMATCH",
        "Trusted specialized feed URL must stay on the declared source domain.",
      );
    }
  }
}

export interface ValidatedSpecializedContextSet {
  context: SpecializedSourceContextArtifactV1;
}
export interface ValidatedSpecializedCandidateSet extends ValidatedSpecializedContextSet {
  candidates: SpecializedSourceCandidateCollectionArtifactV1;
}
export interface ValidatedSpecializedPlanSet extends ValidatedSpecializedCandidateSet {
  plan: SpecializedSourcePlanArtifactV1;
}
export interface ValidatedSpecializedFindingSet extends ValidatedSpecializedPlanSet {
  findings: SpecializedFindingsArtifactV1;
}
export interface ValidatedSpecializedAnalysisSet extends ValidatedSpecializedFindingSet {
  signals: SpecializedSignalsArtifactV1;
}
export interface ValidatedSpecializedArtifactSet extends ValidatedSpecializedAnalysisSet {
  telemetry: SpecializedSourceRunTelemetryArtifactV1;
}

export function validateSpecializedContextArtifact(
  input: unknown,
  expectedRequestId?: string,
): ValidatedSpecializedContextSet {
  scanForbidden(input);
  const context = parseArtifact(
    SpecializedSourceContextArtifactV1Schema,
    input,
    "SPECIALIZED_CONTEXT_INVALID",
  );
  if (expectedRequestId !== undefined && context.requestId !== expectedRequestId) {
    fail("SPECIALIZED_REQUEST_MISMATCH", "Specialized context does not belong to this request.");
  }
  if (context.derivation.sourceRequestId !== context.requestId) {
    fail("SPECIALIZED_CONTEXT_INVALID", "Specialized context derivation request ID mismatch.");
  }
  if (context.artifactId !== deterministicSpecializedContextId(withoutArtifactId(context))) {
    fail("SPECIALIZED_CONTEXT_INVALID", "Deterministic specialized context ID mismatch.");
  }
  return { context };
}

export function validateSpecializedCandidateSet(input: {
  contextSet: ValidatedSpecializedContextSet;
  candidates: unknown;
}): ValidatedSpecializedCandidateSet {
  scanForbidden(input.candidates);
  const candidates = parseArtifact(
    SpecializedSourceCandidateCollectionArtifactV1Schema,
    input.candidates,
    "SPECIALIZED_CANDIDATES_INVALID",
  );
  assertRequestId(input.contextSet.context.requestId, [candidates]);
  if (!candidateArtifactIdMatches(candidates)) {
    fail("SPECIALIZED_CANDIDATES_INVALID", "Deterministic candidate collection ID mismatch.");
  }
  if (candidates.specializedSourceContextArtifactId !== input.contextSet.context.artifactId) {
    fail("SPECIALIZED_LINEAGE_INVALID", "Candidate collection references the wrong context.");
  }
  const emittedCandidateDomains = new Set(candidates.candidates.map((item) => item.domain)).size;
  const acceptedCandidates = candidates.candidates.filter((item) => item.selected).length;
  const rejectedCandidates = candidates.candidates.filter((item) => !item.selected).length;
  if (
    candidates.summary.uniqueDomains < emittedCandidateDomains ||
    candidates.summary.candidatesAccepted !== acceptedCandidates ||
    candidates.summary.candidatesRejected !== rejectedCandidates ||
    acceptedCandidates + rejectedCandidates !== candidates.candidates.length
  ) {
    fail("SPECIALIZED_CANDIDATES_INVALID", "Specialized candidate totals do not reconcile.");
  }
  for (const candidate of candidates.candidates) {
    if (candidate.discoveredUrls.some((url) => !publicHttpsUrl(url))) {
      fail("SPECIALIZED_URL_INVALID", "Dynamic specialized candidate contains a non-public URL.");
    }
    if (candidate.availableRoutes.some((route) => route.route === "dedicated_adapter")) {
      fail(
        "SPECIALIZED_DYNAMIC_ROUTE_INVALID",
        "Dynamic candidates cannot acquire executable dedicated-adapter capability.",
      );
    }
    if (
      candidate.availableRoutes.some(
        (route) =>
          route.route === "generic_feed" && !sameDeclaredDomain(route.feedUrl, candidate.domain),
      )
    ) {
      fail(
        "SPECIALIZED_FEED_DOMAIN_MISMATCH",
        "Dynamic candidate feed route leaves the candidate domain.",
      );
    }
  }
  return { ...input.contextSet, candidates };
}

export function validateSpecializedPlanSet(input: {
  candidateSet: ValidatedSpecializedCandidateSet;
  plan: unknown;
}): ValidatedSpecializedPlanSet {
  scanForbidden(input.plan);
  const plan = parseArtifact(
    SpecializedSourcePlanArtifactV1Schema,
    input.plan,
    "SPECIALIZED_PLAN_INVALID",
  );
  assertRequestId(input.candidateSet.context.requestId, [plan]);
  if (plan.artifactId !== deterministicSpecializedPlanId(withoutArtifactId(plan))) {
    fail("SPECIALIZED_PLAN_INVALID", "Deterministic specialized plan ID mismatch.");
  }
  if (plan.contextArtifactId !== input.candidateSet.context.artifactId) {
    fail("SPECIALIZED_LINEAGE_INVALID", "Specialized plan references the wrong context.");
  }
  validateSelectionRoutes(plan.knownSources, "known");
  validateSelectionRoutes(plan.selectedDynamicSources, "dynamic");
  const candidateIds = new Set(
    input.candidateSet.candidates.candidates.map((item) => item.candidateId),
  );
  for (const selection of plan.selectedDynamicSources) {
    if (selection.candidateId === undefined || !candidateIds.has(selection.candidateId)) {
      fail("SPECIALIZED_PLAN_INVALID", "Specialized plan selected an unknown dynamic candidate.");
    }
  }
  if (!plan.dynamicDiscoveryTriggered && plan.selectedDynamicSources.length > 0) {
    fail("SPECIALIZED_PLAN_INVALID", "Dynamic sources require dynamicDiscoveryTriggered=true.");
  }
  return { ...input.candidateSet, plan };
}

export function validateSpecializedFindingSet(input: {
  planSet: ValidatedSpecializedPlanSet;
  findings: unknown;
}): ValidatedSpecializedFindingSet {
  scanForbidden(input.findings);
  const findings = parseArtifact(
    SpecializedFindingsArtifactV1Schema,
    input.findings,
    "SPECIALIZED_FINDINGS_INVALID",
  );
  assertRequestId(input.planSet.context.requestId, [findings]);
  if (findings.artifactId !== deterministicSpecializedFindingsId(withoutArtifactId(findings))) {
    fail("SPECIALIZED_FINDINGS_INVALID", "Deterministic specialized findings ID mismatch.");
  }
  if (findings.specializedSourcePlanArtifactId !== input.planSet.plan.artifactId) {
    fail("SPECIALIZED_LINEAGE_INVALID", "Specialized findings reference the wrong plan.");
  }
  if (findings.summary.findingsAccepted !== findings.findings.length) {
    fail("SPECIALIZED_FINDINGS_INVALID", "Specialized findings total does not reconcile.");
  }
  const knownIds = new Set(
    input.planSet.plan.knownSources.flatMap((selection) =>
      selection.sourceId === undefined ? [] : [selection.sourceId],
    ),
  );
  const dynamicIds = new Set(
    input.planSet.plan.selectedDynamicSources.flatMap((selection) =>
      selection.candidateId === undefined ? [] : [selection.candidateId],
    ),
  );
  const findingIds = new Set<string>();
  for (const finding of findings.findings) {
    if (findingIds.has(finding.findingId)) {
      fail("SPECIALIZED_FINDINGS_INVALID", "Specialized finding IDs must be unique.");
    }
    findingIds.add(finding.findingId);
    if (!publicHttpsUrl(finding.url) || finding.relatedUrls.some((url) => !publicHttpsUrl(url))) {
      fail("SPECIALIZED_URL_INVALID", "Specialized finding contains a non-public URL.");
    }
    if (finding.pdfUrl !== undefined && !publicHttpsUrl(finding.pdfUrl)) {
      fail("SPECIALIZED_URL_INVALID", "Specialized PDF URL is not public HTTPS.");
    }
    if (finding.sourceId !== undefined && !knownIds.has(finding.sourceId)) {
      fail("SPECIALIZED_FINDING_ORPHAN", "Specialized finding references an unknown source.");
    }
    if (finding.candidateId !== undefined && !dynamicIds.has(finding.candidateId)) {
      fail("SPECIALIZED_FINDING_ORPHAN", "Specialized finding references an unknown candidate.");
    }
    if (finding.sourceId === undefined && finding.candidateId === undefined) {
      fail("SPECIALIZED_FINDING_ORPHAN", "Specialized finding must reference its selected source.");
    }
  }
  return { ...input.planSet, findings };
}

export function validateSpecializedAnalysisSet(input: {
  findingSet: ValidatedSpecializedFindingSet;
  signals: unknown;
}): ValidatedSpecializedAnalysisSet {
  scanForbidden(input.signals);
  const signals = parseArtifact(
    SpecializedSignalsArtifactV1Schema,
    input.signals,
    "SPECIALIZED_SIGNALS_INVALID",
  );
  assertRequestId(input.findingSet.context.requestId, [signals]);
  if (signals.artifactId !== deterministicSpecializedSignalsId(withoutArtifactId(signals))) {
    fail("SPECIALIZED_SIGNALS_INVALID", "Deterministic specialized signals ID mismatch.");
  }
  if (signals.specializedFindingsArtifactId !== input.findingSet.findings.artifactId) {
    fail(
      "SPECIALIZED_LINEAGE_INVALID",
      "Specialized signals reference the wrong findings artifact.",
    );
  }
  if (
    signals.summary.findingsAnalyzed !== input.findingSet.findings.findings.length ||
    signals.summary.signalsGenerated !== signals.signals.length
  ) {
    fail("SPECIALIZED_SIGNALS_INVALID", "Specialized signal totals do not reconcile.");
  }
  const findingsById = new Map(
    input.findingSet.findings.findings.map((finding) => [finding.findingId, finding]),
  );
  for (const signal of signals.signals) {
    const supporting = signal.supportingFindingIds.map((id) => findingsById.get(id));
    if (supporting.some((finding) => finding === undefined)) {
      fail(
        "SPECIALIZED_SIGNAL_REFERENCE_INVALID",
        "Specialized signal references unknown findings.",
      );
    }
    const independent = new Set(
      supporting.flatMap((finding) => (finding === undefined ? [] : [finding.sourceDomain])),
    ).size;
    if (signal.independentSourceCount > independent) {
      fail(
        "SPECIALIZED_SIGNALS_INVALID",
        "Independent source count exceeds supporting source domains.",
      );
    }
  }
  return { ...input.findingSet, signals };
}

export function validateSpecializedArtifactSet(input: {
  requestId: string;
  context: unknown;
  candidates: unknown;
  plan: unknown;
  findings: unknown;
  signals: unknown;
  telemetry: unknown;
}): ValidatedSpecializedArtifactSet {
  const contextSet = validateSpecializedContextArtifact(input.context, input.requestId);
  const candidateSet = validateSpecializedCandidateSet({
    contextSet,
    candidates: input.candidates,
  });
  const planSet = validateSpecializedPlanSet({ candidateSet, plan: input.plan });
  const findingSet = validateSpecializedFindingSet({ planSet, findings: input.findings });
  const analysisSet = validateSpecializedAnalysisSet({ findingSet, signals: input.signals });
  scanForbidden(input.telemetry);
  const telemetry = parseArtifact(
    SpecializedSourceRunTelemetryArtifactV1Schema,
    input.telemetry,
    "SPECIALIZED_SOURCE_TELEMETRY_INVALID",
  );
  assertRequestId(analysisSet.context.requestId, [telemetry]);
  if (telemetry.artifactId !== deterministicSpecializedTelemetryId(withoutArtifactId(telemetry))) {
    fail(
      "SPECIALIZED_SOURCE_TELEMETRY_INVALID",
      "Deterministic specialized telemetry ID mismatch.",
    );
  }
  if (
    telemetry.findings !== analysisSet.findings.findings.length ||
    telemetry.signals !== analysisSet.signals.signals.length ||
    telemetry.coverageBefore !== analysisSet.plan.coverageBeforeDiscovery.overallScore ||
    telemetry.coverageAfter !== analysisSet.plan.coverageAfterDiscovery.overallScore ||
    telemetry.dynamicDiscoveryTriggered !== analysisSet.plan.dynamicDiscoveryTriggered ||
    telemetry.candidateDomains !== analysisSet.candidates.candidates.length ||
    telemetry.selectedRegisteredSources !== analysisSet.plan.knownSources.length ||
    telemetry.selectedDynamicSources !== analysisSet.plan.selectedDynamicSources.length
  ) {
    fail("SPECIALIZED_SOURCE_TELEMETRY_INVALID", "Specialized telemetry totals do not reconcile.");
  }
  return { ...analysisSet, telemetry };
}
