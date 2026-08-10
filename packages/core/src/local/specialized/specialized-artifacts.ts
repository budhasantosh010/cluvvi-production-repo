import { z } from "zod";
import { PublicHttpUrlSchema } from "../community/universal-community";

const ConfidenceSchema = z.number().min(0).max(1);
const CanonicalIdSchema = z
  .string()
  .trim()
  .min(1)
  .max(200)
  .regex(/^[a-z0-9][a-z0-9._-]*$/u);
const DomainSchema = z
  .string()
  .trim()
  .min(1)
  .max(253)
  .regex(/^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/u);
const LimitationListSchema = z.array(z.string().trim().min(1).max(1_000)).max(250);

export const SpecializedModeSchema = z.enum(["auto", "known_only", "dynamic_only"]);
export type SpecializedMode = z.infer<typeof SpecializedModeSchema>;

export const SpecializedDesiredSignalV1Schema = z.enum([
  "regulation_change",
  "compliance_guidance",
  "enforcement_event",
  "inspection_or_quality",
  "tender",
  "procurement_notice",
  "contract_award",
  "project_award",
  "industry_news",
  "company_event",
  "association_update",
  "standard_change",
  "certification_or_licensing",
  "conference_activity",
  "market_activity",
  "research",
  "new_method",
  "benchmark",
  "technical_development",
  "technology_attention",
  "directory_or_registry",
  "other",
]);
export type SpecializedDesiredSignalV1 = z.infer<typeof SpecializedDesiredSignalV1Schema>;

export const SpecializedSourceTypeV1Schema = z.enum([
  "government",
  "regulator",
  "government_database",
  "company_registry",
  "licensing_registry",
  "inspection_database",
  "industry_association",
  "professional_body",
  "trade_publication",
  "research_database",
  "standards_body",
  "tender_portal",
  "procurement_portal",
  "industry_directory",
  "review_platform",
  "conference",
  "specialist_forum",
  "specialist_news_aggregator",
  "specialist_dataset",
  "other",
]);
export type SpecializedSourceTypeV1 = z.infer<typeof SpecializedSourceTypeV1Schema>;

export const SourceAuthorityClassV1Schema = z.enum([
  "official_primary",
  "regulatory_primary",
  "industry_body",
  "specialist_secondary",
  "directory",
  "community",
  "unknown",
]);
export type SourceAuthorityClassV1 = z.infer<typeof SourceAuthorityClassV1Schema>;

const DedicatedRouteSchema = z.strictObject({
  route: z.literal("dedicated_adapter"),
  adapterId: CanonicalIdSchema,
});
const GenericSiteSearchRouteSchema = z.strictObject({ route: z.literal("generic_site_search") });
const GenericFeedRouteSchema = z.strictObject({
  route: z.literal("generic_feed"),
  feedUrl: PublicHttpUrlSchema,
});
const GenericPageExtractionRouteSchema = z.strictObject({
  route: z.literal("generic_page_extraction"),
});
export const SpecializedSourceRouteV1Schema = z.discriminatedUnion("route", [
  DedicatedRouteSchema,
  GenericSiteSearchRouteSchema,
  GenericFeedRouteSchema,
  GenericPageExtractionRouteSchema,
]);
export type SpecializedSourceRouteV1 = z.infer<typeof SpecializedSourceRouteV1Schema>;

export const SpecializedSourceDescriptorV1Schema = z
  .strictObject({
    sourceId: CanonicalIdSchema,
    displayName: z.string().trim().min(1).max(500),
    domains: z.array(DomainSchema).min(1).max(20),
    sourceType: SpecializedSourceTypeV1Schema,
    industries: z
      .array(
        z.strictObject({
          industryId: CanonicalIdSchema,
          relevance: ConfidenceSchema,
        }),
      )
      .max(50),
    subIndustries: z.array(CanonicalIdSchema).max(100),
    geographies: z.array(z.string().trim().min(1).max(100)).max(100),
    signalTypes: z.array(SpecializedDesiredSignalV1Schema).max(50),
    authorityClass: SourceAuthorityClassV1Schema,
    accessCategory: z.enum(["keyless_free", "authenticated_free", "paid", "manual"]),
    routes: z.array(SpecializedSourceRouteV1Schema).min(1).max(8),
    expectedFreshness: z.enum([
      "realtime",
      "daily",
      "weekly",
      "monthly",
      "slow_changing",
      "unknown",
    ]),
    dedicatedAdapterId: CanonicalIdSchema.optional(),
    limitations: LimitationListSchema,
  })
  .superRefine((source, context) => {
    const dedicatedRoutes = source.routes.filter((route) => route.route === "dedicated_adapter");
    if (source.dedicatedAdapterId !== undefined) {
      if (
        dedicatedRoutes.length !== 1 ||
        dedicatedRoutes[0]?.route !== "dedicated_adapter" ||
        dedicatedRoutes[0].adapterId !== source.dedicatedAdapterId
      ) {
        context.addIssue({
          code: "custom",
          path: ["dedicatedAdapterId"],
          message: "dedicatedAdapterId must match exactly one dedicated_adapter route.",
        });
      }
    } else if (dedicatedRoutes.length > 0) {
      context.addIssue({
        code: "custom",
        path: ["routes"],
        message: "Dedicated routes require dedicatedAdapterId.",
      });
    }
  });
export type SpecializedSourceDescriptorV1 = z.infer<typeof SpecializedSourceDescriptorV1Schema>;

export const SpecializedSourcePackV1Schema = z.strictObject({
  packId: CanonicalIdSchema,
  version: z.string().trim().min(1).max(100),
  displayName: z.string().trim().min(1).max(500),
  industries: z.array(CanonicalIdSchema).max(100),
  subIndustries: z.array(CanonicalIdSchema).max(100),
  geographies: z.array(z.string().trim().min(1).max(100)).max(100),
  desiredSignals: z.array(SpecializedDesiredSignalV1Schema).max(50),
  sourceIds: z.array(CanonicalIdSchema).min(1).max(100),
  dynamicDiscoveryTemplates: z.array(z.string().trim().min(1).max(1_000)).max(30),
  limitations: LimitationListSchema,
});
export type SpecializedSourcePackV1 = z.infer<typeof SpecializedSourcePackV1Schema>;

export const SpecializedSourceRegistryV1Schema = z
  .strictObject({
    schemaVersion: z.literal("1.0"),
    artifactKind: z.literal("specialized_source_registry.v1"),
    registryVersion: z.string().trim().min(1).max(100),
    packs: z.array(SpecializedSourcePackV1Schema).max(100),
    sources: z.array(SpecializedSourceDescriptorV1Schema).max(1_000),
    registryDigest: z.string().regex(/^[a-f0-9]{64}$/u),
  })
  .superRefine((registry, context) => {
    const sourceIds = new Set<string>();
    registry.sources.forEach((source, index) => {
      if (sourceIds.has(source.sourceId)) {
        context.addIssue({
          code: "custom",
          path: ["sources", index, "sourceId"],
          message: "Specialized source IDs must be unique.",
        });
      }
      sourceIds.add(source.sourceId);
    });
    const packIds = new Set<string>();
    registry.packs.forEach((pack, index) => {
      if (packIds.has(pack.packId)) {
        context.addIssue({
          code: "custom",
          path: ["packs", index, "packId"],
          message: "Specialized pack IDs must be unique.",
        });
      }
      packIds.add(pack.packId);
      for (const sourceId of pack.sourceIds) {
        if (!sourceIds.has(sourceId)) {
          context.addIssue({
            code: "custom",
            path: ["packs", index, "sourceIds"],
            message: `Specialized pack references unknown source ${sourceId}.`,
          });
        }
      }
    });
  });
export type SpecializedSourceRegistryV1 = z.infer<typeof SpecializedSourceRegistryV1Schema>;

export const SpecializedSourceContextArtifactV1Schema = z.strictObject({
  schemaVersion: z.literal("1.0"),
  artifactKind: z.literal("specialized_source_context.v1"),
  artifactId: z.string().min(1).max(200),
  requestId: z.string().min(1).max(200),
  industries: z
    .array(
      z.strictObject({
        industryId: CanonicalIdSchema,
        label: z.string().trim().min(1).max(300),
        confidence: ConfidenceSchema,
      }),
    )
    .min(1)
    .max(20),
  subIndustries: z
    .array(
      z.strictObject({
        subIndustryId: CanonicalIdSchema,
        label: z.string().trim().min(1).max(300),
        parentIndustryId: CanonicalIdSchema.optional(),
        confidence: ConfidenceSchema,
      }),
    )
    .max(50),
  geographies: z
    .array(
      z.strictObject({
        type: z.enum(["global", "country", "region", "state", "city"]),
        code: z.string().trim().min(1).max(30).optional(),
        label: z.string().trim().min(1).max(300),
        confidence: ConfidenceSchema,
      }),
    )
    .min(1)
    .max(20),
  desiredSignals: z
    .array(
      z.strictObject({
        signalType: SpecializedDesiredSignalV1Schema,
        importance: ConfidenceSchema,
        concepts: z.array(z.string().trim().min(1).max(300)).max(100),
      }),
    )
    .min(1)
    .max(30),
  entityHints: z
    .array(
      z.strictObject({
        type: z.enum(["company", "product", "technology", "organization", "market", "industry"]),
        name: z.string().trim().min(1).max(500),
      }),
    )
    .max(100),
  languagePreferences: z.array(z.string().trim().min(1).max(100)).max(20),
  derivation: z.strictObject({
    sourceArtifactKind: z.literal("discovery_request.v1"),
    sourceRequestId: z.string().min(1).max(200),
    rulesVersion: z.string().min(1).max(100),
  }),
  limitations: LimitationListSchema,
});
export type SpecializedSourceContextArtifactV1 = z.infer<
  typeof SpecializedSourceContextArtifactV1Schema
>;

export const SpecializedSourceSelectionV1Schema = z.strictObject({
  selectionId: z.string().min(1).max(200),
  sourceId: CanonicalIdSchema.optional(),
  candidateId: z.string().min(1).max(200).optional(),
  domain: DomainSchema,
  registered: z.boolean(),
  sourceType: SpecializedSourceTypeV1Schema,
  authorityClass: SourceAuthorityClassV1Schema,
  score: ConfidenceSchema,
  matchedIndustries: z.array(CanonicalIdSchema).max(50),
  matchedGeographies: z.array(z.string().trim().min(1).max(100)).max(50),
  matchedSignals: z.array(SpecializedDesiredSignalV1Schema).max(50),
  selectedRoute: SpecializedSourceRouteV1Schema,
  selectionReasons: z.array(z.string().trim().min(1).max(1_000)).max(50),
  limitations: LimitationListSchema,
});
export type SpecializedSourceSelectionV1 = z.infer<typeof SpecializedSourceSelectionV1Schema>;

export const SpecializedCoverageV1Schema = z.strictObject({
  overallScore: ConfidenceSchema,
  level: z.enum(["high", "medium", "low"]),
  signalCoverage: z
    .array(
      z.strictObject({
        signalType: SpecializedDesiredSignalV1Schema,
        score: ConfidenceSchema,
        selectedSourceCount: z.number().int().nonnegative(),
        sourceTypeDiversity: z.number().int().nonnegative(),
        gaps: z.array(z.string().trim().min(1).max(1_000)).max(30),
      }),
    )
    .max(30),
  geographyCoverage: ConfidenceSchema,
  industryCoverage: ConfidenceSchema,
  limitations: LimitationListSchema,
});
export type SpecializedCoverageV1 = z.infer<typeof SpecializedCoverageV1Schema>;

export const SpecializedSourceDiscoveryQueryV1Schema = z.strictObject({
  queryId: z.string().min(1).max(200),
  query: z.string().trim().min(1).max(1_000),
  signalType: SpecializedDesiredSignalV1Schema,
  importance: ConfidenceSchema,
  selected: z.boolean(),
  selectionReasons: z.array(z.string().trim().min(1).max(1_000)).max(50),
});
export type SpecializedSourceDiscoveryQueryV1 = z.infer<
  typeof SpecializedSourceDiscoveryQueryV1Schema
>;

export const SpecializedSourcePlanArtifactV1Schema = z.strictObject({
  schemaVersion: z.literal("1.0"),
  artifactKind: z.literal("specialized_source_plan.v1"),
  artifactId: z.string().min(1).max(200),
  requestId: z.string().min(1).max(200),
  sourceFamily: z.literal("specialized"),
  contextArtifactId: z.string().min(1).max(200),
  registryVersion: z.string().min(1).max(100),
  registryDigest: z.string().regex(/^[a-f0-9]{64}$/u),
  selectedPacks: z
    .array(
      z.strictObject({
        packId: CanonicalIdSchema,
        score: ConfidenceSchema,
        reasons: z.array(z.string().trim().min(1).max(1_000)).max(30),
      }),
    )
    .max(20),
  desiredSignals: z.array(SpecializedDesiredSignalV1Schema).max(30),
  knownSources: z.array(SpecializedSourceSelectionV1Schema).max(100),
  coverageBeforeDiscovery: SpecializedCoverageV1Schema,
  dynamicDiscoveryTriggered: z.boolean(),
  discoveryQueries: z.array(SpecializedSourceDiscoveryQueryV1Schema).max(10),
  selectedDynamicSources: z.array(SpecializedSourceSelectionV1Schema).max(100),
  coverageAfterDiscovery: SpecializedCoverageV1Schema,
  policy: z.strictObject({
    mode: SpecializedModeSchema,
    maximumPacks: z.number().int().min(1).max(10),
    maximumDiscoveryQueries: z.number().int().min(0).max(10),
    maximumCandidates: z.number().int().min(1).max(100),
    maximumSelectedSources: z.number().int().min(1).max(30),
  }),
  warnings: LimitationListSchema,
});
export type SpecializedSourcePlanArtifactV1 = z.infer<typeof SpecializedSourcePlanArtifactV1Schema>;

export const SpecializedSourceCandidateV1Schema = z.strictObject({
  candidateId: z.string().min(1).max(200),
  domain: DomainSchema,
  discoveredUrls: z.array(PublicHttpUrlSchema).min(1).max(50),
  title: z.string().trim().min(1).max(1_000).optional(),
  organizationName: z.string().trim().min(1).max(1_000).optional(),
  sourceType: SpecializedSourceTypeV1Schema,
  sourceTypeConfidence: ConfidenceSchema,
  industries: z.array(CanonicalIdSchema).max(50),
  geographies: z.array(z.string().trim().min(1).max(100)).max(50),
  signals: z.array(SpecializedDesiredSignalV1Schema).max(50),
  authorityClass: SourceAuthorityClassV1Schema,
  scores: z.strictObject({
    industry: ConfidenceSchema,
    signal: ConfidenceSchema,
    geography: ConfidenceSchema,
    authority: ConfidenceSchema,
    freshness: ConfidenceSchema,
    structure: ConfidenceSchema,
    accessibility: ConfidenceSchema,
    diversity: ConfidenceSchema,
    total: ConfidenceSchema,
  }),
  availableRoutes: z.array(SpecializedSourceRouteV1Schema).min(1).max(8),
  selected: z.boolean(),
  selectionReasons: z.array(z.string().trim().min(1).max(1_000)).max(50),
  rejectionReasons: z.array(z.string().trim().min(1).max(1_000)).max(50),
  limitations: LimitationListSchema,
});
export type SpecializedSourceCandidateV1 = z.infer<typeof SpecializedSourceCandidateV1Schema>;

export const SpecializedSourceCandidateCollectionArtifactV1Schema = z.strictObject({
  schemaVersion: z.literal("1.0"),
  artifactKind: z.literal("specialized_source_candidates.v1"),
  artifactId: z.string().min(1).max(200),
  requestId: z.string().min(1).max(200),
  specializedSourceContextArtifactId: z.string().min(1).max(200),
  candidates: z.array(SpecializedSourceCandidateV1Schema).max(100),
  summary: z.strictObject({
    searchResultsEvaluated: z.number().int().nonnegative(),
    uniqueDomains: z.number().int().nonnegative(),
    candidatesAccepted: z.number().int().nonnegative(),
    candidatesRejected: z.number().int().nonnegative(),
  }),
  warnings: LimitationListSchema,
});
export type SpecializedSourceCandidateCollectionArtifactV1 = z.infer<
  typeof SpecializedSourceCandidateCollectionArtifactV1Schema
>;

export const SpecializedFindingTypeV1Schema = z.enum([
  "regulatory_update",
  "guidance",
  "inspection_or_quality_record",
  "tender_notice",
  "procurement_notice",
  "contract_award",
  "project_update",
  "industry_article",
  "association_update",
  "standard_update",
  "conference_event",
  "directory_record",
  "research_paper",
  "technology_news_cluster",
  "ai_story_cluster",
  "other",
]);
export type SpecializedFindingTypeV1 = z.infer<typeof SpecializedFindingTypeV1Schema>;

export const SpecializedFindingV1Schema = z.strictObject({
  findingId: z.string().min(1).max(200),
  sourceId: CanonicalIdSchema.optional(),
  candidateId: z.string().min(1).max(200).optional(),
  sourceDomain: DomainSchema,
  sourceType: SpecializedSourceTypeV1Schema,
  authorityClass: SourceAuthorityClassV1Schema,
  route: z.enum([
    "dedicated_adapter",
    "generic_site_search",
    "generic_feed",
    "generic_page_extraction",
  ]),
  findingType: SpecializedFindingTypeV1Schema,
  sourceNativeId: z.string().min(1).max(500).optional(),
  title: z.string().trim().min(1).max(10_000),
  summary: z.string().max(25_000).optional(),
  url: PublicHttpUrlSchema,
  publishedAt: z.iso.datetime().optional(),
  updatedAt: z.iso.datetime().optional(),
  organizationNames: z.array(z.string().trim().min(1).max(1_000)).max(100),
  categories: z.array(z.string().trim().min(1).max(500)).max(100),
  relatedUrls: z.array(PublicHttpUrlSchema).max(100),
  doi: z.string().trim().min(1).max(500).optional(),
  pdfUrl: PublicHttpUrlSchema.optional(),
  relevance: ConfidenceSchema,
  sourceConfidence: ConfidenceSchema,
  trustClassification: z.literal("untrusted_public_content"),
  provenance: z
    .array(
      z.strictObject({
        sourceMethod: z.string().trim().min(1).max(200),
        observedAt: z.iso.datetime(),
      }),
    )
    .min(1)
    .max(100),
  limitations: LimitationListSchema,
});
export type SpecializedFindingV1 = z.infer<typeof SpecializedFindingV1Schema>;

export const SpecializedFindingsArtifactV1Schema = z.strictObject({
  schemaVersion: z.literal("1.0"),
  artifactKind: z.literal("specialized_findings.v1"),
  artifactId: z.string().min(1).max(200),
  requestId: z.string().min(1).max(200),
  specializedSourcePlanArtifactId: z.string().min(1).max(200),
  findings: z.array(SpecializedFindingV1Schema).max(1_000),
  summary: z.strictObject({
    sourcesAttempted: z.number().int().nonnegative(),
    sourcesSuccessful: z.number().int().nonnegative(),
    sourcesPartial: z.number().int().nonnegative(),
    sourcesFailed: z.number().int().nonnegative(),
    dedicatedAdapterFindings: z.number().int().nonnegative(),
    genericSearchFindings: z.number().int().nonnegative(),
    feedFindings: z.number().int().nonnegative(),
    pageFindings: z.number().int().nonnegative(),
    findingsAccepted: z.number().int().nonnegative(),
    duplicatesRemoved: z.number().int().nonnegative(),
  }),
  limitations: LimitationListSchema,
  warnings: LimitationListSchema,
});
export type SpecializedFindingsArtifactV1 = z.infer<typeof SpecializedFindingsArtifactV1Schema>;

export const SpecializedSignalTypeV1Schema = z.enum([
  "regulatory_change",
  "compliance_pressure_possible",
  "enforcement_or_quality_event",
  "procurement_opportunity",
  "contract_or_project_activity",
  "industry_activity",
  "association_activity",
  "standard_change",
  "certification_or_licensing_event",
  "conference_activity",
  "new_research",
  "new_method",
  "evaluation_result",
  "benchmark_result",
  "technical_attention",
  "technology_emergence_possible",
  "product_or_company_event",
  "other",
]);
export type SpecializedSignalTypeV1 = z.infer<typeof SpecializedSignalTypeV1Schema>;

export const SpecializedSignalV1Schema = z.strictObject({
  signalId: z.string().min(1).max(200),
  type: SpecializedSignalTypeV1Schema,
  supportingFindingIds: z.array(z.string().min(1).max(200)).min(1).max(100),
  independentSourceCount: z.number().int().positive(),
  observedFacts: z.array(z.string().trim().min(1).max(2_000)).min(1).max(50),
  inference: z.string().trim().min(1).max(2_000),
  confidence: ConfidenceSchema,
  missionRelevance: z.strictObject({
    relevant: z.boolean(),
    score: ConfidenceSchema,
    matchedConcepts: z.array(z.string().trim().min(1).max(300)).max(100),
  }),
  ruleId: z.string().min(1).max(200),
  ruleVersion: z.string().min(1).max(100),
  limitations: LimitationListSchema,
});
export type SpecializedSignalV1 = z.infer<typeof SpecializedSignalV1Schema>;

export const SpecializedSignalsArtifactV1Schema = z.strictObject({
  schemaVersion: z.literal("1.0"),
  artifactKind: z.literal("specialized_signals.v1"),
  artifactId: z.string().min(1).max(200),
  requestId: z.string().min(1).max(200),
  specializedFindingsArtifactId: z.string().min(1).max(200),
  rulesVersion: z.string().min(1).max(100),
  signals: z.array(SpecializedSignalV1Schema).max(500),
  summary: z.strictObject({
    findingsAnalyzed: z.number().int().nonnegative(),
    signalsGenerated: z.number().int().nonnegative(),
    sourceTypesRepresented: z.number().int().nonnegative(),
    independentSourcesRepresented: z.number().int().nonnegative(),
  }),
  warnings: LimitationListSchema,
  limitations: LimitationListSchema,
});
export type SpecializedSignalsArtifactV1 = z.infer<typeof SpecializedSignalsArtifactV1Schema>;

export const SpecializedSourceRunTelemetryArtifactV1Schema = z.strictObject({
  schemaVersion: z.literal("1.0"),
  artifactKind: z.literal("specialized_source_run_telemetry.v1"),
  artifactId: z.string().min(1).max(200),
  requestId: z.string().min(1).max(200),
  observedAt: z.iso.datetime(),
  knownPacksEvaluated: z.number().int().nonnegative(),
  packsSelected: z.number().int().nonnegative(),
  coverageBefore: ConfidenceSchema,
  dynamicDiscoveryTriggered: z.boolean(),
  sourceDiscoveryQueries: z.number().int().nonnegative(),
  candidateDomains: z.number().int().nonnegative(),
  selectedRegisteredSources: z.number().int().nonnegative(),
  selectedDynamicSources: z.number().int().nonnegative(),
  registeredSourceAttempts: z.number().int().nonnegative(),
  dynamicSourceAttempts: z.number().int().nonnegative(),
  genericSiteSearchRequests: z.number().int().nonnegative(),
  feedRequests: z.number().int().nonnegative(),
  pageExtractionAttempts: z.number().int().nonnegative(),
  dedicatedAdapterAttempts: z.number().int().nonnegative(),
  arxivRequests: z.number().int().nonnegative(),
  arxivPdfDrills: z.number().int().nonnegative(),
  techmemeAttempts: z.number().int().nonnegative(),
  diggProcessStarts: z.number().int().nonnegative(),
  findings: z.number().int().nonnegative(),
  signals: z.number().int().nonnegative(),
  sourceFailures: z.number().int().nonnegative(),
  coverageAfter: ConfidenceSchema,
  paidRequests: z.literal(0),
  paidCredits: z.literal(0),
  warnings: LimitationListSchema,
});
export type SpecializedSourceRunTelemetryArtifactV1 = z.infer<
  typeof SpecializedSourceRunTelemetryArtifactV1Schema
>;

export {
  CanonicalIdSchema as SpecializedCanonicalIdSchema,
  DomainSchema as SpecializedDomainSchema,
};
