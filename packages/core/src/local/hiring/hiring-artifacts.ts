import { z } from "zod";

export const PublicHiringUrlSchema = z.url().refine((value) => {
  const protocol = new URL(value).protocol;
  return protocol === "http:" || protocol === "https:";
}, "Only HTTP or HTTPS URLs are allowed.");

export const SourceAccessCategoryV1Schema = z.enum([
  "keyless_free",
  "authenticated_free",
  "paid",
  "manual",
  "fixture",
]);
export type SourceAccessCategoryV1 = z.infer<typeof SourceAccessCategoryV1Schema>;

export const HiringProviderIdV1Schema = z.enum([
  "greenhouse_public_jobs",
  "ashby_public_jobs",
  "lever_public_jobs",
  "workable_public_jobs",
  "smartrecruiters_posting_api",
  "jobposting_jsonld",
  "generic_careers_page",
]);
export type HiringProviderIdV1 = z.infer<typeof HiringProviderIdV1Schema>;

export const Sha256Schema = z.string().regex(/^[a-f0-9]{64}$/);
export const ConfidenceSchema = z.number().min(0).max(1);
export const LimitationListSchema = z.array(z.string().min(1).max(1_000)).max(200);

export const HiringSourceTargetV1Schema = z
  .object({
    targetId: z.string().min(1).max(200),
    companyNameHint: z.string().min(1).max(500),
    companyDomainHint: z.string().min(1).max(253).optional(),
    officialWebsiteUrlHint: PublicHiringUrlSchema.optional(),
    evidenceReferences: z
      .array(
        z
          .object({
            artifactKind: z.enum([
              "search_results.v2",
              "extracted_content.v1",
              "structured_content.v1",
            ]),
            itemId: z.string().min(1).max(500),
            reason: z.string().min(1).max(1_000),
          })
          .strict(),
      )
      .max(100),
    confidence: ConfidenceSchema,
    selectionReasons: z.array(z.string().min(1).max(1_000)).min(1).max(100),
    candidateCareersUrls: z.array(PublicHiringUrlSchema).max(20),
    candidateBoardUrls: z.array(PublicHiringUrlSchema).max(20),
    status: z.enum(["selected", "skipped", "manual_required"]),
    skipOrFailureCode: z.string().min(1).max(100).optional(),
    limitations: LimitationListSchema,
  })
  .strict();
export type HiringSourceTargetV1 = z.infer<typeof HiringSourceTargetV1Schema>;

export const SourceTargetPlanArtifactV1Schema = z
  .object({
    schemaVersion: z.literal("1.0"),
    artifactKind: z.literal("source_target_plan.v1"),
    artifactId: z.string().min(1).max(200),
    requestId: z.string().min(1).max(200),
    sourceFamily: z.literal("hiring"),
    searchResultsDigest: Sha256Schema,
    structuredContentArtifactId: z.string().min(1).max(200).optional(),
    structuredContentDigest: Sha256Schema.optional(),
    policy: z
      .object({
        maximumTargets: z.number().int().min(1).max(10_000),
        minimumTargetConfidence: ConfidenceSchema,
        maximumBoardsPerTarget: z.number().int().min(1).max(50),
        maximumDiscoveryQueriesPerTarget: z.number().int().min(0).max(5),
      })
      .strict(),
    targets: z.array(HiringSourceTargetV1Schema).max(10_000),
    summary: z
      .object({
        candidatesEvaluated: z.number().int().nonnegative(),
        targetsSelected: z.number().int().nonnegative(),
        targetsSkipped: z.number().int().nonnegative(),
        targetsManualRequired: z.number().int().nonnegative(),
      })
      .strict(),
    warnings: z.array(z.string().min(1).max(1_000)).max(200),
  })
  .strict()
  .superRefine((artifact, context) => {
    const ids = new Set<string>();
    for (const [index, target] of artifact.targets.entries()) {
      if (ids.has(target.targetId)) {
        context.addIssue({
          code: "custom",
          path: ["targets", index, "targetId"],
          message: "Target IDs must be unique.",
        });
      }
      ids.add(target.targetId);
      if (target.candidateBoardUrls.length > artifact.policy.maximumBoardsPerTarget * 4) {
        context.addIssue({
          code: "custom",
          path: ["targets", index, "candidateBoardUrls"],
          message: "Target board candidates exceed the bounded planning allowance.",
        });
      }
    }
    const selected = artifact.targets.filter((target) => target.status === "selected").length;
    const skipped = artifact.targets.filter((target) => target.status === "skipped").length;
    const manual = artifact.targets.filter((target) => target.status === "manual_required").length;
    if (
      selected !== artifact.summary.targetsSelected ||
      skipped !== artifact.summary.targetsSkipped ||
      manual !== artifact.summary.targetsManualRequired
    ) {
      context.addIssue({
        code: "custom",
        path: ["summary"],
        message: "Target-plan summary counts must reconcile with targets.",
      });
    }
    if (selected > artifact.policy.maximumTargets) {
      context.addIssue({
        code: "custom",
        path: ["targets"],
        message: "Selected target count exceeds policy maximum.",
      });
    }
    if (
      (artifact.structuredContentArtifactId === undefined) !==
      (artifact.structuredContentDigest === undefined)
    ) {
      context.addIssue({
        code: "custom",
        path: ["structuredContentArtifactId"],
        message: "Structured artifact ID and digest must be present together.",
      });
    }
  });
export type SourceTargetPlanArtifactV1 = z.infer<typeof SourceTargetPlanArtifactV1Schema>;

export const JobBoardSourceV1Schema = z
  .object({
    boardId: z.string().min(1).max(200),
    targetId: z.string().min(1).max(200),
    providerId: HiringProviderIdV1Schema,
    accessCategory: SourceAccessCategoryV1Schema,
    boardSlug: z.string().min(1).max(500).optional(),
    providerRegion: z.string().min(1).max(100).optional(),
    publicBoardUrl: PublicHiringUrlSchema,
    officialCareersPageUrl: PublicHiringUrlSchema.optional(),
    companyNameHint: z.string().min(1).max(500),
    companyDomainHint: z.string().min(1).max(253).optional(),
    relationshipConfidence: ConfidenceSchema,
    relationshipEvidence: z
      .array(
        z
          .object({
            type: z.enum([
              "linked_from_official_site",
              "same_registrable_domain",
              "organization_name_match",
              "jobposting_organization_match",
              "board_metadata_match",
              "search_result_match",
              "slug_match",
            ]),
            description: z.string().min(1).max(1_000),
            confidence: ConfidenceSchema,
          })
          .strict(),
      )
      .min(1)
      .max(100),
    status: z.enum(["validated", "low_confidence", "rejected", "manual_required"]),
    limitations: LimitationListSchema,
  })
  .strict();
export type JobBoardSourceV1 = z.infer<typeof JobBoardSourceV1Schema>;

export const RoleFamilyV1Schema = z.enum([
  "executive",
  "engineering",
  "data_ai",
  "it_security",
  "sales",
  "marketing",
  "customer_success",
  "operations",
  "finance",
  "people_hr",
  "legal_compliance",
  "product",
  "design",
  "support",
  "procurement",
  "research",
  "other",
  "unknown",
]);
export type RoleFamilyV1 = z.infer<typeof RoleFamilyV1Schema>;

export const SeniorityLevelV1Schema = z.enum([
  "intern",
  "entry",
  "mid",
  "senior",
  "staff_principal",
  "manager",
  "director",
  "vice_president",
  "c_suite",
  "unknown",
]);
export type SeniorityLevelV1 = z.infer<typeof SeniorityLevelV1Schema>;

export const JobLocationV1Schema = z
  .object({
    rawText: z.string().min(1).max(2_000),
    city: z.string().min(1).max(500).optional(),
    region: z.string().min(1).max(500).optional(),
    country: z.string().min(1).max(500).optional(),
    countryCode: z
      .string()
      .regex(/^[A-Z]{2}$/)
      .optional(),
    remote: z.boolean().optional(),
    confidence: ConfidenceSchema,
  })
  .strict();

export const PublicCompensationV1Schema = z
  .object({
    minimum: z.number().nonnegative().optional(),
    maximum: z.number().nonnegative().optional(),
    currency: z.string().min(1).max(20).optional(),
    interval: z.string().min(1).max(100).optional(),
    rawText: z.string().min(1).max(5_000).optional(),
    sourceProvided: z.literal(true),
    confidence: ConfidenceSchema,
    limitations: LimitationListSchema,
  })
  .strict()
  .superRefine((value, context) => {
    if (
      value.minimum !== undefined &&
      value.maximum !== undefined &&
      value.maximum < value.minimum
    ) {
      context.addIssue({
        code: "custom",
        path: ["maximum"],
        message: "Compensation maximum cannot be below minimum.",
      });
    }
    if (value.minimum === undefined && value.maximum === undefined && value.rawText === undefined) {
      context.addIssue({
        code: "custom",
        path: [],
        message: "Compensation must preserve at least one source-provided value.",
      });
    }
  });

export const TechnologyMentionV1Schema = z
  .object({
    canonicalName: z.string().min(1).max(200),
    observedText: z.string().min(1).max(200),
    category: z.enum([
      "crm",
      "cloud",
      "data",
      "ai_ml",
      "security",
      "erp",
      "hris",
      "marketing",
      "programming",
      "infrastructure",
      "analytics",
      "other",
    ]),
    sourceField: z.enum(["title", "description", "requirements", "metadata"]),
    confidence: ConfidenceSchema,
  })
  .strict();

export const SkillMentionV1Schema = z
  .object({
    canonicalName: z.string().min(1).max(200),
    observedText: z.string().min(1).max(200),
    sourceField: z.enum(["title", "description", "requirements", "metadata"]),
    confidence: ConfidenceSchema,
  })
  .strict();

export const NormalizedJobV1Schema = z
  .object({
    jobId: z.string().min(1).max(200),
    targetId: z.string().min(1).max(200),
    boardId: z.string().min(1).max(200),
    sourceProviderId: HiringProviderIdV1Schema,
    sourceNativeId: z.string().min(1).max(1_000).optional(),
    companyName: z.string().min(1).max(500),
    companyDomain: z.string().min(1).max(253).optional(),
    title: z.string().min(1).max(2_000),
    descriptionText: z.string().min(1).max(50_000).optional(),
    descriptionHash: Sha256Schema.optional(),
    department: z.string().min(1).max(1_000).optional(),
    team: z.string().min(1).max(1_000).optional(),
    function: z.string().min(1).max(1_000).optional(),
    roleFamily: RoleFamilyV1Schema.optional(),
    roleFamilyConfidence: ConfidenceSchema.optional(),
    roleFamilyMatchedRules: z.array(z.string().min(1).max(200)).max(100).optional(),
    seniority: SeniorityLevelV1Schema.optional(),
    seniorityConfidence: ConfidenceSchema.optional(),
    seniorityMatchedRules: z.array(z.string().min(1).max(200)).max(100).optional(),
    employmentType: z.string().min(1).max(500).optional(),
    workplaceType: z.enum(["remote", "hybrid", "on_site", "unspecified"]),
    locations: z.array(JobLocationV1Schema).max(25),
    compensation: PublicCompensationV1Schema.optional(),
    publishedAt: z.iso.datetime().optional(),
    updatedAt: z.iso.datetime().optional(),
    validThrough: z.iso.datetime().optional(),
    jobUrl: PublicHiringUrlSchema,
    applicationUrl: PublicHiringUrlSchema.optional(),
    technologyMentions: z.array(TechnologyMentionV1Schema).max(100),
    skillMentions: z.array(SkillMentionV1Schema).max(250),
    status: z.literal("active"),
    trustClassification: z.literal("untrusted_public_content"),
    contentHash: Sha256Schema,
    provenance: z
      .array(
        z
          .object({
            providerId: HiringProviderIdV1Schema,
            boardId: z.string().min(1).max(200),
            sourceNativeId: z.string().min(1).max(1_000).optional(),
            sourceUrl: PublicHiringUrlSchema,
          })
          .strict(),
      )
      .min(1)
      .max(100),
    limitations: LimitationListSchema,
  })
  .strict();
export type NormalizedJobV1 = z.infer<typeof NormalizedJobV1Schema>;

export const JobCollectionArtifactV1Schema = z
  .object({
    schemaVersion: z.literal("1.0"),
    artifactKind: z.literal("job_collection.v1"),
    artifactId: z.string().min(1).max(200),
    requestId: z.string().min(1).max(200),
    sourceTargetPlanArtifactId: z.string().min(1).max(200),
    sourceTargetPlanDigest: Sha256Schema,
    boards: z.array(JobBoardSourceV1Schema).max(50_000),
    jobs: z.array(NormalizedJobV1Schema).max(10_000),
    summary: z
      .object({
        targetsAttempted: z.number().int().nonnegative(),
        boardsValidated: z.number().int().nonnegative(),
        boardsFailed: z.number().int().nonnegative(),
        rawJobsReceived: z.number().int().nonnegative(),
        acceptedJobs: z.number().int().nonnegative(),
        duplicateJobsRemoved: z.number().int().nonnegative(),
        invalidJobsRemoved: z.number().int().nonnegative(),
        activeJobs: z.number().int().nonnegative(),
        undatedJobs: z.number().int().nonnegative(),
        providersUsed: z.array(HiringProviderIdV1Schema).max(20),
        companiesRepresented: z.number().int().nonnegative(),
        departments: z.array(z.string().min(1).max(1_000)).max(10_000),
        locations: z.array(z.string().min(1).max(2_000)).max(10_000),
        workplaceTypes: z.array(z.enum(["remote", "hybrid", "on_site", "unspecified"])).max(4),
      })
      .strict(),
    limitations: LimitationListSchema,
    warnings: z.array(z.string().min(1).max(1_000)).max(200),
  })
  .strict()
  .superRefine((artifact, context) => {
    const boardIds = new Set<string>();
    for (const [index, board] of artifact.boards.entries()) {
      if (boardIds.has(board.boardId))
        context.addIssue({
          code: "custom",
          path: ["boards", index, "boardId"],
          message: "Board IDs must be unique.",
        });
      boardIds.add(board.boardId);
    }
    const jobIds = new Set<string>();
    for (const [index, job] of artifact.jobs.entries()) {
      if (jobIds.has(job.jobId))
        context.addIssue({
          code: "custom",
          path: ["jobs", index, "jobId"],
          message: "Job IDs must be unique.",
        });
      jobIds.add(job.jobId);
      if (!boardIds.has(job.boardId))
        context.addIssue({
          code: "custom",
          path: ["jobs", index, "boardId"],
          message: "HIRING_ORPHAN_REFERENCE: every job must reference an existing board.",
        });
      if ((job.descriptionText === undefined) !== (job.descriptionHash === undefined))
        context.addIssue({
          code: "custom",
          path: ["jobs", index, "descriptionHash"],
          message: "Description text and hash must be present together.",
        });
    }
    if (
      artifact.summary.acceptedJobs !== artifact.jobs.length ||
      artifact.summary.activeJobs !== artifact.jobs.length
    ) {
      context.addIssue({
        code: "custom",
        path: ["summary", "acceptedJobs"],
        message: "Accepted and active job counts must equal jobs.length.",
      });
    }
  });
export type JobCollectionArtifactV1 = z.infer<typeof JobCollectionArtifactV1Schema>;

export const HiringSignalTypeV1Schema = z.enum([
  "department_hiring_concentration",
  "leadership_hiring",
  "geographic_hiring_spread",
  "remote_hiring_pattern",
  "technology_demand",
  "sales_capacity_buildout_possible",
  "marketing_capacity_buildout_possible",
  "operations_capacity_buildout_possible",
  "data_ai_investment_possible",
  "security_investment_possible",
  "customer_success_buildout_possible",
  "new_function_possible",
  "high_current_hiring_volume",
  "unknown",
]);
export type HiringSignalTypeV1 = z.infer<typeof HiringSignalTypeV1Schema>;

export const CompanyHiringSummaryV1Schema = z
  .object({
    targetId: z.string().min(1).max(200),
    companyName: z.string().min(1).max(500),
    companyDomain: z.string().min(1).max(253).optional(),
    activeJobCount: z.number().int().nonnegative(),
    datedJobCount: z.number().int().nonnegative(),
    seniorJobCount: z.number().int().nonnegative(),
    roleFamilyCounts: z.partialRecord(RoleFamilyV1Schema, z.number().int().nonnegative()),
    seniorityCounts: z.partialRecord(SeniorityLevelV1Schema, z.number().int().nonnegative()),
    departments: z.array(z.string().min(1).max(1_000)).max(10_000),
    locations: z.array(z.string().min(1).max(2_000)).max(10_000),
    workplaceTypes: z.array(z.enum(["remote", "hybrid", "on_site", "unspecified"])).max(4),
    repeatedTechnologies: z
      .array(
        z
          .object({ technology: z.string().min(1).max(200), jobCount: z.number().int().min(1) })
          .strict(),
      )
      .max(1_000),
    limitations: LimitationListSchema,
  })
  .strict();

export const HiringSignalV1Schema = z
  .object({
    signalId: z.string().min(1).max(200),
    targetId: z.string().min(1).max(200),
    companyName: z.string().min(1).max(500),
    type: HiringSignalTypeV1Schema,
    supportingJobIds: z.array(z.string().min(1).max(200)).min(1).max(10_000),
    observedFacts: z.array(z.string().min(1).max(2_000)).min(1).max(1_000),
    inference: z.string().min(1).max(5_000),
    confidence: ConfidenceSchema,
    evidenceCount: z.number().int().min(1),
    independentBoardCount: z.number().int().min(1),
    observedAt: z.iso.datetime(),
    missionRelevance: z
      .object({
        relevant: z.boolean(),
        matchedConcepts: z.array(z.string().min(1).max(500)).max(100),
        score: ConfidenceSchema,
      })
      .strict()
      .optional(),
    ruleId: z.string().min(1).max(200),
    ruleVersion: z.string().min(1).max(100),
    limitations: LimitationListSchema,
  })
  .strict();
export type HiringSignalV1 = z.infer<typeof HiringSignalV1Schema>;

export const HiringSignalsArtifactV1Schema = z
  .object({
    schemaVersion: z.literal("1.0"),
    artifactKind: z.literal("hiring_signals.v1"),
    artifactId: z.string().min(1).max(200),
    requestId: z.string().min(1).max(200),
    jobCollectionArtifactId: z.string().min(1).max(200),
    jobCollectionDigest: Sha256Schema,
    rulesVersion: z.string().min(1).max(100),
    taxonomyVersion: z.string().min(1).max(100),
    technologyLexiconVersion: z.string().min(1).max(100),
    companies: z.array(CompanyHiringSummaryV1Schema).max(10_000),
    signals: z.array(HiringSignalV1Schema).max(100_000),
    summary: z
      .object({
        companiesAnalyzed: z.number().int().nonnegative(),
        signalsGenerated: z.number().int().nonnegative(),
        highConfidenceSignals: z.number().int().nonnegative(),
        mediumConfidenceSignals: z.number().int().nonnegative(),
        lowConfidenceSignals: z.number().int().nonnegative(),
        dominantRoleFamilies: z.array(RoleFamilyV1Schema).max(20),
        repeatedTechnologies: z.array(z.string().min(1).max(200)).max(1_000),
      })
      .strict(),
    limitations: LimitationListSchema,
    warnings: z.array(z.string().min(1).max(1_000)).max(200),
  })
  .strict()
  .superRefine((artifact, context) => {
    const ids = new Set<string>();
    for (const [index, signal] of artifact.signals.entries()) {
      if (ids.has(signal.signalId))
        context.addIssue({
          code: "custom",
          path: ["signals", index, "signalId"],
          message: "Signal IDs must be unique.",
        });
      ids.add(signal.signalId);
      if (signal.evidenceCount !== signal.supportingJobIds.length)
        context.addIssue({
          code: "custom",
          path: ["signals", index, "evidenceCount"],
          message: "Evidence count must equal supportingJobIds.length.",
        });
      if (
        /definitely has budget|ready to buy|proves they are expanding|confirmed budget|replacement hire/iu.test(
          signal.inference,
        )
      ) {
        context.addIssue({
          code: "custom",
          path: ["signals", index, "inference"],
          message: "Signal inference contains prohibited definitive language.",
        });
      }
    }
    if (
      artifact.summary.companiesAnalyzed !== artifact.companies.length ||
      artifact.summary.signalsGenerated !== artifact.signals.length
    ) {
      context.addIssue({
        code: "custom",
        path: ["summary"],
        message: "Hiring-signal summary counts must reconcile.",
      });
    }
  });
export type HiringSignalsArtifactV1 = z.infer<typeof HiringSignalsArtifactV1Schema>;

export const SourceAdapterAttemptTelemetryV1Schema = z
  .object({
    targetId: z.string().min(1).max(200),
    boardId: z.string().min(1).max(200).optional(),
    adapterId: z.string().min(1).max(100),
    accessCategory: SourceAccessCategoryV1Schema,
    attempted: z.boolean(),
    skippedReason: z.string().min(1).max(1_000).optional(),
    requests: z.number().int().nonnegative(),
    pages: z.number().int().nonnegative(),
    durationMs: z.number().int().nonnegative(),
    rawItems: z.number().int().nonnegative(),
    acceptedItems: z.number().int().nonnegative(),
    duplicateItems: z.number().int().nonnegative(),
    invalidItems: z.number().int().nonnegative(),
    outcome: z.enum([
      "success",
      "partial",
      "zero_results",
      "failed",
      "auth_missing",
      "blocked_by_policy",
      "budget_exhausted",
      "manual_required",
    ]),
    safeFailureCode: z.string().min(1).max(100).optional(),
    safeFailureMessage: z.string().min(1).max(1_000).optional(),
  })
  .strict();

export const SourceAdapterRunTelemetryV1Schema = z
  .object({
    schemaVersion: z.literal("1.0"),
    artifactKind: z.literal("source_adapter_run_telemetry.v1"),
    artifactId: z.string().min(1).max(200),
    requestId: z.string().min(1).max(200),
    sourceFamily: z.literal("hiring"),
    sourceTargetPlanArtifactId: z.string().min(1).max(200),
    jobCollectionArtifactId: z.string().min(1).max(200),
    hiringSignalsArtifactId: z.string().min(1).max(200),
    startedAt: z.iso.datetime(),
    completedAt: z.iso.datetime(),
    totalRuntimeMs: z.number().int().nonnegative(),
    attempts: z.array(SourceAdapterAttemptTelemetryV1Schema).max(100_000),
    totals: z
      .object({
        targetsAttempted: z.number().int().nonnegative(),
        boardsAttempted: z.number().int().nonnegative(),
        requestsAttempted: z.number().int().nonnegative(),
        requestsSuccessful: z.number().int().nonnegative(),
        requestsFailed: z.number().int().nonnegative(),
        rawJobs: z.number().int().nonnegative(),
        acceptedJobs: z.number().int().nonnegative(),
        duplicateJobs: z.number().int().nonnegative(),
        invalidJobs: z.number().int().nonnegative(),
        keylessRequests: z.number().int().nonnegative(),
        authenticatedFreeRequests: z.number().int().nonnegative(),
        paidRequests: z.number().int().nonnegative(),
        signalsGenerated: z.number().int().nonnegative(),
      })
      .strict(),
    warnings: z.array(z.string().min(1).max(1_000)).max(200),
  })
  .strict()
  .superRefine((artifact, context) => {
    const totals = artifact.attempts.reduce(
      (sum, attempt) => ({
        requests: sum.requests + attempt.requests,
        raw: sum.raw + attempt.rawItems,
        accepted: sum.accepted + attempt.acceptedItems,
        duplicate: sum.duplicate + attempt.duplicateItems,
        invalid: sum.invalid + attempt.invalidItems,
      }),
      { requests: 0, raw: 0, accepted: 0, duplicate: 0, invalid: 0 },
    );
    if (
      totals.requests !== artifact.totals.requestsAttempted ||
      totals.raw !== artifact.totals.rawJobs ||
      totals.accepted !== artifact.totals.acceptedJobs ||
      totals.duplicate !== artifact.totals.duplicateJobs ||
      totals.invalid !== artifact.totals.invalidJobs
    ) {
      context.addIssue({
        code: "custom",
        path: ["totals"],
        message: "Telemetry totals must reconcile with attempts.",
      });
    }
  });
export type SourceAdapterRunTelemetryV1 = z.infer<typeof SourceAdapterRunTelemetryV1Schema>;
