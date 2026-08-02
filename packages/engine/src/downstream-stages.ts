import {
  BuyerHypothesesArtifactV1Schema,
  BuyerMapArtifactV1Schema,
  CluvviError,
  DiscoveryCandidatesArtifactV1Schema,
  DiscoveryRequestV1Schema,
  EvidenceFindingsArtifactV1Schema,
  FixtureArtifactEnvelopeSchema,
  IdentityEnrichmentArtifactV1Schema,
  MissionUnderstandingArtifactV1Schema,
  ProjectBFinalizationArtifactV1Schema,
  RankedOpportunitiesArtifactV1Schema,
  SearchResultsArtifactV2Schema,
  type ArtifactType,
} from "@cluvvi/core";
import {
  buildBuyerHypotheses,
  buildBuyerMap,
  buildDiscoveryCandidates,
  buildEvidenceFindings,
  buildIdentityEnrichment,
  buildProjectBFinalization,
  buildRankedOpportunities,
} from "./downstream-fixture-data";
import {
  createDiscoveryRequestV1,
  type BridgeDiscoveryRequestV1,
} from "./discovery-request-adapter";
import { FixtureDiscoveryRuntime, type DiscoveryRuntime } from "./discovery-runtime";
import type { EngineStage, RuntimeSchema, StageContext } from "./stage";

export {
  loadProjectACompatibilityFixture,
  loadProjectBPipelineFixture,
} from "./discovery-fixtures";

function requireArtifact<T>(
  schema: RuntimeSchema<T>,
  artifactType: ArtifactType,
): (context: StageContext) => Promise<unknown> {
  return async (context) => {
    const artifact = await context.getLatestArtifact(artifactType);
    if (artifact === null) {
      throw new Error(`Stage ${context.run.phase} requires missing artifact ${artifactType}.`);
    }
    return schema.parse(artifact.data);
  };
}

function createDownstreamStage<TInput, TOutput>(input: {
  name: EngineStage<TInput, TOutput>["name"];
  artifactType: ArtifactType;
  version: string;
  schemaVersion: string;
  inputSchema: RuntimeSchema<TInput>;
  outputSchema: RuntimeSchema<TOutput>;
  loadInput: (context: StageContext) => Promise<unknown>;
  execute: (validated: TInput, context: StageContext) => TOutput | Promise<TOutput>;
  toolName?: string | ((context: StageContext) => string);
}): EngineStage<TInput, TOutput> {
  return {
    name: input.name,
    artifactType: input.artifactType,
    version: input.version,
    schemaVersion: input.schemaVersion,
    inputSchema: input.inputSchema,
    outputSchema: input.outputSchema,
    loadInput: input.loadInput,
    async execute(validated, context) {
      const output = await input.execute(validated, context);
      const toolName =
        typeof input.toolName === "function"
          ? input.toolName(context)
          : (input.toolName ?? `fixture_project_b_${input.name}`);
      await context.recordFixtureToolCall({
        toolName,
        request: {
          stage: input.name,
          runtimeMode: context.run.config.discoveryRuntimeMode,
          providerMode: context.run.config.discoveryProviderMode,
          inputArtifactKind:
            validated !== null &&
            typeof validated === "object" &&
            "artifactKind" in validated &&
            typeof validated.artifactKind === "string"
              ? validated.artifactKind
              : input.name === "discovery"
                ? "discovery_request.v1"
                : "source_plan.v1",
          fixture: true,
        },
        response: {
          status: "ok",
          artifactType: input.artifactType,
          schemaVersion: input.schemaVersion,
          runtimeMode: context.run.config.discoveryRuntimeMode,
          providerMode: context.run.config.discoveryProviderMode,
          fixture: context.run.config.discoveryProviderMode === "fixture_only",
        },
      });
      return output;
    },
  };
}

const AnyObjectSchema: RuntimeSchema<Record<string, unknown>> = {
  parse(value: unknown): Record<string, unknown> {
    if (value === null || typeof value !== "object" || Array.isArray(value)) {
      throw new Error("Expected an object artifact.");
    }
    return value as Record<string, unknown>;
  },
};

interface DiscoveryStageInput {
  request: BridgeDiscoveryRequestV1;
  sourcePlan: Record<string, unknown>;
}

const DiscoveryStageInputSchema: RuntimeSchema<DiscoveryStageInput> = {
  parse(value: unknown): DiscoveryStageInput {
    if (value === null || typeof value !== "object" || Array.isArray(value)) {
      throw new Error("Discovery stage requires a request and source plan.");
    }
    const record = value as Record<string, unknown>;
    const request = DiscoveryRequestV1Schema.parse(record["request"]);
    if (request.requestId === undefined) {
      throw new Error("Discovery bridge request requires requestId.");
    }
    return {
      request: request as BridgeDiscoveryRequestV1,
      sourcePlan: AnyObjectSchema.parse(record["sourcePlan"]),
    };
  },
};

async function loadDiscoveryInput(context: StageContext): Promise<DiscoveryStageInput> {
  const [understandingArtifact, sourcePlanArtifact] = await Promise.all([
    context.getLatestArtifact("mission_understanding"),
    context.getLatestArtifact("source_plan"),
  ]);
  if (understandingArtifact === null || sourcePlanArtifact === null) {
    throw new Error("Discovery requires mission_understanding and source_plan artifacts.");
  }
  const understandingEnvelope = FixtureArtifactEnvelopeSchema.parse(understandingArtifact.data);
  const sourcePlanEnvelope = FixtureArtifactEnvelopeSchema.parse(sourcePlanArtifact.data);
  return {
    request: createDiscoveryRequestV1({
      runId: context.run.id,
      mission: context.mission,
      understanding: MissionUnderstandingArtifactV1Schema.parse(understandingEnvelope.data),
      providerMode: context.run.config.discoveryProviderMode,
    }),
    sourcePlan: sourcePlanEnvelope.data,
  };
}

export function createDownstreamFixtureStages(
  input: { discoveryRuntime?: DiscoveryRuntime } = {},
): readonly EngineStage<unknown, unknown>[] {
  const discoveryRuntime = input.discoveryRuntime ?? new FixtureDiscoveryRuntime();
  return [
    createDownstreamStage({
      name: "discovery",
      artifactType: "search_results",
      version: "4.0.0",
      schemaVersion: "2.0",
      inputSchema: DiscoveryStageInputSchema,
      outputSchema: SearchResultsArtifactV2Schema,
      loadInput: loadDiscoveryInput,
      toolName: () =>
        discoveryRuntime.mode === "fixture"
          ? "fixture_internal_discovery_results"
          : discoveryRuntime.providerMode === "live_search"
            ? "local_discovery_engine_cli_live_providers"
            : "local_discovery_engine_cli_fixture_provider",
      execute(discoveryInput, context) {
        if (
          context.run.config.discoveryRuntimeMode !== discoveryRuntime.mode ||
          context.run.config.discoveryProviderMode !== discoveryRuntime.providerMode
        ) {
          throw new CluvviError({
            code: "DISCOVERY_ENGINE_NOT_CONFIGURED",
            category: "configuration",
            message: `Run ${context.run.id} requires ${context.run.config.discoveryRuntimeMode}/${context.run.config.discoveryProviderMode}, but the active runner is configured for ${discoveryRuntime.mode}/${discoveryRuntime.providerMode}.`,
            retryable: true,
            stage: "discovery",
            context: { retrySafe: true, resumeSupported: true },
          });
        }
        return discoveryRuntime.execute({
          runId: context.run.id,
          request: discoveryInput.request,
          ...(context.signal === undefined ? {} : { signal: context.signal }),
          ...(context.shouldCancel === undefined ? {} : { shouldCancel: context.shouldCancel }),
        });
      },
    }),
    createDownstreamStage({
      name: "normalization",
      artifactType: "candidates",
      version: "2.0.0",
      schemaVersion: "1.0",
      inputSchema: SearchResultsArtifactV2Schema,
      outputSchema: DiscoveryCandidatesArtifactV1Schema,
      loadInput: requireArtifact(SearchResultsArtifactV2Schema, "search_results"),
      execute(searchResults, context) {
        return buildDiscoveryCandidates(searchResults, context.now());
      },
    }),
    createDownstreamStage({
      name: "investigation",
      artifactType: "evidence_findings",
      version: "1.0.0",
      schemaVersion: "1.0",
      inputSchema: DiscoveryCandidatesArtifactV1Schema,
      outputSchema: EvidenceFindingsArtifactV1Schema,
      loadInput: requireArtifact(DiscoveryCandidatesArtifactV1Schema, "candidates"),
      execute(candidates, context) {
        return buildEvidenceFindings(candidates, context.now());
      },
    }),
    createDownstreamStage({
      name: "buyer_identification",
      artifactType: "buyers",
      version: "1.0.0",
      schemaVersion: "1.0",
      inputSchema: EvidenceFindingsArtifactV1Schema,
      outputSchema: BuyerHypothesesArtifactV1Schema,
      loadInput: requireArtifact(EvidenceFindingsArtifactV1Schema, "evidence_findings"),
      execute(evidence, context) {
        return buildBuyerHypotheses(evidence, context.now());
      },
    }),
    createDownstreamStage({
      name: "enrichment",
      artifactType: "identity_enrichment",
      version: "1.0.0",
      schemaVersion: "1.0",
      inputSchema: BuyerHypothesesArtifactV1Schema,
      outputSchema: IdentityEnrichmentArtifactV1Schema,
      loadInput: requireArtifact(BuyerHypothesesArtifactV1Schema, "buyers"),
      execute(hypotheses, context) {
        return buildIdentityEnrichment(hypotheses, context.now());
      },
    }),
    createDownstreamStage({
      name: "ranking",
      artifactType: "ranked_opportunities",
      version: "1.0.0",
      schemaVersion: "1.0",
      inputSchema: IdentityEnrichmentArtifactV1Schema,
      outputSchema: RankedOpportunitiesArtifactV1Schema,
      loadInput: requireArtifact(IdentityEnrichmentArtifactV1Schema, "identity_enrichment"),
      async execute(identity, context) {
        const evidenceArtifact = await context.getLatestArtifact("evidence_findings");
        if (evidenceArtifact === null) {
          throw new Error("Ranking requires missing evidence_findings artifact.");
        }
        return buildRankedOpportunities({
          identity,
          evidence: EvidenceFindingsArtifactV1Schema.parse(evidenceArtifact.data),
          mission: context.mission,
          generatedAt: context.now(),
        });
      },
    }),
    createDownstreamStage({
      name: "review",
      artifactType: "buyer_map",
      version: "1.0.0",
      schemaVersion: "1.0",
      inputSchema: RankedOpportunitiesArtifactV1Schema,
      outputSchema: BuyerMapArtifactV1Schema,
      loadInput: requireArtifact(RankedOpportunitiesArtifactV1Schema, "ranked_opportunities"),
      async execute(ranked, context) {
        const [identityArtifact, evidenceArtifact, searchResultsArtifact] = await Promise.all([
          context.getLatestArtifact("identity_enrichment"),
          context.getLatestArtifact("evidence_findings"),
          context.getLatestArtifact("search_results"),
        ]);
        if (
          identityArtifact === null ||
          evidenceArtifact === null ||
          searchResultsArtifact === null
        ) {
          throw new Error(
            "Buyer Map requires identity_enrichment, evidence_findings, and search_results artifacts.",
          );
        }
        return buildBuyerMap({
          ranked,
          identity: IdentityEnrichmentArtifactV1Schema.parse(identityArtifact.data),
          evidence: EvidenceFindingsArtifactV1Schema.parse(evidenceArtifact.data),
          searchResults: SearchResultsArtifactV2Schema.parse(searchResultsArtifact.data),
          generatedAt: context.now(),
        });
      },
    }),
    createDownstreamStage({
      name: "finalization",
      artifactType: "finalization",
      version: "2.0.0",
      schemaVersion: "1.0",
      inputSchema: BuyerMapArtifactV1Schema,
      outputSchema: ProjectBFinalizationArtifactV1Schema,
      loadInput: requireArtifact(BuyerMapArtifactV1Schema, "buyer_map"),
      async execute(buyerMap, context) {
        const [evidenceArtifact, identityArtifact] = await Promise.all([
          context.getLatestArtifact("evidence_findings"),
          context.getLatestArtifact("identity_enrichment"),
        ]);
        if (evidenceArtifact === null || identityArtifact === null) {
          throw new Error(
            "Finalization requires evidence_findings and identity_enrichment artifacts.",
          );
        }
        return buildProjectBFinalization({
          runId: context.run.id,
          buyerMap,
          evidence: EvidenceFindingsArtifactV1Schema.parse(evidenceArtifact.data),
          identity: IdentityEnrichmentArtifactV1Schema.parse(identityArtifact.data),
          generatedAt: context.now(),
        });
      },
    }),
  ] as readonly EngineStage<unknown, unknown>[];
}
