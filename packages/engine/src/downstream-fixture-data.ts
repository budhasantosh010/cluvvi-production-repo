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
  type ValidatedCommunityAnalysisSet,
  type ValidatedDeveloperAnalysisSet,
  type DiscoveryCandidateEntityV1,
  type DiscoveryCandidatesArtifactV1,
  type EvidenceFindingV1,
  type EvidenceFindingsArtifactV1,
  type EvidenceMaterialV1,
  type EvidenceSignalType,
  type EvidenceStrength,
  type ExtractedContentArtifactV1,
  type HiringSignalsArtifactV1,
  type IdentityEnrichmentArtifactV1,
  type IdentityHypothesisV1,
  type JobCollectionArtifactV1,
  type LocalMission,
  type ManualContactRouteV1,
  type NormalizedDiscoveryResultV2,
  type ProjectBFinalizationArtifactV1,
  type RankedOpportunitiesArtifactV1,
  type RankedOpportunityV1,
  type RankingComponentKey,
  type RankingScoreComponentV1,
  type SearchResultsArtifactV2,
  type StructuredContentArtifactV1,
} from "@cluvvi/core";
import { buildEvidenceMaterials } from "./extracted-evidence-materials";

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

function matchingHiringResult(
  candidates: DiscoveryCandidatesArtifactV1,
  input: { companyDomain?: string | undefined; companyName: string; sourceUrl: string },
): NormalizedDiscoveryResultV2 | undefined {
  const domain = input.companyDomain?.toLowerCase();
  return (
    candidates.results.find(
      (result) => domain !== undefined && result.domain?.toLowerCase() === domain,
    ) ??
    candidates.results.find(
      (result) => result.authorOrCompany?.toLowerCase() === input.companyName.toLowerCase(),
    ) ??
    candidates.results.find((result) => {
      try {
        return new URL(result.url).hostname === new URL(input.sourceUrl).hostname;
      } catch {
        return false;
      }
    }) ??
    candidates.results[0]
  );
}

function hiringEvidence(input: {
  candidates: DiscoveryCandidatesArtifactV1;
  jobCollection?: JobCollectionArtifactV1;
  hiringSignals?: HiringSignalsArtifactV1;
  generatedAt: string;
}): { materials: EvidenceMaterialV1[]; findings: EvidenceFindingV1[] } {
  if (input.jobCollection === undefined || input.hiringSignals === undefined) {
    return { materials: [], findings: [] };
  }
  const boardById = new Map(input.jobCollection.boards.map((board) => [board.boardId, board]));
  const materials: EvidenceMaterialV1[] = [];
  const findings: EvidenceFindingV1[] = [];
  for (const job of input.jobCollection.jobs) {
    const result = matchingHiringResult(input.candidates, {
      companyName: job.companyName,
      ...(job.companyDomain === undefined ? {} : { companyDomain: job.companyDomain }),
      sourceUrl: job.jobUrl,
    });
    if (result === undefined) continue;
    const board = boardById.get(job.boardId);
    if (board === undefined) continue;
    const materialId = `material_hiring_job_${job.jobId}`;
    const content = [
      job.title,
      job.department,
      job.workplaceType === "unspecified" ? undefined : job.workplaceType.replace("_", " "),
      job.locations.map((location) => location.rawText).join(", "),
      job.descriptionText,
    ]
      .filter((value): value is string => value !== undefined && value.length > 0)
      .join(" — ")
      .slice(0, 20_000);
    const material: EvidenceMaterialV1 = {
      id: materialId,
      searchResultId: result.id,
      entityKey: entityKeyForResult(result),
      kind: "public_job_posting",
      sourceUrl: job.jobUrl,
      content,
      contentHash: job.contentHash,
      trustClassification: "untrusted_public_content",
      targetId: job.targetId,
      boardId: job.boardId,
      jobId: job.jobId,
      hiringProviderId: job.sourceProviderId,
      accessCategory: board.accessCategory,
      companyName: job.companyName,
      ...(job.companyDomain === undefined ? {} : { companyDomain: job.companyDomain }),
      ...(job.roleFamily === undefined ? {} : { roleFamily: job.roleFamily }),
      ...(job.seniority === undefined ? {} : { seniority: job.seniority }),
      workplaceType: job.workplaceType,
      ...(job.department === undefined ? {} : { department: job.department }),
      technologyMentions: job.technologyMentions.map((mention) => mention.canonicalName),
      confidence: board.relationshipConfidence,
      ...(job.publishedAt === undefined ? {} : { publishedAt: job.publishedAt }),
      limitations: [
        ...job.limitations,
        "This public job evidence supports only a bounded hiring observation and no definitive commercial conclusion.",
      ],
    };
    materials.push(material);
    findings.push({
      id: `finding_hiring_job_${fingerprint({ jobId: job.jobId }).slice(0, 16)}`,
      searchResultId: result.id,
      entityKey: entityKeyForResult(result),
      signalType: "hiring_signal",
      positive: true,
      strength: board.relationshipConfidence >= 0.8 ? "moderate" : "weak",
      summary: `${job.companyName} publicly lists ${job.title}. This is an observed hiring fact, not proof of budget, expansion, replacement hiring, an approved project, or purchase intent.`,
      supportingText: content,
      sourceUrl: job.jobUrl,
      providerId: job.sourceProviderId,
      sourceZone: result.sourceZone,
      stale: false,
      materialId,
      materialKind: "public_job_posting",
      provenance: {
        searchResultId: result.id,
        queryId: result.queryId,
        query: result.query,
        sourceUrl: job.jobUrl,
        providerId: job.sourceProviderId,
        providerCategory: result.providerCategory,
        sourceZone: result.sourceZone,
        searchMethod: result.searchMethod,
        signalIntent: result.signalIntent,
        ...(job.publishedAt === undefined ? {} : { publishedAt: job.publishedAt }),
        discoveredAt: result.discoveredAt,
        materialId,
        materialKind: "public_job_posting",
        extractedContentHash: job.contentHash,
        trustClassification: "untrusted_public_content",
        targetId: job.targetId,
        boardId: job.boardId,
        jobId: job.jobId,
        hiringProviderId: job.sourceProviderId,
        accessCategory: board.accessCategory,
        companyName: job.companyName,
        ...(job.companyDomain === undefined ? {} : { companyDomain: job.companyDomain }),
        ...(job.roleFamily === undefined ? {} : { roleFamily: job.roleFamily }),
        ...(job.seniority === undefined ? {} : { seniority: job.seniority }),
        workplaceType: job.workplaceType,
        ...(job.department === undefined ? {} : { department: job.department }),
        technologyMentions: job.technologyMentions.map((mention) => mention.canonicalName),
        confidence: board.relationshipConfidence,
      },
    });
  }
  for (const signal of input.hiringSignals.signals) {
    const company = input.hiringSignals.companies.find(
      (entry) => entry.targetId === signal.targetId,
    );
    if (company === undefined) continue;
    const supportingJob = input.jobCollection.jobs.find((job) =>
      signal.supportingJobIds.includes(job.jobId),
    );
    if (supportingJob === undefined) continue;
    const result = matchingHiringResult(input.candidates, {
      companyName: company.companyName,
      ...(company.companyDomain === undefined ? {} : { companyDomain: company.companyDomain }),
      sourceUrl: supportingJob.jobUrl,
    });
    if (result === undefined) continue;
    const materialId = `material_hiring_signal_${signal.signalId}`;
    const content = `${signal.observedFacts.join(" ")} ${signal.inference}`.slice(0, 20_000);
    materials.push({
      id: materialId,
      searchResultId: result.id,
      entityKey: entityKeyForResult(result),
      kind: "hiring_signal",
      sourceUrl: supportingJob.jobUrl,
      content,
      contentHash: fingerprint({ signalId: signal.signalId, content }),
      trustClassification: "untrusted_public_content",
      targetId: signal.targetId,
      hiringSignalId: signal.signalId,
      companyName: signal.companyName,
      ...(company.companyDomain === undefined ? {} : { companyDomain: company.companyDomain }),
      confidence: signal.confidence,
      limitations: [
        ...signal.limitations,
        "This deterministic hiring inference is bounded and does not establish a commercial decision.",
      ],
    });
    findings.push({
      id: `finding_hiring_signal_${fingerprint({ signalId: signal.signalId }).slice(0, 16)}`,
      searchResultId: result.id,
      entityKey: entityKeyForResult(result),
      signalType: "hiring_signal",
      positive: true,
      strength: signal.confidence >= 0.75 ? "moderate" : "weak",
      summary: `${signal.inference} This bounded inference does not establish budget, expansion, replacement hiring, an approved project, or purchase intent.`,
      supportingText: content,
      sourceUrl: supportingJob.jobUrl,
      providerId: supportingJob.sourceProviderId,
      sourceZone: result.sourceZone,
      stale: false,
      materialId,
      materialKind: "hiring_signal",
      provenance: {
        searchResultId: result.id,
        queryId: result.queryId,
        query: result.query,
        sourceUrl: supportingJob.jobUrl,
        providerId: supportingJob.sourceProviderId,
        providerCategory: result.providerCategory,
        sourceZone: result.sourceZone,
        searchMethod: result.searchMethod,
        signalIntent: result.signalIntent,
        discoveredAt: result.discoveredAt,
        materialId,
        materialKind: "hiring_signal",
        extractedContentHash: fingerprint({ signalId: signal.signalId, content }),
        trustClassification: "untrusted_public_content",
        targetId: signal.targetId,
        hiringSignalId: signal.signalId,
        companyName: signal.companyName,
        ...(company.companyDomain === undefined ? {} : { companyDomain: company.companyDomain }),
        confidence: signal.confidence,
      },
    });
  }
  return { materials, findings };
}

function communityEvidence(input: {
  candidates: DiscoveryCandidatesArtifactV1;
  community?: ValidatedCommunityAnalysisSet;
}): { materials: EvidenceMaterialV1[]; findings: EvidenceFindingV1[] } {
  if (input.community === undefined || input.candidates.results.length === 0)
    return { materials: [], findings: [] };
  const materials: EvidenceMaterialV1[] = [];
  const findings: EvidenceFindingV1[] = [];
  const contextByThread = new Map(
    input.community.threadContext.threads.map((entry) => [entry.threadArtifactId, entry]),
  );
  const commentsById = new Map(
    input.community.commentCollections.flatMap((collection) =>
      collection.comments.map((comment) => [comment.commentId, { collection, comment }] as const),
    ),
  );
  const resultForConcept = (concepts: string[]): NormalizedDiscoveryResultV2 | undefined => {
    const normalized = [
      ...new Set(
        concepts.map((value) => value.trim().toLowerCase()).filter((value) => value.length > 1),
      ),
    ];
    if (normalized.length !== 1) return undefined;
    const concept = normalized[0];
    if (concept === undefined) return undefined;
    const matchingEntities = input.candidates.entities.filter((entity) => {
      const names = [entity.displayName, entity.domain]
        .filter((value): value is string => value !== undefined)
        .map((value) => value.trim().toLowerCase());
      return names.includes(concept);
    });
    if (matchingEntities.length !== 1) return undefined;
    const entity = matchingEntities[0];
    if (entity === undefined) return undefined;
    return entity.resultIds
      .map((resultId) => input.candidates.results.find((result) => result.id === resultId))
      .find((result) => result !== undefined);
  };
  for (const thread of input.community.threads) {
    const context = contextByThread.get(thread.artifactId);
    if (context === undefined || context.contentSafety.excluded) continue;
    const concepts = input.community.plan.queries
      .filter((query) => context.queryIds.includes(query.queryId) && query.selected)
      .map((query) => query.primaryEntity)
      .filter((value): value is string => value !== undefined);
    const result = resultForConcept(concepts);
    if (result === undefined) continue;
    const bestEngagement = [...context.engagementObservations].sort(
      (left, right) =>
        Number(left.stalePossible) - Number(right.stalePossible) ||
        right.confidence - left.confidence,
    )[0];
    const content = `${thread.title ?? ""}\n${thread.body ?? ""}`.trim().slice(0, 20_000);
    if (content.length === 0) continue;
    const materialId = `material_community_thread_${thread.artifactId}`;
    materials.push({
      id: materialId,
      kind: "reddit_thread",
      searchResultId: result.id,
      entityKey: entityKeyForResult(result),
      sourceUrl: thread.url,
      content,
      contentHash: fingerprint({ threadArtifactId: thread.artifactId, content }),
      trustClassification: "untrusted_public_content",
      threadArtifactId: thread.artifactId,
      subreddit: context.subreddit,
      communityQueryIntents: context.queryIntents,
      relevanceScore: context.relevanceScore,
      redditLocalScore: context.redditLocalScore,
      engagementState:
        bestEngagement === undefined
          ? "unknown"
          : bestEngagement.source === "arctic_shift_archive"
            ? "archived"
            : "live",
      ...(bestEngagement === undefined
        ? {}
        : {
            engagementSource: bestEngagement.source,
            engagementObservationSource: bestEngagement.source,
            engagementStalePossible: bestEngagement.stalePossible,
          }),
      ...(thread.createdAt === undefined ? {} : { publishedAt: thread.createdAt }),
      limitations: [
        ...thread.limitations,
        ...context.limitations,
        "Public Reddit discussion is anecdotal sampled evidence. It does not establish representative demand, company identity, buyer identity, budget, authority, or purchase intent.",
      ],
    });
    findings.push({
      id: `finding_community_thread_${fingerprint({ threadArtifactId: thread.artifactId }).slice(0, 16)}`,
      searchResultId: result.id,
      entityKey: entityKeyForResult(result),
      signalType: "community_signal",
      positive: true,
      strength: context.relevanceScore >= 0.75 && context.dedicated ? "moderate" : "weak",
      summary: `A public r/${context.subreddit} thread contains mission-relevant discussion. This is anecdotal community context, not proof of commercial intent.`,
      supportingText: content,
      sourceUrl: thread.url,
      providerId: "reddit_keyless",
      sourceZone: result.sourceZone,
      stale: context.dateConfidence < 0.5,
      materialId,
      materialKind: "reddit_thread",
      provenance: {
        searchResultId: result.id,
        queryId: result.queryId,
        query: result.query,
        sourceUrl: thread.url,
        providerId: "reddit_keyless",
        providerCategory: result.providerCategory,
        sourceZone: result.sourceZone,
        searchMethod: result.searchMethod,
        signalIntent: result.signalIntent,
        ...(thread.createdAt === undefined ? {} : { publishedAt: thread.createdAt }),
        discoveredAt: result.discoveredAt,
        materialId,
        materialKind: "reddit_thread",
        trustClassification: "untrusted_public_content",
        threadArtifactId: thread.artifactId,
        subreddit: context.subreddit,
        communityQueryIds: context.queryIds,
        communityQueryIntents: context.queryIntents,
        relevanceScore: context.relevanceScore,
        redditLocalScore: context.redditLocalScore,
        engagementState:
          bestEngagement === undefined
            ? "unknown"
            : bestEngagement.source === "arctic_shift_archive"
              ? "archived"
              : "live",
        ...(bestEngagement === undefined
          ? {}
          : {
              engagementSource: bestEngagement.source,
              engagementObservationSource: bestEngagement.source,
              engagementStalePossible: bestEngagement.stalePossible,
            }),
      },
    });
  }
  for (const collection of input.community.commentCollections) {
    const thread = input.community.threads.find(
      (entry) => entry.artifactId === collection.threadArtifactId,
    );
    const context = contextByThread.get(collection.threadArtifactId);
    if (thread === undefined || context === undefined || context.contentSafety.excluded) continue;
    const concepts = input.community.plan.queries
      .filter((query) => context.queryIds.includes(query.queryId) && query.selected)
      .map((query) => query.primaryEntity)
      .filter((value): value is string => value !== undefined);
    const result = resultForConcept(concepts);
    if (result === undefined) continue;
    for (const comment of collection.comments) {
      const body = comment.body.slice(0, 20_000);
      const materialId = `material_community_comment_${comment.commentId}`;
      materials.push({
        id: materialId,
        kind: "reddit_comment",
        searchResultId: result.id,
        entityKey: entityKeyForResult(result),
        sourceUrl: thread.url,
        content: body,
        contentHash: fingerprint({
          threadArtifactId: thread.artifactId,
          commentId: comment.commentId,
          body,
        }),
        trustClassification: "untrusted_public_content",
        threadArtifactId: thread.artifactId,
        commentCollectionArtifactId: collection.artifactId,
        commentId: comment.commentId,
        subreddit: context.subreddit,
        communityQueryIds: context.queryIds,
        communityQueryIntents: context.queryIntents,
        relevanceScore: context.relevanceScore,
        redditLocalScore: context.redditLocalScore,
        ...(comment.createdAt === undefined ? {} : { publishedAt: comment.createdAt }),
        limitations: [
          ...comment.limitations,
          "A Reddit comment is anecdotal untrusted public content and cannot identify or qualify a buyer.",
        ],
      });
      findings.push({
        id: `finding_community_comment_${fingerprint({ threadArtifactId: thread.artifactId, commentId: comment.commentId }).slice(0, 16)}`,
        searchResultId: result.id,
        entityKey: entityKeyForResult(result),
        signalType: "community_signal",
        positive: true,
        strength: "weak",
        summary: `A selected public Reddit comment in r/${context.subreddit} adds anecdotal context for an already-known discovery entity. It does not identify a buyer or establish purchase intent.`,
        supportingText: body,
        sourceUrl: thread.url,
        providerId: "reddit_keyless",
        sourceZone: result.sourceZone,
        stale: false,
        materialId,
        materialKind: "reddit_comment",
        provenance: {
          searchResultId: result.id,
          queryId: result.queryId,
          query: result.query,
          sourceUrl: thread.url,
          providerId: "reddit_keyless",
          providerCategory: result.providerCategory,
          sourceZone: result.sourceZone,
          searchMethod: result.searchMethod,
          signalIntent: result.signalIntent,
          ...(comment.createdAt === undefined ? {} : { publishedAt: comment.createdAt }),
          discoveredAt: result.discoveredAt,
          materialId,
          materialKind: "reddit_comment",
          trustClassification: "untrusted_public_content",
          threadArtifactId: thread.artifactId,
          commentId: comment.commentId,
          subreddit: context.subreddit,
          communityQueryIds: context.queryIds,
          communityQueryIntents: context.queryIntents,
          relevanceScore: context.relevanceScore,
          redditLocalScore: context.redditLocalScore,
        },
      });
    }
  }
  for (const signal of input.community.signals.signals) {
    const supportingThread = input.community.threads.find((thread) =>
      signal.supportingThreadArtifactIds.includes(thread.artifactId),
    );
    if (supportingThread === undefined) continue;
    const context = contextByThread.get(supportingThread.artifactId);
    if (context === undefined || context.contentSafety.excluded) continue;
    const signalEntityConcepts = input.community.plan.queries
      .filter((query) => context.queryIds.includes(query.queryId) && query.selected)
      .map((query) => query.primaryEntity)
      .filter((value): value is string => value !== undefined);
    const result = resultForConcept(signalEntityConcepts);
    if (result === undefined) continue;
    const content = `${signal.observedFacts.join(" ")} ${signal.inference}`.slice(0, 20_000);
    const materialId = `material_community_signal_${signal.signalId}`;
    materials.push({
      id: materialId,
      kind: "community_signal",
      searchResultId: result.id,
      entityKey: entityKeyForResult(result),
      sourceUrl: supportingThread.url,
      content,
      contentHash: fingerprint({ signalId: signal.signalId, content }),
      trustClassification: "untrusted_public_content",
      threadArtifactId: supportingThread.artifactId,
      communitySignalId: signal.signalId,
      communitySignalType: signal.type,
      subreddit: context.subreddit,
      communityQueryIds: context.queryIds,
      communityQueryIntents: context.queryIntents,
      relevanceScore: signal.missionRelevance.score,
      confidence: signal.confidence,
      independentThreadCount: signal.independentThreadCount,
      limitations: [
        ...signal.limitations,
        "Deterministic community signals summarize sampled discussion only; they do not prove representative demand, budget, authority, or purchase intent.",
      ],
    });
    findings.push({
      id: `finding_community_signal_${fingerprint({ signalId: signal.signalId }).slice(0, 16)}`,
      searchResultId: result.id,
      entityKey: entityKeyForResult(result),
      signalType: "community_signal",
      positive: true,
      strength:
        signal.missionRelevance.relevant &&
        signal.missionRelevance.score >= 0.7 &&
        signal.confidence >= 0.7 &&
        signal.independentThreadCount >= 2
          ? "moderate"
          : "weak",
      summary: `${signal.inference} This remains anecdotal public-community evidence and does not establish a commercial decision.`,
      supportingText: content,
      sourceUrl: supportingThread.url,
      providerId: "reddit_keyless",
      sourceZone: result.sourceZone,
      stale: false,
      materialId,
      materialKind: "community_signal",
      provenance: {
        searchResultId: result.id,
        queryId: result.queryId,
        query: result.query,
        sourceUrl: supportingThread.url,
        providerId: "reddit_keyless",
        providerCategory: result.providerCategory,
        sourceZone: result.sourceZone,
        searchMethod: result.searchMethod,
        signalIntent: result.signalIntent,
        discoveredAt: result.discoveredAt,
        materialId,
        materialKind: "community_signal",
        trustClassification: "untrusted_public_content",
        threadArtifactId: supportingThread.artifactId,
        communitySignalId: signal.signalId,
        communitySignalType: signal.type,
        subreddit: context.subreddit,
        communityQueryIds: context.queryIds,
        communityQueryIntents: context.queryIntents,
        relevanceScore: signal.missionRelevance.score,
        confidence: signal.confidence,
        independentThreadCount: signal.independentThreadCount,
      },
    });
    for (const commentId of signal.supportingCommentIds) void commentsById.get(commentId);
  }
  return { materials, findings };
}

function developerEvidence(input: {
  candidates: DiscoveryCandidatesArtifactV1;
  developer?: ValidatedDeveloperAnalysisSet;
}): { materials: EvidenceMaterialV1[]; findings: EvidenceFindingV1[] } {
  if (input.developer === undefined || input.candidates.results.length === 0)
    return { materials: [], findings: [] };
  const materials: EvidenceMaterialV1[] = [];
  const findings: EvidenceFindingV1[] = [];
  const metadataByThread = new Map(
    input.developer.threadMetadata.threads.map((entry) => [entry.threadArtifactId, entry]),
  );
  const repositoryById = new Map(
    input.developer.repositoryCollection.repositories.map((repository) => [
      repository.repositoryId,
      repository,
    ]),
  );
  const threadById = new Map(input.developer.threads.map((thread) => [thread.artifactId, thread]));
  const commentsByThread = new Map(
    input.developer.commentCollections.map((collection) => [
      collection.threadArtifactId,
      collection,
    ]),
  );
  const commentMetadataById = new Map(
    input.developer.commentMetadata.comments.map((comment) => [comment.commentId, comment]),
  );
  const resultForConcepts = (concepts: string[]): NormalizedDiscoveryResultV2 | undefined => {
    const normalized = [
      ...new Set(
        concepts.map((value) => value.trim().toLowerCase()).filter((value) => value.length > 1),
      ),
    ];
    if (normalized.length !== 1) return undefined;
    const concept = normalized[0];
    if (concept === undefined) return undefined;
    const matchingEntities = input.candidates.entities.filter((entity) =>
      [entity.displayName, entity.domain]
        .filter((value): value is string => value !== undefined)
        .map((value) => value.trim().toLowerCase())
        .includes(concept),
    );
    if (matchingEntities.length !== 1) return undefined;
    const entity = matchingEntities[0];
    if (entity === undefined) return undefined;
    return entity.resultIds
      .map((resultId) => input.candidates.results.find((result) => result.id === resultId))
      .find((result) => result !== undefined);
  };
  const queryContext = (threadArtifactId: string) => {
    const metadata = metadataByThread.get(threadArtifactId);
    const queryIds = [
      ...new Set(
        (metadata?.provenance ?? [])
          .map((entry) => entry.queryId)
          .filter((value): value is string => value !== undefined),
      ),
    ];
    const queries =
      input.developer?.plan.queries.filter(
        (query) => query.selected && queryIds.includes(query.queryId),
      ) ?? [];
    const concepts = queries
      .map((query) => query.primaryEntity)
      .filter((value): value is string => value !== undefined);
    return {
      metadata,
      queries,
      queryIds,
      concepts,
      result: resultForConcepts(concepts),
    };
  };

  for (const thread of input.developer.threads) {
    const context = queryContext(thread.artifactId);
    const metadata = context.metadata;
    const result = context.result;
    if (metadata === undefined || result === undefined) continue;
    const repository = repositoryById.get(metadata.repositoryId);
    if (repository === undefined) continue;
    const content = `${thread.title ?? ""}\n${thread.body ?? ""}`.trim().slice(0, 20_000);
    if (content.length === 0) continue;
    const materialId = `material_github_thread_${thread.artifactId}`;
    materials.push({
      id: materialId,
      kind: "github_thread",
      searchResultId: result.id,
      entityKey: entityKeyForResult(result),
      sourceUrl: thread.url,
      content,
      contentHash: fingerprint({ threadArtifactId: thread.artifactId, content }),
      trustClassification: "untrusted_public_content",
      threadArtifactId: thread.artifactId,
      repositoryId: repository.repositoryId,
      repositoryFullName: repository.fullName,
      developerThreadKind: metadata.threadKind,
      developerThreadNumber: metadata.nativeNumber,
      developerQueryIds: context.queryIds,
      developerQueryIntents: context.queries.map((query) => query.intent),
      relevanceScore: metadata.relevanceScore,
      developerLocalScore: metadata.developerLocalScore,
      ...(metadata.authorAssociation === undefined
        ? {}
        : { authorAssociation: metadata.authorAssociation }),
      ...(thread.createdAt === undefined ? {} : { publishedAt: thread.createdAt }),
      limitations: [
        ...thread.limitations,
        ...metadata.limitations,
        "Public GitHub authors and associations are attribution only and are never used as buyer or contact identity evidence.",
      ],
    });
    findings.push({
      id: `finding_github_thread_${fingerprint({ threadArtifactId: thread.artifactId }).slice(0, 16)}`,
      searchResultId: result.id,
      entityKey: entityKeyForResult(result),
      signalType: "developer_signal",
      positive: true,
      strength: metadata.relevanceScore >= 0.75 ? "moderate" : "weak",
      summary: `A public GitHub ${metadata.threadKind.replace("_", " ")} in ${repository.fullName} contains mission-relevant developer discussion. It does not identify or qualify a buyer.`,
      supportingText: content,
      sourceUrl: thread.url,
      providerId: "github_public",
      sourceZone: result.sourceZone,
      stale: false,
      materialId,
      materialKind: "github_thread",
      provenance: {
        searchResultId: result.id,
        queryId: result.queryId,
        query: result.query,
        sourceUrl: thread.url,
        providerId: "github_public",
        providerCategory: result.providerCategory,
        sourceZone: result.sourceZone,
        searchMethod: result.searchMethod,
        signalIntent: result.signalIntent,
        ...(thread.createdAt === undefined ? {} : { publishedAt: thread.createdAt }),
        discoveredAt: result.discoveredAt,
        materialId,
        materialKind: "github_thread",
        trustClassification: "untrusted_public_content",
        threadArtifactId: thread.artifactId,
        repositoryId: repository.repositoryId,
        repositoryFullName: repository.fullName,
        developerThreadKind: metadata.threadKind,
        developerThreadNumber: metadata.nativeNumber,
        developerQueryIds: context.queryIds,
        developerQueryIntents: context.queries.map((query) => query.intent),
        relevanceScore: metadata.relevanceScore,
        developerLocalScore: metadata.developerLocalScore,
        ...(metadata.authorAssociation === undefined
          ? {}
          : { authorAssociation: metadata.authorAssociation }),
      },
    });

    const repositoryContent =
      `${repository.fullName}\n${repository.description ?? ""}\n${repository.primaryLanguage ?? ""}\n${repository.topics.join(" ")}`
        .trim()
        .slice(0, 20_000);
    const repositoryMaterialId = `material_github_repository_${repository.repositoryId}_${thread.artifactId}`;
    if (
      repositoryContent.length > 0 &&
      !materials.some(
        (material) =>
          material.kind === "github_repository" &&
          material.repositoryId === repository.repositoryId,
      )
    ) {
      materials.push({
        id: repositoryMaterialId,
        kind: "github_repository",
        searchResultId: result.id,
        entityKey: entityKeyForResult(result),
        sourceUrl: repository.url,
        content: repositoryContent,
        contentHash: fingerprint({ repositoryId: repository.repositoryId, repositoryContent }),
        trustClassification: "untrusted_public_content",
        repositoryId: repository.repositoryId,
        repositoryFullName: repository.fullName,
        developerQueryIds: context.queryIds,
        developerQueryIntents: context.queries.map((query) => query.intent),
        relevanceScore: metadata.relevanceScore,
        limitations: [
          ...repository.limitations,
          "Public repository metadata is project context only and does not identify a buyer, budget, authority, or purchase intent.",
        ],
      });
      findings.push({
        id: `finding_github_repository_${fingerprint({ repositoryId: repository.repositoryId }).slice(0, 16)}`,
        searchResultId: result.id,
        entityKey: entityKeyForResult(result),
        signalType: "developer_signal",
        positive: true,
        strength: "weak",
        summary: `Public repository metadata for ${repository.fullName} is relevant developer context for an already-known discovery entity.`,
        supportingText: repositoryContent,
        sourceUrl: repository.url,
        providerId: "github_public",
        sourceZone: result.sourceZone,
        stale: false,
        materialId: repositoryMaterialId,
        materialKind: "github_repository",
        provenance: {
          searchResultId: result.id,
          queryId: result.queryId,
          query: result.query,
          sourceUrl: repository.url,
          providerId: "github_public",
          providerCategory: result.providerCategory,
          sourceZone: result.sourceZone,
          searchMethod: result.searchMethod,
          signalIntent: result.signalIntent,
          discoveredAt: result.discoveredAt,
          materialId: repositoryMaterialId,
          materialKind: "github_repository",
          trustClassification: "untrusted_public_content",
          repositoryId: repository.repositoryId,
          repositoryFullName: repository.fullName,
          developerQueryIds: context.queryIds,
          developerQueryIntents: context.queries.map((query) => query.intent),
          relevanceScore: metadata.relevanceScore,
        },
      });
      for (const release of repository.releases) {
        const releaseContent = `${release.name ?? release.tagName}\n${release.bodyExcerpt ?? ""}`
          .trim()
          .slice(0, 20_000);
        if (releaseContent.length === 0) continue;
        const releaseMaterialId = `material_github_release_${release.releaseId}`;
        materials.push({
          id: releaseMaterialId,
          kind: "github_release",
          searchResultId: result.id,
          entityKey: entityKeyForResult(result),
          sourceUrl: release.url,
          content: releaseContent,
          contentHash: fingerprint({ releaseId: release.releaseId, releaseContent }),
          trustClassification: "untrusted_public_content",
          repositoryId: repository.repositoryId,
          repositoryFullName: repository.fullName,
          releaseId: release.releaseId,
          releaseTagName: release.tagName,
          releasePrerelease: release.prerelease,
          developerQueryIds: context.queryIds,
          developerQueryIntents: context.queries.map((query) => query.intent),
          ...(release.publishedAt === undefined ? {} : { publishedAt: release.publishedAt }),
          limitations: [
            ...release.limitations,
            "Release activity is implementation context only; asset URLs are never followed and release activity alone is not a buyer signal.",
          ],
        });
        findings.push({
          id: `finding_github_release_${fingerprint({ releaseId: release.releaseId }).slice(0, 16)}`,
          searchResultId: result.id,
          entityKey: entityKeyForResult(result),
          signalType: "developer_signal",
          positive: true,
          strength: "weak",
          summary: `Published release ${release.tagName} is public developer context for ${repository.fullName}; release activity alone does not imply commercial intent.`,
          supportingText: releaseContent,
          sourceUrl: release.url,
          providerId: "github_public",
          sourceZone: result.sourceZone,
          stale: false,
          materialId: releaseMaterialId,
          materialKind: "github_release",
          provenance: {
            searchResultId: result.id,
            queryId: result.queryId,
            query: result.query,
            sourceUrl: release.url,
            providerId: "github_public",
            providerCategory: result.providerCategory,
            sourceZone: result.sourceZone,
            searchMethod: result.searchMethod,
            signalIntent: result.signalIntent,
            ...(release.publishedAt === undefined ? {} : { publishedAt: release.publishedAt }),
            discoveredAt: result.discoveredAt,
            materialId: releaseMaterialId,
            materialKind: "github_release",
            trustClassification: "untrusted_public_content",
            repositoryId: repository.repositoryId,
            repositoryFullName: repository.fullName,
            releaseId: release.releaseId,
            releaseTagName: release.tagName,
            releasePrerelease: release.prerelease,
          },
        });
      }
    }

    const collection = commentsByThread.get(thread.artifactId);
    for (const comment of collection?.comments ?? []) {
      const commentMetadata = commentMetadataById.get(comment.commentId);
      const body = comment.body.slice(0, 20_000);
      if (body.length === 0) continue;
      const commentMaterialId = `material_github_comment_${comment.commentId}`;
      materials.push({
        id: commentMaterialId,
        kind: "github_comment",
        searchResultId: result.id,
        entityKey: entityKeyForResult(result),
        sourceUrl: commentMetadata?.permalink ?? thread.url,
        content: body,
        contentHash: fingerprint({ commentId: comment.commentId, body }),
        trustClassification: "untrusted_public_content",
        threadArtifactId: thread.artifactId,
        commentCollectionArtifactId: collection?.artifactId,
        commentId: comment.commentId,
        repositoryId: repository.repositoryId,
        repositoryFullName: repository.fullName,
        developerThreadKind: metadata.threadKind,
        developerThreadNumber: metadata.nativeNumber,
        ...(commentMetadata === undefined
          ? {}
          : {
              developerCommentKind: commentMetadata.commentKind,
              ...(commentMetadata.authorAssociation === undefined
                ? {}
                : { authorAssociation: commentMetadata.authorAssociation }),
            }),
        developerQueryIds: context.queryIds,
        developerQueryIntents: context.queries.map((query) => query.intent),
        relevanceScore: metadata.relevanceScore,
        ...(comment.createdAt === undefined ? {} : { publishedAt: comment.createdAt }),
        limitations: [
          ...comment.limitations,
          ...(commentMetadata?.limitations ?? []),
          "GitHub comment authors and associations are attribution only and are never used as company, buyer, or contact identity evidence.",
        ],
      });
      findings.push({
        id: `finding_github_comment_${fingerprint({ commentId: comment.commentId }).slice(0, 16)}`,
        searchResultId: result.id,
        entityKey: entityKeyForResult(result),
        signalType: "developer_signal",
        positive: true,
        strength: "weak",
        summary: `A selected public GitHub comment adds developer context to an already-known entity; it does not identify a buyer or contact.`,
        supportingText: body,
        sourceUrl: commentMetadata?.permalink ?? thread.url,
        providerId: "github_public",
        sourceZone: result.sourceZone,
        stale: false,
        materialId: commentMaterialId,
        materialKind: "github_comment",
        provenance: {
          searchResultId: result.id,
          queryId: result.queryId,
          query: result.query,
          sourceUrl: commentMetadata?.permalink ?? thread.url,
          providerId: "github_public",
          providerCategory: result.providerCategory,
          sourceZone: result.sourceZone,
          searchMethod: result.searchMethod,
          signalIntent: result.signalIntent,
          ...(comment.createdAt === undefined ? {} : { publishedAt: comment.createdAt }),
          discoveredAt: result.discoveredAt,
          materialId: commentMaterialId,
          materialKind: "github_comment",
          trustClassification: "untrusted_public_content",
          threadArtifactId: thread.artifactId,
          commentId: comment.commentId,
          repositoryId: repository.repositoryId,
          repositoryFullName: repository.fullName,
          developerThreadKind: metadata.threadKind,
          developerThreadNumber: metadata.nativeNumber,
          ...(commentMetadata === undefined
            ? {}
            : {
                developerCommentKind: commentMetadata.commentKind,
                ...(commentMetadata.authorAssociation === undefined
                  ? {}
                  : { authorAssociation: commentMetadata.authorAssociation }),
              }),
          developerQueryIds: context.queryIds,
          developerQueryIntents: context.queries.map((query) => query.intent),
          relevanceScore: metadata.relevanceScore,
        },
      });
    }
  }

  for (const signal of input.developer.signals.signals) {
    const supportingThread = signal.supportingThreadArtifactIds
      .map((threadId) => threadById.get(threadId))
      .find((thread) => thread !== undefined);
    if (supportingThread === undefined) continue;
    const context = queryContext(supportingThread.artifactId);
    const result = context.result;
    if (result === undefined) continue;
    const supportingRepository = signal.repositoryIds
      .map((repositoryId) => repositoryById.get(repositoryId))
      .find((repository) => repository !== undefined);
    if (supportingRepository === undefined) continue;
    const content = `${signal.observedFacts.join(" ")} ${signal.inference}`.slice(0, 20_000);
    const materialId = `material_developer_signal_${signal.signalId}`;
    materials.push({
      id: materialId,
      kind: "developer_signal",
      searchResultId: result.id,
      entityKey: entityKeyForResult(result),
      sourceUrl: supportingThread.url,
      content,
      contentHash: fingerprint({ signalId: signal.signalId, content }),
      trustClassification: "untrusted_public_content",
      threadArtifactId: supportingThread.artifactId,
      repositoryId: supportingRepository.repositoryId,
      repositoryFullName: supportingRepository.fullName,
      developerSignalId: signal.signalId,
      developerSignalType: signal.type,
      developerQueryIds: context.queryIds,
      developerQueryIntents: context.queries.map((query) => query.intent),
      relevanceScore: signal.missionRelevance.score,
      confidence: signal.confidence,
      independentThreadCount: signal.independentThreadCount,
      independentRepositoryCount: signal.independentRepositoryCount,
      limitations: [
        ...signal.limitations,
        "Deterministic developer signals summarize bounded public GitHub evidence only; they do not prove budget, buying authority, purchase intent, representative market demand, or developer identity.",
      ],
    });
    findings.push({
      id: `finding_developer_signal_${fingerprint({ signalId: signal.signalId }).slice(0, 16)}`,
      searchResultId: result.id,
      entityKey: entityKeyForResult(result),
      signalType: "developer_signal",
      positive: true,
      strength:
        signal.missionRelevance.relevant &&
        signal.missionRelevance.score >= 0.7 &&
        signal.confidence >= 0.7 &&
        signal.independentRepositoryCount >= 2
          ? "moderate"
          : "weak",
      summary: `${signal.inference} This remains bounded public developer evidence and does not establish a commercial decision or buyer identity.`,
      supportingText: content,
      sourceUrl: supportingThread.url,
      providerId: "github_public",
      sourceZone: result.sourceZone,
      stale: false,
      materialId,
      materialKind: "developer_signal",
      provenance: {
        searchResultId: result.id,
        queryId: result.queryId,
        query: result.query,
        sourceUrl: supportingThread.url,
        providerId: "github_public",
        providerCategory: result.providerCategory,
        sourceZone: result.sourceZone,
        searchMethod: result.searchMethod,
        signalIntent: result.signalIntent,
        discoveredAt: result.discoveredAt,
        materialId,
        materialKind: "developer_signal",
        trustClassification: "untrusted_public_content",
        threadArtifactId: supportingThread.artifactId,
        repositoryId: supportingRepository.repositoryId,
        repositoryFullName: supportingRepository.fullName,
        developerSignalId: signal.signalId,
        developerSignalType: signal.type,
        developerQueryIds: context.queryIds,
        developerQueryIntents: context.queries.map((query) => query.intent),
        relevanceScore: signal.missionRelevance.score,
        confidence: signal.confidence,
        independentThreadCount: signal.independentThreadCount,
        independentRepositoryCount: signal.independentRepositoryCount,
      },
    });
  }
  return { materials, findings };
}

export function buildEvidenceFindings(
  candidates: DiscoveryCandidatesArtifactV1,
  generatedAt: string,
  extractedContent?: ExtractedContentArtifactV1,
  structuredContent?: StructuredContentArtifactV1,
  jobCollection?: JobCollectionArtifactV1,
  hiringSignals?: HiringSignalsArtifactV1,
  communityArtifacts?: ValidatedCommunityAnalysisSet,
  developerArtifacts?: ValidatedDeveloperAnalysisSet,
): EvidenceFindingsArtifactV1 {
  const parsed = DiscoveryCandidatesArtifactV1Schema.parse(candidates);
  const hiring = hiringEvidence({
    candidates: parsed,
    generatedAt,
    ...(jobCollection === undefined ? {} : { jobCollection }),
    ...(hiringSignals === undefined ? {} : { hiringSignals }),
  });
  const community = communityEvidence({
    candidates: parsed,
    ...(communityArtifacts === undefined ? {} : { community: communityArtifacts }),
  });
  const developer = developerEvidence({
    candidates: parsed,
    ...(developerArtifacts === undefined ? {} : { developer: developerArtifacts }),
  });
  const materials = [
    ...buildEvidenceMaterials(parsed, extractedContent, structuredContent),
    ...hiring.materials,
    ...community.materials,
    ...developer.materials,
  ];
  const materialsByResult = new Map<string, EvidenceMaterialV1[]>();
  for (const entry of materials) {
    const current = materialsByResult.get(entry.searchResultId) ?? [];
    current.push(entry);
    materialsByResult.set(entry.searchResultId, current);
  }
  const findings: EvidenceFindingV1[] = [
    ...hiring.findings,
    ...community.findings,
    ...developer.findings,
  ];
  for (const result of parsed.results) {
    const stale = isStale(result, generatedAt);
    const available = materialsByResult.get(result.id) ?? [];
    const preferred =
      available.find((entry) => entry.kind === "structured_section") ??
      available.find((entry) => entry.kind === "structured_table") ??
      available.find((entry) => entry.kind === "structured_metadata") ??
      available.find((entry) => entry.kind === "structured_footnote") ??
      available.find((entry) => entry.kind === "extracted_page_text") ??
      available.find((entry) => entry.kind === "extracted_metadata") ??
      available.find((entry) => entry.kind === "extracted_json_ld") ??
      available.find((entry) => entry.kind === "search_snippet");
    for (const spec of findingSpecs(result)) {
      const finding = {
        id: `finding_${fingerprint({
          resultId: result.id,
          signalType: spec.signalType,
          materialId: preferred?.id,
        }).slice(0, 16)}`,
        searchResultId: result.id,
        entityKey: entityKeyForResult(result),
        signalType: spec.signalType,
        positive: spec.positive,
        strength: strengthForResult(result, stale, spec.signalType),
        summary: spec.summary,
        supportingText: preferred?.content ?? result.snippet,
        sourceUrl: preferred?.sourceUrl ?? result.url,
        providerId: result.providerId,
        sourceZone: result.sourceZone,
        stale,
        materialKind: preferred?.kind ?? "search_snippet",
        ...(preferred === undefined ? {} : { materialId: preferred.id }),
        provenance: {
          searchResultId: result.id,
          queryId: result.queryId,
          query: result.query,
          sourceUrl: preferred?.sourceUrl ?? result.url,
          providerId: result.providerId,
          providerCategory: result.providerCategory,
          sourceZone: result.sourceZone,
          searchMethod: result.searchMethod,
          signalIntent: result.signalIntent,
          ...(preferred?.publishedAt === undefined
            ? result.publishedAt === undefined
              ? {}
              : { publishedAt: result.publishedAt }
            : { publishedAt: preferred.publishedAt }),
          discoveredAt: result.discoveredAt,
          ...(result.credibility === undefined ? {} : { credibility: result.credibility }),
          ...(result.riskLevel === undefined ? {} : { riskLevel: result.riskLevel }),
          ...(preferred === undefined
            ? {}
            : {
                materialId: preferred.id,
                materialKind: preferred.kind,
                extractedContentHash: preferred.contentHash,
                trustClassification: preferred.trustClassification,
                ...(preferred.extractionItemId === undefined
                  ? {}
                  : { extractionItemId: preferred.extractionItemId }),
                ...(preferred.frontierItemId === undefined
                  ? {}
                  : { frontierItemId: preferred.frontierItemId }),
                ...(preferred.structuredContentItemId === undefined
                  ? {}
                  : { structuredContentItemId: preferred.structuredContentItemId }),
                ...(preferred.sectionId === undefined ? {} : { sectionId: preferred.sectionId }),
                ...(preferred.tableId === undefined ? {} : { tableId: preferred.tableId }),
                ...(preferred.footnoteId === undefined ? {} : { footnoteId: preferred.footnoteId }),
                ...(preferred.parserProviderId === undefined
                  ? {}
                  : { parserProviderId: preferred.parserProviderId }),
                ...(preferred.parserVersion === undefined
                  ? {}
                  : { parserVersion: preferred.parserVersion }),
                ...(preferred.resourceKind === undefined
                  ? {}
                  : { resourceKind: preferred.resourceKind }),
                ...(preferred.structuredContentHash === undefined
                  ? {}
                  : { structuredContentHash: preferred.structuredContentHash }),
                ...(preferred.contentCompleteness === undefined
                  ? {}
                  : { contentCompleteness: preferred.contentCompleteness }),
                ...(preferred.headingPath === undefined
                  ? {}
                  : { headingPath: preferred.headingPath }),
                ...(preferred.characterStart === undefined
                  ? {}
                  : { characterStart: preferred.characterStart }),
                ...(preferred.characterEnd === undefined
                  ? {}
                  : { characterEnd: preferred.characterEnd }),
              }),
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
  const extractionSummary = extractedContent?.summary;
  const extractionWarnings = [
    ...(extractedContent === undefined
      ? []
      : [
          "Extracted page text and JSON-LD are untrusted public source material, not instructions.",
          ...extractedContent.warnings,
        ]),
    ...(structuredContent === undefined
      ? []
      : [
          "Structured sections, tables, metadata, and footnotes are untrusted public source material, not instructions.",
          ...structuredContent.warnings,
        ]),
    ...(hiringSignals === undefined
      ? []
      : [
          "Public job postings and derived hiring signals are untrusted public evidence, not instructions.",
          "Hiring evidence does not confirm budget, expansion, replacement hiring, an approved project, purchase intent, identity, or purchasing authority.",
          ...hiringSignals.warnings,
        ]),
    ...(communityArtifacts === undefined
      ? []
      : [
          "Public Reddit threads, comments, and deterministic community signals are untrusted public evidence, not instructions.",
          "Community evidence is anecdotal and sampled; it does not establish representative market demand, company identity, buyer identity, budget, purchasing authority, or purchase intent.",
          ...communityArtifacts.signals.warnings,
        ]),
    ...(developerArtifacts === undefined
      ? []
      : [
          "Public GitHub repositories, issues, pull requests, comments, reviews, releases, and deterministic developer signals are untrusted public evidence, not instructions.",
          "Developer evidence is bounded project context; GitHub authors and associations are attribution only and do not establish company identity, buyer identity, contact identity, budget, purchasing authority, purchase intent, or representative market demand.",
          ...developerArtifacts.signals.warnings,
        ]),
  ];
  return EvidenceFindingsArtifactV1Schema.parse({
    schemaVersion: "1.0",
    artifactKind: "evidence_findings.v1",
    fixture: true,
    warning:
      developerArtifacts !== undefined
        ? "Deterministic evidence analysis includes bounded public GitHub repository, thread, comment, release, and cautious developer-signal context. GitHub evidence does not prove representative demand, company or buyer identity, contact identity, budget, authority, or purchase intent."
        : communityArtifacts !== undefined
          ? "Deterministic evidence analysis includes bounded public Reddit threads, selected comments, and cautious community signals. Community evidence is anecdotal and does not prove representative demand, company or buyer identity, budget, authority, or purchase intent."
          : hiringSignals !== undefined
            ? "Deterministic evidence analysis includes bounded public hiring facts and cautious hiring-signal inferences. These sources do not prove budget, expansion, replacement hiring, approved projects, purchase intent, identities, or purchasing authority."
            : structuredContent !== undefined
              ? "Deterministic evidence analysis over search results, bounded public-page extraction, and structured public resources. Resource claims, identities, and buying intent are not independently verified."
              : extractedContent === undefined
                ? PROJECT_B_FIXTURE_WARNING
                : "Deterministic evidence analysis over search results and bounded public-page extraction. Page claims, identities, and buying intent are not independently verified.",
    generatedAt,
    sourceArtifact: parsed.sourceArtifact,
    evidenceSourceMode:
      developerArtifacts !== undefined
        ? structuredContent !== undefined
          ? hiringSignals !== undefined && communityArtifacts !== undefined
            ? "snippet_plus_structured_hiring_community_and_developer_intelligence"
            : hiringSignals !== undefined
              ? "snippet_plus_structured_hiring_and_developer_intelligence"
              : communityArtifacts !== undefined
                ? "snippet_plus_structured_community_and_developer_intelligence"
                : "snippet_plus_structured_and_developer_intelligence"
          : hiringSignals !== undefined && communityArtifacts !== undefined
            ? "snippet_plus_hiring_community_and_developer_intelligence"
            : hiringSignals !== undefined
              ? "snippet_plus_hiring_and_developer_intelligence"
              : communityArtifacts !== undefined
                ? "snippet_plus_community_and_developer_intelligence"
                : extractedContent !== undefined
                  ? "snippet_plus_extracted_and_developer_intelligence"
                  : "snippet_plus_public_developer_intelligence"
        : communityArtifacts !== undefined
          ? hiringSignals !== undefined
            ? structuredContent !== undefined
              ? "snippet_plus_structured_hiring_and_community_intelligence"
              : "snippet_plus_hiring_and_community_intelligence"
            : "snippet_plus_public_community_intelligence"
          : hiringSignals !== undefined
            ? structuredContent !== undefined
              ? "snippet_plus_structured_and_hiring_intelligence"
              : extractedContent !== undefined
                ? "snippet_plus_extracted_and_hiring_intelligence"
                : "snippet_plus_public_hiring_intelligence"
            : structuredContent !== undefined
              ? "snippet_plus_structured_public_content"
              : extractedContent === undefined
                ? "snippet_only"
                : "snippet_plus_extracted_public_pages",
    materials,
    extractionSummary: {
      selectedPages: extractionSummary?.selectedUrls ?? 0,
      successfulPages: extractionSummary?.successfulExtractions ?? 0,
      partialPages: extractionSummary?.partialExtractions ?? 0,
      failedPages: extractionSummary?.failedExtractions ?? 0,
      blockedPages: extractionSummary?.blockedUrls ?? 0,
      structuredResources: structuredContent?.items.length ?? 0,
      structuredSections: structuredContent?.summary.totalSections ?? 0,
      structuredTables: structuredContent?.summary.totalTables ?? 0,
      structuredFootnotes:
        structuredContent?.items.reduce((count, item) => count + item.footnotes.length, 0) ?? 0,
      materialCount: materials.length,
    },
    findings,
    entities,
    coverage: parsed.coverage,
    warnings: [...new Set([...parsed.warnings, ...extractionWarnings])],
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
    const identityPositive = positive.filter(
      (finding) =>
        finding.signalType !== "community_signal" && finding.signalType !== "developer_signal",
    );
    const strongPositive = identityPositive.filter(
      (finding) => finding.strength === "strong",
    ).length;
    const strongNegative = findings.filter(
      (finding) => !finding.positive && finding.strength === "strong",
    ).length;
    const rolePlan = titlesForFindings(findings);
    const jobFindings = findings.filter((finding) => finding.materialKind === "public_job_posting");
    const signalFindings = findings.filter((finding) => finding.materialKind === "hiring_signal");
    const hiringCompanyName = [...jobFindings, ...signalFindings].find(
      (finding) => finding.provenance.companyName !== undefined,
    )?.provenance.companyName;
    const hiringCompanyDomain = [...jobFindings, ...signalFindings].find(
      (finding) => finding.provenance.companyDomain !== undefined,
    )?.provenance.companyDomain;
    const communityThreadFindings = findings.filter(
      (finding) => finding.materialKind === "reddit_thread",
    );
    const communityCommentFindings = findings.filter(
      (finding) => finding.materialKind === "reddit_comment",
    );
    const communitySignalFindings = findings.filter(
      (finding) => finding.materialKind === "community_signal",
    );
    const developerRepositoryFindings = findings.filter(
      (finding) => finding.materialKind === "github_repository",
    );
    const developerThreadFindings = findings.filter(
      (finding) => finding.materialKind === "github_thread",
    );
    const developerCommentFindings = findings.filter(
      (finding) => finding.materialKind === "github_comment",
    );
    const developerReleaseFindings = findings.filter(
      (finding) => finding.materialKind === "github_release",
    );
    const developerSignalFindings = findings.filter(
      (finding) => finding.materialKind === "developer_signal",
    );
    const confidence =
      strongPositive >= 2 && strongNegative === 0
        ? "high"
        : identityPositive.length > 0 && strongNegative === 0
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
      rationale: `${positive.length} positive and ${findings.length - positive.length} negative evidence findings support this role hypothesis. No real person was identified.`,
      sourceResultIds: [...new Set(findings.map((finding) => finding.searchResultId))],
      evidenceFindingIds: findings.map((finding) => finding.id),
      ...(communityThreadFindings.length === 0 &&
      communityCommentFindings.length === 0 &&
      communitySignalFindings.length === 0
        ? {}
        : {
            communityIdentityEvidence: {
              observedThreadFindingIds: communityThreadFindings.map((finding) => finding.id),
              observedCommentFindingIds: communityCommentFindings.map((finding) => finding.id),
              inferredSignalFindingIds: communitySignalFindings.map((finding) => finding.id),
              confidence: "low" as const,
              conservativeMatch: true as const,
              userIdentityUsed: false as const,
              limitations: [
                "Community evidence was attached only to an already-existing discovery entity and did not create or identify a buyer.",
                "Reddit usernames and handles are never used as company, buyer, or contact identities.",
                "Community discussion does not establish budget, authority, representative demand, or purchase intent.",
              ],
            },
          }),
      ...(developerRepositoryFindings.length === 0 &&
      developerThreadFindings.length === 0 &&
      developerCommentFindings.length === 0 &&
      developerReleaseFindings.length === 0 &&
      developerSignalFindings.length === 0
        ? {}
        : {
            developerIdentityEvidence: {
              observedRepositoryFindingIds: developerRepositoryFindings.map(
                (finding) => finding.id,
              ),
              observedThreadFindingIds: developerThreadFindings.map((finding) => finding.id),
              observedCommentFindingIds: developerCommentFindings.map((finding) => finding.id),
              observedReleaseFindingIds: developerReleaseFindings.map((finding) => finding.id),
              inferredSignalFindingIds: developerSignalFindings.map((finding) => finding.id),
              confidence: "low" as const,
              conservativeMatch: true as const,
              developerIdentityUsed: false as const,
              limitations: [
                "Developer evidence was attached only to an already-existing discovery entity and did not create or identify a buyer.",
                "GitHub usernames, handles, author associations, commit identities, and contributors are never used as company, buyer, or contact identities.",
                "Developer discussion and release activity do not establish budget, purchasing authority, representative market demand, or purchase intent.",
              ],
            },
          }),
      ...(jobFindings.length === 0 && signalFindings.length === 0
        ? {}
        : {
            hiringIdentityEvidence: {
              observedJobFindingIds: jobFindings.map((finding) => finding.id),
              inferredSignalFindingIds: signalFindings.map((finding) => finding.id),
              ...(hiringCompanyName === undefined ? {} : { companyName: hiringCompanyName }),
              ...(hiringCompanyDomain === undefined ? {} : { companyDomain: hiringCompanyDomain }),
              confidence: jobFindings.some(
                (finding) =>
                  finding.provenance.confidence !== undefined &&
                  finding.provenance.confidence >= 0.8,
              )
                ? "high"
                : jobFindings.length > 0
                  ? "medium"
                  : "low",
              conservativeMatch: true,
              limitations: [
                "Hiring identity evidence links only public company names/domains and never identifies a person.",
                "A hiring signal does not prove budget, expansion, replacement hiring, approved work, or purchase intent.",
              ],
            },
          }),
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
    const baselineFindings = findings.filter(
      (finding) =>
        finding.signalType !== "community_signal" && finding.signalType !== "developer_signal",
    );
    const baselinePositive = baselineFindings.filter((finding) => finding.positive);
    const hasPain = baselinePositive.some(
      (finding) =>
        (finding.signalType === "problem_signal" ||
          finding.signalType === "manual_process_signal") &&
        finding.strength !== "weak",
    );
    const hasRecent = baselinePositive.some((finding) => isRecent(finding, input.generatedAt));
    const hasHiring = baselinePositive.some((finding) => finding.signalType === "hiring_signal");
    const communityFindings = positive.filter(
      (finding) => finding.signalType === "community_signal",
    );
    const qualifyingCommunitySignalTypes = new Set([
      "pain",
      "complaint",
      "workflow_friction",
      "switching_intent",
      "competitor_dissatisfaction",
    ]);
    const qualifyingCommunityFindings = communityFindings.filter(
      (finding) =>
        finding.materialKind === "community_signal" &&
        finding.strength !== "weak" &&
        finding.provenance.communitySignalType !== undefined &&
        qualifyingCommunitySignalTypes.has(finding.provenance.communitySignalType) &&
        (finding.provenance.independentThreadCount ?? 0) >= 2 &&
        (finding.provenance.confidence ?? 0) >= 0.7 &&
        (finding.provenance.relevanceScore ?? 0) >= 0.7,
    );
    const hasCommunity = qualifyingCommunityFindings.length > 0;
    const communityIndependentThreadCount = Math.max(
      0,
      ...qualifyingCommunityFindings.map(
        (finding) => finding.provenance.independentThreadCount ?? 0,
      ),
    );
    const qualifyingDeveloperSignalTypes = new Set([
      "bug_pain",
      "integration_problem",
      "implementation_difficulty",
      "migration_signal",
      "alternative_search",
      "performance_problem",
      "dependency_problem",
      "breaking_change",
    ]);
    const qualifyingDeveloperFindings = positive.filter(
      (finding) =>
        finding.signalType === "developer_signal" &&
        finding.materialKind === "developer_signal" &&
        finding.strength !== "weak" &&
        finding.provenance.developerSignalType !== undefined &&
        qualifyingDeveloperSignalTypes.has(finding.provenance.developerSignalType) &&
        (finding.provenance.independentRepositoryCount ?? 0) >= 2 &&
        (finding.provenance.independentThreadCount ?? 0) >= 2 &&
        (finding.provenance.confidence ?? 0) >= 0.7 &&
        (finding.provenance.relevanceScore ?? 0) >= 0.7,
    );
    const hasDeveloper = qualifyingDeveloperFindings.length > 0;
    const developerIndependentRepositoryCount = Math.max(
      0,
      ...qualifyingDeveloperFindings.map(
        (finding) => finding.provenance.independentRepositoryCount ?? 0,
      ),
    );
    const developerIndependentThreadCount = Math.max(
      0,
      ...qualifyingDeveloperFindings.map(
        (finding) => finding.provenance.independentThreadCount ?? 0,
      ),
    );
    const hasWorkaround = baselinePositive.some((finding) =>
      ["competitor_signal", "workaround_signal", "manual_process_signal"].includes(
        finding.signalType,
      ),
    );
    const hasClearCompany = hypothesis.companyDomain !== undefined;
    const hasRoute = hypothesis.manualContactRoute.instructions.length > 0;
    const exclusionText = `${hypothesis.companyName} ${hypothesis.companyDomain ?? ""} ${baselineFindings
      .map((finding) => finding.summary)
      .join(" ")}`;
    const hasExclusionConflict =
      negative.some(
        (finding) =>
          finding.signalType !== "community_signal" &&
          finding.signalType !== "developer_signal" &&
          finding.signalType === "negative_signal",
      ) || textMatchesExclusion(exclusionText, input.mission.input.exclusions);
    const weakOrStale =
      baselinePositive.length === 0 ||
      baselinePositive.every((finding) => finding.strength === "weak" || finding.stale);
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
        1,
        hasHiring
          ? "A bounded public hiring signal contributes one capped point. It does not prove budget, expansion, replacement hiring, an approved project, or purchase intent."
          : "No related public hiring signal.",
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
    const communityPoints = hasCommunity ? 1 : 0;
    const developerPoints = hasDeveloper ? 1 : 0;
    const score =
      components.reduce((sum, component) => sum + component.points, 0) +
      communityPoints +
      developerPoints;
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
      communityContribution: {
        applied: hasCommunity,
        points: communityPoints,
        maximumShareOfPositiveScore: 0.08,
        rationale: hasCommunity
          ? "A repeated, mission-relevant pain, switching, or competitor-dissatisfaction signal across at least two independent Reddit threads contributes exactly one capped point. Community evidence cannot establish representative demand, buyer identity, budget, authority, or purchase intent."
          : "No qualifying repeated community signal was applied. Single threads, single weak comments, ambiguous links, low-confidence signals, and duplicate-route evidence contribute zero points.",
        independentThreadCount: communityIndependentThreadCount,
      },
      developerContribution: {
        applied: hasDeveloper,
        points: developerPoints,
        maximumShareOfPositiveScore: 0.08,
        rationale: hasDeveloper
          ? "A mission-relevant developer pain, migration, alternative-search, performance, dependency, or breaking-change signal supported across at least two independent public repositories and two threads contributes exactly one capped point. GitHub evidence cannot establish buyer identity, contact identity, budget, authority, purchase intent, or representative market demand."
          : "No qualifying independent developer signal was applied. Single-repository activity, release activity alone, maintenance/adoption hints, weak discussion, low-confidence signals, and ambiguous entity links contribute zero points.",
        independentRepositoryCount: developerIndependentRepositoryCount,
        independentThreadCount: developerIndependentThreadCount,
      },
      hiringContribution: {
        applied: hasHiring,
        points: hasHiring ? 1 : 0,
        maximumShareOfPositiveScore: 0.08,
        rationale: hasHiring
          ? "Public hiring evidence is capped at one point and cannot establish budget, expansion, replacement hiring, approved work, or purchase intent."
          : "No public hiring contribution was applied.",
      },
      evidenceSummary: `${positive.length} positive and ${negative.length} negative evidence findings.`,
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
        ...(finding.provenance.materialId === undefined
          ? {}
          : { materialId: finding.provenance.materialId }),
        ...(finding.provenance.materialKind === undefined
          ? {}
          : { materialKind: finding.provenance.materialKind }),
        ...(finding.provenance.extractionItemId === undefined
          ? {}
          : { extractionItemId: finding.provenance.extractionItemId }),
        ...(finding.provenance.frontierItemId === undefined
          ? {}
          : { frontierItemId: finding.provenance.frontierItemId }),
        ...(finding.provenance.structuredContentItemId === undefined
          ? {}
          : { structuredContentItemId: finding.provenance.structuredContentItemId }),
        ...(finding.provenance.sectionId === undefined
          ? {}
          : { sectionId: finding.provenance.sectionId }),
        ...(finding.provenance.tableId === undefined
          ? {}
          : { tableId: finding.provenance.tableId }),
        ...(finding.provenance.footnoteId === undefined
          ? {}
          : { footnoteId: finding.provenance.footnoteId }),
        ...(finding.provenance.parserProviderId === undefined
          ? {}
          : { parserProviderId: finding.provenance.parserProviderId }),
        ...(finding.provenance.parserVersion === undefined
          ? {}
          : { parserVersion: finding.provenance.parserVersion }),
        ...(finding.provenance.resourceKind === undefined
          ? {}
          : { resourceKind: finding.provenance.resourceKind }),
        ...(finding.provenance.structuredContentHash === undefined
          ? {}
          : { structuredContentHash: finding.provenance.structuredContentHash }),
        ...(finding.provenance.contentCompleteness === undefined
          ? {}
          : { contentCompleteness: finding.provenance.contentCompleteness }),
        ...(finding.provenance.headingPath === undefined
          ? {}
          : { headingPath: finding.provenance.headingPath }),
        ...(finding.provenance.extractedContentHash === undefined
          ? {}
          : { extractedContentHash: finding.provenance.extractedContentHash }),
        ...(finding.provenance.trustClassification === undefined
          ? {}
          : { trustClassification: finding.provenance.trustClassification }),
        ...(finding.provenance.targetId === undefined
          ? {}
          : { targetId: finding.provenance.targetId }),
        ...(finding.provenance.boardId === undefined
          ? {}
          : { boardId: finding.provenance.boardId }),
        ...(finding.provenance.jobId === undefined ? {} : { jobId: finding.provenance.jobId }),
        ...(finding.provenance.hiringSignalId === undefined
          ? {}
          : { hiringSignalId: finding.provenance.hiringSignalId }),
        ...(finding.provenance.hiringProviderId === undefined
          ? {}
          : { hiringProviderId: finding.provenance.hiringProviderId }),
        ...(finding.provenance.accessCategory === undefined
          ? {}
          : { accessCategory: finding.provenance.accessCategory }),
        ...(finding.provenance.companyName === undefined
          ? {}
          : { companyName: finding.provenance.companyName }),
        ...(finding.provenance.companyDomain === undefined
          ? {}
          : { companyDomain: finding.provenance.companyDomain }),
        ...(finding.provenance.roleFamily === undefined
          ? {}
          : { roleFamily: finding.provenance.roleFamily }),
        ...(finding.provenance.seniority === undefined
          ? {}
          : { seniority: finding.provenance.seniority }),
        ...(finding.provenance.workplaceType === undefined
          ? {}
          : { workplaceType: finding.provenance.workplaceType }),
        ...(finding.provenance.department === undefined
          ? {}
          : { department: finding.provenance.department }),
        ...(finding.provenance.technologyMentions === undefined
          ? {}
          : { technologyMentions: finding.provenance.technologyMentions }),
        ...(finding.provenance.confidence === undefined
          ? {}
          : { confidence: finding.provenance.confidence }),
        ...(finding.provenance.threadArtifactId === undefined
          ? {}
          : { threadArtifactId: finding.provenance.threadArtifactId }),
        ...(finding.provenance.commentCollectionArtifactId === undefined
          ? {}
          : { commentCollectionArtifactId: finding.provenance.commentCollectionArtifactId }),
        ...(finding.provenance.commentId === undefined
          ? {}
          : { commentId: finding.provenance.commentId }),
        ...(finding.provenance.communitySignalId === undefined
          ? {}
          : { communitySignalId: finding.provenance.communitySignalId }),
        ...(finding.provenance.communitySignalType === undefined
          ? {}
          : { communitySignalType: finding.provenance.communitySignalType }),
        ...(finding.provenance.subreddit === undefined
          ? {}
          : { subreddit: finding.provenance.subreddit }),
        ...(finding.provenance.relevanceScore === undefined
          ? {}
          : { relevanceScore: finding.provenance.relevanceScore }),
        ...(finding.provenance.redditLocalScore === undefined
          ? {}
          : { redditLocalScore: finding.provenance.redditLocalScore }),
        ...(finding.provenance.engagementSource === undefined
          ? {}
          : { engagementSource: finding.provenance.engagementSource }),
        ...(finding.provenance.engagementStalePossible === undefined
          ? {}
          : { engagementStalePossible: finding.provenance.engagementStalePossible }),
        ...(finding.provenance.independentThreadCount === undefined
          ? {}
          : { independentThreadCount: finding.provenance.independentThreadCount }),
        ...(finding.provenance.repositoryId === undefined
          ? {}
          : { repositoryId: finding.provenance.repositoryId }),
        ...(finding.provenance.repositoryFullName === undefined
          ? {}
          : { repositoryFullName: finding.provenance.repositoryFullName }),
        ...(finding.provenance.developerThreadKind === undefined
          ? {}
          : { developerThreadKind: finding.provenance.developerThreadKind }),
        ...(finding.provenance.developerThreadNumber === undefined
          ? {}
          : { developerThreadNumber: finding.provenance.developerThreadNumber }),
        ...(finding.provenance.developerCommentKind === undefined
          ? {}
          : { developerCommentKind: finding.provenance.developerCommentKind }),
        ...(finding.provenance.developerSignalId === undefined
          ? {}
          : { developerSignalId: finding.provenance.developerSignalId }),
        ...(finding.provenance.developerSignalType === undefined
          ? {}
          : { developerSignalType: finding.provenance.developerSignalType }),
        ...(finding.provenance.developerQueryIds === undefined
          ? {}
          : { developerQueryIds: finding.provenance.developerQueryIds }),
        ...(finding.provenance.developerQueryIntents === undefined
          ? {}
          : { developerQueryIntents: finding.provenance.developerQueryIntents }),
        ...(finding.provenance.developerLocalScore === undefined
          ? {}
          : { developerLocalScore: finding.provenance.developerLocalScore }),
        ...(finding.provenance.independentRepositoryCount === undefined
          ? {}
          : { independentRepositoryCount: finding.provenance.independentRepositoryCount }),
        ...(finding.provenance.authorAssociation === undefined
          ? {}
          : { authorAssociation: finding.provenance.authorAssociation }),
        ...(finding.provenance.releaseId === undefined
          ? {}
          : { releaseId: finding.provenance.releaseId }),
        ...(finding.provenance.releaseTagName === undefined
          ? {}
          : { releaseTagName: finding.provenance.releaseTagName }),
        ...(finding.provenance.releasePrerelease === undefined
          ? {}
          : { releasePrerelease: finding.provenance.releasePrerelease }),
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
    warning: evidence.evidenceSourceMode.includes("developer_intelligence")
      ? "Buyer Map includes bounded public GitHub evidence. Repositories, issues, pull requests, comments, reviews, releases, and deterministic developer signals do not verify representative demand, company or buyer identity, contact identity, budget, purchasing authority, or buying intent. GitHub usernames and author associations remain source attribution only."
      : evidence.evidenceSourceMode.includes("community_intelligence")
        ? "Buyer Map includes sampled public Reddit evidence. Community threads, comments, and deterministic signals are anecdotal and do not verify representative demand, company or buyer identity, budget, purchasing authority, or buying intent."
        : evidence.evidenceSourceMode.includes("hiring_intelligence")
          ? "Buyer Map includes bounded public hiring evidence. Jobs and hiring signals do not verify budget, expansion, replacement hiring, approved projects, identities, purchasing authority, or buying intent."
          : evidence.evidenceSourceMode === "snippet_plus_structured_public_content"
            ? "Buyer Map is a deterministic synthesis of search results, bounded public-page extraction, and structured public resources. It does not verify identities, purchasing authority, or buying intent."
            : evidence.evidenceSourceMode === "snippet_plus_extracted_public_pages"
              ? "Buyer Map is a deterministic synthesis of search results and bounded untrusted public-page extraction. It does not verify identities, purchasing authority, or buying intent."
              : PROJECT_B_FIXTURE_WARNING,
    generatedAt: input.generatedAt,
    evidenceSourceMode: evidence.evidenceSourceMode,
    summary: {
      rankedOpportunityCount: opportunities.length,
      positiveEvidenceCount: evidence.findings.filter((finding) => finding.positive).length,
      negativeEvidenceCount: evidence.findings.filter((finding) => !finding.positive).length,
      coverageGapCount: coverageGaps.length,
      extractedEvidenceCitationCount: opportunities.reduce(
        (count, opportunity) =>
          count +
          opportunity.evidence.filter(
            (citation) => citation.trustClassification === "untrusted_public_content",
          ).length,
        0,
      ),
      structuredEvidenceCitationCount: opportunities.reduce(
        (count, opportunity) =>
          count +
          opportunity.evidence.filter((citation) =>
            citation.materialKind?.startsWith("structured_"),
          ).length,
        0,
      ),
      publicJobCitationCount: opportunities.reduce(
        (count, opportunity) =>
          count +
          opportunity.evidence.filter((citation) => citation.materialKind === "public_job_posting")
            .length,
        0,
      ),
      hiringSignalCitationCount: opportunities.reduce(
        (count, opportunity) =>
          count +
          opportunity.evidence.filter((citation) => citation.materialKind === "hiring_signal")
            .length,
        0,
      ),
      redditThreadCitationCount: opportunities.reduce(
        (count, opportunity) =>
          count +
          opportunity.evidence.filter((citation) => citation.materialKind === "reddit_thread")
            .length,
        0,
      ),
      redditCommentCitationCount: opportunities.reduce(
        (count, opportunity) =>
          count +
          opportunity.evidence.filter((citation) => citation.materialKind === "reddit_comment")
            .length,
        0,
      ),
      communitySignalCitationCount: opportunities.reduce(
        (count, opportunity) =>
          count +
          opportunity.evidence.filter((citation) => citation.materialKind === "community_signal")
            .length,
        0,
      ),
      githubRepositoryCitationCount: opportunities.reduce(
        (count, opportunity) =>
          count +
          opportunity.evidence.filter((citation) => citation.materialKind === "github_repository")
            .length,
        0,
      ),
      githubThreadCitationCount: opportunities.reduce(
        (count, opportunity) =>
          count +
          opportunity.evidence.filter((citation) => citation.materialKind === "github_thread")
            .length,
        0,
      ),
      githubCommentCitationCount: opportunities.reduce(
        (count, opportunity) =>
          count +
          opportunity.evidence.filter((citation) => citation.materialKind === "github_comment")
            .length,
        0,
      ),
      githubReleaseCitationCount: opportunities.reduce(
        (count, opportunity) =>
          count +
          opportunity.evidence.filter((citation) => citation.materialKind === "github_release")
            .length,
        0,
      ),
      developerSignalCitationCount: opportunities.reduce(
        (count, opportunity) =>
          count +
          opportunity.evidence.filter((citation) => citation.materialKind === "developer_signal")
            .length,
        0,
      ),
    },
    opportunities,
    coverageGaps,
    confidenceLimitations: searchResults.coverage.confidenceLimitations,
    warnings: [...new Set([...searchResults.warnings, ...ranked.warnings, ...evidence.warnings])],
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
