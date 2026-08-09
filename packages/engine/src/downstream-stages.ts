import {
  BuyerHypothesesArtifactV1Schema,
  BuyerMapArtifactV1Schema,
  CluvviError,
  CommentCollectionManifestArtifactV1Schema,
  CommunityCommentContextArtifactV1Schema,
  CommunitySignalsArtifactV1Schema,
  CommunitySourcePlanArtifactV1Schema,
  CommunitySourceRunTelemetryArtifactV1Schema,
  CommunityThreadContextArtifactV1Schema,
  ContentParseTelemetryV1Schema,
  CrawlFrontierArtifactV1Schema,
  DeveloperCommentCollectionManifestArtifactV1Schema,
  DeveloperCommentMetadataArtifactV1Schema,
  DeveloperRepositoryCollectionArtifactV1Schema,
  DeveloperSignalsArtifactV1Schema,
  DeveloperSourcePlanArtifactV1Schema,
  DeveloperSourceRunTelemetryArtifactV1Schema,
  DeveloperThreadManifestArtifactV1Schema,
  DeveloperThreadMetadataArtifactV1Schema,
  DiscoveryCandidatesArtifactV1Schema,
  DiscoveryRequestV1Schema,
  EvidenceFindingsArtifactV1Schema,
  ExtractedContentArtifactV1Schema,
  ExtractionRunTelemetryV1Schema,
  FixtureArtifactEnvelopeSchema,
  HiringSignalsArtifactV1Schema,
  IdentityEnrichmentArtifactV1Schema,
  JobCollectionArtifactV1Schema,
  MissionUnderstandingArtifactV1Schema,
  ProjectBFinalizationArtifactV1Schema,
  RankedOpportunitiesArtifactV1Schema,
  SearchResultsArtifactV2Schema,
  SourceAdapterRunTelemetryV1Schema,
  SourceTargetPlanArtifactV1Schema,
  StructuredContentArtifactV1Schema,
  ThreadManifestArtifactV1Schema,
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

type CommunityStageInput = { searchResults: SearchResultsArtifactV2; upstream: unknown };
function communityStageInputSchema(
  upstreamSchema: RuntimeSchema<unknown>,
): RuntimeSchema<CommunityStageInput> {
  return {
    parse(value: unknown): CommunityStageInput {
      const object = AnyObjectSchema.parse(value);
      return {
        searchResults: SearchResultsArtifactV2Schema.parse(object["searchResults"]),
        upstream: upstreamSchema.parse(object["upstream"]),
      };
    },
  };
}
function loadCommunityStageInput(
  upstreamType: ArtifactType,
): (context: StageContext) => Promise<unknown> {
  return async (context) => {
    const [searchResults, upstream] = await Promise.all([
      context.getLatestArtifact("search_results"),
      context.getLatestArtifact(upstreamType),
    ]);
    if (searchResults === null)
      throw new Error(`Community stage ${context.run.phase} requires search_results.`);
    if (upstream === null)
      throw new Error(`Community stage ${context.run.phase} requires ${upstreamType}.`);
    return { searchResults: searchResults.data, upstream: upstream.data };
  };
}

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
  jobCollection?: ReturnType<typeof JobCollectionArtifactV1Schema.parse>;
  hiringSignals?: ReturnType<typeof HiringSignalsArtifactV1Schema.parse>;
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
      ...(record["jobCollection"] === undefined
        ? {}
        : { jobCollection: JobCollectionArtifactV1Schema.parse(record["jobCollection"]) }),
      ...(record["hiringSignals"] === undefined
        ? {}
        : { hiringSignals: HiringSignalsArtifactV1Schema.parse(record["hiringSignals"]) }),
    };
  },
};

async function loadEvidenceInput(context: StageContext): Promise<EvidenceStageInput> {
  const candidates = await context.getLatestArtifact("candidates");
  if (candidates === null) throw new Error("Evidence requires missing candidates artifact.");
  const [extractedContent, structuredContent, jobCollection, hiringSignals] = await Promise.all([
    context.getLatestArtifact("extracted_content"),
    context.getLatestArtifact("structured_content"),
    context.getLatestArtifact("job_collection"),
    context.getLatestArtifact("hiring_signals"),
  ]);
  return {
    candidates: DiscoveryCandidatesArtifactV1Schema.parse(candidates.data),
    ...(extractedContent === null
      ? {}
      : { extractedContent: ExtractedContentArtifactV1Schema.parse(extractedContent.data) }),
    ...(structuredContent === null
      ? {}
      : { structuredContent: StructuredContentArtifactV1Schema.parse(structuredContent.data) }),
    ...(jobCollection === null
      ? {}
      : { jobCollection: JobCollectionArtifactV1Schema.parse(jobCollection.data) }),
    ...(hiringSignals === null
      ? {}
      : { hiringSignals: HiringSignalsArtifactV1Schema.parse(hiringSignals.data) }),
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

async function requireHiringArtifactSet(
  runtime: DiscoveryRuntime,
  context: StageContext,
  searchResults: SearchResultsArtifactV2,
) {
  if (
    runtime.sourceAdapterMode !== "selected_sources" ||
    !runtime.sourceFamilies?.includes("hiring") ||
    context.run.config.discoverySourceAdapterMode !== "selected_sources" ||
    !context.run.config.discoverySourceFamilies.includes("hiring")
  ) {
    throw new CluvviError({
      code: "DISCOVERY_HIRING_NOT_CONFIGURED",
      category: "configuration",
      message:
        "The run requested public hiring intelligence, but the active Discovery runtime is not configured for the hiring source family.",
      retryable: true,
      stage: context.run.phase,
      context: {
        retrySafe: true,
        resumeSupported: true,
        discoveryReuseExpected: true,
        frontierReuseExpected: true,
        extractionReuseExpected: true,
        structuredParsingReuseExpected: true,
      },
    });
  }
  if (runtime.readHiringArtifactSet === undefined) {
    throw new CluvviError({
      code: "DISCOVERY_HIRING_NOT_SUPPORTED",
      category: "unsupported",
      message: "The active Discovery runtime cannot import hiring companion artifacts.",
      retryable: false,
      stage: context.run.phase,
    });
  }
  const extraction =
    context.run.config.discoveryExtractionMode === "selected_public_pages"
      ? await requireExtractionArtifactSet(runtime, context, searchResults)
      : undefined;
  const structured =
    context.run.config.discoveryStructuredContentMode === "selected_resources"
      ? await requireStructuredContentArtifactSet(runtime, context, searchResults)
      : undefined;
  return runtime.readHiringArtifactSet({
    runId: context.run.id,
    searchResults,
    ...(extraction === undefined ? {} : { extraction }),
    ...(structured === undefined ? {} : { structured }),
  });
}

function assertCommunityConfigured(runtime: DiscoveryRuntime, context: StageContext): void {
  if (
    runtime.sourceAdapterMode !== "selected_sources" ||
    !runtime.sourceFamilies?.includes("community") ||
    context.run.config.discoverySourceAdapterMode !== "selected_sources" ||
    !context.run.config.discoverySourceFamilies.includes("community")
  ) {
    throw new CluvviError({
      code: "DISCOVERY_COMMUNITY_NOT_CONFIGURED",
      category: "configuration",
      message:
        "The run requested public Reddit community intelligence, but the active Discovery runtime is not configured for the community source family.",
      retryable: true,
      stage: context.run.phase,
      context: {
        retrySafe: true,
        resumeSupported: true,
        discoveryReuseExpected: true,
        hiringReuseExpected: true,
      },
    });
  }
}
async function requireCommunityPlan(
  runtime: DiscoveryRuntime,
  context: StageContext,
  searchResults: SearchResultsArtifactV2,
) {
  assertCommunityConfigured(runtime, context);
  if (runtime.readCommunityPlan === undefined) {
    throw new CluvviError({
      code: "DISCOVERY_COMMUNITY_NOT_SUPPORTED",
      category: "unsupported",
      message: "The active Discovery runtime cannot import the community source plan.",
      retryable: false,
      stage: context.run.phase,
    });
  }
  return runtime.readCommunityPlan({ runId: context.run.id, searchResults });
}

async function requireCommunityThreadManifest(
  runtime: DiscoveryRuntime,
  context: StageContext,
  searchResults: SearchResultsArtifactV2,
) {
  assertCommunityConfigured(runtime, context);
  if (runtime.readCommunityThreadManifest === undefined) {
    throw new CluvviError({
      code: "DISCOVERY_COMMUNITY_NOT_SUPPORTED",
      category: "unsupported",
      message: "The active Discovery runtime cannot import the Reddit thread manifest.",
      retryable: false,
      stage: context.run.phase,
    });
  }
  return runtime.readCommunityThreadManifest({ runId: context.run.id, searchResults });
}

async function requireCommunityThreads(
  runtime: DiscoveryRuntime,
  context: StageContext,
  searchResults: SearchResultsArtifactV2,
) {
  assertCommunityConfigured(runtime, context);
  if (runtime.readCommunityThreads === undefined) {
    throw new CluvviError({
      code: "DISCOVERY_COMMUNITY_NOT_SUPPORTED",
      category: "unsupported",
      message: "The active Discovery runtime cannot import validated Reddit thread artifacts.",
      retryable: false,
      stage: context.run.phase,
    });
  }
  return runtime.readCommunityThreads({ runId: context.run.id, searchResults });
}

async function requireCommunityCommentManifest(
  runtime: DiscoveryRuntime,
  context: StageContext,
  searchResults: SearchResultsArtifactV2,
) {
  assertCommunityConfigured(runtime, context);
  if (runtime.readCommunityCommentManifest === undefined) {
    throw new CluvviError({
      code: "DISCOVERY_COMMUNITY_NOT_SUPPORTED",
      category: "unsupported",
      message: "The active Discovery runtime cannot import the Reddit comment manifest.",
      retryable: false,
      stage: context.run.phase,
    });
  }
  return runtime.readCommunityCommentManifest({ runId: context.run.id, searchResults });
}

async function requireCommunityComments(
  runtime: DiscoveryRuntime,
  context: StageContext,
  searchResults: SearchResultsArtifactV2,
) {
  assertCommunityConfigured(runtime, context);
  if (runtime.readCommunityComments === undefined) {
    throw new CluvviError({
      code: "DISCOVERY_COMMUNITY_NOT_SUPPORTED",
      category: "unsupported",
      message: "The active Discovery runtime cannot import validated Reddit comment artifacts.",
      retryable: false,
      stage: context.run.phase,
    });
  }
  return runtime.readCommunityComments({ runId: context.run.id, searchResults });
}

async function requireCommunityAnalysis(
  runtime: DiscoveryRuntime,
  context: StageContext,
  searchResults: SearchResultsArtifactV2,
) {
  assertCommunityConfigured(runtime, context);
  if (runtime.readCommunityAnalysis === undefined) {
    throw new CluvviError({
      code: "DISCOVERY_COMMUNITY_NOT_SUPPORTED",
      category: "unsupported",
      message: "The active Discovery runtime cannot import validated community signals.",
      retryable: false,
      stage: context.run.phase,
    });
  }
  return runtime.readCommunityAnalysis({ runId: context.run.id, searchResults });
}

async function requireCommunityTelemetry(
  runtime: DiscoveryRuntime,
  context: StageContext,
  searchResults: SearchResultsArtifactV2,
) {
  assertCommunityConfigured(runtime, context);
  if (runtime.readCommunityArtifactSet === undefined) {
    throw new CluvviError({
      code: "DISCOVERY_COMMUNITY_NOT_SUPPORTED",
      category: "unsupported",
      message: "The active Discovery runtime cannot import community telemetry.",
      retryable: false,
      stage: context.run.phase,
    });
  }
  return runtime.readCommunityArtifactSet({ runId: context.run.id, searchResults });
}

function assertDeveloperConfigured(runtime: DiscoveryRuntime, context: StageContext): void {
  if (
    runtime.sourceAdapterMode !== "selected_sources" ||
    !runtime.sourceFamilies?.includes("developer") ||
    context.run.config.discoverySourceAdapterMode !== "selected_sources" ||
    !context.run.config.discoverySourceFamilies.includes("developer")
  ) {
    throw new CluvviError({
      code: "DISCOVERY_DEVELOPER_NOT_CONFIGURED",
      category: "configuration",
      message:
        "The run requested public GitHub developer intelligence, but the active Discovery runtime is not configured for the developer source family.",
      retryable: true,
      stage: context.run.phase,
      context: {
        retrySafe: true,
        resumeSupported: true,
        discoveryReuseExpected: true,
        hiringReuseExpected: true,
        communityReuseExpected: true,
      },
    });
  }
}

async function requireDeveloperPlan(
  runtime: DiscoveryRuntime,
  context: StageContext,
  searchResults: SearchResultsArtifactV2,
) {
  assertDeveloperConfigured(runtime, context);
  if (runtime.readDeveloperPlan === undefined)
    throw new CluvviError({
      code: "DISCOVERY_DEVELOPER_NOT_SUPPORTED",
      category: "unsupported",
      message: "The active Discovery runtime cannot import the developer source plan.",
      retryable: false,
      stage: context.run.phase,
    });
  return runtime.readDeveloperPlan({ runId: context.run.id, searchResults });
}

async function requireDeveloperRepositories(
  runtime: DiscoveryRuntime,
  context: StageContext,
  searchResults: SearchResultsArtifactV2,
) {
  assertDeveloperConfigured(runtime, context);
  if (runtime.readDeveloperRepositories === undefined)
    throw new CluvviError({
      code: "DISCOVERY_DEVELOPER_NOT_SUPPORTED",
      category: "unsupported",
      message: "The active Discovery runtime cannot import public GitHub repository artifacts.",
      retryable: false,
      stage: context.run.phase,
    });
  return runtime.readDeveloperRepositories({ runId: context.run.id, searchResults });
}

async function requireDeveloperThreadManifest(
  runtime: DiscoveryRuntime,
  context: StageContext,
  searchResults: SearchResultsArtifactV2,
) {
  assertDeveloperConfigured(runtime, context);
  if (runtime.readDeveloperThreadManifest === undefined)
    throw new CluvviError({
      code: "DISCOVERY_DEVELOPER_NOT_SUPPORTED",
      category: "unsupported",
      message: "The active Discovery runtime cannot import the GitHub thread manifest.",
      retryable: false,
      stage: context.run.phase,
    });
  return runtime.readDeveloperThreadManifest({ runId: context.run.id, searchResults });
}

async function requireDeveloperThreads(
  runtime: DiscoveryRuntime,
  context: StageContext,
  searchResults: SearchResultsArtifactV2,
) {
  assertDeveloperConfigured(runtime, context);
  if (runtime.readDeveloperThreads === undefined)
    throw new CluvviError({
      code: "DISCOVERY_DEVELOPER_NOT_SUPPORTED",
      category: "unsupported",
      message: "The active Discovery runtime cannot import validated GitHub thread metadata.",
      retryable: false,
      stage: context.run.phase,
    });
  return runtime.readDeveloperThreads({ runId: context.run.id, searchResults });
}

async function requireDeveloperCommentManifest(
  runtime: DiscoveryRuntime,
  context: StageContext,
  searchResults: SearchResultsArtifactV2,
) {
  assertDeveloperConfigured(runtime, context);
  if (runtime.readDeveloperCommentManifest === undefined)
    throw new CluvviError({
      code: "DISCOVERY_DEVELOPER_NOT_SUPPORTED",
      category: "unsupported",
      message: "The active Discovery runtime cannot import the GitHub comment manifest.",
      retryable: false,
      stage: context.run.phase,
    });
  return runtime.readDeveloperCommentManifest({ runId: context.run.id, searchResults });
}

async function requireDeveloperComments(
  runtime: DiscoveryRuntime,
  context: StageContext,
  searchResults: SearchResultsArtifactV2,
) {
  assertDeveloperConfigured(runtime, context);
  if (runtime.readDeveloperComments === undefined)
    throw new CluvviError({
      code: "DISCOVERY_DEVELOPER_NOT_SUPPORTED",
      category: "unsupported",
      message: "The active Discovery runtime cannot import validated GitHub comment metadata.",
      retryable: false,
      stage: context.run.phase,
    });
  return runtime.readDeveloperComments({ runId: context.run.id, searchResults });
}

async function requireDeveloperAnalysis(
  runtime: DiscoveryRuntime,
  context: StageContext,
  searchResults: SearchResultsArtifactV2,
) {
  assertDeveloperConfigured(runtime, context);
  if (runtime.readDeveloperAnalysis === undefined)
    throw new CluvviError({
      code: "DISCOVERY_DEVELOPER_NOT_SUPPORTED",
      category: "unsupported",
      message: "The active Discovery runtime cannot import validated developer signals.",
      retryable: false,
      stage: context.run.phase,
    });
  return runtime.readDeveloperAnalysis({ runId: context.run.id, searchResults });
}

async function requireDeveloperTelemetry(
  runtime: DiscoveryRuntime,
  context: StageContext,
  searchResults: SearchResultsArtifactV2,
) {
  assertDeveloperConfigured(runtime, context);
  if (runtime.readDeveloperArtifactSet === undefined)
    throw new CluvviError({
      code: "DISCOVERY_DEVELOPER_NOT_SUPPORTED",
      category: "unsupported",
      message: "The active Discovery runtime cannot import developer source telemetry.",
      retryable: false,
      stage: context.run.phase,
    });
  return runtime.readDeveloperArtifactSet({ runId: context.run.id, searchResults });
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
      name: "source_targeting",
      artifactType: "source_target_plan",
      version: "1.0.0",
      schemaVersion: "1.0",
      inputSchema: SearchResultsArtifactV2Schema,
      outputSchema: SourceTargetPlanArtifactV1Schema,
      shouldRun: (context) =>
        context.run.config.discoverySourceAdapterMode === "selected_sources" &&
        context.run.config.discoverySourceFamilies.includes("hiring"),
      loadInput: requireArtifact(SearchResultsArtifactV2Schema, "search_results"),
      toolName: "local_discovery_engine_import_source_target_plan",
      async execute(searchResults, context) {
        const set = await requireHiringArtifactSet(discoveryRuntime, context, searchResults);
        return set.sourceTargetPlan;
      },
    }),
    createDownstreamStage({
      name: "hiring_retrieval",
      artifactType: "job_collection",
      version: "1.0.0",
      schemaVersion: "1.0",
      inputSchema: SearchResultsArtifactV2Schema,
      outputSchema: JobCollectionArtifactV1Schema,
      shouldRun: (context) =>
        context.run.config.discoverySourceAdapterMode === "selected_sources" &&
        context.run.config.discoverySourceFamilies.includes("hiring"),
      loadInput: requireArtifact(SearchResultsArtifactV2Schema, "search_results"),
      toolName: "local_discovery_engine_import_job_collection",
      async execute(searchResults, context) {
        const set = await requireHiringArtifactSet(discoveryRuntime, context, searchResults);
        return set.jobCollection;
      },
    }),
    createDownstreamStage({
      name: "hiring_analysis",
      artifactType: "hiring_signals",
      version: "1.0.0",
      schemaVersion: "1.0",
      inputSchema: SearchResultsArtifactV2Schema,
      outputSchema: HiringSignalsArtifactV1Schema,
      shouldRun: (context) =>
        context.run.config.discoverySourceAdapterMode === "selected_sources" &&
        context.run.config.discoverySourceFamilies.includes("hiring"),
      loadInput: requireArtifact(SearchResultsArtifactV2Schema, "search_results"),
      toolName: "local_discovery_engine_import_hiring_signals",
      async execute(searchResults, context) {
        const set = await requireHiringArtifactSet(discoveryRuntime, context, searchResults);
        return set.hiringSignals;
      },
    }),
    createDownstreamStage({
      name: "source_adapter_telemetry",
      artifactType: "source_adapter_telemetry",
      version: "1.0.0",
      schemaVersion: "1.0",
      inputSchema: SearchResultsArtifactV2Schema,
      outputSchema: SourceAdapterRunTelemetryV1Schema,
      shouldRun: (context) =>
        context.run.config.discoverySourceAdapterMode === "selected_sources" &&
        context.run.config.discoverySourceFamilies.includes("hiring"),
      loadInput: requireArtifact(SearchResultsArtifactV2Schema, "search_results"),
      toolName: "local_discovery_engine_import_source_adapter_telemetry",
      async execute(searchResults, context) {
        const set = await requireHiringArtifactSet(discoveryRuntime, context, searchResults);
        return set.telemetry;
      },
    }),
    createDownstreamStage({
      name: "community_planning",
      artifactType: "community_source_plan",
      version: "1.0.0",
      schemaVersion: "1.0",
      inputSchema: SearchResultsArtifactV2Schema,
      outputSchema: CommunitySourcePlanArtifactV1Schema,
      shouldRun: (context) =>
        context.run.config.discoverySourceAdapterMode === "selected_sources" &&
        context.run.config.discoverySourceFamilies.includes("community"),
      loadInput: requireArtifact(SearchResultsArtifactV2Schema, "search_results"),
      toolName: "local_discovery_engine_import_community_source_plan",
      async execute(searchResults, context) {
        return (await requireCommunityPlan(discoveryRuntime, context, searchResults)).plan;
      },
    }),
    createDownstreamStage({
      name: "community_retrieval",
      artifactType: "thread_manifest",
      version: "1.0.0",
      schemaVersion: "1.0",
      inputSchema: communityStageInputSchema(CommunitySourcePlanArtifactV1Schema),
      outputSchema: ThreadManifestArtifactV1Schema,
      shouldRun: (context) =>
        context.run.config.discoverySourceAdapterMode === "selected_sources" &&
        context.run.config.discoverySourceFamilies.includes("community"),
      loadInput: loadCommunityStageInput("community_source_plan"),
      toolName: "local_discovery_engine_import_thread_manifest",
      async execute(input, context) {
        return (
          await requireCommunityThreadManifest(discoveryRuntime, context, input.searchResults)
        ).threadManifest;
      },
    }),
    createDownstreamStage({
      name: "community_thread_context",
      artifactType: "community_thread_context",
      version: "1.0.0",
      schemaVersion: "1.0",
      inputSchema: communityStageInputSchema(ThreadManifestArtifactV1Schema),
      outputSchema: CommunityThreadContextArtifactV1Schema,
      shouldRun: (context) =>
        context.run.config.discoverySourceAdapterMode === "selected_sources" &&
        context.run.config.discoverySourceFamilies.includes("community"),
      loadInput: loadCommunityStageInput("thread_manifest"),
      toolName: "local_discovery_engine_import_community_thread_context",
      async execute(input, context) {
        return (await requireCommunityThreads(discoveryRuntime, context, input.searchResults))
          .threadContext;
      },
    }),
    createDownstreamStage({
      name: "community_comment_retrieval",
      artifactType: "comment_collection_manifest",
      version: "1.0.0",
      schemaVersion: "1.0",
      inputSchema: communityStageInputSchema(CommunityThreadContextArtifactV1Schema),
      outputSchema: CommentCollectionManifestArtifactV1Schema,
      shouldRun: (context) =>
        context.run.config.discoverySourceAdapterMode === "selected_sources" &&
        context.run.config.discoverySourceFamilies.includes("community"),
      loadInput: loadCommunityStageInput("community_thread_context"),
      toolName: "local_discovery_engine_import_comment_collection_manifest",
      async execute(input, context) {
        return (
          await requireCommunityCommentManifest(discoveryRuntime, context, input.searchResults)
        ).commentManifest;
      },
    }),
    createDownstreamStage({
      name: "community_comment_context",
      artifactType: "community_comment_context",
      version: "1.0.0",
      schemaVersion: "1.0",
      inputSchema: communityStageInputSchema(CommentCollectionManifestArtifactV1Schema),
      outputSchema: CommunityCommentContextArtifactV1Schema,
      shouldRun: (context) =>
        context.run.config.discoverySourceAdapterMode === "selected_sources" &&
        context.run.config.discoverySourceFamilies.includes("community"),
      loadInput: loadCommunityStageInput("comment_collection_manifest"),
      toolName: "local_discovery_engine_import_community_comment_context",
      async execute(input, context) {
        return (await requireCommunityComments(discoveryRuntime, context, input.searchResults))
          .commentContext;
      },
    }),
    createDownstreamStage({
      name: "community_analysis",
      artifactType: "community_signals",
      version: "1.0.0",
      schemaVersion: "1.0",
      inputSchema: communityStageInputSchema(CommunityCommentContextArtifactV1Schema),
      outputSchema: CommunitySignalsArtifactV1Schema,
      shouldRun: (context) =>
        context.run.config.discoverySourceAdapterMode === "selected_sources" &&
        context.run.config.discoverySourceFamilies.includes("community"),
      loadInput: loadCommunityStageInput("community_comment_context"),
      toolName: "local_discovery_engine_import_community_signals",
      async execute(input, context) {
        return (await requireCommunityAnalysis(discoveryRuntime, context, input.searchResults))
          .signals;
      },
    }),
    createDownstreamStage({
      name: "community_source_telemetry",
      artifactType: "community_source_telemetry",
      version: "1.0.0",
      schemaVersion: "1.0",
      inputSchema: communityStageInputSchema(CommunitySignalsArtifactV1Schema),
      outputSchema: CommunitySourceRunTelemetryArtifactV1Schema,
      shouldRun: (context) =>
        context.run.config.discoverySourceAdapterMode === "selected_sources" &&
        context.run.config.discoverySourceFamilies.includes("community"),
      loadInput: loadCommunityStageInput("community_signals"),
      toolName: "local_discovery_engine_import_community_source_telemetry",
      async execute(input, context) {
        return (await requireCommunityTelemetry(discoveryRuntime, context, input.searchResults))
          .telemetry;
      },
    }),
    createDownstreamStage({
      name: "developer_planning",
      artifactType: "developer_source_plan",
      version: "1.0.0",
      schemaVersion: "1.0",
      inputSchema: SearchResultsArtifactV2Schema,
      outputSchema: DeveloperSourcePlanArtifactV1Schema,
      shouldRun: (context) =>
        context.run.config.discoverySourceAdapterMode === "selected_sources" &&
        context.run.config.discoverySourceFamilies.includes("developer"),
      loadInput: requireArtifact(SearchResultsArtifactV2Schema, "search_results"),
      toolName: "local_discovery_engine_import_developer_source_plan",
      async execute(searchResults, context) {
        return (await requireDeveloperPlan(discoveryRuntime, context, searchResults)).plan;
      },
    }),
    createDownstreamStage({
      name: "developer_repository_retrieval",
      artifactType: "developer_repository_collection",
      version: "1.0.0",
      schemaVersion: "1.0",
      inputSchema: communityStageInputSchema(DeveloperSourcePlanArtifactV1Schema),
      outputSchema: DeveloperRepositoryCollectionArtifactV1Schema,
      shouldRun: (context) =>
        context.run.config.discoverySourceAdapterMode === "selected_sources" &&
        context.run.config.discoverySourceFamilies.includes("developer"),
      loadInput: loadCommunityStageInput("developer_source_plan"),
      toolName: "local_discovery_engine_import_developer_repository_collection",
      async execute(input, context) {
        return (await requireDeveloperRepositories(discoveryRuntime, context, input.searchResults))
          .repositoryCollection;
      },
    }),
    createDownstreamStage({
      name: "developer_thread_retrieval",
      artifactType: "developer_thread_manifest",
      version: "1.0.0",
      schemaVersion: "1.0",
      inputSchema: communityStageInputSchema(DeveloperRepositoryCollectionArtifactV1Schema),
      outputSchema: DeveloperThreadManifestArtifactV1Schema,
      shouldRun: (context) =>
        context.run.config.discoverySourceAdapterMode === "selected_sources" &&
        context.run.config.discoverySourceFamilies.includes("developer"),
      loadInput: loadCommunityStageInput("developer_repository_collection"),
      toolName: "local_discovery_engine_import_developer_thread_manifest",
      async execute(input, context) {
        return (
          await requireDeveloperThreadManifest(discoveryRuntime, context, input.searchResults)
        ).threadManifest;
      },
    }),
    createDownstreamStage({
      name: "developer_thread_context",
      artifactType: "developer_thread_metadata",
      version: "1.0.0",
      schemaVersion: "1.0",
      inputSchema: communityStageInputSchema(DeveloperThreadManifestArtifactV1Schema),
      outputSchema: DeveloperThreadMetadataArtifactV1Schema,
      shouldRun: (context) =>
        context.run.config.discoverySourceAdapterMode === "selected_sources" &&
        context.run.config.discoverySourceFamilies.includes("developer"),
      loadInput: loadCommunityStageInput("developer_thread_manifest"),
      toolName: "local_discovery_engine_import_developer_thread_metadata",
      async execute(input, context) {
        return (await requireDeveloperThreads(discoveryRuntime, context, input.searchResults))
          .threadMetadata;
      },
    }),
    createDownstreamStage({
      name: "developer_comment_retrieval",
      artifactType: "developer_comment_collection_manifest",
      version: "1.0.0",
      schemaVersion: "1.0",
      inputSchema: communityStageInputSchema(DeveloperThreadMetadataArtifactV1Schema),
      outputSchema: DeveloperCommentCollectionManifestArtifactV1Schema,
      shouldRun: (context) =>
        context.run.config.discoverySourceAdapterMode === "selected_sources" &&
        context.run.config.discoverySourceFamilies.includes("developer"),
      loadInput: loadCommunityStageInput("developer_thread_metadata"),
      toolName: "local_discovery_engine_import_developer_comment_manifest",
      async execute(input, context) {
        return (
          await requireDeveloperCommentManifest(discoveryRuntime, context, input.searchResults)
        ).commentManifest;
      },
    }),
    createDownstreamStage({
      name: "developer_comment_context",
      artifactType: "developer_comment_metadata",
      version: "1.0.0",
      schemaVersion: "1.0",
      inputSchema: communityStageInputSchema(DeveloperCommentCollectionManifestArtifactV1Schema),
      outputSchema: DeveloperCommentMetadataArtifactV1Schema,
      shouldRun: (context) =>
        context.run.config.discoverySourceAdapterMode === "selected_sources" &&
        context.run.config.discoverySourceFamilies.includes("developer"),
      loadInput: loadCommunityStageInput("developer_comment_collection_manifest"),
      toolName: "local_discovery_engine_import_developer_comment_metadata",
      async execute(input, context) {
        return (await requireDeveloperComments(discoveryRuntime, context, input.searchResults))
          .commentMetadata;
      },
    }),
    createDownstreamStage({
      name: "developer_analysis",
      artifactType: "developer_signals",
      version: "1.0.0",
      schemaVersion: "1.0",
      inputSchema: communityStageInputSchema(DeveloperCommentMetadataArtifactV1Schema),
      outputSchema: DeveloperSignalsArtifactV1Schema,
      shouldRun: (context) =>
        context.run.config.discoverySourceAdapterMode === "selected_sources" &&
        context.run.config.discoverySourceFamilies.includes("developer"),
      loadInput: loadCommunityStageInput("developer_comment_metadata"),
      toolName: "local_discovery_engine_import_developer_signals",
      async execute(input, context) {
        return (await requireDeveloperAnalysis(discoveryRuntime, context, input.searchResults))
          .signals;
      },
    }),
    createDownstreamStage({
      name: "developer_source_telemetry",
      artifactType: "developer_source_telemetry",
      version: "1.0.0",
      schemaVersion: "1.0",
      inputSchema: communityStageInputSchema(DeveloperSignalsArtifactV1Schema),
      outputSchema: DeveloperSourceRunTelemetryArtifactV1Schema,
      shouldRun: (context) =>
        context.run.config.discoverySourceAdapterMode === "selected_sources" &&
        context.run.config.discoverySourceFamilies.includes("developer"),
      loadInput: loadCommunityStageInput("developer_signals"),
      toolName: "local_discovery_engine_import_developer_source_telemetry",
      async execute(input, context) {
        return (await requireDeveloperTelemetry(discoveryRuntime, context, input.searchResults))
          .telemetry;
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
      async execute(input, context) {
        const developerSelected =
          context.run.config.discoverySourceAdapterMode === "selected_sources" &&
          context.run.config.discoverySourceFamilies.includes("developer");
        const communitySelected =
          context.run.config.discoverySourceAdapterMode === "selected_sources" &&
          context.run.config.discoverySourceFamilies.includes("community");
        let community;
        let developer;
        if (communitySelected || developerSelected) {
          const searchArtifact = await context.getLatestArtifact("search_results");
          if (searchArtifact === null)
            throw new Error("Community/developer evidence requires the search_results artifact.");
          const searchResults = SearchResultsArtifactV2Schema.parse(searchArtifact.data);
          if (communitySelected) {
            community = await requireCommunityAnalysis(discoveryRuntime, context, searchResults);
          }
          if (developerSelected) {
            developer = await requireDeveloperAnalysis(discoveryRuntime, context, searchResults);
          }
        }
        return buildEvidenceFindings(
          input.candidates,
          context.now(),
          input.extractedContent,
          input.structuredContent,
          input.jobCollection,
          input.hiringSignals,
          community,
          developer,
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
