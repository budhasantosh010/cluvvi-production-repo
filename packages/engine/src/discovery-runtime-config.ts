import type {
  CluvviExtractionMode,
  CluvviSourceAdapterMode,
  CluvviSourceFamily,
  CluvviStructuredContentMode,
  DiscoveryProviderMode,
  DiscoveryProviderPolicy,
} from "@cluvvi/core";
import { existsSync, statSync } from "node:fs";
import { isAbsolute, normalize, resolve } from "node:path";

export const DISCOVERY_PROVIDER_ENV_ALLOWLIST = [
  "DISCOVERY_LIVE_PROVIDERS",
  "DISCOVERY_HTTP_TIMEOUT_MS",
  "DISCOVERY_HTTP_MAX_ATTEMPTS",
  "DISCOVERY_HTTP_CONCURRENCY",
  "DISCOVERY_LIVE_MAX_QUERIES",
  "DISCOVERY_MAX_RESULTS_PER_PROVIDER",
  "DISCOVERY_HN_ALGOLIA_MAX_REQUESTS_PER_RUN",
  "DISCOVERY_HN_FIREBASE_MAX_ITEMS_PER_RUN",
  "DISCOVERY_SEARXNG_URL",
  "DISCOVERY_SEARXNG_TIMEOUT_MS",
  "DISCOVERY_SEARXNG_MAX_REQUESTS_PER_RUN",
  "DISCOVERY_DDG_ENABLED",
  "DISCOVERY_DDG_TIMEOUT_MS",
  "DISCOVERY_DDG_MAX_REQUESTS_PER_RUN",
  "DISCOVERY_STARTPAGE_ENABLED",
  "DISCOVERY_STARTPAGE_TIMEOUT_MS",
  "DISCOVERY_STARTPAGE_MAX_REQUESTS_PER_RUN",
  "DISCOVERY_FREE_SEARCH_MIN_RESULTS",
  "DISCOVERY_FREE_SEARCH_MIN_UNIQUE_DOMAINS",
  "DISCOVERY_FREE_SEARCH_MAX_DUPLICATE_RATIO",
  "DISCOVERY_FREE_SEARCH_MIN_RELEVANT_RATIO",
  "DISCOVERY_FREE_SEARCH_MAX_HTML_BYTES",
  "DISCOVERY_FREE_SEARCH_MAX_JSON_BYTES",
  "DISCOVERY_TAVILY_MAX_REQUESTS_PER_RUN",
  "DISCOVERY_BRAVE_MAX_REQUESTS_PER_RUN",
  "DISCOVERY_TAVILY_SEARCH_DEPTH",
  "DISCOVERY_BROAD_PROVIDER_STRATEGY",
  "DISCOVERY_EXTRACTION_MAX_URLS_PER_QUERY",
  "DISCOVERY_EXTRACTION_MAX_URLS_PER_DOMAIN",
  "DISCOVERY_EXTRACTION_MIN_PRIORITY",
  "DISCOVERY_EXTRACTION_TIMEOUT_MS",
  "DISCOVERY_EXTRACTION_MAX_ATTEMPTS",
  "DISCOVERY_EXTRACTION_MAX_CONCURRENCY",
  "DISCOVERY_EXTRACTION_MAX_DOMAIN_CONCURRENCY",
  "DISCOVERY_EXTRACTION_MIN_DOMAIN_DELAY_MS",
  "DISCOVERY_EXTRACTION_MAX_REDIRECTS",
  "DISCOVERY_EXTRACTION_MAX_HTML_BYTES",
  "DISCOVERY_EXTRACTION_MAX_TEXT_CHARACTERS",
  "DISCOVERY_EXTRACTION_MIN_USEFUL_CHARACTERS",
  "DISCOVERY_EXTRACTION_RESPECT_ROBOTS",
  "DISCOVERY_EXTRACTION_ROBOTS_FAILURE_POLICY",
  "DISCOVERY_EXTRACTION_USER_AGENT",
  "DISCOVERY_STRUCTURED_MAX_RESOURCES",
  "DISCOVERY_STRUCTURED_MAX_DOCUMENT_RESOURCES",
  "DISCOVERY_DOCUMENT_MAX_BYTES",
  "DISCOVERY_DOCUMENT_PARSE_TIMEOUT_MS",
  "DISCOVERY_DOCUMENT_WORKER_MAX_ATTEMPTS",
  "DISCOVERY_MARKDOWN_MAX_CHARACTERS",
  "DISCOVERY_SECTIONS_MAX_PER_RESOURCE",
  "DISCOVERY_TABLES_MAX_PER_RESOURCE",
  "DISCOVERY_LINKS_MAX_PER_RESOURCE",
  "DISCOVERY_FOOTNOTES_MAX_PER_RESOURCE",
  "DISCOVERY_ASSETS_MAX_PER_RESOURCE",
  "DISCOVERY_TABLE_MAX_ROWS",
  "DISCOVERY_TABLE_MAX_COLUMNS",
  "DISCOVERY_TABLE_MAX_CELL_CHARACTERS",
  "DISCOVERY_TABLE_MAX_TOTAL_CELLS",
  "DISCOVERY_HTML_MARKDOWN_ENABLED",
  "DISCOVERY_ANYDOC_ENABLED",
  "DISCOVERY_ANYDOC_WORKER_CONCURRENCY",
  "DISCOVERY_HIRING_MAX_TARGETS",
  "DISCOVERY_HIRING_MAX_BOARDS_PER_TARGET",
  "DISCOVERY_HIRING_MAX_JOBS_PER_BOARD",
  "DISCOVERY_HIRING_MAX_TOTAL_JOBS",
  "DISCOVERY_HIRING_MAX_DISCOVERY_QUERIES_PER_TARGET",
  "DISCOVERY_HIRING_MAX_CONVENTIONAL_PATH_PROBES",
  "DISCOVERY_HIRING_MAX_CONCURRENCY",
  "DISCOVERY_HIRING_MAX_DOMAIN_CONCURRENCY",
  "DISCOVERY_HIRING_PROVIDER_TIMEOUT_MS",
  "DISCOVERY_HIRING_DESCRIPTION_MAX_CHARACTERS",
  "DISCOVERY_HIRING_TOTAL_DESCRIPTION_MAX_CHARACTERS",
  "DISCOVERY_HIRING_INCLUDE_PUBLIC_COMPENSATION",
  "DISCOVERY_HIRING_ALLOW_AUTHENTICATED_FREE",
  "DISCOVERY_HIRING_MIN_TARGET_CONFIDENCE",
  "DISCOVERY_HIRING_MIN_BOARD_RELATIONSHIP_CONFIDENCE",
  "DISCOVERY_REDDIT_ENABLED",
  "DISCOVERY_REDDIT_DEPTH",
  "DISCOVERY_REDDIT_MAX_QUERIES",
  "DISCOVERY_REDDIT_MAX_DISCOVERED_SUBREDDITS",
  "DISCOVERY_REDDIT_MAX_SELECTED_SUBREDDITS",
  "DISCOVERY_REDDIT_MAX_THREADS",
  "DISCOVERY_REDDIT_MAX_THREADS_DRILLED_QUICK",
  "DISCOVERY_REDDIT_MAX_THREADS_DRILLED_DEFAULT",
  "DISCOVERY_REDDIT_MAX_THREADS_DRILLED_DEEP",
  "DISCOVERY_REDDIT_MAX_COMMENTS_PER_THREAD",
  "DISCOVERY_REDDIT_MAX_TOTAL_COMMENTS",
  "DISCOVERY_REDDIT_RSS_TIMEOUT_MS",
  "DISCOVERY_REDDIT_LISTING_TIMEOUT_MS",
  "DISCOVERY_REDDIT_COMMENT_TIMEOUT_MS",
  "DISCOVERY_REDDIT_ENRICH_BUDGET_MS",
  "DISCOVERY_REDDIT_MAX_CONCURRENCY",
  "DISCOVERY_REDDIT_MAX_DOMAIN_CONCURRENCY",
  "DISCOVERY_REDDIT_MAX_RSS_RESPONSE_BYTES",
  "DISCOVERY_REDDIT_MAX_HTML_RESPONSE_BYTES",
  "DISCOVERY_REDDIT_ARCTIC_ENABLED",
  "DISCOVERY_REDDIT_ARCTIC_TIMEOUT_MS",
  "DISCOVERY_REDDIT_ARCTIC_BATCH_SIZE",
  "DISCOVERY_REDDIT_ARCTIC_MAX_BATCHES",
  "DISCOVERY_REDDIT_ARCTIC_PACE_MS",
  "DISCOVERY_REDDIT_ARCTIC_CACHE_MAX",
  "DISCOVERY_REDDIT_RELEVANCE_FLOOR",
  "DISCOVERY_REDDIT_CONTENT_SAFETY_FILTER",
] as const;

export type DiscoveryProviderEnvironmentKey = (typeof DISCOVERY_PROVIDER_ENV_ALLOWLIST)[number];

export const CLUVVI_EXTRACTOR_VERSION = "basic_public_html_extractor@1.0.0";
export const CLUVVI_FRONTIER_POLICY_VERSION = "frontier_policy@1.0.0";
export const CLUVVI_STRUCTURED_PARSER_POLICY_VERSION = "structured_parser_policy@1.0.0";
export const CLUVVI_ANYDOC_PARSER_VERSION = "@firecrawl/anydoc@0.1.6";
export const CLUVVI_HTML_MARKDOWN_RENDERER_VERSION = "sanitized_html_to_gfm@1.0.0";
export const CLUVVI_EXTRACTION_QUALITY_EVALUATOR_VERSION = "extraction_quality@1.0.0";
export const CLUVVI_COMMUNITY_SIGNAL_RULE_VERSION = "community_signals@1.0.0";
export const CLUVVI_HIRING_SIGNAL_RULE_VERSION = "hiring_signals@1.0.0";
export const CLUVVI_HIRING_TAXONOMY_VERSION = "hiring_taxonomy@1.0.0";
export const CLUVVI_HIRING_TECHNOLOGY_LEXICON_VERSION = "hiring_technology_lexicon@1.0.0";

export interface LocalDiscoveryEngineConfig {
  projectPath: string;
  command: string;
  timeoutMs: number;
  keepExchangeFiles: boolean;
  providerMode: DiscoveryProviderMode;
  providerPolicy: DiscoveryProviderPolicy;
  extractionMode?: CluvviExtractionMode;
  maximumExtractions?: number;
  structuredContentMode?: CluvviStructuredContentMode;
  maximumStructuredResources?: number;
  maximumDocumentResources?: number;
  sourceAdapterMode?: CluvviSourceAdapterMode;
  sourceFamilies?: CluvviSourceFamily[];
  maximumHiringTargets?: number;
  maximumHiringBoardsPerTarget?: number;
  maximumHiringJobsPerBoard?: number;
  maximumHiringJobsTotal?: number;
  redditDepth?: "quick" | "default" | "deep";
  maximumRedditQueries?: number;
  maximumRedditSubreddits?: number;
  maximumRedditThreads?: number;
  maximumRedditThreadDrill?: number;
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
  providerEnvironment: Record<string, string | undefined>;
}

export type DiscoveryRuntimeConfig =
  | {
      mode: "fixture";
      providerMode: "fixture_only";
      providerPolicy: "free_only";
      extractionMode: "none";
      maximumExtractions: number;
      structuredContentMode: "none";
      maximumStructuredResources: number;
      maximumDocumentResources: number;
      sourceAdapterMode: "none";
      sourceFamilies: CluvviSourceFamily[];
      maximumHiringTargets: number;
      maximumHiringBoardsPerTarget: number;
      maximumHiringJobsPerBoard: number;
      maximumHiringJobsTotal: number;
      redditDepth: "quick" | "default" | "deep";
      maximumRedditQueries: number;
      maximumRedditSubreddits: number;
      maximumRedditThreads: number;
      maximumRedditThreadDrill: number;
      communitySignalRuleVersion: string;
      hiringSignalRuleVersion: string;
      hiringTaxonomyVersion: string;
      hiringTechnologyLexiconVersion: string;
      extractorVersion: string;
      frontierPolicyVersion: string;
      structuredParserPolicyVersion: string;
      anydocParserVersion: string;
      htmlMarkdownRendererVersion: string;
      extractionQualityEvaluatorVersion: string;
    }
  | {
      mode: "local_discovery_engine";
      providerMode: DiscoveryProviderMode;
      providerPolicy: DiscoveryProviderPolicy;
      extractionMode: CluvviExtractionMode;
      maximumExtractions: number;
      structuredContentMode: CluvviStructuredContentMode;
      maximumStructuredResources: number;
      maximumDocumentResources: number;
      sourceAdapterMode: CluvviSourceAdapterMode;
      sourceFamilies: CluvviSourceFamily[];
      maximumHiringTargets: number;
      maximumHiringBoardsPerTarget: number;
      maximumHiringJobsPerBoard: number;
      maximumHiringJobsTotal: number;
      redditDepth: "quick" | "default" | "deep";
      maximumRedditQueries: number;
      maximumRedditSubreddits: number;
      maximumRedditThreads: number;
      maximumRedditThreadDrill: number;
      communitySignalRuleVersion: string;
      hiringSignalRuleVersion: string;
      hiringTaxonomyVersion: string;
      hiringTechnologyLexiconVersion: string;
      extractorVersion: string;
      frontierPolicyVersion: string;
      structuredParserPolicyVersion: string;
      anydocParserVersion: string;
      htmlMarkdownRendererVersion: string;
      extractionQualityEvaluatorVersion: string;
      local: LocalDiscoveryEngineConfig;
    };

export class DiscoveryRuntimeConfigurationError extends Error {
  readonly code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = "DiscoveryRuntimeConfigurationError";
    this.code = code;
  }
}

const MIN_TIMEOUT_MS = 1_000;
const MAX_TIMEOUT_MS = 300_000;
const DEFAULT_TIMEOUT_MS = 60_000;
const DEFAULT_MAX_EXTRACTIONS = 8;
const DEFAULT_MAX_STRUCTURED_RESOURCES = 8;
const DEFAULT_MAX_DOCUMENT_RESOURCES = 4;
const DEFAULT_MAX_HIRING_TARGETS = 10;
const DEFAULT_MAX_HIRING_BOARDS_PER_TARGET = 4;
const DEFAULT_MAX_HIRING_JOBS_PER_BOARD = 250;
const DEFAULT_MAX_HIRING_JOBS_TOTAL = 2_000;
const DEFAULT_REDDIT_DEPTH = "default" as const;
const DEFAULT_MAX_REDDIT_QUERIES = 8;
const DEFAULT_MAX_REDDIT_SUBREDDITS = 20;
const DEFAULT_MAX_REDDIT_THREADS = 100;
const DEFAULT_MAX_REDDIT_THREAD_DRILL = 5;

function configuredValue(
  environment: Readonly<Record<string, string | undefined>>,
  key: string,
): string | undefined {
  const value = environment[key]?.trim();
  return value === undefined || value.length === 0 ? undefined : value;
}

function parseBoolean(value: string | undefined, key: string, fallback: boolean): boolean {
  if (value === undefined) return fallback;
  if (["true", "1", "yes"].includes(value.toLowerCase())) return true;
  if (["false", "0", "no"].includes(value.toLowerCase())) return false;
  throw new DiscoveryRuntimeConfigurationError(`${key}_INVALID`, `${key} must be true or false.`);
}

function parseProviderMode(value: string | undefined): DiscoveryProviderMode {
  const mode = value ?? "fixture_only";
  if (mode === "fixture_only" || mode === "live_search") return mode;
  throw new DiscoveryRuntimeConfigurationError(
    "LOCAL_DISCOVERY_PROVIDER_MODE_INVALID",
    "CLUVVI_DISCOVERY_PROVIDER_MODE must be fixture_only or live_search.",
  );
}

function parseProviderPolicy(value: string | undefined): DiscoveryProviderPolicy {
  const policy = value ?? "free_only";
  if (policy === "free_only" || policy === "balanced" || policy === "paid_deep") return policy;
  throw new DiscoveryRuntimeConfigurationError(
    "LOCAL_DISCOVERY_PROVIDER_POLICY_INVALID",
    "CLUVVI_DISCOVERY_PROVIDER_POLICY must be free_only, balanced, or paid_deep.",
  );
}

function parseExtractionMode(value: string | undefined): CluvviExtractionMode {
  const mode = value ?? "none";
  if (mode === "none" || mode === "selected_public_pages") return mode;
  throw new DiscoveryRuntimeConfigurationError(
    "LOCAL_DISCOVERY_EXTRACTION_MODE_INVALID",
    "CLUVVI_DISCOVERY_EXTRACTION_MODE must be none or selected_public_pages.",
  );
}

function parseMaximumExtractions(value: string | undefined): number {
  if (value === undefined) return DEFAULT_MAX_EXTRACTIONS;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 100) {
    throw new DiscoveryRuntimeConfigurationError(
      "LOCAL_DISCOVERY_MAX_EXTRACTIONS_INVALID",
      "CLUVVI_DISCOVERY_MAX_EXTRACTIONS must be an integer from 1 to 100.",
    );
  }
  return parsed;
}

function parseStructuredContentMode(value: string | undefined): CluvviStructuredContentMode {
  const mode = value ?? "none";
  if (mode === "none" || mode === "selected_resources") return mode;
  throw new DiscoveryRuntimeConfigurationError(
    "LOCAL_DISCOVERY_STRUCTURED_CONTENT_MODE_INVALID",
    "CLUVVI_DISCOVERY_STRUCTURED_CONTENT_MODE must be none or selected_resources.",
  );
}

function parseSourceAdapterMode(value: string | undefined): CluvviSourceAdapterMode {
  const mode = value ?? "none";
  if (mode === "none" || mode === "selected_sources") return mode;
  throw new DiscoveryRuntimeConfigurationError(
    "LOCAL_DISCOVERY_SOURCE_ADAPTER_MODE_INVALID",
    "CLUVVI_DISCOVERY_SOURCE_ADAPTER_MODE must be none or selected_sources.",
  );
}

function parseSourceFamilies(value: string | undefined): CluvviSourceFamily[] {
  if (value === undefined || value.trim().length === 0) return [];
  const families = [
    ...new Set(
      value
        .split(",")
        .map((entry) => entry.trim())
        .filter(Boolean),
    ),
  ];
  if (families.some((family) => family !== "hiring" && family !== "community")) {
    throw new DiscoveryRuntimeConfigurationError(
      "LOCAL_DISCOVERY_SOURCE_FAMILY_INVALID",
      "CLUVVI_DISCOVERY_SOURCE_FAMILIES currently supports hiring and community.",
    );
  }
  return families as CluvviSourceFamily[];
}

function parseBoundedInteger(
  value: string | undefined,
  fallback: number,
  minimum: number,
  maximum: number,
  key: string,
  code: string,
): number {
  if (value === undefined) return fallback;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < minimum || parsed > maximum) {
    throw new DiscoveryRuntimeConfigurationError(
      code,
      `${key} must be an integer from ${minimum} to ${maximum}.`,
    );
  }
  return parsed;
}

function parseStructuredBudget(
  value: string | undefined,
  fallback: number,
  key: string,
  code: string,
): number {
  if (value === undefined) return fallback;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 100) {
    throw new DiscoveryRuntimeConfigurationError(code, `${key} must be an integer from 1 to 100.`);
  }
  return parsed;
}

function pathIsDirectory(path: string): boolean {
  try {
    return statSync(path).isDirectory();
  } catch {
    return false;
  }
}

export function allowedDiscoveryProviderEnvironment(
  environment: Readonly<Record<string, string | undefined>>,
): Record<string, string | undefined> {
  const allowed: Record<string, string | undefined> = {};
  for (const key of DISCOVERY_PROVIDER_ENV_ALLOWLIST) {
    const value = environment[key];
    if (value !== undefined) allowed[key] = value;
  }
  return allowed;
}

export function publicDiscoveryProviderEnvironment(
  environment: Readonly<Record<string, string | undefined>>,
): Record<string, string> {
  const publicValues: Record<string, string> = {};
  for (const key of DISCOVERY_PROVIDER_ENV_ALLOWLIST) {
    const value = environment[key];
    if (value !== undefined) publicValues[key] = value;
  }
  return publicValues;
}

export function parseDiscoveryRuntimeConfig(
  environment: Readonly<Record<string, string | undefined>> = process.env,
): DiscoveryRuntimeConfig {
  const rawMode = configuredValue(environment, "CLUVVI_DISCOVERY_MODE") ?? "fixture";
  const providerMode = parseProviderMode(
    configuredValue(environment, "CLUVVI_DISCOVERY_PROVIDER_MODE"),
  );
  const providerPolicy = parseProviderPolicy(
    configuredValue(environment, "CLUVVI_DISCOVERY_PROVIDER_POLICY"),
  );
  const extractionMode = parseExtractionMode(
    configuredValue(environment, "CLUVVI_DISCOVERY_EXTRACTION_MODE"),
  );
  const maximumExtractions = parseMaximumExtractions(
    configuredValue(environment, "CLUVVI_DISCOVERY_MAX_EXTRACTIONS"),
  );
  const structuredContentMode = parseStructuredContentMode(
    configuredValue(environment, "CLUVVI_DISCOVERY_STRUCTURED_CONTENT_MODE"),
  );
  const maximumStructuredResources = parseStructuredBudget(
    configuredValue(environment, "CLUVVI_DISCOVERY_MAX_STRUCTURED_RESOURCES"),
    DEFAULT_MAX_STRUCTURED_RESOURCES,
    "CLUVVI_DISCOVERY_MAX_STRUCTURED_RESOURCES",
    "LOCAL_DISCOVERY_MAX_STRUCTURED_RESOURCES_INVALID",
  );
  const maximumDocumentResources = parseStructuredBudget(
    configuredValue(environment, "CLUVVI_DISCOVERY_MAX_DOCUMENT_RESOURCES"),
    DEFAULT_MAX_DOCUMENT_RESOURCES,
    "CLUVVI_DISCOVERY_MAX_DOCUMENT_RESOURCES",
    "LOCAL_DISCOVERY_MAX_DOCUMENT_RESOURCES_INVALID",
  );
  if (maximumDocumentResources > maximumStructuredResources) {
    throw new DiscoveryRuntimeConfigurationError(
      "LOCAL_DISCOVERY_STRUCTURED_BUDGET_INVALID",
      "CLUVVI_DISCOVERY_MAX_DOCUMENT_RESOURCES cannot exceed CLUVVI_DISCOVERY_MAX_STRUCTURED_RESOURCES.",
    );
  }
  const sourceAdapterMode = parseSourceAdapterMode(
    configuredValue(environment, "CLUVVI_DISCOVERY_SOURCE_ADAPTER_MODE"),
  );
  const sourceFamilies = parseSourceFamilies(
    configuredValue(environment, "CLUVVI_DISCOVERY_SOURCE_FAMILIES"),
  );
  const maximumHiringTargets = parseBoundedInteger(
    configuredValue(environment, "CLUVVI_DISCOVERY_MAX_HIRING_TARGETS"),
    DEFAULT_MAX_HIRING_TARGETS,
    1,
    100,
    "CLUVVI_DISCOVERY_MAX_HIRING_TARGETS",
    "LOCAL_DISCOVERY_MAX_HIRING_TARGETS_INVALID",
  );
  const maximumHiringBoardsPerTarget = parseBoundedInteger(
    configuredValue(environment, "CLUVVI_DISCOVERY_MAX_HIRING_BOARDS_PER_TARGET"),
    DEFAULT_MAX_HIRING_BOARDS_PER_TARGET,
    1,
    20,
    "CLUVVI_DISCOVERY_MAX_HIRING_BOARDS_PER_TARGET",
    "LOCAL_DISCOVERY_MAX_HIRING_BOARDS_INVALID",
  );
  const maximumHiringJobsPerBoard = parseBoundedInteger(
    configuredValue(environment, "CLUVVI_DISCOVERY_MAX_HIRING_JOBS_PER_BOARD"),
    DEFAULT_MAX_HIRING_JOBS_PER_BOARD,
    1,
    1_000,
    "CLUVVI_DISCOVERY_MAX_HIRING_JOBS_PER_BOARD",
    "LOCAL_DISCOVERY_MAX_HIRING_JOBS_PER_BOARD_INVALID",
  );
  const maximumHiringJobsTotal = parseBoundedInteger(
    configuredValue(environment, "CLUVVI_DISCOVERY_MAX_HIRING_JOBS_TOTAL"),
    DEFAULT_MAX_HIRING_JOBS_TOTAL,
    1,
    10_000,
    "CLUVVI_DISCOVERY_MAX_HIRING_JOBS_TOTAL",
    "LOCAL_DISCOVERY_MAX_HIRING_JOBS_TOTAL_INVALID",
  );
  if (maximumHiringJobsPerBoard > maximumHiringJobsTotal) {
    throw new DiscoveryRuntimeConfigurationError(
      "LOCAL_DISCOVERY_HIRING_BUDGET_INVALID",
      "CLUVVI_DISCOVERY_MAX_HIRING_JOBS_PER_BOARD cannot exceed CLUVVI_DISCOVERY_MAX_HIRING_JOBS_TOTAL.",
    );
  }
  const redditDepthValue =
    configuredValue(environment, "CLUVVI_DISCOVERY_REDDIT_DEPTH") ?? DEFAULT_REDDIT_DEPTH;
  if (
    !(["quick", "default", "deep"] as const).includes(
      redditDepthValue as "quick" | "default" | "deep",
    )
  ) {
    throw new DiscoveryRuntimeConfigurationError(
      "LOCAL_DISCOVERY_REDDIT_DEPTH_INVALID",
      "CLUVVI_DISCOVERY_REDDIT_DEPTH must be quick, default, or deep.",
    );
  }
  const redditDepth = redditDepthValue as "quick" | "default" | "deep";
  const maximumRedditQueries = parseBoundedInteger(
    configuredValue(environment, "CLUVVI_DISCOVERY_MAX_REDDIT_QUERIES"),
    DEFAULT_MAX_REDDIT_QUERIES,
    1,
    8,
    "CLUVVI_DISCOVERY_MAX_REDDIT_QUERIES",
    "LOCAL_DISCOVERY_MAX_REDDIT_QUERIES_INVALID",
  );
  const maximumRedditSubreddits = parseBoundedInteger(
    configuredValue(environment, "CLUVVI_DISCOVERY_MAX_REDDIT_SUBREDDITS"),
    DEFAULT_MAX_REDDIT_SUBREDDITS,
    1,
    20,
    "CLUVVI_DISCOVERY_MAX_REDDIT_SUBREDDITS",
    "LOCAL_DISCOVERY_MAX_REDDIT_SUBREDDITS_INVALID",
  );
  const maximumRedditThreads = parseBoundedInteger(
    configuredValue(environment, "CLUVVI_DISCOVERY_MAX_REDDIT_THREADS"),
    DEFAULT_MAX_REDDIT_THREADS,
    1,
    200,
    "CLUVVI_DISCOVERY_MAX_REDDIT_THREADS",
    "LOCAL_DISCOVERY_MAX_REDDIT_THREADS_INVALID",
  );
  const maximumRedditThreadDrill = parseBoundedInteger(
    configuredValue(environment, "CLUVVI_DISCOVERY_MAX_REDDIT_THREAD_DRILL"),
    DEFAULT_MAX_REDDIT_THREAD_DRILL,
    1,
    20,
    "CLUVVI_DISCOVERY_MAX_REDDIT_THREAD_DRILL",
    "LOCAL_DISCOVERY_MAX_REDDIT_THREAD_DRILL_INVALID",
  );
  if (maximumRedditThreadDrill > maximumRedditThreads) {
    throw new DiscoveryRuntimeConfigurationError(
      "LOCAL_DISCOVERY_REDDIT_BUDGET_INVALID",
      "CLUVVI_DISCOVERY_MAX_REDDIT_THREAD_DRILL cannot exceed CLUVVI_DISCOVERY_MAX_REDDIT_THREADS.",
    );
  }
  if (sourceAdapterMode === "none" && sourceFamilies.length > 0) {
    throw new DiscoveryRuntimeConfigurationError(
      "LOCAL_DISCOVERY_SOURCE_FAMILY_INVALID",
      "Source families require CLUVVI_DISCOVERY_SOURCE_ADAPTER_MODE=selected_sources.",
    );
  }
  if (sourceAdapterMode === "selected_sources" && sourceFamilies.length === 0) {
    throw new DiscoveryRuntimeConfigurationError(
      "LOCAL_DISCOVERY_SOURCE_FAMILY_INVALID",
      "selected_sources requires at least one approved source family.",
    );
  }

  if (rawMode === "fixture") {
    if (
      providerMode !== "fixture_only" ||
      extractionMode !== "none" ||
      structuredContentMode !== "none" ||
      sourceAdapterMode !== "none"
    ) {
      throw new DiscoveryRuntimeConfigurationError(
        "DISCOVERY_ENGINE_NOT_CONFIGURED",
        "Live search, public-page extraction, structured parsing, or source adapters require CLUVVI_DISCOVERY_MODE=local_discovery_engine.",
      );
    }
    return {
      mode: "fixture",
      providerMode: "fixture_only",
      providerPolicy: "free_only",
      extractionMode: "none",
      maximumExtractions,
      structuredContentMode: "none",
      maximumStructuredResources,
      maximumDocumentResources,
      sourceAdapterMode: "none",
      sourceFamilies: [],
      maximumHiringTargets,
      maximumHiringBoardsPerTarget,
      maximumHiringJobsPerBoard,
      maximumHiringJobsTotal,
      redditDepth,
      maximumRedditQueries,
      maximumRedditSubreddits,
      maximumRedditThreads,
      maximumRedditThreadDrill,
      communitySignalRuleVersion: CLUVVI_COMMUNITY_SIGNAL_RULE_VERSION,
      hiringSignalRuleVersion: CLUVVI_HIRING_SIGNAL_RULE_VERSION,
      hiringTaxonomyVersion: CLUVVI_HIRING_TAXONOMY_VERSION,
      hiringTechnologyLexiconVersion: CLUVVI_HIRING_TECHNOLOGY_LEXICON_VERSION,
      extractorVersion: CLUVVI_EXTRACTOR_VERSION,
      frontierPolicyVersion: CLUVVI_FRONTIER_POLICY_VERSION,
      structuredParserPolicyVersion: CLUVVI_STRUCTURED_PARSER_POLICY_VERSION,
      anydocParserVersion: CLUVVI_ANYDOC_PARSER_VERSION,
      htmlMarkdownRendererVersion: CLUVVI_HTML_MARKDOWN_RENDERER_VERSION,
      extractionQualityEvaluatorVersion: CLUVVI_EXTRACTION_QUALITY_EVALUATOR_VERSION,
    };
  }
  if (rawMode !== "local_discovery_engine") {
    throw new DiscoveryRuntimeConfigurationError(
      "DISCOVERY_ENGINE_NOT_CONFIGURED",
      `Unsupported CLUVVI_DISCOVERY_MODE: ${rawMode}. Use fixture or local_discovery_engine.`,
    );
  }
  if (providerMode === "fixture_only" && providerPolicy !== "free_only") {
    throw new DiscoveryRuntimeConfigurationError(
      "LOCAL_DISCOVERY_PROVIDER_POLICY_INVALID",
      "balanced and paid_deep require CLUVVI_DISCOVERY_PROVIDER_MODE=live_search.",
    );
  }
  if (
    structuredContentMode === "selected_resources" &&
    extractionMode !== "selected_public_pages"
  ) {
    throw new DiscoveryRuntimeConfigurationError(
      "LOCAL_DISCOVERY_STRUCTURED_CONTENT_REQUIRES_EXTRACTION",
      "selected_resources requires CLUVVI_DISCOVERY_EXTRACTION_MODE=selected_public_pages.",
    );
  }

  const configuredPath = configuredValue(environment, "CLUVVI_DISCOVERY_ENGINE_PATH");
  if (configuredPath === undefined || !isAbsolute(configuredPath)) {
    throw new DiscoveryRuntimeConfigurationError(
      "LOCAL_DISCOVERY_PATH_MISSING",
      "CLUVVI_DISCOVERY_ENGINE_PATH must be an absolute path in local_discovery_engine mode.",
    );
  }
  const projectPath = normalize(configuredPath);
  if (!existsSync(projectPath) || !pathIsDirectory(projectPath)) {
    throw new DiscoveryRuntimeConfigurationError(
      "DISCOVERY_ENGINE_PATH_NOT_FOUND",
      `The configured standalone Discovery Engine path does not exist: ${projectPath}`,
    );
  }
  if (!existsSync(resolve(projectPath, "package.json"))) {
    throw new DiscoveryRuntimeConfigurationError(
      "LOCAL_DISCOVERY_PACKAGE_MISSING",
      `The configured standalone Discovery Engine path has no package.json: ${projectPath}`,
    );
  }

  const command = configuredValue(environment, "CLUVVI_DISCOVERY_ENGINE_COMMAND");
  if (command === undefined) {
    throw new DiscoveryRuntimeConfigurationError(
      "LOCAL_DISCOVERY_COMMAND_MISSING",
      "CLUVVI_DISCOVERY_ENGINE_COMMAND is required in local_discovery_engine mode.",
    );
  }

  const timeoutValue =
    configuredValue(environment, "CLUVVI_DISCOVERY_ENGINE_TIMEOUT_MS") ??
    String(DEFAULT_TIMEOUT_MS);
  const timeoutMs = Number(timeoutValue);
  if (!Number.isInteger(timeoutMs) || timeoutMs < MIN_TIMEOUT_MS || timeoutMs > MAX_TIMEOUT_MS) {
    throw new DiscoveryRuntimeConfigurationError(
      "LOCAL_DISCOVERY_TIMEOUT_INVALID",
      `CLUVVI_DISCOVERY_ENGINE_TIMEOUT_MS must be an integer from ${MIN_TIMEOUT_MS} to ${MAX_TIMEOUT_MS}.`,
    );
  }

  return {
    mode: "local_discovery_engine",
    providerMode,
    providerPolicy,
    extractionMode,
    maximumExtractions,
    structuredContentMode,
    maximumStructuredResources,
    maximumDocumentResources,
    sourceAdapterMode,
    sourceFamilies,
    maximumHiringTargets,
    maximumHiringBoardsPerTarget,
    maximumHiringJobsPerBoard,
    maximumHiringJobsTotal,
    redditDepth,
    maximumRedditQueries,
    maximumRedditSubreddits,
    maximumRedditThreads,
    maximumRedditThreadDrill,
    communitySignalRuleVersion: CLUVVI_COMMUNITY_SIGNAL_RULE_VERSION,
    hiringSignalRuleVersion: CLUVVI_HIRING_SIGNAL_RULE_VERSION,
    hiringTaxonomyVersion: CLUVVI_HIRING_TAXONOMY_VERSION,
    hiringTechnologyLexiconVersion: CLUVVI_HIRING_TECHNOLOGY_LEXICON_VERSION,
    extractorVersion: CLUVVI_EXTRACTOR_VERSION,
    frontierPolicyVersion: CLUVVI_FRONTIER_POLICY_VERSION,
    structuredParserPolicyVersion: CLUVVI_STRUCTURED_PARSER_POLICY_VERSION,
    anydocParserVersion: CLUVVI_ANYDOC_PARSER_VERSION,
    htmlMarkdownRendererVersion: CLUVVI_HTML_MARKDOWN_RENDERER_VERSION,
    extractionQualityEvaluatorVersion: CLUVVI_EXTRACTION_QUALITY_EVALUATOR_VERSION,
    local: {
      projectPath,
      command,
      timeoutMs,
      providerMode,
      providerPolicy,
      extractionMode,
      maximumExtractions,
      structuredContentMode,
      maximumStructuredResources,
      maximumDocumentResources,
      sourceAdapterMode,
      sourceFamilies,
      maximumHiringTargets,
      maximumHiringBoardsPerTarget,
      maximumHiringJobsPerBoard,
      maximumHiringJobsTotal,
      redditDepth,
      maximumRedditQueries,
      maximumRedditSubreddits,
      maximumRedditThreads,
      maximumRedditThreadDrill,
      communitySignalRuleVersion: CLUVVI_COMMUNITY_SIGNAL_RULE_VERSION,
      hiringSignalRuleVersion: CLUVVI_HIRING_SIGNAL_RULE_VERSION,
      hiringTaxonomyVersion: CLUVVI_HIRING_TAXONOMY_VERSION,
      hiringTechnologyLexiconVersion: CLUVVI_HIRING_TECHNOLOGY_LEXICON_VERSION,
      extractorVersion: CLUVVI_EXTRACTOR_VERSION,
      frontierPolicyVersion: CLUVVI_FRONTIER_POLICY_VERSION,
      structuredParserPolicyVersion: CLUVVI_STRUCTURED_PARSER_POLICY_VERSION,
      anydocParserVersion: CLUVVI_ANYDOC_PARSER_VERSION,
      htmlMarkdownRendererVersion: CLUVVI_HTML_MARKDOWN_RENDERER_VERSION,
      extractionQualityEvaluatorVersion: CLUVVI_EXTRACTION_QUALITY_EVALUATOR_VERSION,
      providerEnvironment: allowedDiscoveryProviderEnvironment(environment),
      keepExchangeFiles: parseBoolean(
        configuredValue(environment, "CLUVVI_DISCOVERY_KEEP_EXCHANGE_FILES"),
        "CLUVVI_DISCOVERY_KEEP_EXCHANGE_FILES",
        false,
      ),
    },
  };
}
