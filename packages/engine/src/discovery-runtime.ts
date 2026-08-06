import type {
  CluvviExtractionMode,
  CluvviStructuredContentMode,
  DiscoveryProviderMode,
  DiscoveryProviderPolicy,
  DiscoveryRuntimeMode,
  SearchResultsArtifactV2,
  ValidatedExtractionArtifactSet,
  ValidatedStructuredContentArtifactSet,
} from "@cluvvi/core";
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
  readonly extractorVersion?: string;
  readonly frontierPolicyVersion?: string;
  readonly structuredParserPolicyVersion?: string;
  readonly anydocParserVersion?: string;
  readonly htmlMarkdownRendererVersion?: string;
  readonly extractionQualityEvaluatorVersion?: string;
  readonly providerConfigurationFingerprint: string;
  readonly extractionConfigurationFingerprint?: string;
  readonly structuredConfigurationFingerprint?: string;
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
  readonly extractorVersion = "basic_public_html_extractor@1.0.0";
  readonly frontierPolicyVersion = "frontier_policy@1.0.0";
  readonly structuredParserPolicyVersion = "structured_parser_policy@1.0.0";
  readonly anydocParserVersion = "@firecrawl/anydoc@0.1.6";
  readonly htmlMarkdownRendererVersion = "sanitized_html_to_gfm@1.0.0";
  readonly extractionQualityEvaluatorVersion = "extraction_quality@1.0.0";
  readonly providerConfigurationFingerprint = "fixture-project-b-v2";
  readonly extractionConfigurationFingerprint = "fixture-no-extraction";
  readonly structuredConfigurationFingerprint = "fixture-no-structured-content";

  async execute(input: DiscoveryRuntimeExecutionInput): Promise<SearchResultsArtifactV2> {
    void input;
    return loadProjectBPipelineFixture();
  }
}
