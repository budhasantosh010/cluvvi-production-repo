import {
  BuyerHypothesesArtifactV1Schema,
  BuyerMapArtifactV1Schema,
  DiscoveryCandidatesArtifactV1Schema,
  EvidenceFindingsArtifactV1Schema,
  IdentityEnrichmentArtifactV1Schema,
  PROJECT_B_FIXTURE_WARNING,
  ProjectBFinalizationArtifactV1Schema,
  RankedOpportunitiesArtifactV1Schema,
  SearchResultsArtifactV2Schema,
  fingerprint,
  type BuyerHypothesisV1,
  type BuyerMapArtifactV1,
  type BuyerMapCoverageGapV1,
  type DiscoveryCandidateEntityV1,
  type DiscoveryCandidatesArtifactV1,
  type EvidenceFindingV1,
  type EvidenceFindingsArtifactV1,
  type EvidenceSignalType,
  type EvidenceStrength,
  type IdentityEnrichmentArtifactV1,
  type IdentityHypothesisV1,
  type LocalMission,
  type ManualContactRouteV1,
  type NormalizedDiscoveryResultV2,
  type ProjectBFinalizationArtifactV1,
  type RankedOpportunitiesArtifactV1,
  type RankedOpportunityV1,
  type RankingComponentKey,
  type RankingScoreComponentV1,
  type SearchResultsArtifactV2,
} from "@cluvvi/core";

const STALE_AFTER_DAYS = 365;
const RECENT_WITHIN_DAYS = 90;
const DAY_MS = 24 * 60 * 60 * 1000;

function clone<T>(value: T): T {
  return structuredClone(value);
}

function entityKeyForResult(result: NormalizedDiscoveryResultV2): string {
  const basis = result.domain ?? result.authorOrCompany ?? new URL(result.url).hostname;
  return `entity_${fingerprint({ basis: basis.toLowerCase() }).slice(0, 16)}`;
}

function displayNameForResult(result: NormalizedDiscoveryResultV2): string {
  return result.authorOrCompany ?? result.domain ?? new URL(result.url).hostname;
}

function daysBetween(later: string, earlier: string): number {
  return Math.max(0, (Date.parse(later) - Date.parse(earlier)) / DAY_MS);
}

function isStale(result: NormalizedDiscoveryResultV2, referenceTime: string): boolean {
  return result.publishedAt !== undefined
    ? daysBetween(referenceTime, result.publishedAt) > STALE_AFTER_DAYS
    : false;
}

function isRecent(finding: EvidenceFindingV1, referenceTime: string): boolean {
  return (
    finding.positive &&
    !finding.stale &&
    finding.provenance.publishedAt !== undefined &&
    daysBetween(referenceTime, finding.provenance.publishedAt) <= RECENT_WITHIN_DAYS
  );
}

function strengthForResult(
  result: NormalizedDiscoveryResultV2,
  stale: boolean,
  signalType: EvidenceSignalType,
): EvidenceStrength {
  if (stale || result.credibility === "low") return "weak";
  if (signalType === "risk_signal" && result.riskLevel === "high") return "strong";
  if (result.credibility === "official" || result.credibility === "high") return "strong";
  return "moderate";
}

interface FindingSpec {
  signalType: EvidenceSignalType;
  positive: boolean;
  summary: string;
}

function findingSpecs(result: NormalizedDiscoveryResultV2): FindingSpec[] {
  const company = displayNameForResult(result);
  const specs: FindingSpec[] = [];
  switch (result.signalIntent) {
    case "direct_purchase":
      specs.push({
        signalType: "problem_signal",
        positive: true,
        summary: `${company} directly described a need related to the mission.`,
      });
      break;
    case "hiring":
      specs.push({
        signalType: "hiring_signal",
        positive: true,
        summary: `${company} showed a related hiring or capacity signal.`,
      });
      break;
    case "procurement":
      specs.push({
        signalType: "procurement_signal",
        positive: true,
        summary: `${company} showed a related procurement signal.`,
      });
      break;
    case "complaint":
      specs.push(
        {
          signalType: "problem_signal",
          positive: true,
          summary: `${company} received a complaint consistent with the mission pain.`,
        },
        {
          signalType: "manual_process_signal",
          positive: true,
          summary: `${company} appears to rely on a slow manual process.`,
        },
      );
      break;
    case "recommendation_request":
      specs.push({
        signalType: "workaround_signal",
        positive: true,
        summary: `${company} asked for a recommendation or replacement approach.`,
      });
      break;
    case "competitor_switching":
      specs.push({
        signalType: "competitor_signal",
        positive: true,
        summary: `${company} showed possible competitor-switching intent.`,
      });
      break;
    case "manual_workaround":
      specs.push(
        {
          signalType: "workaround_signal",
          positive: true,
          summary: `${company} described an active workaround.`,
        },
        {
          signalType: "manual_process_signal",
          positive: true,
          summary: `${company} described repeatable manual work that may be replaceable.`,
        },
      );
      break;
    case "expansion":
      specs.push({
        signalType: "timing_signal",
        positive: true,
        summary: `${company} announced expansion that may increase urgency.`,
      });
      break;
    case "negative_evidence":
      specs.push({
        signalType: "negative_signal",
        positive: false,
        summary: `${company} published evidence that conflicts with the opportunity thesis.`,
      });
      break;
    case "general_relevance":
      specs.push({
        signalType: "company_fit_signal",
        positive: true,
        summary: `${company} appears relevant to the target market, but the signal is indirect.`,
      });
      break;
    default:
      specs.push({
        signalType: "buyer_fit_signal",
        positive: true,
        summary: `${company} matched a custom discovery signal that needs human review.`,
      });
      break;
  }
  if (result.riskLevel === "high") {
    specs.push({
      signalType: "risk_signal",
      positive: false,
      summary: `${company} has a high-risk or unverified source signal.`,
    });
  }
  return specs;
}

function strongest(findings: EvidenceFindingV1[]): EvidenceStrength | undefined {
  if (findings.some((finding) => finding.strength === "strong")) return "strong";
  if (findings.some((finding) => finding.strength === "moderate")) return "moderate";
  if (findings.some((finding) => finding.strength === "weak")) return "weak";
  return undefined;
}

export function buildDiscoveryCandidates(
  searchResults: SearchResultsArtifactV2,
  generatedAt: string,
): DiscoveryCandidatesArtifactV1 {
  const validated = SearchResultsArtifactV2Schema.parse(searchResults);
  const groups = new Map<string, DiscoveryCandidateEntityV1>();
  for (const result of validated.results) {
    const entityKey = entityKeyForResult(result);
    const current = groups.get(entityKey);
    if (current === undefined) {
      groups.set(entityKey, {
        entityKey,
        displayName: displayNameForResult(result),
        ...(result.domain === undefined ? {} : { domain: result.domain }),
        resultIds: [result.id],
        resultCount: 1,
      });
    } else {
      current.resultIds.push(result.id);
      current.resultCount += 1;
    }
  }
  return DiscoveryCandidatesArtifactV1Schema.parse({
    schemaVersion: "1.0",
    artifactKind: "discovery_candidates.v1",
    fixture: true,
    warning: PROJECT_B_FIXTURE_WARNING,
    generatedAt,
    sourceArtifact: {
      requestId: validated.requestId,
      schemaVersion: "2.0",
      artifactKind: "search_results.v2",
    },
    results: clone(validated.results),
    entities: [...groups.values()].sort((left, right) =>
      left.displayName.localeCompare(right.displayName),
    ),
    duplicatesRemoved: Math.max(0, validated.summary.rawResults - validated.summary.dedupedResults),
    coverage: clone(validated.coverage),
    warnings: [...new Set([PROJECT_B_FIXTURE_WARNING, ...validated.warnings])],
  });
}

export function buildEvidenceFindings(
  candidates: DiscoveryCandidatesArtifactV1,
  generatedAt: string,
): EvidenceFindingsArtifactV1 {
  const parsed = DiscoveryCandidatesArtifactV1Schema.parse(candidates);
  const findings: EvidenceFindingV1[] = [];
  for (const result of parsed.results) {
    const stale = isStale(result, generatedAt);
    for (const spec of findingSpecs(result)) {
      const finding = {
        id: `finding_${fingerprint({ resultId: result.id, signalType: spec.signalType }).slice(0, 16)}`,
        searchResultId: result.id,
        entityKey: entityKeyForResult(result),
        signalType: spec.signalType,
        positive: spec.positive,
        strength: strengthForResult(result, stale, spec.signalType),
        summary: spec.summary,
        supportingText: result.snippet,
        sourceUrl: result.url,
        providerId: result.providerId,
        sourceZone: result.sourceZone,
        stale,
        provenance: {
          searchResultId: result.id,
          queryId: result.queryId,
          query: result.query,
          sourceUrl: result.url,
          providerId: result.providerId,
          providerCategory: result.providerCategory,
          sourceZone: result.sourceZone,
          searchMethod: result.searchMethod,
          signalIntent: result.signalIntent,
          ...(result.publishedAt === undefined ? {} : { publishedAt: result.publishedAt }),
          discoveredAt: result.discoveredAt,
          ...(result.credibility === undefined ? {} : { credibility: result.credibility }),
          ...(result.riskLevel === undefined ? {} : { riskLevel: result.riskLevel }),
        },
      } satisfies EvidenceFindingV1;
      findings.push(finding);
    }
  }
  const entities = parsed.entities.map((entity) => {
    const entityFindings = findings.filter((finding) => finding.entityKey === entity.entityKey);
    const positive = entityFindings.filter((finding) => finding.positive);
    const negative = entityFindings.filter((finding) => !finding.positive);
    return {
      entityKey: entity.entityKey,
      displayName: entity.displayName,
      ...(entity.domain === undefined ? {} : { domain: entity.domain }),
      findingIds: entityFindings.map((finding) => finding.id),
      positiveFindingCount: positive.length,
      negativeFindingCount: negative.length,
      ...(strongest(positive) === undefined
        ? {}
        : { strongestPositiveStrength: strongest(positive) }),
      ...(strongest(negative) === undefined
        ? {}
        : { strongestNegativeStrength: strongest(negative) }),
    };
  });
  return EvidenceFindingsArtifactV1Schema.parse({
    schemaVersion: "1.0",
    artifactKind: "evidence_findings.v1",
    fixture: true,
    warning: PROJECT_B_FIXTURE_WARNING,
    generatedAt,
    sourceArtifact: parsed.sourceArtifact,
    findings,
    entities,
    coverage: parsed.coverage,
    warnings: parsed.warnings,
  });
}

function titlesForFindings(findings: EvidenceFindingV1[]): {
  department: string;
  titles: string[];
} {
  const signals = new Set(findings.map((finding) => finding.signalType));
  if (signals.has("procurement_signal") || signals.has("budget_signal")) {
    return {
      department: "Operations and procurement",
      titles: ["Operations Director", "Procurement Lead", "Founder or Managing Director"],
    };
  }
  if (signals.has("timing_signal")) {
    return {
      department: "Content and growth",
      titles: ["Head of Content", "Production Director", "VP Growth"],
    };
  }
  return {
    department: "Content operations and post-production",
    titles: ["Head of Post-Production", "Content Operations Lead", "Founder or Managing Director"],
  };
}

export function buildBuyerHypotheses(
  evidence: EvidenceFindingsArtifactV1,
  generatedAt: string,
): ReturnType<typeof BuyerHypothesesArtifactV1Schema.parse> {
  const parsed = EvidenceFindingsArtifactV1Schema.parse(evidence);
  const hypotheses: BuyerHypothesisV1[] = parsed.entities.map((entity) => {
    const findings = parsed.findings.filter((finding) => finding.entityKey === entity.entityKey);
    const positive = findings.filter((finding) => finding.positive);
    const strongPositive = positive.filter((finding) => finding.strength === "strong").length;
    const strongNegative = findings.filter(
      (finding) => !finding.positive && finding.strength === "strong",
    ).length;
    const rolePlan = titlesForFindings(findings);
    const confidence =
      strongPositive >= 2 && strongNegative === 0
        ? "high"
        : positive.length > 0 && strongNegative === 0
          ? "medium"
          : "low";
    return {
      id: `identity_hypothesis_${fingerprint({ entityKey: entity.entityKey }).slice(0, 16)}`,
      entityKey: entity.entityKey,
      companyName: entity.displayName,
      ...(entity.domain === undefined ? {} : { companyDomain: entity.domain }),
      likelyDepartment: rolePlan.department,
      likelyDecisionMakerTitles: rolePlan.titles,
      confidence,
      rationale: `${positive.length} positive and ${findings.length - positive.length} negative fixture findings support this role hypothesis. No real person was identified.`,
      sourceResultIds: [...new Set(findings.map((finding) => finding.searchResultId))],
      evidenceFindingIds: findings.map((finding) => finding.id),
    };
  });
  return BuyerHypothesesArtifactV1Schema.parse({
    schemaVersion: "1.0",
    artifactKind: "buyer_hypotheses.v1",
    fixture: true,
    warning: PROJECT_B_FIXTURE_WARNING,
    generatedAt,
    sourceArtifactKind: "evidence_findings.v1",
    hypotheses,
    warnings: [
      PROJECT_B_FIXTURE_WARNING,
      "Identity output contains role hypotheses only. No real person or private contact data was inferred.",
    ],
  });
}

function contactRouteForHypothesis(hypothesis: BuyerHypothesisV1): ManualContactRouteV1 {
  if (hypothesis.companyDomain !== undefined) {
    return {
      type: "company_website",
      label: `Review ${hypothesis.companyName}'s public website manually`,
      url: `https://${hypothesis.companyDomain}`,
      instructions:
        "Open the public company website and look for an official contact, team, or leadership page. Do not guess private contact data.",
    };
  }
  return {
    type: "manual_research",
    label: `Research ${hypothesis.companyName} manually`,
    instructions:
      "Use approved public sources to confirm the company and identify an official contact route. Do not scrape login-gated sources.",
  };
}

export function buildIdentityEnrichment(
  hypothesesArtifact: ReturnType<typeof BuyerHypothesesArtifactV1Schema.parse>,
  generatedAt: string,
): IdentityEnrichmentArtifactV1 {
  const parsed = BuyerHypothesesArtifactV1Schema.parse(hypothesesArtifact);
  const hypotheses: IdentityHypothesisV1[] = parsed.hypotheses.map((hypothesis) => ({
    ...hypothesis,
    manualContactRoute: contactRouteForHypothesis(hypothesis),
  }));
  return IdentityEnrichmentArtifactV1Schema.parse({
    schemaVersion: "1.0",
    artifactKind: "identity_enrichment.v1",
    fixture: true,
    warning: PROJECT_B_FIXTURE_WARNING,
    generatedAt,
    sourceArtifactKind: "buyer_hypotheses.v1",
    hypotheses,
    fabricatedContacts: false,
    publicManualRoutesOnly: true,
    warnings: parsed.warnings,
  });
}

function scoreComponent(
  key: RankingComponentKey,
  applied: boolean,
  points: number,
  reason: string,
): RankingScoreComponentV1 {
  return { key, applied, points: applied ? points : 0, reason };
}

function textMatchesExclusion(text: string, exclusions: string[]): boolean {
  const normalized = text.toLowerCase();
  return exclusions.some((exclusion) => {
    const candidate = exclusion.trim().toLowerCase();
    return candidate.length > 2 && normalized.includes(candidate);
  });
}

export function buildRankedOpportunities(input: {
  identity: IdentityEnrichmentArtifactV1;
  evidence: EvidenceFindingsArtifactV1;
  mission: LocalMission;
  generatedAt: string;
}): RankedOpportunitiesArtifactV1 {
  const identity = IdentityEnrichmentArtifactV1Schema.parse(input.identity);
  const evidence = EvidenceFindingsArtifactV1Schema.parse(input.evidence);
  const opportunities = identity.hypotheses.map((hypothesis) => {
    const findings = evidence.findings.filter(
      (finding) => finding.entityKey === hypothesis.entityKey,
    );
    const positive = findings.filter((finding) => finding.positive);
    const negative = findings.filter((finding) => !finding.positive);
    const hasPain = positive.some(
      (finding) =>
        (finding.signalType === "problem_signal" ||
          finding.signalType === "manual_process_signal") &&
        finding.strength !== "weak",
    );
    const hasRecent = positive.some((finding) => isRecent(finding, input.generatedAt));
    const hasHiring = positive.some((finding) => finding.signalType === "hiring_signal");
    const hasWorkaround = positive.some((finding) =>
      ["competitor_signal", "workaround_signal", "manual_process_signal"].includes(
        finding.signalType,
      ),
    );
    const hasClearCompany = hypothesis.companyDomain !== undefined;
    const hasRoute = hypothesis.manualContactRoute.instructions.length > 0;
    const exclusionText = `${hypothesis.companyName} ${hypothesis.companyDomain ?? ""} ${findings
      .map((finding) => finding.summary)
      .join(" ")}`;
    const hasExclusionConflict =
      negative.some((finding) => finding.signalType === "negative_signal") ||
      textMatchesExclusion(exclusionText, input.mission.input.exclusions);
    const weakOrStale =
      positive.length === 0 ||
      positive.every((finding) => finding.strength === "weak" || finding.stale);
    const components: RankingScoreComponentV1[] = [
      scoreComponent(
        "clear_pain",
        hasPain,
        5,
        hasPain ? "Clear pain or manual-process evidence is present." : "No clear pain signal.",
      ),
      scoreComponent(
        "recent_signal",
        hasRecent,
        3,
        hasRecent ? "At least one positive signal is recent." : "No recent positive signal.",
      ),
      scoreComponent(
        "related_hiring",
        hasHiring,
        4,
        hasHiring ? "Related hiring or capacity evidence is present." : "No related hiring signal.",
      ),
      scoreComponent(
        "competitor_or_workaround",
        hasWorkaround,
        3,
        hasWorkaround
          ? "A competitor, workaround, or manual-process signal is present."
          : "No workaround or competitor signal.",
      ),
      scoreComponent(
        "clear_company",
        hasClearCompany,
        3,
        hasClearCompany ? "A company domain is available." : "Company identity is incomplete.",
      ),
      scoreComponent(
        "decision_maker_route",
        hasRoute,
        2,
        hasRoute ? "A public manual contact route is available." : "No contact route is available.",
      ),
      scoreComponent(
        "exclusion_conflict",
        hasExclusionConflict,
        -5,
        hasExclusionConflict
          ? "Negative evidence or a mission exclusion conflicts with the opportunity."
          : "No exclusion conflict was found.",
      ),
      scoreComponent(
        "weak_or_stale_signal",
        weakOrStale,
        -3,
        weakOrStale
          ? "The positive evidence is weak, stale, or absent."
          : "The opportunity has at least one current moderate or strong signal.",
      ),
    ];
    const score = components.reduce((sum, component) => sum + component.points, 0);
    const confidence =
      score >= 14 && !hasExclusionConflict ? "high" : score >= 7 ? "medium" : "low";
    const risks = [
      ...negative.map((finding) => finding.summary),
      ...findings
        .filter((finding) => finding.provenance.riskLevel === "high")
        .map((finding) => `High-risk source: ${finding.summary}`),
      ...findings
        .filter((finding) => finding.stale)
        .map((finding) => `Stale evidence: ${finding.summary}`),
    ];
    const opportunity: Omit<RankedOpportunityV1, "rank"> = {
      id: `opportunity_${fingerprint({ entityKey: hypothesis.entityKey }).slice(0, 16)}`,
      entityKey: hypothesis.entityKey,
      companyName: hypothesis.companyName,
      ...(hypothesis.companyDomain === undefined
        ? {}
        : { companyDomain: hypothesis.companyDomain }),
      score,
      confidence,
      scoreComponents: components,
      evidenceSummary: `${positive.length} positive and ${negative.length} negative fixture findings.`,
      positiveEvidenceFindingIds: positive.map((finding) => finding.id),
      negativeEvidenceFindingIds: negative.map((finding) => finding.id),
      identityHypothesisId: hypothesis.id,
      manualContactRoute: hypothesis.manualContactRoute,
      risks: [...new Set(risks)],
      limitations: [
        PROJECT_B_FIXTURE_WARNING,
        "The score is deterministic and transparent, not a prediction of purchase behavior.",
      ],
    };
    return opportunity;
  });
  const ranked: RankedOpportunityV1[] = opportunities
    .sort(
      (left, right) =>
        right.score - left.score || left.companyName.localeCompare(right.companyName),
    )
    .map((opportunity, index) => ({ ...opportunity, rank: index + 1 }));
  return RankedOpportunitiesArtifactV1Schema.parse({
    schemaVersion: "1.0",
    artifactKind: "ranked_opportunities.v1",
    fixture: true,
    warning: PROJECT_B_FIXTURE_WARNING,
    generatedAt: input.generatedAt,
    scoringVersion: "project-b-scorecard.v1",
    opportunities: ranked,
    warnings: [
      PROJECT_B_FIXTURE_WARNING,
      "Negative and stale evidence can lower deterministic scores.",
    ],
  });
}

export function buildBuyerMap(input: {
  ranked: RankedOpportunitiesArtifactV1;
  identity: IdentityEnrichmentArtifactV1;
  evidence: EvidenceFindingsArtifactV1;
  searchResults: SearchResultsArtifactV2;
  generatedAt: string;
}): BuyerMapArtifactV1 {
  const ranked = RankedOpportunitiesArtifactV1Schema.parse(input.ranked);
  const identity = IdentityEnrichmentArtifactV1Schema.parse(input.identity);
  const evidence = EvidenceFindingsArtifactV1Schema.parse(input.evidence);
  const searchResults = SearchResultsArtifactV2Schema.parse(input.searchResults);
  const identityById = new Map(identity.hypotheses.map((item) => [item.id, item] as const));
  const opportunities = ranked.opportunities.map((opportunity) => {
    const hypothesis = identityById.get(opportunity.identityHypothesisId);
    if (hypothesis === undefined) {
      throw new Error(`Missing identity hypothesis ${opportunity.identityHypothesisId}.`);
    }
    const findings = evidence.findings.filter(
      (finding) => finding.entityKey === opportunity.entityKey,
    );
    return {
      rankedOpportunityId: opportunity.id,
      rank: opportunity.rank,
      entityKey: opportunity.entityKey,
      companyName: opportunity.companyName,
      ...(opportunity.companyDomain === undefined
        ? {}
        : { companyDomain: opportunity.companyDomain }),
      score: opportunity.score,
      confidence: opportunity.confidence,
      whyItMayBeWorthContacting: opportunity.evidenceSummary,
      likelyDecisionMakerTitles: hypothesis.likelyDecisionMakerTitles,
      likelyDepartment: hypothesis.likelyDepartment,
      manualContactRoute: hypothesis.manualContactRoute,
      evidence: findings.map((finding) => ({
        evidenceFindingId: finding.id,
        searchResultId: finding.searchResultId,
        signalType: finding.signalType,
        positive: finding.positive,
        strength: finding.strength,
        summary: finding.summary,
        sourceUrl: finding.sourceUrl,
        sourceZone: finding.sourceZone,
        ...(finding.provenance.publishedAt === undefined
          ? {}
          : { publishedAt: finding.provenance.publishedAt }),
        discoveredAt: finding.provenance.discoveredAt,
      })),
      risks: opportunity.risks,
      limitations: opportunity.limitations,
    };
  });
  const coverageGapByZone = new Map<string, BuyerMapCoverageGapV1>(
    searchResults.coverage.skippedSourceZones.map(
      (gap) =>
        [
          gap.sourceZone,
          {
            sourceZone: gap.sourceZone,
            reason: gap.reason,
            suggestedAction: `Review ${gap.sourceZone.replaceAll("_", " ")} manually or configure an approved provider later.`,
          },
        ] as const,
    ),
  );
  for (const gap of searchResults.coverage.manualReviewRecommended) {
    coverageGapByZone.set(gap.sourceZone, gap);
  }
  const coverageGaps = [...coverageGapByZone.values()];
  return BuyerMapArtifactV1Schema.parse({
    schemaVersion: "1.0",
    artifactKind: "buyer_map.v1",
    fixture: true,
    warning: PROJECT_B_FIXTURE_WARNING,
    generatedAt: input.generatedAt,
    summary: {
      rankedOpportunityCount: opportunities.length,
      positiveEvidenceCount: evidence.findings.filter((finding) => finding.positive).length,
      negativeEvidenceCount: evidence.findings.filter((finding) => !finding.positive).length,
      coverageGapCount: coverageGaps.length,
    },
    opportunities,
    coverageGaps,
    confidenceLimitations: searchResults.coverage.confidenceLimitations,
    warnings: [...new Set([...searchResults.warnings, ...ranked.warnings])],
  });
}

export function buildProjectBFinalization(input: {
  runId: string;
  buyerMap: BuyerMapArtifactV1;
  evidence: EvidenceFindingsArtifactV1;
  identity: IdentityEnrichmentArtifactV1;
  generatedAt: string;
}): ProjectBFinalizationArtifactV1 {
  const buyerMap = BuyerMapArtifactV1Schema.parse(input.buyerMap);
  const evidence = EvidenceFindingsArtifactV1Schema.parse(input.evidence);
  const identity = IdentityEnrichmentArtifactV1Schema.parse(input.identity);
  return ProjectBFinalizationArtifactV1Schema.parse({
    schemaVersion: "1.0",
    artifactKind: "project_b_finalization.v1",
    fixture: true,
    warning: PROJECT_B_FIXTURE_WARNING,
    runId: input.runId,
    generatedAt: input.generatedAt,
    outcome: "fixture_buyer_map_completed",
    rankedOpportunityCount: buyerMap.opportunities.length,
    evidenceFindingCount: evidence.findings.length,
    identityHypothesisCount: identity.hypotheses.length,
    coverageGapCount: buyerMap.coverageGaps.length,
    realOpportunitiesProduced: 0,
    nextPhase: "C1-H researched live-provider integration path",
  });
}
