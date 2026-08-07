import {
  DEFAULT_RUN_BUDGET,
  EMPTY_RUN_USAGE,
  LocalMissionSchema,
  LocalRunEventSchema,
  LocalRunSchema,
  createOpaqueId,
  type CluvviExtractionMode,
  type CluvviSourceAdapterMode,
  type CluvviSourceFamily,
  type CluvviStructuredContentMode,
  type DiscoveryProviderMode,
  type DiscoveryProviderPolicy,
  type DiscoveryRuntimeMode,
  type LocalMission,
  type LocalRun,
  type LocalRunEvent,
  type MissionInputV1,
  type RunBudget,
} from "@cluvvi/core";
import { LOCAL_ENGINE_VERSION } from "./version";

export interface RunCreationRecords {
  mission: LocalMission;
  run: LocalRun;
  event: LocalRunEvent;
}

export function createRunCreationRecords(input: {
  mission: MissionInputV1;
  sourceFile: string;
  now?: string;
  budget?: RunBudget;
  discoveryRuntimeMode?: DiscoveryRuntimeMode;
  discoveryProviderMode?: DiscoveryProviderMode;
  discoveryProviderPolicy?: DiscoveryProviderPolicy;
  discoveryExtractionMode?: CluvviExtractionMode;
  discoveryMaximumExtractions?: number;
  discoveryStructuredContentMode?: CluvviStructuredContentMode;
  discoveryMaximumStructuredResources?: number;
  discoveryMaximumDocumentResources?: number;
  discoverySourceAdapterMode?: CluvviSourceAdapterMode;
  discoverySourceFamilies?: readonly CluvviSourceFamily[];
  discoveryMaximumHiringTargets?: number;
  discoveryMaximumHiringBoardsPerTarget?: number;
  discoveryMaximumHiringJobsPerBoard?: number;
  discoveryMaximumHiringJobsTotal?: number;
  discoveryRedditDepth?: "quick" | "default" | "deep";
  discoveryMaximumRedditQueries?: number;
  discoveryMaximumRedditSubreddits?: number;
  discoveryMaximumRedditThreads?: number;
  discoveryMaximumRedditThreadDrill?: number;
  communitySignalRuleVersion?: string;
  hiringSignalRuleVersion?: string;
  hiringTaxonomyVersion?: string;
  hiringTechnologyLexiconVersion?: string;
  extractorVersion?: string;
  frontierPolicyVersion?: string;
  structuredParserPolicyVersion?: string;
  anydocParserVersion?: string;
  htmlMarkdownRendererVersion?: string;
  extractionQualityEvaluatorVersion?: string;
}): RunCreationRecords {
  const now = input.now ?? new Date().toISOString();
  const mission = LocalMissionSchema.parse({
    id: createOpaqueId("mission"),
    input: input.mission,
    sourceFile: input.sourceFile,
    createdAt: now,
  });
  const run = LocalRunSchema.parse({
    id: createOpaqueId("run"),
    missionId: mission.id,
    missionName: mission.input.name,
    status: "created",
    phase: "mission",
    config: {
      engineVersion: LOCAL_ENGINE_VERSION,
      fixtureMode: true,
      discoveryRuntimeMode: input.discoveryRuntimeMode ?? "fixture",
      discoveryProviderMode: input.discoveryProviderMode ?? "fixture_only",
      discoveryProviderPolicy: input.discoveryProviderPolicy ?? "free_only",
      discoveryExtractionMode: input.discoveryExtractionMode ?? "none",
      discoveryMaximumExtractions: input.discoveryMaximumExtractions ?? 8,
      discoveryStructuredContentMode: input.discoveryStructuredContentMode ?? "none",
      discoveryMaximumStructuredResources: input.discoveryMaximumStructuredResources ?? 8,
      discoveryMaximumDocumentResources: input.discoveryMaximumDocumentResources ?? 4,
      discoverySourceAdapterMode: input.discoverySourceAdapterMode ?? "none",
      discoverySourceFamilies: [...(input.discoverySourceFamilies ?? [])],
      discoveryMaximumHiringTargets: input.discoveryMaximumHiringTargets ?? 10,
      discoveryMaximumHiringBoardsPerTarget: input.discoveryMaximumHiringBoardsPerTarget ?? 4,
      discoveryMaximumHiringJobsPerBoard: input.discoveryMaximumHiringJobsPerBoard ?? 250,
      discoveryMaximumHiringJobsTotal: input.discoveryMaximumHiringJobsTotal ?? 2_000,
      discoveryRedditDepth: input.discoveryRedditDepth ?? "default",
      discoveryMaximumRedditQueries: input.discoveryMaximumRedditQueries ?? 8,
      discoveryMaximumRedditSubreddits: input.discoveryMaximumRedditSubreddits ?? 20,
      discoveryMaximumRedditThreads: input.discoveryMaximumRedditThreads ?? 100,
      discoveryMaximumRedditThreadDrill: input.discoveryMaximumRedditThreadDrill ?? 5,
      communitySignalRuleVersion: input.communitySignalRuleVersion ?? "community_signals@1.0.0",
      hiringSignalRuleVersion: input.hiringSignalRuleVersion ?? "hiring_signals@1.0.0",
      hiringTaxonomyVersion: input.hiringTaxonomyVersion ?? "hiring_taxonomy@1.0.0",
      hiringTechnologyLexiconVersion:
        input.hiringTechnologyLexiconVersion ?? "hiring_technology_lexicon@1.0.0",
      extractorVersion: input.extractorVersion ?? "basic_public_html_extractor@1.0.0",
      frontierPolicyVersion: input.frontierPolicyVersion ?? "frontier_policy@1.0.0",
      structuredParserPolicyVersion:
        input.structuredParserPolicyVersion ?? "structured_parser_policy@1.0.0",
      anydocParserVersion: input.anydocParserVersion ?? "@firecrawl/anydoc@0.1.6",
      htmlMarkdownRendererVersion:
        input.htmlMarkdownRendererVersion ?? "sanitized_html_to_gfm@1.0.0",
      extractionQualityEvaluatorVersion:
        input.extractionQualityEvaluatorVersion ?? "extraction_quality@1.0.0",
    },
    budget: input.budget ?? DEFAULT_RUN_BUDGET,
    usage: EMPTY_RUN_USAGE,
    startedAt: now,
    updatedAt: now,
  });
  const event = LocalRunEventSchema.parse({
    id: createOpaqueId("event"),
    runId: run.id,
    eventType: "run_created",
    phase: run.phase,
    data: {
      sourceFile: input.sourceFile,
      discoveryRuntimeMode: run.config.discoveryRuntimeMode,
      discoveryProviderMode: run.config.discoveryProviderMode,
      discoveryProviderPolicy: run.config.discoveryProviderPolicy,
      discoveryExtractionMode: run.config.discoveryExtractionMode,
      discoveryMaximumExtractions: run.config.discoveryMaximumExtractions,
      discoveryStructuredContentMode: run.config.discoveryStructuredContentMode,
      discoveryMaximumStructuredResources: run.config.discoveryMaximumStructuredResources,
      discoveryMaximumDocumentResources: run.config.discoveryMaximumDocumentResources,
      discoverySourceAdapterMode: run.config.discoverySourceAdapterMode,
      discoverySourceFamilies: run.config.discoverySourceFamilies,
      discoveryMaximumHiringTargets: run.config.discoveryMaximumHiringTargets,
      discoveryMaximumHiringBoardsPerTarget: run.config.discoveryMaximumHiringBoardsPerTarget,
      discoveryMaximumHiringJobsPerBoard: run.config.discoveryMaximumHiringJobsPerBoard,
      discoveryMaximumHiringJobsTotal: run.config.discoveryMaximumHiringJobsTotal,
      discoveryRedditDepth: run.config.discoveryRedditDepth,
      discoveryMaximumRedditQueries: run.config.discoveryMaximumRedditQueries,
      discoveryMaximumRedditSubreddits: run.config.discoveryMaximumRedditSubreddits,
      discoveryMaximumRedditThreads: run.config.discoveryMaximumRedditThreads,
      discoveryMaximumRedditThreadDrill: run.config.discoveryMaximumRedditThreadDrill,
      communitySignalRuleVersion: run.config.communitySignalRuleVersion,
    },
    createdAt: now,
  });
  return { mission, run, event };
}
