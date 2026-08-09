import {
  ArtifactTypeSchema,
  LocalRunEventSchema,
  MissionInputSchemaV1,
  OpaqueIdSchema,
  ORDERED_RUN_PHASES,
  RunRequestSchema,
  createOpaqueId,
  type ArtifactRecord,
  type ArtifactType,
  type CluvviExtractionMode,
  type CluvviSourceAdapterMode,
  type CluvviSourceFamily,
  type CluvviStructuredContentMode,
  type DiscoveryProviderMode,
  type DiscoveryProviderPolicy,
  type DiscoveryRuntimeMode,
  type LocalRun,
  type LocalRunEvent,
  type MissionInputV1,
  type RunRequest,
} from "@cluvvi/core";
import {
  LOCAL_ENGINE_VERSION,
  createRunCreationRecords,
  readLiveProviderTelemetry,
  readProviderPolicyTrace,
} from "@cluvvi/engine";
import type { LocalCluvviPaths, LocalRuntimeStore } from "@cluvvi/storage";
import type {
  CapabilityReport,
  CluvviApplicationService,
  CreateRunResult,
  LocalDiagnostics,
  RunStageView,
  RunView,
} from "./contracts";

const FIXTURE_WARNING =
  "The current workflow processes a version-controlled search_results.v2 fixture through Evidence, Identity, Ranking, and Buyer Map. It does not contain live market discovery.";
const LOCAL_DISCOVERY_WARNING =
  "This run uses the standalone local Discovery Engine with fixture providers. It does not represent live customer discovery.";
const LIVE_DISCOVERY_WARNING =
  "This run uses provider-policy-controlled search through the local Discovery Engine. Identity, purchasing authority, and contact details are not verified.";
const LIVE_EXTRACTION_WARNING =
  "Selected public pages are fetched through the standalone Discovery Engine with bounded SSRF-safe extraction. Extracted text and JSON-LD remain untrusted source material and are never treated as instructions.";
const STRUCTURED_CONTENT_WARNING =
  "Selected HTML pages and public documents are parsed into bounded sections, tables, metadata, and footnotes. Parsed content remains untrusted source material; macros, formulas, links, and embedded instructions are never executed.";
const HIRING_INTELLIGENCE_WARNING =
  "Public hiring intelligence uses bounded public ATS and careers sources. Job text and derived hiring signals remain untrusted evidence and do not prove budget, expansion, replacement hiring, approved projects, or purchase intent.";

export class ApplicationServiceError extends Error {
  readonly code: string;
  readonly status: number;
  readonly retryable: boolean;

  constructor(input: { code: string; message: string; status: number; retryable?: boolean }) {
    super(input.message);
    this.name = "ApplicationServiceError";
    this.code = input.code;
    this.status = input.status;
    this.retryable = input.retryable ?? false;
  }
}

export class LocalCluvviApplicationService implements CluvviApplicationService {
  readonly #store: LocalRuntimeStore;
  readonly #paths: LocalCluvviPaths;
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
  readonly #communitySignalRuleVersion: string;
  readonly #developerSignalRuleVersion: string;
  readonly #hiringSignalRuleVersion: string;
  readonly #hiringTaxonomyVersion: string;
  readonly #hiringTechnologyLexiconVersion: string;
  readonly #extractorVersion: string;
  readonly #frontierPolicyVersion: string;
  readonly #structuredParserPolicyVersion: string;
  readonly #anydocParserVersion: string;
  readonly #htmlMarkdownRendererVersion: string;
  readonly #extractionQualityEvaluatorVersion: string;
  readonly #now: () => string;

  constructor(input: {
    store: LocalRuntimeStore;
    paths: LocalCluvviPaths;
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
    communitySignalRuleVersion?: string;
    developerSignalRuleVersion?: string;
    hiringSignalRuleVersion?: string;
    hiringTaxonomyVersion?: string;
    hiringTechnologyLexiconVersion?: string;
    extractorVersion?: string;
    frontierPolicyVersion?: string;
    structuredParserPolicyVersion?: string;
    anydocParserVersion?: string;
    htmlMarkdownRendererVersion?: string;
    extractionQualityEvaluatorVersion?: string;
    now?: () => string;
  }) {
    this.#store = input.store;
    this.#paths = input.paths;
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
    this.#communitySignalRuleVersion =
      input.communitySignalRuleVersion ?? "community_signals@1.0.0";
    this.#developerSignalRuleVersion =
      input.developerSignalRuleVersion ?? "c1-j3.developer-signals.v1";
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
    this.#now = input.now ?? (() => new Date().toISOString());
  }

  async createRun(input: MissionInputV1, idempotencyKey: string): Promise<CreateRunResult> {
    const missionInput = MissionInputSchemaV1.parse(input);
    const normalizedKey = idempotencyKey.trim();
    if (normalizedKey.length < 8 || normalizedKey.length > 200) {
      throw new ApplicationServiceError({
        code: "IDEMPOTENCY_KEY_INVALID",
        message: "Idempotency-Key must contain between 8 and 200 characters.",
        status: 400,
      });
    }

    await this.#store.initialize();
    const now = this.#now();
    const records = createRunCreationRecords({
      mission: missionInput,
      sourceFile: "browser://mission-form",
      now,
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
      communitySignalRuleVersion: this.#communitySignalRuleVersion,
      developerSignalRuleVersion: this.#developerSignalRuleVersion,
      hiringSignalRuleVersion: this.#hiringSignalRuleVersion,
      hiringTaxonomyVersion: this.#hiringTaxonomyVersion,
      hiringTechnologyLexiconVersion: this.#hiringTechnologyLexiconVersion,
      extractorVersion: this.#extractorVersion,
      frontierPolicyVersion: this.#frontierPolicyVersion,
      structuredParserPolicyVersion: this.#structuredParserPolicyVersion,
      anydocParserVersion: this.#anydocParserVersion,
      htmlMarkdownRendererVersion: this.#htmlMarkdownRendererVersion,
      extractionQualityEvaluatorVersion: this.#extractionQualityEvaluatorVersion,
    });
    const request = RunRequestSchema.parse({
      id: createOpaqueId("request"),
      runId: records.run.id,
      action: "start",
      status: "pending",
      idempotencyKey: normalizedKey,
      attempt: 0,
      createdAt: now,
      updatedAt: now,
    });
    const persisted = await this.#store.createQueuedRun({ ...records, request });
    const view = await this.getRun(persisted.run.id);
    if (view === null) {
      throw new Error(`Run ${persisted.run.id} disappeared after creation.`);
    }
    return { view, request: persisted.request, created: persisted.created };
  }

  async getRun(runId: string): Promise<RunView | null> {
    OpaqueIdSchema.parse(runId);
    await this.#store.initialize();
    const run = await this.#store.getRun(runId);
    if (run === null) {
      return null;
    }
    const mission = await this.#store.getMission(runId);
    if (mission === null) {
      throw new Error(`Mission for run ${runId} was not found.`);
    }
    const [executions, events, artifacts, requests] = await Promise.all([
      this.#store.listStageExecutions(runId),
      this.#store.listRunEvents(runId),
      this.#store.listArtifacts(runId),
      this.#store.listRunRequests(runId),
    ]);
    const reused = new Set(
      events.filter((event) => event.eventType === "stage_reused").map((event) => event.phase),
    );
    const providerTelemetry =
      run.config.discoveryProviderMode === "live_search"
        ? await readLiveProviderTelemetry({
            runsDirectory: this.#paths.runsDirectory,
            runId,
          }).catch(() => null)
        : null;
    const providerPolicyTrace =
      run.config.discoveryProviderMode === "live_search"
        ? await readProviderPolicyTrace({
            runsDirectory: this.#paths.runsDirectory,
            runId,
          }).catch(() => null)
        : null;
    const stages: RunStageView[] = ORDERED_RUN_PHASES.map((name) => {
      const attempts = executions.filter((execution) => execution.stageName === name);
      const latest = attempts.at(-1);
      if (reused.has(name)) {
        return {
          name,
          status: "reused",
          ...(latest === undefined ? {} : this.#stageTiming(latest)),
        };
      }
      if (latest !== undefined) {
        return {
          name,
          status: latest.status,
          ...this.#stageTiming(latest),
          ...(latest.failure === undefined ? {} : { failureCode: latest.failure.code }),
        };
      }
      return { name, status: "pending" };
    });
    return {
      run,
      mission,
      stages,
      events,
      artifacts,
      requests,
      providerTelemetry,
      providerPolicyTrace,
      fixture: run.config.discoveryProviderMode === "fixture_only",
    };
  }

  async listRuns(input: { limit?: number; status?: LocalRun["status"] } = {}): Promise<LocalRun[]> {
    await this.#store.initialize();
    const runs = await this.#store.listRuns(input.limit ?? 20);
    return input.status === undefined ? runs : runs.filter((run) => run.status === input.status);
  }

  async getRunEvents(
    runId: string,
    input: { afterTimestamp?: string } = {},
  ): Promise<LocalRunEvent[]> {
    OpaqueIdSchema.parse(runId);
    await this.#store.initialize();
    const events = await this.#store.listRunEvents(runId);
    if (input.afterTimestamp === undefined) {
      return events;
    }
    const boundary = Date.parse(input.afterTimestamp);
    if (Number.isNaN(boundary)) {
      throw new ApplicationServiceError({
        code: "EVENT_CURSOR_INVALID",
        message: "afterTimestamp must be a valid ISO timestamp.",
        status: 400,
      });
    }
    return events
      .filter((event) => Date.parse(event.createdAt) > boundary)
      .map((event) => LocalRunEventSchema.parse(event));
  }

  async getRunArtifact(runId: string, artifactType: ArtifactType): Promise<ArtifactRecord | null> {
    OpaqueIdSchema.parse(runId);
    const validatedType = ArtifactTypeSchema.parse(artifactType);
    await this.#store.initialize();
    return this.#store.getLatestArtifact(runId, validatedType);
  }

  async requestResume(runId: string): Promise<RunRequest> {
    const run = await this.#requireRun(runId);
    if (
      !(["failed", "budget_exhausted"] as const).includes(
        run.status as "failed" | "budget_exhausted",
      )
    ) {
      throw new ApplicationServiceError({
        code: "RUN_NOT_RESUMABLE",
        message: `Run ${runId} cannot be resumed from status ${run.status}.`,
        status: 409,
      });
    }
    return this.#enqueue(run, "resume", `resume:${run.id}:${run.updatedAt}`);
  }

  async requestCancel(runId: string): Promise<RunRequest> {
    const run = await this.#requireRun(runId);
    if (["completed", "cancelled"].includes(run.status)) {
      throw new ApplicationServiceError({
        code: "RUN_NOT_CANCELLABLE",
        message: `Run ${runId} cannot be cancelled from status ${run.status}.`,
        status: 409,
      });
    }
    return this.#enqueue(run, "cancel", `cancel:${run.id}:${run.updatedAt}`);
  }

  async getCapabilities(): Promise<CapabilityReport> {
    return {
      mode: this.#discoveryProviderMode === "live_search" ? "live_search" : "fixture",
      discoveryRuntimeMode: this.#discoveryRuntimeMode,
      discoveryProviderMode: this.#discoveryProviderMode,
      discoveryProviderPolicy: this.#discoveryProviderPolicy,
      discoveryExtractionMode: this.#discoveryExtractionMode,
      discoveryMaximumExtractions: this.#discoveryMaximumExtractions,
      discoveryStructuredContentMode: this.#discoveryStructuredContentMode,
      discoveryMaximumStructuredResources: this.#discoveryMaximumStructuredResources,
      discoveryMaximumDocumentResources: this.#discoveryMaximumDocumentResources,
      discoverySourceAdapterMode: this.#discoverySourceAdapterMode,
      discoverySourceFamilies: [...this.#discoverySourceFamilies],
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
      communitySignalRuleVersion: this.#communitySignalRuleVersion,
      developerSignalRuleVersion: this.#developerSignalRuleVersion,
      capabilities: {
        localEngine: true,
        missionCompiler: false,
        webSearch: this.#discoveryProviderMode === "live_search",
        webFetch: this.#discoveryExtractionMode === "selected_public_pages",
        enrichment: false,
        youtube: false,
        outreach: false,
      },
      warnings: [
        this.#discoveryProviderMode === "live_search"
          ? LIVE_DISCOVERY_WARNING
          : this.#discoveryRuntimeMode === "local_discovery_engine"
            ? LOCAL_DISCOVERY_WARNING
            : FIXTURE_WARNING,
        ...(this.#discoveryExtractionMode === "selected_public_pages"
          ? [LIVE_EXTRACTION_WARNING]
          : []),
        ...(this.#discoveryStructuredContentMode === "selected_resources"
          ? [STRUCTURED_CONTENT_WARNING]
          : []),
        ...(this.#discoverySourceAdapterMode === "selected_sources"
          ? [HIRING_INTELLIGENCE_WARNING]
          : []),
      ],
    };
  }

  async getDiagnostics(): Promise<LocalDiagnostics> {
    await this.#store.initialize();
    const heartbeat = await this.#store.getLatestRunnerHeartbeat();
    const available = heartbeat !== null && Date.now() - Date.parse(heartbeat.lastSeenAt) <= 15_000;
    return {
      projectRoot: this.#paths.projectRoot,
      databasePath: this.#paths.databasePath,
      runsDirectory: this.#paths.runsDirectory,
      databaseInstanceId: await this.#store.getDatabaseInstanceId(),
      migrationVersion: await this.#store.getMigrationVersion(),
      engineVersion: LOCAL_ENGINE_VERSION,
      mode: this.#discoveryProviderMode === "live_search" ? "live_search" : "fixture",
      discoveryRuntimeMode: this.#discoveryRuntimeMode,
      discoveryProviderMode: this.#discoveryProviderMode,
      discoveryProviderPolicy: this.#discoveryProviderPolicy,
      discoveryExtractionMode: this.#discoveryExtractionMode,
      discoveryMaximumExtractions: this.#discoveryMaximumExtractions,
      discoveryStructuredContentMode: this.#discoveryStructuredContentMode,
      discoveryMaximumStructuredResources: this.#discoveryMaximumStructuredResources,
      discoveryMaximumDocumentResources: this.#discoveryMaximumDocumentResources,
      discoverySourceAdapterMode: this.#discoverySourceAdapterMode,
      discoverySourceFamilies: [...this.#discoverySourceFamilies],
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
      communitySignalRuleVersion: this.#communitySignalRuleVersion,
      developerSignalRuleVersion: this.#developerSignalRuleVersion,
      runner: { available, heartbeat },
    };
  }

  async #requireRun(runId: string): Promise<LocalRun> {
    OpaqueIdSchema.parse(runId);
    await this.#store.initialize();
    const run = await this.#store.getRun(runId);
    if (run === null) {
      throw new ApplicationServiceError({
        code: "RUN_NOT_FOUND",
        message: `Run ${runId} was not found.`,
        status: 404,
      });
    }
    return run;
  }

  async #enqueue(
    run: LocalRun,
    action: "resume" | "cancel",
    idempotencyKey: string,
  ): Promise<RunRequest> {
    const now = this.#now();
    return this.#store.enqueueRunRequest(
      RunRequestSchema.parse({
        id: createOpaqueId("request"),
        runId: run.id,
        action,
        status: "pending",
        idempotencyKey,
        attempt: 0,
        createdAt: now,
        updatedAt: now,
      }),
    );
  }

  #stageTiming(execution: {
    attempt: number;
    startedAt: string;
    completedAt?: string | undefined;
  }): Pick<RunStageView, "attempt" | "startedAt" | "completedAt"> {
    return {
      attempt: execution.attempt,
      startedAt: execution.startedAt,
      ...(execution.completedAt === undefined ? {} : { completedAt: execution.completedAt }),
    };
  }
}
