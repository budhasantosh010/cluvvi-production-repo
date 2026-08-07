import {
  SearchResultsArtifactV2Schema,
  canonicalDigest,
  deterministicHiringSignalsId,
  deterministicJobCollectionId,
  deterministicSourceAdapterTelemetryId,
  deterministicSourceTargetPlanId,
  type HiringSignalsArtifactV1,
  type JobCollectionArtifactV1,
  type SourceAdapterRunTelemetryV1,
  type SourceTargetPlanArtifactV1,
} from "../src/index";
import { validateHiringArtifactSet } from "../src/local/hiring/validators";
import { describe, expect, it } from "vitest";

const searchResults = SearchResultsArtifactV2Schema.parse({
  schemaVersion: "2.0",
  artifactKind: "search_results.v2",
  requestId: "request_hiring",
  discoveryGoal: "customer_opportunities",
  discoveryMode: "free_only",
  domainPackIds: ["hiring"],
  summary: {
    queriesPlanned: 1,
    queriesExecuted: 1,
    providersUsed: ["fixture"],
    rawResults: 1,
    dedupedResults: 1,
    paidCreditsUsed: 0,
    startedAt: "2026-08-01T00:00:00.000Z",
    completedAt: "2026-08-01T00:00:01.000Z",
  },
  providerBreakdown: [
    {
      providerId: "fixture",
      providerCategory: "fixture",
      sourceZone: "company_websites",
      searchMethod: "keyword_search",
      queriesExecuted: 1,
      resultsReturned: 1,
      errors: 0,
    },
  ],
  results: [
    {
      id: "result_acme",
      queryId: "query_acme",
      query: "Acme careers",
      providerId: "fixture",
      providerCategory: "fixture",
      discoveryGoal: "customer_opportunities",
      searchMethod: "keyword_search",
      sourceZone: "company_websites",
      signalIntent: "custom:hiring_signal",
      title: "Acme careers",
      snippet: "Acme public careers page.",
      url: "https://www.example.com/careers",
      domain: "example.com",
      authorOrCompany: "Acme",
      credibility: "official",
      discoveredAt: "2026-08-01T00:00:00.000Z",
    },
  ],
  coverage: {
    searchedSourceZones: ["company_websites"],
    skippedSourceZones: [],
    providersUsed: ["fixture"],
    providersUnavailable: [],
    manualReviewRecommended: [],
    confidenceLimitations: ["Controlled fixture."],
    nextBestSearches: [],
  },
  warnings: ["Controlled fixture."],
});

function validSet(): {
  sourceTargetPlan: SourceTargetPlanArtifactV1;
  jobCollection: JobCollectionArtifactV1;
  hiringSignals: HiringSignalsArtifactV1;
  telemetry: SourceAdapterRunTelemetryV1;
} {
  const sourceTargetPlanWithoutId: Omit<SourceTargetPlanArtifactV1, "artifactId"> = {
    schemaVersion: "1.0",
    artifactKind: "source_target_plan.v1",
    requestId: searchResults.requestId,
    sourceFamily: "hiring",
    searchResultsDigest: canonicalDigest(searchResults),
    policy: {
      maximumTargets: 2,
      minimumTargetConfidence: 0.5,
      maximumBoardsPerTarget: 2,
      maximumDiscoveryQueriesPerTarget: 1,
    },
    targets: [
      {
        targetId: "target_acme",
        companyNameHint: "Acme",
        companyDomainHint: "example.com",
        officialWebsiteUrlHint: "https://www.example.com",
        evidenceReferences: [
          {
            artifactKind: "search_results.v2",
            itemId: "result_acme",
            reason: "Official company careers result.",
          },
        ],
        confidence: 0.9,
        selectionReasons: ["Official domain and careers evidence agree."],
        candidateCareersUrls: ["https://www.example.com/careers"],
        candidateBoardUrls: ["https://boards.greenhouse.io/acme"],
        status: "selected",
        limitations: [],
      },
    ],
    summary: {
      candidatesEvaluated: 1,
      targetsSelected: 1,
      targetsSkipped: 0,
      targetsManualRequired: 0,
    },
    warnings: [],
  };
  const sourceTargetPlan: SourceTargetPlanArtifactV1 = {
    ...sourceTargetPlanWithoutId,
    artifactId: deterministicSourceTargetPlanId(sourceTargetPlanWithoutId),
  };

  const jobCollectionWithoutId: Omit<JobCollectionArtifactV1, "artifactId"> = {
    schemaVersion: "1.0",
    artifactKind: "job_collection.v1",
    requestId: searchResults.requestId,
    sourceTargetPlanArtifactId: sourceTargetPlan.artifactId,
    sourceTargetPlanDigest: canonicalDigest(sourceTargetPlan),
    boards: [
      {
        boardId: "board_acme",
        targetId: "target_acme",
        providerId: "greenhouse_public_jobs",
        accessCategory: "keyless_free",
        boardSlug: "acme",
        publicBoardUrl: "https://boards.greenhouse.io/acme",
        officialCareersPageUrl: "https://www.example.com/careers",
        companyNameHint: "Acme",
        companyDomainHint: "example.com",
        relationshipConfidence: 0.92,
        relationshipEvidence: [
          {
            type: "linked_from_official_site",
            description: "The official careers page links to the public board.",
            confidence: 0.92,
          },
        ],
        status: "validated",
        limitations: [],
      },
    ],
    jobs: [
      {
        jobId: "job_acme_data",
        targetId: "target_acme",
        boardId: "board_acme",
        sourceProviderId: "greenhouse_public_jobs",
        sourceNativeId: "123",
        companyName: "Acme",
        companyDomain: "example.com",
        title: "Senior Data Engineer",
        descriptionText: "Build public data systems with Python and Snowflake.",
        descriptionHash: canonicalDigest("Build public data systems with Python and Snowflake."),
        department: "Data",
        roleFamily: "data_ai",
        roleFamilyConfidence: 0.9,
        roleFamilyMatchedRules: ["title:data"],
        seniority: "senior",
        seniorityConfidence: 0.9,
        seniorityMatchedRules: ["title:senior"],
        workplaceType: "remote",
        locations: [{ rawText: "Remote - US", remote: true, confidence: 0.9 }],
        publishedAt: "2026-08-01T00:00:00.000Z",
        jobUrl: "https://boards.greenhouse.io/acme/jobs/123",
        applicationUrl: "https://boards.greenhouse.io/acme/jobs/123",
        technologyMentions: [
          {
            canonicalName: "Snowflake",
            observedText: "Snowflake",
            category: "data",
            sourceField: "description",
            confidence: 0.95,
          },
        ],
        skillMentions: [
          {
            canonicalName: "Python",
            observedText: "Python",
            sourceField: "description",
            confidence: 0.95,
          },
        ],
        status: "active",
        trustClassification: "untrusted_public_content",
        contentHash: canonicalDigest({ title: "Senior Data Engineer", sourceNativeId: "123" }),
        provenance: [
          {
            providerId: "greenhouse_public_jobs",
            boardId: "board_acme",
            sourceNativeId: "123",
            sourceUrl: "https://boards.greenhouse.io/acme/jobs/123",
          },
        ],
        limitations: [],
      },
    ],
    summary: {
      targetsAttempted: 1,
      boardsValidated: 1,
      boardsFailed: 0,
      rawJobsReceived: 1,
      acceptedJobs: 1,
      duplicateJobsRemoved: 0,
      invalidJobsRemoved: 0,
      activeJobs: 1,
      undatedJobs: 0,
      providersUsed: ["greenhouse_public_jobs"],
      companiesRepresented: 1,
      departments: ["Data"],
      locations: ["Remote - US"],
      workplaceTypes: ["remote"],
    },
    limitations: [],
    warnings: [],
  };
  const jobCollection: JobCollectionArtifactV1 = {
    ...jobCollectionWithoutId,
    artifactId: deterministicJobCollectionId(jobCollectionWithoutId),
  };

  const hiringSignalsWithoutId: Omit<HiringSignalsArtifactV1, "artifactId"> = {
    schemaVersion: "1.0",
    artifactKind: "hiring_signals.v1",
    requestId: searchResults.requestId,
    jobCollectionArtifactId: jobCollection.artifactId,
    jobCollectionDigest: canonicalDigest(jobCollection),
    rulesVersion: "hiring_signals@1.0.0",
    taxonomyVersion: "hiring_taxonomy@1.0.0",
    technologyLexiconVersion: "hiring_technology_lexicon@1.0.0",
    companies: [
      {
        targetId: "target_acme",
        companyName: "Acme",
        companyDomain: "example.com",
        activeJobCount: 1,
        datedJobCount: 1,
        seniorJobCount: 1,
        roleFamilyCounts: { data_ai: 1 },
        seniorityCounts: { senior: 1 },
        departments: ["Data"],
        locations: ["Remote - US"],
        workplaceTypes: ["remote"],
        repeatedTechnologies: [{ technology: "Snowflake", jobCount: 1 }],
        limitations: [],
      },
    ],
    signals: [
      {
        signalId: "signal_acme_data",
        targetId: "target_acme",
        companyName: "Acme",
        type: "technology_demand",
        supportingJobIds: ["job_acme_data"],
        observedFacts: ["One active public job mentions Snowflake."],
        inference: "The public role may indicate current demand for Snowflake skills.",
        confidence: 0.65,
        evidenceCount: 1,
        independentBoardCount: 1,
        observedAt: "2026-08-01T00:00:01.000Z",
        ruleId: "technology-demand",
        ruleVersion: "1.0.0",
        limitations: ["One job is limited evidence."],
      },
    ],
    summary: {
      companiesAnalyzed: 1,
      signalsGenerated: 1,
      highConfidenceSignals: 0,
      mediumConfidenceSignals: 1,
      lowConfidenceSignals: 0,
      dominantRoleFamilies: ["data_ai"],
      repeatedTechnologies: ["Snowflake"],
    },
    limitations: [],
    warnings: [],
  };
  const hiringSignals: HiringSignalsArtifactV1 = {
    ...hiringSignalsWithoutId,
    artifactId: deterministicHiringSignalsId(hiringSignalsWithoutId),
  };

  const telemetryWithoutId: Omit<SourceAdapterRunTelemetryV1, "artifactId"> = {
    schemaVersion: "1.0",
    artifactKind: "source_adapter_run_telemetry.v1",
    requestId: searchResults.requestId,
    sourceFamily: "hiring",
    sourceTargetPlanArtifactId: sourceTargetPlan.artifactId,
    jobCollectionArtifactId: jobCollection.artifactId,
    hiringSignalsArtifactId: hiringSignals.artifactId,
    startedAt: "2026-08-01T00:00:00.000Z",
    completedAt: "2026-08-01T00:00:01.000Z",
    totalRuntimeMs: 1_000,
    attempts: [
      {
        targetId: "target_acme",
        boardId: "board_acme",
        adapterId: "greenhouse_public_jobs",
        accessCategory: "keyless_free",
        attempted: true,
        requests: 1,
        pages: 1,
        durationMs: 1_000,
        rawItems: 1,
        acceptedItems: 1,
        duplicateItems: 0,
        invalidItems: 0,
        outcome: "success",
      },
    ],
    totals: {
      targetsAttempted: 1,
      boardsAttempted: 1,
      requestsAttempted: 1,
      requestsSuccessful: 1,
      requestsFailed: 0,
      rawJobs: 1,
      acceptedJobs: 1,
      duplicateJobs: 0,
      invalidJobs: 0,
      keylessRequests: 1,
      authenticatedFreeRequests: 0,
      paidRequests: 0,
      signalsGenerated: 1,
    },
    warnings: [],
  };
  const telemetry: SourceAdapterRunTelemetryV1 = {
    ...telemetryWithoutId,
    artifactId: deterministicSourceAdapterTelemetryId(telemetryWithoutId),
  };
  return { sourceTargetPlan, jobCollection, hiringSignals, telemetry };
}

function validate(set = validSet()) {
  return validateHiringArtifactSet({
    searchResults,
    ...set,
    providerPolicy: "free_only",
  });
}

describe("independent C1-J hiring artifact contracts", () => {
  it("validates the complete deterministic artifact set", () => {
    const result = validate();
    expect(result.jobCollection.jobs).toHaveLength(1);
    expect(result.hiringSignals.signals).toHaveLength(1);
    expect(result.telemetry.totals.paidRequests).toBe(0);
  });

  it.each([
    [
      "bad target digest",
      (set: ReturnType<typeof validSet>): void => {
        set.sourceTargetPlan.searchResultsDigest = "0".repeat(64);
      },
      "SOURCE_TARGET_PLAN_INVALID",
    ],
    [
      "orphan job board",
      (set: ReturnType<typeof validSet>): void => {
        set.jobCollection.jobs[0]!.boardId = "missing";
      },
      "HIRING_ORPHAN_REFERENCE",
    ],
    [
      "private URL",
      (set: ReturnType<typeof validSet>): void => {
        set.jobCollection.jobs[0]!.jobUrl = "http://127.0.0.1/jobs/1";
      },
      "JOB_COLLECTION_INVALID",
    ],
    [
      "telemetry mismatch",
      (set: ReturnType<typeof validSet>): void => {
        set.telemetry.totals.signalsGenerated = 0;
      },
      "SOURCE_ADAPTER_TELEMETRY_INVALID",
    ],
    [
      "paid free-only request",
      (set: ReturnType<typeof validSet>): void => {
        set.telemetry.totals.paidRequests = 1;
      },
      "SOURCE_ADAPTER_TELEMETRY_INVALID",
    ],
  ] as const)("rejects %s", (_name, mutate, code) => {
    const set = validSet();
    mutate(set);
    expect(() => validate(set)).toThrow(expect.objectContaining({ code }));
  });

  it.each(["candidateEmail", "rawHtml", "requestHeaders"])(
    "rejects forbidden %s fields",
    (field) => {
      const set = validSet();
      (set.jobCollection as unknown as Record<string, unknown>)[field] = "forbidden";
      expect(() => validate(set)).toThrow(
        expect.objectContaining({ code: "HIRING_PRIVATE_DATA_REJECTED" }),
      );
    },
  );

  it("rejects prohibited definitive inference language", () => {
    const set = validSet();
    set.hiringSignals.signals[0]!.inference = "This confirms budget and proves they are expanding.";
    expect(() => validate(set)).toThrow();
  });

  it("rejects deterministic artifact ID mutations", () => {
    const set = validSet();
    set.hiringSignals.artifactId = "hiring_signals_tampered";
    expect(() => validate(set)).toThrow(
      expect.objectContaining({ code: "HIRING_SIGNALS_INVALID" }),
    );
  });
});
