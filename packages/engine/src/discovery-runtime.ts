import type {
  DiscoveryProviderMode,
  DiscoveryProviderPolicy,
  DiscoveryRuntimeMode,
  SearchResultsArtifactV2,
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
  readonly providerConfigurationFingerprint: string;
  execute(input: DiscoveryRuntimeExecutionInput): Promise<SearchResultsArtifactV2>;
}

export class FixtureDiscoveryRuntime implements DiscoveryRuntime {
  readonly mode = "fixture" as const;
  readonly providerMode = "fixture_only" as const;
  readonly providerPolicy = "free_only" as const;
  readonly providerConfigurationFingerprint = "fixture-project-b-v2";

  async execute(input: DiscoveryRuntimeExecutionInput): Promise<SearchResultsArtifactV2> {
    void input;
    return loadProjectBPipelineFixture();
  }
}
