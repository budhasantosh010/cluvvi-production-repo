import type {
  CluvviExtractionMode,
  CluvviSourceAdapterMode,
  CluvviSourceFamily,
  CluvviStructuredContentMode,
  DiscoveryProviderMode,
  DiscoveryProviderPolicy,
  DiscoveryRuntimeMode,
  SearchResultsArtifactV2,
  ValidatedCommunityAnalysisSet,
  ValidatedCommunityArtifactSet,
  ValidatedCommunityCommentManifestSet,
  ValidatedCommunityCommentSet,
  ValidatedCommunityPlanSet,
  ValidatedCommunityThreadManifestSet,
  ValidatedCommunityThreadSet,
  ValidatedDeveloperAnalysisSet,
  ValidatedDeveloperArtifactSet,
  ValidatedDeveloperCommentManifestSet,
  ValidatedDeveloperCommentSet,
  ValidatedDeveloperPlanSet,
  ValidatedDeveloperRepositorySet,
  ValidatedDeveloperThreadManifestSet,
  ValidatedDeveloperThreadSet,
  ValidatedExtractionArtifactSet,
  ValidatedStructuredContentArtifactSet,
} from "@cluvvi/core";
import type { ValidatedHiringArtifactSet } from "@cluvvi/core/hiring-validation";
import type { BridgeDiscoveryRequestV1 } from "./discovery-request-adapter";
import { loadProjectBPipelineFixture } from "./discovery-fixtures";

export interface DiscoveryRuntimeExecutionInput {
  runId: string;
  request: BridgeDiscoveryRequestV1;
  signal?: AbortSignal;
  shouldCancel?: () => Promise<boolean>;
}

export interface DiscoveryRuntime {
  readonly mode: DiscoveryRuntimeMode;
  readonly providerMode: DiscoveryProviderMode;
  readonly providerPolicy: DiscoveryProviderPolicy;
  readonly extractionMode?: CluvviExtractionMode;
  readonly maximumExtractions?: number;
  readonly structuredContentMode?: CluvviStructuredContentMode;
  readonly maximumStructuredResources?: number;
  readonly maximumDocumentResources?: number;
  readonly sourceAdapterMode?: CluvviSourceAdapterMode;
  readonly sourceFamilies?: readonly CluvviSourceFamily[];
  readonly maximumHiringTargets?: number;
  readonly maximumHiringBoardsPerTarget?: number;
  readonly maximumHiringJobsPerBoard?: number;
  readonly maximumHiringJobsTotal?: number;
  readonly redditDepth?: "quick" | "default" | "deep";
  readonly maximumRedditQueries?: number;
  readonly maximumRedditSubreddits?: number;
  readonly maximumRedditThreads?: number;
  readonly maximumRedditThreadDrill?: number;
  readonly githubDepth?: "quick" | "default" | "deep";
  readonly maximumGitHubQueries?: number;
  readonly maximumGitHubRepositories?: number;
  readonly maximumGitHubThreadDrill?: number;
  readonly communitySignalRuleVersion?: string;
  readonly developerSignalRuleVersion?: string;
  readonly hiringSignalRuleVersion?: string;
  readonly hiringTaxonomyVersion?: string;
  readonly hiringTechnologyLexiconVersion?: string;
  readonly extractorVersion?: string;
  readonly frontierPolicyVersion?: string;
  readonly structuredParserPolicyVersion?: string;
  readonly anydocParserVersion?: string;
  readonly htmlMarkdownRendererVersion?: string;
  readonly extractionQualityEvaluatorVersion?: string;
  readonly providerConfigurationFingerprint: string;
  readonly extractionConfigurationFingerprint?: string;
  readonly structuredConfigurationFingerprint?: string;
  readonly sourceAdapterConfigurationFingerprint?: string;
  readonly communityConfigurationFingerprint?: string;
  readonly developerConfigurationFingerprint?: string;
  execute(input: DiscoveryRuntimeExecutionInput): Promise<SearchResultsArtifactV2>;
  readExtractionArtifactSet?(input: {
    runId: string;
    searchResults: SearchResultsArtifactV2;
  }): Promise<ValidatedExtractionArtifactSet>;
  readStructuredContentArtifactSet?(input: {
    runId: string;
    searchResults: SearchResultsArtifactV2;
    extraction?: ValidatedExtractionArtifactSet;
  }): Promise<ValidatedStructuredContentArtifactSet>;
  readHiringArtifactSet?(input: {
    runId: string;
    searchResults: SearchResultsArtifactV2;
    extraction?: ValidatedExtractionArtifactSet;
    structured?: ValidatedStructuredContentArtifactSet;
  }): Promise<ValidatedHiringArtifactSet>;
  readCommunityPlan?(input: {
    runId: string;
    searchResults: SearchResultsArtifactV2;
  }): Promise<ValidatedCommunityPlanSet>;
  readCommunityThreadManifest?(input: {
    runId: string;
    searchResults: SearchResultsArtifactV2;
  }): Promise<ValidatedCommunityThreadManifestSet>;
  readCommunityThreads?(input: {
    runId: string;
    searchResults: SearchResultsArtifactV2;
  }): Promise<ValidatedCommunityThreadSet>;
  readCommunityCommentManifest?(input: {
    runId: string;
    searchResults: SearchResultsArtifactV2;
  }): Promise<ValidatedCommunityCommentManifestSet>;
  readCommunityComments?(input: {
    runId: string;
    searchResults: SearchResultsArtifactV2;
  }): Promise<ValidatedCommunityCommentSet>;
  readCommunityAnalysis?(input: {
    runId: string;
    searchResults: SearchResultsArtifactV2;
  }): Promise<ValidatedCommunityAnalysisSet>;
  readCommunityArtifactSet?(input: {
    runId: string;
    searchResults: SearchResultsArtifactV2;
  }): Promise<ValidatedCommunityArtifactSet>;
  readDeveloperPlan?(input: {
    runId: string;
    searchResults: SearchResultsArtifactV2;
  }): Promise<ValidatedDeveloperPlanSet>;
  readDeveloperRepositories?(input: {
    runId: string;
    searchResults: SearchResultsArtifactV2;
  }): Promise<ValidatedDeveloperRepositorySet>;
  readDeveloperThreadManifest?(input: {
    runId: string;
    searchResults: SearchResultsArtifactV2;
  }): Promise<ValidatedDeveloperThreadManifestSet>;
  readDeveloperThreads?(input: {
    runId: string;
    searchResults: SearchResultsArtifactV2;
  }): Promise<ValidatedDeveloperThreadSet>;
  readDeveloperCommentManifest?(input: {
    runId: string;
    searchResults: SearchResultsArtifactV2;
  }): Promise<ValidatedDeveloperCommentManifestSet>;
  readDeveloperComments?(input: {
    runId: string;
    searchResults: SearchResultsArtifactV2;
  }): Promise<ValidatedDeveloperCommentSet>;
  readDeveloperAnalysis?(input: {
    runId: string;
    searchResults: SearchResultsArtifactV2;
  }): Promise<ValidatedDeveloperAnalysisSet>;
  readDeveloperArtifactSet?(input: {
    runId: string;
    searchResults: SearchResultsArtifactV2;
  }): Promise<ValidatedDeveloperArtifactSet>;
}

export class FixtureDiscoveryRuntime implements DiscoveryRuntime {
  readonly mode = "fixture" as const;
  readonly providerMode = "fixture_only" as const;
  readonly providerPolicy = "free_only" as const;
  readonly extractionMode = "none" as const;
  readonly maximumExtractions = 8;
  readonly structuredContentMode = "none" as const;
  readonly maximumStructuredResources = 8;
  readonly maximumDocumentResources = 4;
  readonly sourceAdapterMode = "none" as const;
  readonly sourceFamilies = [] as const;
  readonly maximumHiringTargets = 10;
  readonly maximumHiringBoardsPerTarget = 4;
  readonly maximumHiringJobsPerBoard = 250;
  readonly maximumHiringJobsTotal = 2_000;
  readonly redditDepth = "default" as const;
  readonly maximumRedditQueries = 8;
  readonly maximumRedditSubreddits = 20;
  readonly maximumRedditThreads = 100;
  readonly maximumRedditThreadDrill = 5;
  readonly githubDepth = "default" as const;
  readonly maximumGitHubQueries = 4;
  readonly maximumGitHubRepositories = 8;
  readonly maximumGitHubThreadDrill = 5;
  readonly communitySignalRuleVersion = "community_signals@1.0.0";
  readonly developerSignalRuleVersion = "c1-j3.developer-signals.v1";
  readonly hiringSignalRuleVersion = "hiring_signals@1.0.0";
  readonly hiringTaxonomyVersion = "hiring_taxonomy@1.0.0";
  readonly hiringTechnologyLexiconVersion = "hiring_technology_lexicon@1.0.0";
  readonly extractorVersion = "basic_public_html_extractor@1.0.0";
  readonly frontierPolicyVersion = "frontier_policy@1.0.0";
  readonly structuredParserPolicyVersion = "structured_parser_policy@1.0.0";
  readonly anydocParserVersion = "@firecrawl/anydoc@0.1.6";
  readonly htmlMarkdownRendererVersion = "sanitized_html_to_gfm@1.0.0";
  readonly extractionQualityEvaluatorVersion = "extraction_quality@1.0.0";
  readonly providerConfigurationFingerprint = "fixture-project-b-v2";
  readonly extractionConfigurationFingerprint = "fixture-no-extraction";
  readonly structuredConfigurationFingerprint = "fixture-no-structured-content";
  readonly sourceAdapterConfigurationFingerprint = "fixture-no-source-adapters";
  readonly communityConfigurationFingerprint = "fixture-no-community-sources";
  readonly developerConfigurationFingerprint = "fixture-no-developer-sources";

  async execute(input: DiscoveryRuntimeExecutionInput): Promise<SearchResultsArtifactV2> {
    void input;
    return loadProjectBPipelineFixture();
  }
}
