import {
  BuyerHypothesesArtifactV1Schema,
  BuyerMapArtifactV1Schema,
  CluvviError,
  ContentParseTelemetryV1Schema,
  CrawlFrontierArtifactV1Schema,
  DiscoveryCandidatesArtifactV1Schema,
  DiscoveryRequestV1Schema,
  EvidenceFindingsArtifactV1Schema,
  ExtractedContentArtifactV1Schema,
  ExtractionRunTelemetryV1Schema,
  FixtureArtifactEnvelopeSchema,
  IdentityEnrichmentArtifactV1Schema,
  MissionUnderstandingArtifactV1Schema,
  ProjectBFinalizationArtifactV1Schema,
  RankedOpportunitiesArtifactV1Schema,
  SearchResultsArtifactV2Schema,
  StructuredContentArtifactV1Schema,
  type ArtifactType,
  type SearchResultsArtifactV2,
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
  shouldRun?: (context: StageContext) => boolean | Promise<boolean>;
  toolName?: string | ((context: StageContext) => string);
}): EngineStage<TInput, TOutput> {
  return {
    name: input.name,
    artifactType: input.artifactType,
    version: input.version,
    schemaVersion: input.schemaVersion,
    inputSchema: input.inputSchema,
    outputSchema: input.outputSchema,
    ...(input.shouldRun === undefined ? {} : { shouldRun: input.shouldRun }),
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
      providerPolicy: context.run.config.discoveryProviderPolicy,
    }),
    sourcePlan: sourcePlanEnvelope.data,
  };
}

interface EvidenceStageInput {
  candidates: ReturnType<typeof DiscoveryCandidatesArtifactV1Schema.parse>;
  extractedContent?: ReturnType<typeof ExtractedContentArtifactV1Schema.parse>;
  structuredContent?: ReturnType<typeof StructuredContentArtifactV1Schema.parse>;
}

const EvidenceStageInputSchema: RuntimeSchema<EvidenceStageInput> = {
  parse(value: unknown): EvidenceStageInput {
    if (value === null || typeof value !== "object" || Array.isArray(value)) {
      throw new Error("Evidence stage requires candidates and optional extracted content.");
    }
    const record = value as Record<string, unknown>;
    return {
      candidates: DiscoveryCandidatesArtifactV1Schema.parse(record["candidates"]),
      ...(record["extractedContent"] === undefined
        ? {}
        : { extractedContent: ExtractedContentArtifactV1Schema.parse(record["extractedContent"]) }),
      ...(record["structuredContent"] === undefined
        ? {}
        : {
            structuredContent: StructuredContentArtifactV1Schema.parse(record["structuredContent"]),
          }),
    };
  },
};

async function loadEvidenceInput(context: StageContext): Promise<EvidenceStageInput> {
  const candidates = await context.getLatestArtifact("candidates");
  if (candidates === null) throw new Error("Evidence requires missing candidates artifact.");
  const [extractedContent, structuredContent] = await Promise.all([
    context.getLatestArtifact("extracted_content"),
    context.getLatestArtifact("structured_content"),
  ]);
  return {
    candidates: DiscoveryCandidatesArtifactV1Schema.parse(candidates.data),
    ...(extractedContent === null
      ? {}
      : { extractedContent: ExtractedContentArtifactV1Schema.parse(extractedContent.data) }),
    ...(structuredContent === null
      ? {}
      : { structuredContent: StructuredContentArtifactV1Schema.parse(structuredContent.data) }),
  };
}

async function requireExtractionArtifactSet(
  runtime: DiscoveryRuntime,
  context: StageContext,
  searchResults: SearchResultsArtifactV2,
) {
  if (
    runtime.extractionMode !== "selected_public_pages" ||
    context.run.config.discoveryExtractionMode !== "selected_public_pages"
  ) {
    throw new CluvviError({
      code: "DISCOVERY_EXTRACTION_NOT_CONFIGURED",
      category: "configuration",
      message:
        "The run requested public-page extraction, but the active Discovery runtime is not configured for it.",
      retryable: true,
      stage: context.run.phase,
      context: { retrySafe: true, resumeSupported: true, discoveryReuseExpected: true },
    });
  }
  if (runtime.readExtractionArtifactSet === undefined) {
    throw new CluvviError({
      code: "DISCOVERY_EXTRACTION_NOT_SUPPORTED",
      category: "unsupported",
      message: "The active Discovery runtime cannot import extraction companion artifacts.",
      retryable: false,
      stage: context.run.phase,
    });
  }
  return runtime.readExtractionArtifactSet({ runId: context.run.id, searchResults });
}

async function requireStructuredContentArtifactSet(
  runtime: DiscoveryRuntime,
  context: StageContext,
  searchResults: SearchResultsArtifactV2,
) {
  if (
    runtime.structuredContentMode !== "selected_resources" ||
    context.run.config.discoveryStructuredContentMode !== "selected_resources"
  ) {
    throw new CluvviError({
      code: "DISCOVERY_STRUCTURED_CONTENT_NOT_CONFIGURED",
      category: "configuration",
      message:
        "The run requested structured parsing, but the active Discovery runtime is not configured for it.",
      retryable: true,
      stage: context.run.phase,
      context: {
        retrySafe: true,
        resumeSupported: true,
        discoveryReuseExpected: true,
        frontierReuseExpected: true,
        extractionReuseExpected: true,
      },
    });
  }
  if (runtime.readStructuredContentArtifactSet === undefined) {
    throw new CluvviError({
      code: "DISCOVERY_STRUCTURED_CONTENT_NOT_SUPPORTED",
      category: "unsupported",
      message: "The active Discovery runtime cannot import structured-content companion artifacts.",
      retryable: false,
      stage: context.run.phase,
    });
  }
  const extraction = await requireExtractionArtifactSet(runtime, context, searchResults);
  return runtime.readStructuredContentArtifactSet({
    runId: context.run.id,
    searchResults,
    extraction,
  });
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
            message: `Run ${context.run.id} requires ${context.run.config.discoveryRuntimeMode}/${context.run.config.discoveryProviderMode}/${context.run.config.discoveryProviderPolicy}, but the active runner is configured for ${discoveryRuntime.mode}/${discoveryRuntime.providerMode}/${discoveryRuntime.providerPolicy}.`,
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
      name: "frontier",
      artifactType: "crawl_frontier",
      version: "1.0.0",
      schemaVersion: "1.0",
      inputSchema: SearchResultsArtifactV2Schema,
      outputSchema: CrawlFrontierArtifactV1Schema,
      shouldRun: (context) =>
        context.run.config.discoveryExtractionMode === "selected_public_pages",
      loadInput: requireArtifact(SearchResultsArtifactV2Schema, "search_results"),
      toolName: "local_discovery_engine_import_crawl_frontier",
      async execute(searchResults, context) {
        const set = await requireExtractionArtifactSet(discoveryRuntime, context, searchResults);
        return set.frontier;
      },
    }),
    createDownstreamStage({
      name: "extraction",
      artifactType: "extracted_content",
      version: "1.0.0",
      schemaVersion: "1.0",
      inputSchema: SearchResultsArtifactV2Schema,
      outputSchema: ExtractedContentArtifactV1Schema,
      shouldRun: (context) =>
        context.run.config.discoveryExtractionMode === "selected_public_pages",
      loadInput: requireArtifact(SearchResultsArtifactV2Schema, "search_results"),
      toolName: "local_discovery_engine_import_extracted_content",
      async execute(searchResults, context) {
        const set = await requireExtractionArtifactSet(discoveryRuntime, context, searchResults);
        return set.extractedContent;
      },
    }),
    createDownstreamStage({
      name: "extraction_telemetry",
      artifactType: "extraction_telemetry",
      version: "1.0.0",
      schemaVersion: "1.0",
      inputSchema: SearchResultsArtifactV2Schema,
      outputSchema: ExtractionRunTelemetryV1Schema,
      shouldRun: (context) =>
        context.run.config.discoveryExtractionMode === "selected_public_pages",
      loadInput: requireArtifact(SearchResultsArtifactV2Schema, "search_results"),
      toolName: "local_discovery_engine_import_extraction_telemetry",
      async execute(searchResults, context) {
        const set = await requireExtractionArtifactSet(discoveryRuntime, context, searchResults);
        return set.telemetry;
      },
    }),
    createDownstreamStage({
      name: "structured_parsing",
      artifactType: "structured_content",
      version: "1.0.0",
      schemaVersion: "1.0",
      inputSchema: SearchResultsArtifactV2Schema,
      outputSchema: StructuredContentArtifactV1Schema,
      shouldRun: (context) =>
        context.run.config.discoveryStructuredContentMode === "selected_resources",
      loadInput: requireArtifact(SearchResultsArtifactV2Schema, "search_results"),
      toolName: "local_discovery_engine_import_structured_content",
      async execute(searchResults, context) {
        const set = await requireStructuredContentArtifactSet(
          discoveryRuntime,
          context,
          searchResults,
        );
        return set.structuredContent;
      },
    }),
    createDownstreamStage({
      name: "content_parse_telemetry",
      artifactType: "content_parse_telemetry",
      version: "1.0.0",
      schemaVersion: "1.0",
      inputSchema: SearchResultsArtifactV2Schema,
      outputSchema: ContentParseTelemetryV1Schema,
      shouldRun: (context) =>
        context.run.config.discoveryStructuredContentMode === "selected_resources",
      loadInput: requireArtifact(SearchResultsArtifactV2Schema, "search_results"),
      toolName: "local_discovery_engine_import_content_parse_telemetry",
      async execute(searchResults, context) {
        const set = await requireStructuredContentArtifactSet(
          discoveryRuntime,
          context,
          searchResults,
        );
        return set.telemetry;
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
      version: "2.0.0",
      schemaVersion: "1.0",
      inputSchema: EvidenceStageInputSchema,
      outputSchema: EvidenceFindingsArtifactV1Schema,
      loadInput: loadEvidenceInput,
      execute(input, context) {
        return buildEvidenceFindings(
          input.candidates,
          context.now(),
          input.extractedContent,
          input.structuredContent,
        );
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
