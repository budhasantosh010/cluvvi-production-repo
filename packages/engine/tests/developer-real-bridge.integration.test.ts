import {
  EvidenceFindingsArtifactV1Schema,
  SearchResultsArtifactV2Schema,
  createOpaqueId,
  validateDeveloperArtifactSet,
} from "@cluvvi/core";
import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { promisify } from "node:util";
import { afterAll, describe, expect, it } from "vitest";
import {
  buildBuyerHypotheses,
  buildBuyerMap,
  buildDiscoveryCandidates,
  buildEvidenceFindings,
  buildIdentityEnrichment,
  buildRankedOpportunities,
} from "../src";

const execFileAsync = promisify(execFile);
const EXPECTED_PROJECT_A_SHA = "b9002bff2f56ac20c8db696b3137bda336437b8b";
const defaultProjectAPath = resolve(process.cwd(), "..", "Separate Discovery engine");
const projectAPath = process.env["CLUVVI_DISCOVERY_ENGINE_PATH"]?.trim() || defaultProjectAPath;
const runReal = process.env["RUN_DEVELOPER_DISCOVERY_INTEGRATION"] === "1";
const integration = runReal ? describe.sequential : describe.skip;
const cleanupDirectories: string[] = [];

const projectAHelper = String.raw`
import { readFile, writeFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { resolve } from "node:path";
const outputDirectory = process.argv[2];
if (!outputDirectory) throw new Error("output directory is required");
const project = await import(pathToFileURL(resolve(process.cwd(), "dist/index.js")).href);
const template = JSON.parse(await readFile(resolve(process.cwd(), "fixtures/video-editing.search-results.v2.json"), "utf8"));
const now = new Date().toISOString();
const requestId = "req_c1j3_real_project_a_github";
const seededResult = {
  ...template.results[0],
  id: "result_real_typescript_github",
  queryId: "query_real_typescript_github",
  query: "TypeScript developer workflow",
  providerId: "fixture_search_provider",
  providerCategory: "fixture",
  discoveryGoal: "customer_opportunities",
  searchMethod: "keyword_search",
  sourceZone: "custom:developer",
  signalIntent: "general_relevance",
  title: "TypeScript",
  snippet: "Operator-reviewed TypeScript seed used only to link real public GitHub evidence downstream.",
  url: "https://github.com/microsoft/TypeScript",
  normalizedUrl: "https://github.com/microsoft/TypeScript",
  domain: "github.com",
  authorOrCompany: "TypeScript",
  publishedAt: now,
  discoveredAt: now,
  language: "en",
  credibility: "official",
  riskLevel: "low",
  raw: { integrationSearchSeed: true },
};
const searchResults = project.SearchResultsArtifactV2Schema.parse({
  ...template,
  requestId,
  domainPackIds: ["generic-business"],
  summary: { queriesPlanned: 1, queriesExecuted: 1, providersUsed: ["fixture_search_provider"], rawResults: 1, dedupedResults: 1, paidCreditsUsed: 0, startedAt: now, completedAt: now },
  providerBreakdown: [{ providerId: "fixture_search_provider", providerCategory: "fixture", sourceZone: "custom:developer", searchMethod: "keyword_search", queriesExecuted: 1, resultsReturned: 1, errors: 0 }],
  results: [seededResult],
  coverage: { searchedSourceZones: ["custom:developer"], skippedSourceZones: [], providersUsed: ["fixture_search_provider"], providersUnavailable: [], manualReviewRecommended: [], confidenceLimitations: ["Search discovery is seeded only so this proof isolates real public GitHub source-adapter I/O."], nextBestSearches: [] },
  warnings: ["The TypeScript search result is an operator-reviewed integration seed; all GitHub retrieval is real public network I/O."],
});
const request = project.DiscoveryRequestV1Schema.parse({
  schemaVersion: "1.0", artifactKind: "discovery_request.v1", requestId, goal: "customer_opportunities",
  description: "Research current TypeScript integration problems, implementation difficulty, migration, dependency, and breaking-change discussion using bounded public GitHub evidence only.",
  answerRequirement: { outputType: "evidence_collection", completenessTarget: "balanced", evidenceRequirement: "multiple_sources", maximumResults: 10 },
  retrievalObjective: { recallPriority: 0.4, precisionPriority: 1, freshnessPriority: 1, authorityPriority: 0.6, diversityPriority: 0.5 },
  subject: { type: "technology", name: "TypeScript", description: "TypeScript developer tooling and workflow" },
  targetEntityTypes: ["technology"], buyerHypotheses: ["TypeScript"], temporal: { intent: "current", maxAgeDays: 30 }, languages: ["en"],
  exclusions: ["private GitHub", "repository cloning", "developer identity inference", "contact enrichment", "outreach"], discoveryMode: "free_only", providerPreference: "free_first",
});
const sourceConfiguration = project.parseSourceAdapterConfiguration({
  DISCOVERY_SOURCE_ADAPTER_MODE: "selected_sources", DISCOVERY_SOURCE_FAMILIES: "developer", DISCOVERY_GITHUB_MODE: "anonymous_only", DISCOVERY_GITHUB_DEPTH: "quick",
  DISCOVERY_GITHUB_MAX_QUERIES: "1", DISCOVERY_GITHUB_MAX_REPOSITORY_TARGETS: "1", DISCOVERY_GITHUB_MAX_DISCOVERY_ITEMS: "10", DISCOVERY_GITHUB_MAX_THREAD_DRILL_QUICK: "1",
  DISCOVERY_GITHUB_MAX_COMMENTS_PER_THREAD: "3", DISCOVERY_GITHUB_MAX_COMMENTS_TOTAL: "3", DISCOVERY_GITHUB_MAX_RELEASES_PER_REPOSITORY: "3", DISCOVERY_GITHUB_MAX_ANON_SEARCH_REQUESTS: "4", DISCOVERY_GITHUB_MAX_ANON_CORE_REQUESTS: "12",
  DISCOVERY_GITHUB_API_CONCURRENCY: "1", DISCOVERY_GITHUB_REQUEST_TIMEOUT_MS: "20000", DISCOVERY_GITHUB_MAX_RATE_LIMIT_WAIT_MS: "5000", DISCOVERY_GITHUB_PUBLIC_ONLY: "true",
});
const developer = await project.runSelectedDeveloperSourceAdapters({ request, searchResults, sourceConfiguration });
await writeFile(resolve(outputDirectory, "developer-bundle.json"), JSON.stringify({ searchResults, ...developer }, null, 2) + "\n", "utf8");
console.log("C1J3_PROJECT_A_GITHUB=" + JSON.stringify({ accessMode: developer.telemetry.accessMode, repositories: developer.repositoryCollection.repositories.length, threads: developer.threads.length, comments: developer.telemetry.totals.commentsAccepted, releases: developer.telemetry.totals.releasesAccepted, signals: developer.signals.signals.length, rateLimitEvents: developer.telemetry.totals.rateLimitEvents, privateRejected: developer.telemetry.totals.privateResourcesRejected, paidRequests: developer.telemetry.totals.paidRequests, paidCredits: developer.telemetry.totals.paidCredits }));
`;

afterAll(async () => {
  await Promise.all(
    cleanupDirectories.splice(0).map((path) => rm(path, { recursive: true, force: true })),
  );
});

integration("C1-J.3 real Project A → Project B public GitHub bridge", () => {
  it("pins Project A, performs bounded anonymous public GitHub retrieval, validates Project B contracts, and preserves zero-paid/read-only boundaries", async () => {
    const { stdout: shaOutput } = await execFileAsync("git", ["rev-parse", "HEAD"], {
      cwd: projectAPath,
      windowsHide: true,
    });
    expect(shaOutput.trim()).toBe(EXPECTED_PROJECT_A_SHA);
    const directory = await mkdtemp(join(tmpdir(), "cluvvi-c1j3-real-github-"));
    cleanupDirectories.push(directory);
    const helperPath = resolve(directory, "run-project-a-live-github.mjs");
    await writeFile(helperPath, projectAHelper, "utf8");
    const execution = await execFileAsync(process.execPath, [helperPath, directory], {
      cwd: projectAPath,
      env: {
        ...process.env,
        DISCOVERY_GITHUB_TOKEN: "",
        DISCOVERY_GITHUB_ALLOW_GH_CLI_TOKEN: "false",
      },
      windowsHide: true,
      timeout: 90_000,
      maxBuffer: 2_000_000,
    });
    expect(execution.stderr.trim()).toBe("");
    expect(execution.stdout).toContain("C1J3_PROJECT_A_GITHUB=");
    console.info(execution.stdout.trim());
    const bundle = JSON.parse(
      await readFile(resolve(directory, "developer-bundle.json"), "utf8"),
    ) as Record<string, unknown>;
    const searchResults = SearchResultsArtifactV2Schema.parse(bundle["searchResults"]);
    const validated = validateDeveloperArtifactSet({
      plan: bundle["plan"],
      repositoryCollection: bundle["repositoryCollection"],
      threadManifest: bundle["threadManifest"],
      threadMetadata: bundle["threadMetadata"],
      threads: Array.isArray(bundle["threads"]) ? bundle["threads"] : [],
      commentManifest: bundle["commentManifest"],
      commentMetadata: bundle["commentMetadata"],
      commentCollections: Array.isArray(bundle["commentCollections"])
        ? bundle["commentCollections"]
        : [],
      signals: bundle["signals"],
      telemetry: bundle["telemetry"],
      expectedRequestId: searchResults.requestId,
    });
    expect(validated.telemetry.accessMode).toBe("anonymous");
    expect(validated.telemetry.totals.paidRequests).toBe(0);
    expect(validated.telemetry.totals.paidCredits).toBe(0);
    expect(JSON.stringify(validated.repositoryCollection.repositories)).not.toContain(
      '"visibility":"private"',
    );
    const generatedAt = new Date().toISOString();
    const candidates = buildDiscoveryCandidates(searchResults, generatedAt);
    const evidence = EvidenceFindingsArtifactV1Schema.parse(
      buildEvidenceFindings(
        candidates,
        generatedAt,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        validated,
      ),
    );
    expect(evidence.evidenceSourceMode).toBe("snippet_plus_public_developer_intelligence");
    const identity = buildIdentityEnrichment(
      buildBuyerHypotheses(evidence, generatedAt),
      generatedAt,
    );
    expect(identity.fabricatedContacts).toBe(false);
    const observedHandles = [
      ...validated.threads.map((thread) => thread.author?.handle),
      ...validated.commentCollections.flatMap((collection) =>
        collection.comments.map((comment) => comment.author?.handle),
      ),
    ].filter((value) => typeof value === "string" && value.length > 0);
    const identityJson = JSON.stringify(identity);
    for (const handle of observedHandles) expect(identityJson).not.toContain(handle);
    const ranked = buildRankedOpportunities({
      identity,
      evidence,
      mission: {
        id: createOpaqueId("mission"),
        input: {
          schemaVersion: "1.0",
          name: "C1-J.3 real public GitHub bridge",
          description:
            "Review bounded public TypeScript GitHub developer evidence without treating it as representative demand, buyer identity, contact identity, budget, authority, or purchase intent.",
          customerOutcome: "Use public developer evidence cautiously.",
          desiredOpportunities: 10,
          exclusions: [
            "private GitHub",
            "developer identity inference",
            "contact enrichment",
            "outreach",
          ],
          goodCustomerExamples: [],
          badCustomerExamples: [],
          geographies: ["global"],
        },
        sourceFile: "integration://project-a-live-github",
        createdAt: generatedAt,
      },
      generatedAt,
    });
    expect(
      ranked.opportunities.every((opportunity) => opportunity.developerContribution.points <= 1),
    ).toBe(true);
    const buyerMap = buildBuyerMap({
      ranked,
      identity,
      evidence,
      searchResults,
      generatedAt,
    });
    expect(buyerMap.warning).toMatch(/GitHub|contact identity|attribution/iu);
    expect(JSON.stringify({ validated, evidence, identity, ranked, buyerMap })).not.toMatch(
      /authorization|bearer\s+|github[_-]?token|commitEmail|emailAddress/iu,
    );
  }, 120_000);
});
