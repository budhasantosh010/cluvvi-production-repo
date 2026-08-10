import {
  ArtifactRecordSchema,
  CluvviError,
  LocalRunEventSchema,
  LocalRunSchema,
  ORDERED_RUN_PHASES,
  StageExecutionSchema,
  ToolCallRecordSchema,
  classifyError,
  createOpaqueId,
  fingerprint,
  type ArtifactRecord,
  type ArtifactType,
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
  type LocalRunPhase,
  type MissionInputV1,
  type RunBudget,
} from "@cluvvi/core";
import type { CluvviStore } from "@cluvvi/storage";
import { setTimeout as delay } from "node:timers/promises";
import type { LocalArtifactWriter } from "./artifact-writer";
import { BudgetController } from "./budget-controller";
import { FixtureDiscoveryRuntime, type DiscoveryRuntime } from "./discovery-runtime";
import { createPlaceholderStages } from "./placeholder-stages";
import { createRunCreationRecords } from "./run-factory";
import type { EngineStage, StageContext } from "./stage";
import { StageRegistry } from "./stage";
import { LOCAL_ENGINE_VERSION } from "./version";

export interface RunResult {
  run: LocalRun;
  artifacts: ArtifactRecord[];
}

export interface RunExecutionOptions {
  shouldCancel?: () => Promise<boolean>;
  signal?: AbortSignal;
  failStage?: LocalRunPhase;
}

export class RunExecutionError extends Error {
  readonly runId: string;

  constructor(runId: string, cause: unknown) {
    super(`Run ${runId} failed. Resume with: pnpm cluvvi resume ${runId}`, { cause });
    this.name = "RunExecutionError";
    this.runId = runId;
  }
}

export interface EngineEventSink {
  emit(event: LocalRunEvent): void;
}

export class CluvviEngine {
  readonly #store: CluvviStore;
  readonly #stages: StageRegistry;
  readonly #artifactWriter: LocalArtifactWriter;
  readonly #budgetController: BudgetController;
  readonly #eventSink: EngineEventSink;
  readonly #now: () => string;
  readonly #stageDelayMs: number;
  readonly #discoveryRuntimeMode: DiscoveryRuntimeMode;
  readonly #discoveryProviderMode: DiscoveryProviderMode;
  readonly #discoveryProviderPolicy: DiscoveryProviderPolicy;
  readonly #discoveryExtractionMode: CluvviExtractionMode;
  readonly #discoveryMaximumExtractions: number;
  readonly #discoveryStructuredContentMode: CluvviStructuredContentMode;
  readonly #discoveryMaximumStructuredResources: number;
  readonly #discoveryMaximumDocumentResources: number;
  readonly #discoverySourceAdapterMode: CluvviSourceAdapterMode;
  readonly #discoverySourceFamilies: readonly CluvviSourceFamily[];
  readonly #discoveryMaximumHiringTargets: number;
  readonly #discoveryMaximumHiringBoardsPerTarget: number;
  readonly #discoveryMaximumHiringJobsPerBoard: number;
  readonly #discoveryMaximumHiringJobsTotal: number;
  readonly #discoveryRedditDepth: "quick" | "default" | "deep";
  readonly #discoveryMaximumRedditQueries: number;
  readonly #discoveryMaximumRedditSubreddits: number;
  readonly #discoveryMaximumRedditThreads: number;
  readonly #discoveryMaximumRedditThreadDrill: number;
  readonly #discoveryGitHubDepth: "quick" | "default" | "deep";
  readonly #discoveryMaximumGitHubQueries: number;
  readonly #discoveryMaximumGitHubRepositories: number;
  readonly #discoveryMaximumGitHubThreadDrill: number;
  readonly #discoveryYoutubeDepth: "quick" | "default" | "deep";
  readonly #communitySignalRuleVersion: string;
  readonly #developerSignalRuleVersion: string;
  readonly #videoSignalRuleVersion: string;
  readonly #specializedSignalRuleVersion: string;
  readonly #hiringSignalRuleVersion: string;
  readonly #hiringTaxonomyVersion: string;
  readonly #hiringTechnologyLexiconVersion: string;
  readonly #extractorVersion: string;
  readonly #frontierPolicyVersion: string;
  readonly #structuredParserPolicyVersion: string;
  readonly #anydocParserVersion: string;
  readonly #htmlMarkdownRendererVersion: string;
  readonly #extractionQualityEvaluatorVersion: string;
  readonly #providerConfigurationFingerprint: string;
  readonly #extractionConfigurationFingerprint: string;
  readonly #structuredConfigurationFingerprint: string;
  readonly #sourceAdapterConfigurationFingerprint: string;
  readonly #communityConfigurationFingerprint: string;
  readonly #developerConfigurationFingerprint: string;
  readonly #videoConfigurationFingerprint: string;
  readonly #specializedConfigurationFingerprint: string;

  constructor(input: {
    store: CluvviStore;
    stages: StageRegistry;
    artifactWriter: LocalArtifactWriter;
    budgetController?: BudgetController;
    eventSink?: EngineEventSink;
    now?: () => string;
    stageDelayMs?: number;
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
    discoveryGitHubDepth?: "quick" | "default" | "deep";
    discoveryMaximumGitHubQueries?: number;
    discoveryMaximumGitHubRepositories?: number;
    discoveryMaximumGitHubThreadDrill?: number;
    discoveryYoutubeDepth?: "quick" | "default" | "deep";
    communitySignalRuleVersion?: string;
    developerSignalRuleVersion?: string;
    videoSignalRuleVersion?: string;
    specializedSignalRuleVersion?: string;
    hiringSignalRuleVersion?: string;
    hiringTaxonomyVersion?: string;
    hiringTechnologyLexiconVersion?: string;
    extractorVersion?: string;
    frontierPolicyVersion?: string;
    structuredParserPolicyVersion?: string;
    anydocParserVersion?: string;
    htmlMarkdownRendererVersion?: string;
    extractionQualityEvaluatorVersion?: string;
    providerConfigurationFingerprint?: string;
    extractionConfigurationFingerprint?: string;
    structuredConfigurationFingerprint?: string;
    sourceAdapterConfigurationFingerprint?: string;
    communityConfigurationFingerprint?: string;
    developerConfigurationFingerprint?: string;
    videoConfigurationFingerprint?: string;
    specializedConfigurationFingerprint?: string;
  }) {
    this.#store = input.store;
    this.#stages = input.stages;
    this.#artifactWriter = input.artifactWriter;
    this.#budgetController = input.budgetController ?? new BudgetController();
    this.#eventSink = input.eventSink ?? { emit() {} };
    this.#now = input.now ?? (() => new Date().toISOString());
    this.#stageDelayMs = input.stageDelayMs ?? 0;
    this.#discoveryRuntimeMode = input.discoveryRuntimeMode ?? "fixture";
    this.#discoveryProviderMode = input.discoveryProviderMode ?? "fixture_only";
    this.#discoveryProviderPolicy = input.discoveryProviderPolicy ?? "free_only";
    this.#discoveryExtractionMode = input.discoveryExtractionMode ?? "none";
    this.#discoveryMaximumExtractions = input.discoveryMaximumExtractions ?? 8;
    this.#discoveryStructuredContentMode = input.discoveryStructuredContentMode ?? "none";
    this.#discoveryMaximumStructuredResources = input.discoveryMaximumStructuredResources ?? 8;
    this.#discoveryMaximumDocumentResources = input.discoveryMaximumDocumentResources ?? 4;
    this.#discoverySourceAdapterMode = input.discoverySourceAdapterMode ?? "none";
    this.#discoverySourceFamilies = input.discoverySourceFamilies ?? [];
    this.#discoveryMaximumHiringTargets = input.discoveryMaximumHiringTargets ?? 10;
    this.#discoveryMaximumHiringBoardsPerTarget = input.discoveryMaximumHiringBoardsPerTarget ?? 4;
    this.#discoveryMaximumHiringJobsPerBoard = input.discoveryMaximumHiringJobsPerBoard ?? 250;
    this.#discoveryMaximumHiringJobsTotal = input.discoveryMaximumHiringJobsTotal ?? 2_000;
    this.#discoveryRedditDepth = input.discoveryRedditDepth ?? "default";
    this.#discoveryMaximumRedditQueries = input.discoveryMaximumRedditQueries ?? 8;
    this.#discoveryMaximumRedditSubreddits = input.discoveryMaximumRedditSubreddits ?? 20;
    this.#discoveryMaximumRedditThreads = input.discoveryMaximumRedditThreads ?? 100;
    this.#discoveryMaximumRedditThreadDrill = input.discoveryMaximumRedditThreadDrill ?? 5;
    this.#discoveryGitHubDepth = input.discoveryGitHubDepth ?? "default";
    this.#discoveryMaximumGitHubQueries = input.discoveryMaximumGitHubQueries ?? 4;
    this.#discoveryMaximumGitHubRepositories = input.discoveryMaximumGitHubRepositories ?? 8;
    this.#discoveryMaximumGitHubThreadDrill = input.discoveryMaximumGitHubThreadDrill ?? 5;
    this.#discoveryYoutubeDepth = input.discoveryYoutubeDepth ?? "default";
    this.#communitySignalRuleVersion =
      input.communitySignalRuleVersion ?? "community_signals@1.0.0";
    this.#developerSignalRuleVersion =
      input.developerSignalRuleVersion ?? "c1-j3.developer-signals.v1";
    this.#videoSignalRuleVersion = input.videoSignalRuleVersion ?? "c1-j4.video-signals.v1";
    this.#specializedSignalRuleVersion =
      input.specializedSignalRuleVersion ?? "c1-j5.specialized-signals.v1";
    this.#hiringSignalRuleVersion = input.hiringSignalRuleVersion ?? "hiring_signals@1.0.0";
    this.#hiringTaxonomyVersion = input.hiringTaxonomyVersion ?? "hiring_taxonomy@1.0.0";
    this.#hiringTechnologyLexiconVersion =
      input.hiringTechnologyLexiconVersion ?? "hiring_technology_lexicon@1.0.0";
    this.#extractorVersion = input.extractorVersion ?? "basic_public_html_extractor@1.0.0";
    this.#frontierPolicyVersion = input.frontierPolicyVersion ?? "frontier_policy@1.0.0";
    this.#structuredParserPolicyVersion =
      input.structuredParserPolicyVersion ?? "structured_parser_policy@1.0.0";
    this.#anydocParserVersion = input.anydocParserVersion ?? "@firecrawl/anydoc@0.1.6";
    this.#htmlMarkdownRendererVersion =
      input.htmlMarkdownRendererVersion ?? "sanitized_html_to_gfm@1.0.0";
    this.#extractionQualityEvaluatorVersion =
      input.extractionQualityEvaluatorVersion ?? "extraction_quality@1.0.0";
    this.#providerConfigurationFingerprint =
      input.providerConfigurationFingerprint ?? "fixture-project-b-v2";
    this.#extractionConfigurationFingerprint =
      input.extractionConfigurationFingerprint ?? "fixture-no-extraction";
    this.#structuredConfigurationFingerprint =
      input.structuredConfigurationFingerprint ?? "fixture-no-structured-content";
    this.#sourceAdapterConfigurationFingerprint =
      input.sourceAdapterConfigurationFingerprint ?? "fixture-no-source-adapters";
    this.#communityConfigurationFingerprint =
      input.communityConfigurationFingerprint ?? "fixture-no-community-sources";
    this.#developerConfigurationFingerprint =
      input.developerConfigurationFingerprint ?? "fixture-no-developer-sources";
    this.#videoConfigurationFingerprint =
      input.videoConfigurationFingerprint ?? "fixture-no-video-sources";
    this.#specializedConfigurationFingerprint =
      input.specializedConfigurationFingerprint ?? "fixture-no-specialized-sources";
  }

  async start(input: {
    mission: MissionInputV1;
    sourceFile: string;
    budget?: RunBudget;
    failStage?: LocalRunPhase;
  }): Promise<RunResult> {
    await this.#store.initialize();
    const { mission, run, event } = createRunCreationRecords({
      mission: input.mission,
      sourceFile: input.sourceFile,
      now: this.#now(),
      discoveryRuntimeMode: this.#discoveryRuntimeMode,
      discoveryProviderMode: this.#discoveryProviderMode,
      discoveryProviderPolicy: this.#discoveryProviderPolicy,
      discoveryExtractionMode: this.#discoveryExtractionMode,
      discoveryMaximumExtractions: this.#discoveryMaximumExtractions,
      discoveryStructuredContentMode: this.#discoveryStructuredContentMode,
      discoveryMaximumStructuredResources: this.#discoveryMaximumStructuredResources,
      discoveryMaximumDocumentResources: this.#discoveryMaximumDocumentResources,
      discoverySourceAdapterMode: this.#discoverySourceAdapterMode,
      discoverySourceFamilies: this.#discoverySourceFamilies,
      discoveryMaximumHiringTargets: this.#discoveryMaximumHiringTargets,
      discoveryMaximumHiringBoardsPerTarget: this.#discoveryMaximumHiringBoardsPerTarget,
      discoveryMaximumHiringJobsPerBoard: this.#discoveryMaximumHiringJobsPerBoard,
      discoveryMaximumHiringJobsTotal: this.#discoveryMaximumHiringJobsTotal,
      discoveryRedditDepth: this.#discoveryRedditDepth,
      discoveryMaximumRedditQueries: this.#discoveryMaximumRedditQueries,
      discoveryMaximumRedditSubreddits: this.#discoveryMaximumRedditSubreddits,
      discoveryMaximumRedditThreads: this.#discoveryMaximumRedditThreads,
      discoveryMaximumRedditThreadDrill: this.#discoveryMaximumRedditThreadDrill,
      discoveryGitHubDepth: this.#discoveryGitHubDepth,
      discoveryMaximumGitHubQueries: this.#discoveryMaximumGitHubQueries,
      discoveryMaximumGitHubRepositories: this.#discoveryMaximumGitHubRepositories,
      discoveryMaximumGitHubThreadDrill: this.#discoveryMaximumGitHubThreadDrill,
      discoveryYoutubeDepth: this.#discoveryYoutubeDepth,
      communitySignalRuleVersion: this.#communitySignalRuleVersion,
      developerSignalRuleVersion: this.#developerSignalRuleVersion,
      videoSignalRuleVersion: this.#videoSignalRuleVersion,
      specializedSignalRuleVersion: this.#specializedSignalRuleVersion,
      hiringSignalRuleVersion: this.#hiringSignalRuleVersion,
      hiringTaxonomyVersion: this.#hiringTaxonomyVersion,
      hiringTechnologyLexiconVersion: this.#hiringTechnologyLexiconVersion,
      extractorVersion: this.#extractorVersion,
      frontierPolicyVersion: this.#frontierPolicyVersion,
      structuredParserPolicyVersion: this.#structuredParserPolicyVersion,
      anydocParserVersion: this.#anydocParserVersion,
      htmlMarkdownRendererVersion: this.#htmlMarkdownRendererVersion,
      extractionQualityEvaluatorVersion: this.#extractionQualityEvaluatorVersion,
      ...(input.budget === undefined ? {} : { budget: input.budget }),
    });
    await this.#artifactWriter.ensureRunDirectory(run.id);
    await this.#store.createRun(run, mission, event);
    this.#eventSink.emit(event);
    try {
      return await this.#execute(run.id, {
        resumed: false,
        ...(input.failStage === undefined ? {} : { failStage: input.failStage }),
      });
    } catch (error) {
      throw new RunExecutionError(run.id, error);
    }
  }

  async run(runId: string, options: RunExecutionOptions = {}): Promise<RunResult> {
    return this.#execute(runId, { resumed: false, ...options });
  }

  async resume(runId: string, options: RunExecutionOptions = {}): Promise<RunResult> {
    return this.#execute(runId, { resumed: true, ...options });
  }

  async #execute(
    runId: string,
    options: RunExecutionOptions & { resumed: boolean },
  ): Promise<RunResult> {
    await this.#store.initialize();
    let run = await this.#requireRun(runId);
    const mission = await this.#requireMission(runId);

    if (run.status === "completed" || run.status === "cancelled") {
      return { run, artifacts: await this.#store.listArtifacts(run.id) };
    }

    const startTime = this.#now();
    run = LocalRunSchema.parse({
      ...run,
      status: "running",
      updatedAt: startTime,
      completedAt: undefined,
      failure: undefined,
    });
    const startedEvent = this.#event(run, options.resumed ? "run_resumed" : "run_started", {});
    await this.#store.persistRunAndEvent(run, startedEvent);
    this.#eventSink.emit(startedEvent);

    for (const stage of this.#stages.stages) {
      if (options.shouldCancel !== undefined && (await options.shouldCancel())) {
        const cancelledAt = this.#now();
        run = LocalRunSchema.parse({
          ...run,
          status: "cancelled",
          updatedAt: cancelledAt,
          completedAt: cancelledAt,
          failure: undefined,
        });
        const cancelledEvent = this.#event(run, "run_cancelled", {});
        await this.#store.persistRunAndEvent(run, cancelledEvent);
        this.#eventSink.emit(cancelledEvent);
        return { run, artifacts: await this.#store.listArtifacts(run.id) };
      }

      this.#budgetController.assertRunCanContinue(run);
      const context = this.#context(run, mission, stage, options);
      if (stage.shouldRun !== undefined && !(await stage.shouldRun(context))) {
        const skippedAt = this.#now();
        run = LocalRunSchema.parse({ ...run, phase: stage.name, updatedAt: skippedAt });
        const inputFingerprint = fingerprint({
          stage: stage.name,
          stageVersion: stage.version,
          skipped: true,
          engineVersion: LOCAL_ENGINE_VERSION,
          discoveryRuntimeMode: run.config.discoveryRuntimeMode,
          discoveryProviderMode: run.config.discoveryProviderMode,
          discoveryProviderPolicy: run.config.discoveryProviderPolicy,
          extractionConfiguration: this.#extractionConfigurationFingerprint,
          ...(stage.name === "structured_parsing" || stage.name === "content_parse_telemetry"
            ? { structuredConfiguration: this.#structuredConfigurationFingerprint }
            : {}),
          ...([
            "source_targeting",
            "hiring_retrieval",
            "hiring_analysis",
            "source_adapter_telemetry",
          ].includes(stage.name)
            ? {
                sourceAdapterConfiguration: this.#sourceAdapterConfigurationFingerprint,
                sourceFamily: "hiring",
              }
            : {}),
          ...([
            "community_planning",
            "community_retrieval",
            "community_thread_context",
            "community_comment_retrieval",
            "community_comment_context",
            "community_analysis",
            "community_source_telemetry",
          ].includes(stage.name)
            ? {
                communityConfiguration: this.#communityConfigurationFingerprint,
                sourceFamily: "community",
                redditDepth: this.#discoveryRedditDepth,
                maximumRedditQueries: this.#discoveryMaximumRedditQueries,
                maximumRedditSubreddits: this.#discoveryMaximumRedditSubreddits,
                maximumRedditThreads: this.#discoveryMaximumRedditThreads,
                maximumRedditThreadDrill: this.#discoveryMaximumRedditThreadDrill,
                communitySignalRuleVersion: this.#communitySignalRuleVersion,
              }
            : {}),
          ...([
            "developer_planning",
            "developer_repository_retrieval",
            "developer_thread_retrieval",
            "developer_thread_context",
            "developer_comment_retrieval",
            "developer_comment_context",
            "developer_analysis",
            "developer_source_telemetry",
          ].includes(stage.name)
            ? {
                developerConfiguration: this.#developerConfigurationFingerprint,
                sourceFamily: "developer",
                githubDepth: this.#discoveryGitHubDepth,
                maximumGitHubQueries: this.#discoveryMaximumGitHubQueries,
                maximumGitHubRepositories: this.#discoveryMaximumGitHubRepositories,
                maximumGitHubThreadDrill: this.#discoveryMaximumGitHubThreadDrill,
                developerSignalRuleVersion: this.#developerSignalRuleVersion,
              }
            : {}),
          ...([
            "video_planning",
            "video_retrieval",
            "video_transcript_retrieval",
            "video_comment_retrieval",
            "video_analysis",
            "video_source_telemetry",
          ].includes(stage.name)
            ? {
                videoConfiguration: this.#videoConfigurationFingerprint,
                sourceFamily: "video",
                youtubeDepth: this.#discoveryYoutubeDepth,
                videoSignalRuleVersion: this.#videoSignalRuleVersion,
              }
            : {}),
          ...([
            "specialized_context",
            "specialized_candidate_discovery",
            "specialized_planning",
            "specialized_retrieval",
            "specialized_analysis",
            "specialized_source_telemetry",
          ].includes(stage.name)
            ? {
                specializedConfiguration: this.#specializedConfigurationFingerprint,
                sourceFamily: "specialized",
                specializedSignalRuleVersion: this.#specializedSignalRuleVersion,
              }
            : {}),
        });
        const previousSkipped = (await this.#store.listStageExecutions(run.id)).find(
          (execution) =>
            execution.stageName === stage.name &&
            execution.stageVersion === stage.version &&
            execution.inputFingerprint === inputFingerprint &&
            execution.status === "skipped",
        );
        if (previousSkipped !== undefined) {
          const reusedEvent = this.#event(run, "stage_reused", {
            executionId: previousSkipped.id,
            inputFingerprint,
            skipped: true,
          });
          await this.#store.persistRunAndEvent(run, reusedEvent);
          this.#eventSink.emit(reusedEvent);
          continue;
        }
        const execution = StageExecutionSchema.parse({
          id: createOpaqueId("stage"),
          runId: run.id,
          stageName: stage.name,
          stageVersion: stage.version,
          status: "skipped",
          inputFingerprint,
          attempt: await this.#store.getNextStageAttempt(run.id, stage.name),
          startedAt: skippedAt,
          completedAt: skippedAt,
        });
        const skippedEvent = this.#event(run, "stage_skipped", {
          executionId: execution.id,
          reason: "extraction_disabled",
        });
        await this.#store.skipStage({ run, execution, event: skippedEvent });
        this.#eventSink.emit(skippedEvent);
        continue;
      }
      const untrustedInput = await stage.loadInput(context);
      const validatedInput = stage.inputSchema.parse(untrustedInput);
      const inputFingerprint = fingerprint({
        stage: stage.name,
        stageVersion: stage.version,
        input: validatedInput,
        engineVersion: LOCAL_ENGINE_VERSION,
        discoveryRuntimeMode: run.config.discoveryRuntimeMode,
        discoveryProviderMode: run.config.discoveryProviderMode,
        discoveryProviderPolicy: run.config.discoveryProviderPolicy,
        providerConfiguration: this.#providerConfigurationFingerprint,
        ...(stage.name === "discovery"
          ? {}
          : { extractionConfiguration: this.#extractionConfigurationFingerprint }),
        ...(stage.name === "structured_parsing" || stage.name === "content_parse_telemetry"
          ? { structuredConfiguration: this.#structuredConfigurationFingerprint }
          : {}),
        ...([
          "source_targeting",
          "hiring_retrieval",
          "hiring_analysis",
          "source_adapter_telemetry",
        ].includes(stage.name)
          ? { sourceAdapterConfiguration: this.#sourceAdapterConfigurationFingerprint }
          : {}),
        ...([
          "community_planning",
          "community_retrieval",
          "community_thread_context",
          "community_comment_retrieval",
          "community_comment_context",
          "community_analysis",
          "community_source_telemetry",
        ].includes(stage.name)
          ? { communityConfiguration: this.#communityConfigurationFingerprint }
          : {}),
        ...([
          "developer_planning",
          "developer_repository_retrieval",
          "developer_thread_retrieval",
          "developer_thread_context",
          "developer_comment_retrieval",
          "developer_comment_context",
          "developer_analysis",
          "developer_source_telemetry",
        ].includes(stage.name)
          ? { developerConfiguration: this.#developerConfigurationFingerprint }
          : {}),
        ...([
          "video_planning",
          "video_retrieval",
          "video_transcript_retrieval",
          "video_comment_retrieval",
          "video_analysis",
          "video_source_telemetry",
        ].includes(stage.name)
          ? { videoConfiguration: this.#videoConfigurationFingerprint }
          : {}),
        ...([
          "specialized_context",
          "specialized_candidate_discovery",
          "specialized_planning",
          "specialized_retrieval",
          "specialized_analysis",
          "specialized_source_telemetry",
        ].includes(stage.name)
          ? { specializedConfiguration: this.#specializedConfigurationFingerprint }
          : {}),
      });
      const previous = await this.#store.findCompletedStageExecution(
        run.id,
        stage.name,
        stage.version,
        inputFingerprint,
      );
      if (previous !== null) {
        run = LocalRunSchema.parse({ ...run, phase: stage.name, updatedAt: this.#now() });
        const reusedEvent = this.#event(run, "stage_reused", {
          executionId: previous.id,
          inputFingerprint,
        });
        await this.#store.persistRunAndEvent(run, reusedEvent);
        this.#eventSink.emit(reusedEvent);
        continue;
      }

      const stageStartedAt = this.#now();
      run = LocalRunSchema.parse({ ...run, phase: stage.name, updatedAt: stageStartedAt });
      const execution = StageExecutionSchema.parse({
        id: createOpaqueId("stage"),
        runId: run.id,
        stageName: stage.name,
        stageVersion: stage.version,
        status: "running",
        inputFingerprint,
        attempt: await this.#store.getNextStageAttempt(run.id, stage.name),
        startedAt: stageStartedAt,
      });
      const stageStartedEvent = this.#event(run, "stage_started", {
        executionId: execution.id,
        attempt: execution.attempt,
      });
      await this.#store.startStage({ run, execution, event: stageStartedEvent });
      this.#eventSink.emit(stageStartedEvent);

      try {
        if (options.failStage === stage.name) {
          throw new CluvviError({
            code: "SIMULATED_STAGE_FAILURE",
            category: "internal",
            message: `Simulated C0.5 fixture failure at ${stage.name}.`,
            retryable: true,
            stage: stage.name,
          });
        }
        if (this.#stageDelayMs > 0) {
          await delay(this.#stageDelayMs);
        }
        const output = await stage.execute(validatedInput, context);
        const validatedOutput = stage.outputSchema.parse(output);
        const previousArtifact = await this.#store.getLatestArtifact(run.id, stage.artifactType);
        const completedAt = this.#now();
        const artifact = await this.#artifactWriter.writeArtifact({
          run,
          artifactType: stage.artifactType,
          stage: stage.name,
          schemaVersion: stage.schemaVersion,
          version: (previousArtifact?.version ?? 0) + 1,
          data: validatedOutput,
          createdAt: completedAt,
        });
        ArtifactRecordSchema.parse(artifact);
        run = LocalRunSchema.parse({ ...run, phase: stage.name, updatedAt: completedAt });
        const completedEvent = this.#event(run, "stage_completed", {
          executionId: execution.id,
          artifactId: artifact.id,
          artifactType: artifact.artifactType,
        });
        await this.#store.completeStage({
          run,
          executionId: execution.id,
          completedAt,
          artifact,
          event: completedEvent,
        });
        this.#eventSink.emit(completedEvent);
      } catch (error) {
        const failedAt = this.#now();
        const failure = classifyError(error, stage.name);
        const cancelled = failure.code === "DISCOVERY_ENGINE_CANCELLED";
        run = LocalRunSchema.parse({
          ...run,
          status: cancelled
            ? "cancelled"
            : failure.category === "budget"
              ? "budget_exhausted"
              : "failed",
          phase: stage.name,
          failure,
          updatedAt: failedAt,
          ...(cancelled ? { completedAt: failedAt } : {}),
        });
        const failedEvent = this.#event(run, cancelled ? "run_cancelled" : "stage_failed", {
          executionId: execution.id,
          code: failure.code,
          retryable: failure.retryable,
        });
        await this.#store.failStage({
          run,
          executionId: execution.id,
          failedAt,
          event: failedEvent,
        });
        this.#eventSink.emit(failedEvent);
        await this.#artifactWriter.writeFailure(run);
        if (cancelled) {
          return { run, artifacts: await this.#store.listArtifacts(run.id) };
        }
        throw error;
      }
    }

    const completedAt = this.#now();
    run = LocalRunSchema.parse({
      ...run,
      status: "completed",
      phase: "finalization",
      updatedAt: completedAt,
      completedAt,
      failure: undefined,
    });
    const completedEvent = this.#event(run, "run_completed", {
      stages: ORDERED_RUN_PHASES.length,
    });
    await this.#store.persistRunAndEvent(run, completedEvent);
    this.#eventSink.emit(completedEvent);
    const artifacts = await this.#store.listArtifacts(run.id);
    const events = await this.#store.listRunEvents(run.id);
    const toolCalls = await this.#store.listToolCalls(run.id);
    await this.#artifactWriter.writeToolCalls(run.id, toolCalls);
    await this.#artifactWriter.writeRunReport({ run, events, artifacts, toolCalls });
    return { run, artifacts };
  }

  #context(
    run: LocalRun,
    mission: LocalMission,
    stage: EngineStage<unknown, unknown>,
    options: RunExecutionOptions,
  ): StageContext {
    return {
      run,
      mission,
      store: this.#store,
      now: this.#now,
      ...(options.signal === undefined ? {} : { signal: options.signal }),
      ...(options.shouldCancel === undefined ? {} : { shouldCancel: options.shouldCancel }),
      getLatestArtifact: (artifactType: ArtifactType) =>
        this.#store.getLatestArtifact(run.id, artifactType),
      recordFixtureToolCall: async ({ toolName, request, response }) => {
        const createdAt = this.#now();
        const record = ToolCallRecordSchema.parse({
          id: createOpaqueId("tool"),
          runId: run.id,
          stageName: stage.name,
          toolName,
          provider: "fixture",
          requestFingerprint: fingerprint({ toolName, request, stage: stage.name }),
          request,
          response,
          status: "completed",
          attempt: 1,
          costUsd: 0,
          inputTokens: 0,
          outputTokens: 0,
          latencyMs: 0,
          providerRequestId: `fixture:${run.id}:${stage.name}`,
          createdAt,
          completedAt: createdAt,
        });
        await this.#store.recordToolCall(record);
        return record;
      },
    };
  }

  #event(
    run: LocalRun,
    eventType: LocalRunEvent["eventType"],
    data: Record<string, unknown>,
  ): LocalRunEvent {
    return LocalRunEventSchema.parse({
      id: createOpaqueId("event"),
      runId: run.id,
      eventType,
      phase: run.phase,
      data,
      createdAt: this.#now(),
    });
  }

  async #requireRun(runId: string): Promise<LocalRun> {
    const run = await this.#store.getRun(runId);
    if (run === null) {
      throw new Error(`Run ${runId} was not found.`);
    }
    return run;
  }

  async #requireMission(runId: string): Promise<LocalMission> {
    const mission = await this.#store.getMission(runId);
    if (mission === null) {
      throw new Error(`Mission for run ${runId} was not found.`);
    }
    return mission;
  }
}

export function createDefaultStageRegistry(
  input: { discoveryRuntime?: DiscoveryRuntime } = {},
): StageRegistry {
  const discoveryRuntime = input.discoveryRuntime ?? new FixtureDiscoveryRuntime();
  const stages = createPlaceholderStages({ discoveryRuntime });
  const stageNames = new Set(stages.map((stage) => stage.name));
  if (stageNames.size !== ORDERED_RUN_PHASES.length) {
    throw new Error("Default stage registry must contain every run phase exactly once.");
  }
  return new StageRegistry(stages);
}
