import { randomUUID } from "node:crypto";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  DiscoveryRuntimeConfigurationError,
  allowedDiscoveryProviderEnvironment,
  parseDiscoveryRuntimeConfig,
  publicDiscoveryProviderEnvironment,
} from "../src/discovery-runtime-config";

const cleanupDirectories: string[] = [];
afterEach(async () => {
  await Promise.all(
    cleanupDirectories.splice(0).map((path) => rm(path, { recursive: true, force: true })),
  );
});

async function fakeProject(): Promise<string> {
  const path = resolve(process.cwd(), ".cluvvi-test", randomUUID());
  cleanupDirectories.push(path);
  await mkdir(path, { recursive: true });
  await writeFile(resolve(path, "package.json"), "{}\n", "utf8");
  return path;
}

function expectCode(operation: () => unknown, code: string): void {
  try {
    operation();
    throw new Error("Expected configuration parsing to fail.");
  } catch (error) {
    expect(error).toBeInstanceOf(DiscoveryRuntimeConfigurationError);
    expect((error as DiscoveryRuntimeConfigurationError).code).toBe(code);
  }
}

describe("discovery runtime configuration", () => {
  it("defaults fixture runtime, fixture providers, and free-only policy", () => {
    expect(parseDiscoveryRuntimeConfig({})).toEqual({
      mode: "fixture",
      providerMode: "fixture_only",
      providerPolicy: "free_only",
      extractionMode: "none",
      maximumExtractions: 8,
      structuredContentMode: "none",
      maximumStructuredResources: 8,
      maximumDocumentResources: 4,
      sourceAdapterMode: "none",
      sourceFamilies: [],
      maximumHiringTargets: 10,
      maximumHiringBoardsPerTarget: 4,
      maximumHiringJobsPerBoard: 250,
      maximumHiringJobsTotal: 2_000,
      redditDepth: "default",
      maximumRedditQueries: 8,
      maximumRedditSubreddits: 20,
      maximumRedditThreads: 100,
      maximumRedditThreadDrill: 5,
      githubDepth: "default",
      maximumGitHubQueries: 4,
      maximumGitHubRepositories: 8,
      maximumGitHubThreadDrill: 5,
      communitySignalRuleVersion: "community_signals@1.0.0",
      developerSignalRuleVersion: "c1-j3.developer-signals.v1",
      youtubeDepth: "default",
      videoSignalRuleVersion: "c1-j4.video-signals.v1",
      specializedSignalRuleVersion: "c1-j5.specialized-signals.v1",
      hiringSignalRuleVersion: "hiring_signals@1.0.0",
      hiringTaxonomyVersion: "hiring_taxonomy@1.0.0",
      hiringTechnologyLexiconVersion: "hiring_technology_lexicon@1.0.0",
      extractorVersion: "basic_public_html_extractor@1.0.0",
      frontierPolicyVersion: "frontier_policy@1.0.0",
      structuredParserPolicyVersion: "structured_parser_policy@1.0.0",
      anydocParserVersion: "@firecrawl/anydoc@0.1.6",
      htmlMarkdownRendererVersion: "sanitized_html_to_gfm@1.0.0",
      extractionQualityEvaluatorVersion: "extraction_quality@1.0.0",
    });
  });

  it("validates local fixture configuration", async () => {
    const projectPath = await fakeProject();
    expect(
      parseDiscoveryRuntimeConfig({
        CLUVVI_DISCOVERY_MODE: "local_discovery_engine",
        CLUVVI_DISCOVERY_ENGINE_PATH: projectPath,
        CLUVVI_DISCOVERY_ENGINE_COMMAND: "pnpm",
      }),
    ).toMatchObject({
      mode: "local_discovery_engine",
      providerMode: "fixture_only",
      providerPolicy: "free_only",
      local: { projectPath, providerMode: "fixture_only", providerPolicy: "free_only" },
    });
  });

  it.each(["free_only", "balanced", "paid_deep"] as const)(
    "parses live policy %s and forwards only known non-secret settings",
    async (policy) => {
      const projectPath = await fakeProject();
      const environment = {
        CLUVVI_DISCOVERY_MODE: "local_discovery_engine",
        CLUVVI_DISCOVERY_PROVIDER_MODE: "live_search",
        CLUVVI_DISCOVERY_PROVIDER_POLICY: policy,
        CLUVVI_DISCOVERY_ENGINE_PATH: projectPath,
        CLUVVI_DISCOVERY_ENGINE_COMMAND: "pnpm",
        DISCOVERY_TAVILY_API_KEY: "must-not-pass",
        DISCOVERY_BRAVE_API_KEY: "must-not-pass",
        DISCOVERY_BROAD_PROVIDER_STRATEGY: "fanout",
        DISCOVERY_SEARXNG_URL: "https://search.example.test",
        DISCOVERY_FREE_SEARCH_MIN_RESULTS: "5",
        UNRELATED_SECRET: "must-not-pass",
      };
      const parsed = parseDiscoveryRuntimeConfig(environment);
      if (parsed.mode !== "local_discovery_engine") throw new Error("Expected local mode.");
      expect(parsed.providerMode).toBe("live_search");
      expect(parsed.providerPolicy).toBe(policy);
      expect(parsed.local.providerEnvironment).toEqual({
        DISCOVERY_BROAD_PROVIDER_STRATEGY: "fanout",
        DISCOVERY_SEARXNG_URL: "https://search.example.test",
        DISCOVERY_FREE_SEARCH_MIN_RESULTS: "5",
      });
      expect(allowedDiscoveryProviderEnvironment(environment)).not.toHaveProperty(
        "DISCOVERY_TAVILY_API_KEY",
      );
      expect(publicDiscoveryProviderEnvironment(parsed.local.providerEnvironment)).toEqual(
        parsed.local.providerEnvironment,
      );
    },
  );

  it("rejects live policy outside local live mode", async () => {
    expectCode(
      () => parseDiscoveryRuntimeConfig({ CLUVVI_DISCOVERY_PROVIDER_MODE: "live_search" }),
      "DISCOVERY_ENGINE_NOT_CONFIGURED",
    );
    const projectPath = await fakeProject();
    expectCode(
      () =>
        parseDiscoveryRuntimeConfig({
          CLUVVI_DISCOVERY_MODE: "local_discovery_engine",
          CLUVVI_DISCOVERY_PROVIDER_POLICY: "balanced",
          CLUVVI_DISCOVERY_ENGINE_PATH: projectPath,
          CLUVVI_DISCOVERY_ENGINE_COMMAND: "pnpm",
        }),
      "LOCAL_DISCOVERY_PROVIDER_POLICY_INVALID",
    );
  });

  it("rejects invalid provider mode and policy", async () => {
    const projectPath = await fakeProject();
    expectCode(
      () =>
        parseDiscoveryRuntimeConfig({
          CLUVVI_DISCOVERY_MODE: "local_discovery_engine",
          CLUVVI_DISCOVERY_PROVIDER_MODE: "automatic",
          CLUVVI_DISCOVERY_ENGINE_PATH: projectPath,
          CLUVVI_DISCOVERY_ENGINE_COMMAND: "pnpm",
        }),
      "LOCAL_DISCOVERY_PROVIDER_MODE_INVALID",
    );
    expectCode(
      () =>
        parseDiscoveryRuntimeConfig({
          CLUVVI_DISCOVERY_MODE: "local_discovery_engine",
          CLUVVI_DISCOVERY_PROVIDER_MODE: "live_search",
          CLUVVI_DISCOVERY_PROVIDER_POLICY: "automatic",
          CLUVVI_DISCOVERY_ENGINE_PATH: projectPath,
          CLUVVI_DISCOVERY_ENGINE_COMMAND: "pnpm",
        }),
      "LOCAL_DISCOVERY_PROVIDER_POLICY_INVALID",
    );
  });

  it("parses opt-in selected public-page extraction and forwards only safe extraction settings", async () => {
    const projectPath = await fakeProject();
    const config = parseDiscoveryRuntimeConfig({
      CLUVVI_DISCOVERY_MODE: "local_discovery_engine",
      CLUVVI_DISCOVERY_ENGINE_PATH: projectPath,
      CLUVVI_DISCOVERY_ENGINE_COMMAND: "pnpm",
      CLUVVI_DISCOVERY_EXTRACTION_MODE: "selected_public_pages",
      CLUVVI_DISCOVERY_MAX_EXTRACTIONS: "5",
      DISCOVERY_EXTRACTION_TIMEOUT_MS: "9000",
      DISCOVERY_EXTRACTION_MAX_HTML_BYTES: "750000",
      DISCOVERY_EXTRACTION_MAX_CONCURRENCY: "2",
      DISCOVERY_EXTRACTION_MAX_DOMAIN_CONCURRENCY: "1",
      DISCOVERY_EXTRACTION_MAX_REDIRECTS: "4",
      DISCOVERY_EXTRACTION_MAX_TEXT_CHARACTERS: "40000",
      DISCOVERY_EXTRACTION_MIN_USEFUL_CHARACTERS: "150",
      DISCOVERY_EXTRACTION_ROBOTS_FAILURE_POLICY: "allow_with_warning",
      DISCOVERY_EXTRACTION_USER_AGENT: "CluvviTest/1.0",
      TAVILY_API_KEY: "must-not-forward",
    });
    expect(config).toMatchObject({
      mode: "local_discovery_engine",
      extractionMode: "selected_public_pages",
      maximumExtractions: 5,
      local: {
        extractionMode: "selected_public_pages",
        maximumExtractions: 5,
        providerEnvironment: {
          DISCOVERY_EXTRACTION_TIMEOUT_MS: "9000",
          DISCOVERY_EXTRACTION_MAX_HTML_BYTES: "750000",
          DISCOVERY_EXTRACTION_MAX_CONCURRENCY: "2",
          DISCOVERY_EXTRACTION_MAX_DOMAIN_CONCURRENCY: "1",
          DISCOVERY_EXTRACTION_MAX_REDIRECTS: "4",
          DISCOVERY_EXTRACTION_MAX_TEXT_CHARACTERS: "40000",
          DISCOVERY_EXTRACTION_MIN_USEFUL_CHARACTERS: "150",
          DISCOVERY_EXTRACTION_ROBOTS_FAILURE_POLICY: "allow_with_warning",
          DISCOVERY_EXTRACTION_USER_AGENT: "CluvviTest/1.0",
        },
      },
    });
    if (config.mode !== "local_discovery_engine") throw new Error("Expected local config.");
    expect(config.local.providerEnvironment).not.toHaveProperty("TAVILY_API_KEY");
  });

  it("parses opt-in structured resources and forwards only safe parser settings", async () => {
    const projectPath = await fakeProject();
    const config = parseDiscoveryRuntimeConfig({
      CLUVVI_DISCOVERY_MODE: "local_discovery_engine",
      CLUVVI_DISCOVERY_ENGINE_PATH: projectPath,
      CLUVVI_DISCOVERY_ENGINE_COMMAND: "pnpm",
      CLUVVI_DISCOVERY_EXTRACTION_MODE: "selected_public_pages",
      CLUVVI_DISCOVERY_STRUCTURED_CONTENT_MODE: "selected_resources",
      CLUVVI_DISCOVERY_MAX_STRUCTURED_RESOURCES: "6",
      CLUVVI_DISCOVERY_MAX_DOCUMENT_RESOURCES: "3",
      DISCOVERY_STRUCTURED_MAX_RESOURCES: "6",
      DISCOVERY_STRUCTURED_MAX_DOCUMENT_RESOURCES: "3",
      DISCOVERY_DOCUMENT_MAX_BYTES: "10485760",
      DISCOVERY_DOCUMENT_PARSE_TIMEOUT_MS: "20000",
      DISCOVERY_DOCUMENT_WORKER_MAX_ATTEMPTS: "1",
      DISCOVERY_MARKDOWN_MAX_CHARACTERS: "200000",
      DISCOVERY_ANYDOC_ENABLED: "true",
      DISCOVERY_ANYDOC_TEMP_ROOT: "must-not-forward",
      PRIVATE_TOKEN: "must-not-forward",
    });
    expect(config).toMatchObject({
      structuredContentMode: "selected_resources",
      maximumStructuredResources: 6,
      maximumDocumentResources: 3,
      local: {
        structuredContentMode: "selected_resources",
        maximumStructuredResources: 6,
        maximumDocumentResources: 3,
        providerEnvironment: {
          DISCOVERY_STRUCTURED_MAX_RESOURCES: "6",
          DISCOVERY_STRUCTURED_MAX_DOCUMENT_RESOURCES: "3",
          DISCOVERY_DOCUMENT_MAX_BYTES: "10485760",
          DISCOVERY_DOCUMENT_PARSE_TIMEOUT_MS: "20000",
          DISCOVERY_DOCUMENT_WORKER_MAX_ATTEMPTS: "1",
          DISCOVERY_MARKDOWN_MAX_CHARACTERS: "200000",
          DISCOVERY_ANYDOC_ENABLED: "true",
        },
      },
    });
    if (config.mode !== "local_discovery_engine") throw new Error("Expected local config.");
    expect(config.local.providerEnvironment).not.toHaveProperty("DISCOVERY_ANYDOC_TEMP_ROOT");
    expect(config.local.providerEnvironment).not.toHaveProperty("PRIVATE_TOKEN");
  });

  it("rejects structured mode without extraction and invalid structured budgets", async () => {
    const projectPath = await fakeProject();
    expectCode(
      () =>
        parseDiscoveryRuntimeConfig({
          CLUVVI_DISCOVERY_MODE: "local_discovery_engine",
          CLUVVI_DISCOVERY_ENGINE_PATH: projectPath,
          CLUVVI_DISCOVERY_ENGINE_COMMAND: "pnpm",
          CLUVVI_DISCOVERY_STRUCTURED_CONTENT_MODE: "selected_resources",
        }),
      "LOCAL_DISCOVERY_STRUCTURED_CONTENT_REQUIRES_EXTRACTION",
    );
    expectCode(
      () =>
        parseDiscoveryRuntimeConfig({
          CLUVVI_DISCOVERY_MODE: "local_discovery_engine",
          CLUVVI_DISCOVERY_ENGINE_PATH: projectPath,
          CLUVVI_DISCOVERY_ENGINE_COMMAND: "pnpm",
          CLUVVI_DISCOVERY_EXTRACTION_MODE: "selected_public_pages",
          CLUVVI_DISCOVERY_STRUCTURED_CONTENT_MODE: "recursive",
        }),
      "LOCAL_DISCOVERY_STRUCTURED_CONTENT_MODE_INVALID",
    );
    expectCode(
      () =>
        parseDiscoveryRuntimeConfig({
          CLUVVI_DISCOVERY_MODE: "local_discovery_engine",
          CLUVVI_DISCOVERY_ENGINE_PATH: projectPath,
          CLUVVI_DISCOVERY_ENGINE_COMMAND: "pnpm",
          CLUVVI_DISCOVERY_EXTRACTION_MODE: "selected_public_pages",
          CLUVVI_DISCOVERY_STRUCTURED_CONTENT_MODE: "selected_resources",
          CLUVVI_DISCOVERY_MAX_STRUCTURED_RESOURCES: "2",
          CLUVVI_DISCOVERY_MAX_DOCUMENT_RESOURCES: "3",
        }),
      "LOCAL_DISCOVERY_STRUCTURED_BUDGET_INVALID",
    );
  });

  it("parses opt-in public hiring intelligence and forwards only safe non-secret settings", async () => {
    const projectPath = await fakeProject();
    const config = parseDiscoveryRuntimeConfig({
      CLUVVI_DISCOVERY_MODE: "local_discovery_engine",
      CLUVVI_DISCOVERY_ENGINE_PATH: projectPath,
      CLUVVI_DISCOVERY_ENGINE_COMMAND: "pnpm",
      CLUVVI_DISCOVERY_SOURCE_ADAPTER_MODE: "selected_sources",
      CLUVVI_DISCOVERY_SOURCE_FAMILIES: "hiring",
      CLUVVI_DISCOVERY_MAX_HIRING_TARGETS: "6",
      CLUVVI_DISCOVERY_MAX_HIRING_BOARDS_PER_TARGET: "3",
      CLUVVI_DISCOVERY_MAX_HIRING_JOBS_PER_BOARD: "120",
      CLUVVI_DISCOVERY_MAX_HIRING_JOBS_TOTAL: "600",
      DISCOVERY_HIRING_MAX_TARGETS: "6",
      DISCOVERY_HIRING_MAX_BOARDS_PER_TARGET: "3",
      DISCOVERY_HIRING_MAX_JOBS_PER_BOARD: "120",
      DISCOVERY_HIRING_MAX_TOTAL_JOBS: "600",
      DISCOVERY_HIRING_PROVIDER_TIMEOUT_MS: "12000",
      DISCOVERY_HIRING_INCLUDE_PUBLIC_COMPENSATION: "true",
      DISCOVERY_SMARTRECRUITERS_API_KEY: "must-not-forward",
      PRIVATE_TOKEN: "must-not-forward",
    });
    expect(config).toMatchObject({
      sourceAdapterMode: "selected_sources",
      sourceFamilies: ["hiring"],
      maximumHiringTargets: 6,
      maximumHiringBoardsPerTarget: 3,
      maximumHiringJobsPerBoard: 120,
      maximumHiringJobsTotal: 600,
      local: {
        sourceAdapterMode: "selected_sources",
        sourceFamilies: ["hiring"],
        maximumHiringTargets: 6,
        maximumHiringBoardsPerTarget: 3,
        maximumHiringJobsPerBoard: 120,
        maximumHiringJobsTotal: 600,
        providerEnvironment: {
          DISCOVERY_HIRING_MAX_TARGETS: "6",
          DISCOVERY_HIRING_MAX_BOARDS_PER_TARGET: "3",
          DISCOVERY_HIRING_MAX_JOBS_PER_BOARD: "120",
          DISCOVERY_HIRING_MAX_TOTAL_JOBS: "600",
          DISCOVERY_HIRING_PROVIDER_TIMEOUT_MS: "12000",
          DISCOVERY_HIRING_INCLUDE_PUBLIC_COMPENSATION: "true",
        },
      },
    });
    if (config.mode !== "local_discovery_engine") throw new Error("Expected local config.");
    expect(config.local.providerEnvironment).not.toHaveProperty(
      "DISCOVERY_SMARTRECRUITERS_API_KEY",
    );
    expect(config.local.providerEnvironment).not.toHaveProperty("PRIVATE_TOKEN");
    expect(
      allowedDiscoveryProviderEnvironment({
        DISCOVERY_SMARTRECRUITERS_API_KEY: "must-not-forward",
      }),
    ).toEqual({});
  });

  it("parses bounded Reddit community intelligence and rejects invalid Reddit budgets", async () => {
    const projectPath = await fakeProject();
    const base = {
      CLUVVI_DISCOVERY_MODE: "local_discovery_engine",
      CLUVVI_DISCOVERY_ENGINE_PATH: projectPath,
      CLUVVI_DISCOVERY_ENGINE_COMMAND: "pnpm",
      CLUVVI_DISCOVERY_SOURCE_ADAPTER_MODE: "selected_sources",
      CLUVVI_DISCOVERY_SOURCE_FAMILIES: "community",
    };
    const config = parseDiscoveryRuntimeConfig({
      ...base,
      CLUVVI_DISCOVERY_REDDIT_DEPTH: "deep",
      CLUVVI_DISCOVERY_MAX_REDDIT_QUERIES: "6",
      CLUVVI_DISCOVERY_MAX_REDDIT_SUBREDDITS: "12",
      CLUVVI_DISCOVERY_MAX_REDDIT_THREADS: "80",
      CLUVVI_DISCOVERY_MAX_REDDIT_THREAD_DRILL: "8",
      DISCOVERY_REDDIT_RSS_TIMEOUT_MS: "9000",
      DISCOVERY_REDDIT_ARCTIC_ENABLED: "true",
      PRIVATE_TOKEN: "must-not-forward",
    });
    expect(config).toMatchObject({
      sourceAdapterMode: "selected_sources",
      sourceFamilies: ["community"],
      redditDepth: "deep",
      maximumRedditQueries: 6,
      maximumRedditSubreddits: 12,
      maximumRedditThreads: 80,
      maximumRedditThreadDrill: 8,
      communitySignalRuleVersion: "community_signals@1.0.0",
      local: {
        sourceAdapterMode: "selected_sources",
        sourceFamilies: ["community"],
        redditDepth: "deep",
        maximumRedditQueries: 6,
        maximumRedditSubreddits: 12,
        maximumRedditThreads: 80,
        maximumRedditThreadDrill: 8,
        providerEnvironment: {
          DISCOVERY_REDDIT_RSS_TIMEOUT_MS: "9000",
          DISCOVERY_REDDIT_ARCTIC_ENABLED: "true",
        },
      },
    });
    if (config.mode !== "local_discovery_engine") throw new Error("Expected local config.");
    expect(config.local.providerEnvironment).not.toHaveProperty("PRIVATE_TOKEN");
    expectCode(
      () => parseDiscoveryRuntimeConfig({ ...base, CLUVVI_DISCOVERY_REDDIT_DEPTH: "extreme" }),
      "LOCAL_DISCOVERY_REDDIT_DEPTH_INVALID",
    );
    expectCode(
      () => parseDiscoveryRuntimeConfig({ ...base, CLUVVI_DISCOVERY_MAX_REDDIT_QUERIES: "9" }),
      "LOCAL_DISCOVERY_MAX_REDDIT_QUERIES_INVALID",
    );
    expectCode(
      () =>
        parseDiscoveryRuntimeConfig({
          ...base,
          CLUVVI_DISCOVERY_MAX_REDDIT_THREADS: "3",
          CLUVVI_DISCOVERY_MAX_REDDIT_THREAD_DRILL: "5",
        }),
      "LOCAL_DISCOVERY_REDDIT_BUDGET_INVALID",
    );
  });

  it("parses bounded public GitHub developer intelligence, supports all source families, and never forwards the GitHub token", async () => {
    const projectPath = await fakeProject();
    const base = {
      CLUVVI_DISCOVERY_MODE: "local_discovery_engine",
      CLUVVI_DISCOVERY_ENGINE_PATH: projectPath,
      CLUVVI_DISCOVERY_ENGINE_COMMAND: "pnpm",
      CLUVVI_DISCOVERY_SOURCE_ADAPTER_MODE: "selected_sources",
      CLUVVI_DISCOVERY_SOURCE_FAMILIES: "hiring,community,developer",
    };
    const config = parseDiscoveryRuntimeConfig({
      ...base,
      CLUVVI_DISCOVERY_GITHUB_DEPTH: "deep",
      CLUVVI_DISCOVERY_MAX_GITHUB_QUERIES: "6",
      CLUVVI_DISCOVERY_MAX_GITHUB_REPOSITORIES: "12",
      CLUVVI_DISCOVERY_MAX_GITHUB_THREAD_DRILL: "8",
      DISCOVERY_GITHUB_ENABLED: "true",
      DISCOVERY_GITHUB_REQUEST_TIMEOUT_MS: "12000",
      DISCOVERY_GITHUB_MAX_RESPONSE_BYTES: "2097152",
      DISCOVERY_GITHUB_TOKEN: "must-not-forward",
      DISCOVERY_GITHUB_ALLOW_GH_CLI_TOKEN: "true",
      PRIVATE_TOKEN: "must-not-forward",
    });
    expect(config).toMatchObject({
      sourceAdapterMode: "selected_sources",
      sourceFamilies: ["hiring", "community", "developer"],
      githubDepth: "deep",
      maximumGitHubQueries: 6,
      maximumGitHubRepositories: 12,
      maximumGitHubThreadDrill: 8,
      developerSignalRuleVersion: "c1-j3.developer-signals.v1",
      local: {
        sourceFamilies: ["hiring", "community", "developer"],
        githubDepth: "deep",
        maximumGitHubQueries: 6,
        maximumGitHubRepositories: 12,
        maximumGitHubThreadDrill: 8,
        providerEnvironment: {
          DISCOVERY_GITHUB_ENABLED: "true",
          DISCOVERY_GITHUB_REQUEST_TIMEOUT_MS: "12000",
          DISCOVERY_GITHUB_MAX_RESPONSE_BYTES: "2097152",
        },
      },
    });
    if (config.mode !== "local_discovery_engine") throw new Error("Expected local config.");
    expect(config.local.providerEnvironment).not.toHaveProperty("DISCOVERY_GITHUB_TOKEN");
    expect(config.local.providerEnvironment).not.toHaveProperty(
      "DISCOVERY_GITHUB_ALLOW_GH_CLI_TOKEN",
    );
    expect(config.local.providerEnvironment).not.toHaveProperty("PRIVATE_TOKEN");
    expect(
      allowedDiscoveryProviderEnvironment({
        DISCOVERY_GITHUB_TOKEN: "must-not-forward",
        DISCOVERY_GITHUB_ALLOW_GH_CLI_TOKEN: "true",
        DISCOVERY_GITHUB_REQUEST_TIMEOUT_MS: "9000",
      }),
    ).toEqual({ DISCOVERY_GITHUB_REQUEST_TIMEOUT_MS: "9000" });
    expectCode(
      () => parseDiscoveryRuntimeConfig({ ...base, CLUVVI_DISCOVERY_GITHUB_DEPTH: "extreme" }),
      "LOCAL_DISCOVERY_GITHUB_DEPTH_INVALID",
    );
    expectCode(
      () => parseDiscoveryRuntimeConfig({ ...base, CLUVVI_DISCOVERY_MAX_GITHUB_QUERIES: "9" }),
      "LOCAL_DISCOVERY_MAX_GITHUB_QUERIES_INVALID",
    );
    expectCode(
      () =>
        parseDiscoveryRuntimeConfig({
          ...base,
          CLUVVI_DISCOVERY_MAX_GITHUB_REPOSITORIES: "16",
        }),
      "LOCAL_DISCOVERY_MAX_GITHUB_REPOSITORIES_INVALID",
    );
    expectCode(
      () => parseDiscoveryRuntimeConfig({ ...base, CLUVVI_DISCOVERY_MAX_GITHUB_THREAD_DRILL: "9" }),
      "LOCAL_DISCOVERY_MAX_GITHUB_THREAD_DRILL_INVALID",
    );
  });

  it("rejects invalid source-adapter mode, family, and hiring budgets", async () => {
    expectCode(
      () =>
        parseDiscoveryRuntimeConfig({
          CLUVVI_DISCOVERY_SOURCE_ADAPTER_MODE: "selected_sources",
          CLUVVI_DISCOVERY_SOURCE_FAMILIES: "hiring",
        }),
      "DISCOVERY_ENGINE_NOT_CONFIGURED",
    );
    const projectPath = await fakeProject();
    const base = {
      CLUVVI_DISCOVERY_MODE: "local_discovery_engine",
      CLUVVI_DISCOVERY_ENGINE_PATH: projectPath,
      CLUVVI_DISCOVERY_ENGINE_COMMAND: "pnpm",
    };
    expectCode(
      () => parseDiscoveryRuntimeConfig({ ...base, CLUVVI_DISCOVERY_SOURCE_ADAPTER_MODE: "all" }),
      "LOCAL_DISCOVERY_SOURCE_ADAPTER_MODE_INVALID",
    );
    expectCode(
      () =>
        parseDiscoveryRuntimeConfig({
          ...base,
          CLUVVI_DISCOVERY_SOURCE_ADAPTER_MODE: "selected_sources",
          CLUVVI_DISCOVERY_SOURCE_FAMILIES: "github",
        }),
      "LOCAL_DISCOVERY_SOURCE_FAMILY_INVALID",
    );
    expectCode(
      () =>
        parseDiscoveryRuntimeConfig({
          ...base,
          CLUVVI_DISCOVERY_SOURCE_ADAPTER_MODE: "selected_sources",
          CLUVVI_DISCOVERY_SOURCE_FAMILIES: "hiring",
          CLUVVI_DISCOVERY_MAX_HIRING_TARGETS: "101",
        }),
      "LOCAL_DISCOVERY_MAX_HIRING_TARGETS_INVALID",
    );
    expectCode(
      () =>
        parseDiscoveryRuntimeConfig({
          ...base,
          CLUVVI_DISCOVERY_SOURCE_ADAPTER_MODE: "selected_sources",
          CLUVVI_DISCOVERY_SOURCE_FAMILIES: "hiring",
          CLUVVI_DISCOVERY_MAX_HIRING_JOBS_PER_BOARD: "500",
          CLUVVI_DISCOVERY_MAX_HIRING_JOBS_TOTAL: "100",
        }),
      "LOCAL_DISCOVERY_HIRING_BUDGET_INVALID",
    );
  });

  it("rejects extraction in the internal fixture runtime and invalid extraction limits", async () => {
    expectCode(
      () =>
        parseDiscoveryRuntimeConfig({
          CLUVVI_DISCOVERY_EXTRACTION_MODE: "selected_public_pages",
        }),
      "DISCOVERY_ENGINE_NOT_CONFIGURED",
    );
    const projectPath = await fakeProject();
    expectCode(
      () =>
        parseDiscoveryRuntimeConfig({
          CLUVVI_DISCOVERY_MODE: "local_discovery_engine",
          CLUVVI_DISCOVERY_ENGINE_PATH: projectPath,
          CLUVVI_DISCOVERY_ENGINE_COMMAND: "pnpm",
          CLUVVI_DISCOVERY_EXTRACTION_MODE: "recursive",
        }),
      "LOCAL_DISCOVERY_EXTRACTION_MODE_INVALID",
    );
    expectCode(
      () =>
        parseDiscoveryRuntimeConfig({
          CLUVVI_DISCOVERY_MODE: "local_discovery_engine",
          CLUVVI_DISCOVERY_ENGINE_PATH: projectPath,
          CLUVVI_DISCOVERY_ENGINE_COMMAND: "pnpm",
          CLUVVI_DISCOVERY_MAX_EXTRACTIONS: "101",
        }),
      "LOCAL_DISCOVERY_MAX_EXTRACTIONS_INVALID",
    );
  });

  it("rejects missing paths, package metadata, commands, and invalid timeouts", async () => {
    expectCode(
      () => parseDiscoveryRuntimeConfig({ CLUVVI_DISCOVERY_MODE: "local_discovery_engine" }),
      "LOCAL_DISCOVERY_PATH_MISSING",
    );
    const noPackage = resolve(process.cwd(), ".cluvvi-test", randomUUID());
    cleanupDirectories.push(noPackage);
    await mkdir(noPackage, { recursive: true });
    expectCode(
      () =>
        parseDiscoveryRuntimeConfig({
          CLUVVI_DISCOVERY_MODE: "local_discovery_engine",
          CLUVVI_DISCOVERY_ENGINE_PATH: noPackage,
          CLUVVI_DISCOVERY_ENGINE_COMMAND: "pnpm",
        }),
      "LOCAL_DISCOVERY_PACKAGE_MISSING",
    );
    const projectPath = await fakeProject();
    expectCode(
      () =>
        parseDiscoveryRuntimeConfig({
          CLUVVI_DISCOVERY_MODE: "local_discovery_engine",
          CLUVVI_DISCOVERY_ENGINE_PATH: projectPath,
        }),
      "LOCAL_DISCOVERY_COMMAND_MISSING",
    );
    expectCode(
      () =>
        parseDiscoveryRuntimeConfig({
          CLUVVI_DISCOVERY_MODE: "local_discovery_engine",
          CLUVVI_DISCOVERY_ENGINE_PATH: projectPath,
          CLUVVI_DISCOVERY_ENGINE_COMMAND: "pnpm",
          CLUVVI_DISCOVERY_ENGINE_TIMEOUT_MS: "999",
        }),
      "LOCAL_DISCOVERY_TIMEOUT_INVALID",
    );
  });
});
