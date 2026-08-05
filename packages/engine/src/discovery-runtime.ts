import type {
  CluvviExtractionMode,
  DiscoveryProviderMode,
  DiscoveryProviderPolicy,
  DiscoveryRuntimeMode,
  SearchResultsArtifactV2,
  ValidatedExtractionArtifactSet,
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
  readonly extractorVersion?: string;
  readonly frontierPolicyVersion?: string;
  readonly providerConfigurationFingerprint: string;
  readonly extractionConfigurationFingerprint?: string;
  execute(input: DiscoveryRuntimeExecutionInput): Promise<SearchResultsArtifactV2>;
  readExtractionArtifactSet?(input: {
    runId: string;
    searchResults: SearchResultsArtifactV2;
  }): Promise<ValidatedExtractionArtifactSet>;
}

export class FixtureDiscoveryRuntime implements DiscoveryRuntime {
  readonly mode = "fixture" as const;
  readonly providerMode = "fixture_only" as const;
  readonly providerPolicy = "free_only" as const;
  readonly extractionMode = "none" as const;
  readonly maximumExtractions = 8;
  readonly extractorVersion = "basic_public_html_extractor@1.0.0";
  readonly frontierPolicyVersion = "frontier_policy@1.0.0";
  readonly providerConfigurationFingerprint = "fixture-project-b-v2";
  readonly extractionConfigurationFingerprint = "fixture-no-extraction";

  async execute(input: DiscoveryRuntimeExecutionInput): Promise<SearchResultsArtifactV2> {
    void input;
    return loadProjectBPipelineFixture();
  }
}
