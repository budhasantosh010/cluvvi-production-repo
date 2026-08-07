import {
  BuyerMapArtifactV1Schema,
  EvidenceFindingsArtifactV1Schema,
  SearchResultsArtifactV2Schema,
  createOpaqueId,
  validateCommunityArtifactSet,
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
const EXPECTED_PROJECT_A_SHA = "db13a6cf568b307fa76782306179060b2df23d7c";
const defaultProjectAPath = resolve(process.cwd(), "..", "Separate Discovery engine");
const projectAPath = process.env["CLUVVI_DISCOVERY_ENGINE_PATH"]?.trim() || defaultProjectAPath;
const runReal = process.env["RUN_COMMUNITY_DISCOVERY_INTEGRATION"] === "1";
const integration = runReal ? describe.sequential : describe.skip;
const cleanupDirectories: string[] = [];

const projectAHelper = String.raw`
import { readFile, writeFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { resolve } from "node:path";

const outputDirectory = process.argv[2];
if (!outputDirectory) throw new Error("output directory is required");
const project = await import(pathToFileURL(resolve(process.cwd(), "dist/index.js")).href);
const template = JSON.parse(
  await readFile(resolve(process.cwd(), "fixtures/video-editing.search-results.v2.json"), "utf8"),
);
const now = new Date().toISOString();
const requestId = "req_c1j2_real_project_a_reddit";
const seededResult = {
  ...template.results[0],
  id: "result_real_typescript_official",
  queryId: "query_real_typescript_official",
  query: "TypeScript developer workflow",
  providerId: "fixture_search_provider",
  providerCategory: "fixture",
  discoveryGoal: "customer_opportunities",
  searchMethod: "keyword_search",
  sourceZone: "general_web",
  signalIntent: "general_relevance",
  title: "TypeScript",
  snippet: "Operator-reviewed TypeScript entity seed used only to link real public Reddit evidence downstream.",
  url: "https://www.typescriptlang.org/",
  domain: "typescriptlang.org",
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
  summary: {
    queriesPlanned: 1,
    queriesExecuted: 1,
    providersUsed: ["fixture_search_provider"],
    rawResults: 1,
    dedupedResults: 1,
    paidCreditsUsed: 0,
    startedAt: now,
    completedAt: now,
  },
  providerBreakdown: [
    {
      providerId: "fixture_search_provider",
      providerCategory: "fixture",
      sourceZone: "general_web",
      searchMethod: "keyword_search",
      queriesExecuted: 1,
      resultsReturned: 1,
      errors: 0,
    },
  ],
  results: [seededResult],
  coverage: {
    searchedSourceZones: ["general_web"],
    skippedSourceZones: [],
    providersUsed: ["fixture_search_provider"],
    providersUnavailable: [],
    manualReviewRecommended: [],
    confidenceLimitations: [
      "Search discovery is seeded only so this integration proof isolates real public Reddit source-adapter I/O.",
    ],
    nextBestSearches: [],
  },
  warnings: [
    "The TypeScript entity search result is an operator-reviewed integration seed; all Reddit retrieval is real public network I/O.",
  ],
});
const request = project.DiscoveryRequestV1Schema.parse({
  schemaVersion: "1.0",
  artifactKind: "discovery_request.v1",
  requestId,
  goal: "customer_opportunities",
  description:
    "Research current TypeScript developer workflow pain, implementation difficulty, alternatives, and recommendations in r/typescript using sampled public community evidence only.",
  answerRequirement: {
    outputType: "evidence_collection",
    completenessTarget: "balanced",
    evidenceRequirement: "multiple_sources",
    maximumResults: 10,
  },
  retrievalObjective: {
    recallPriority: 0.5,
    precisionPriority: 1,
    freshnessPriority: 1,
    authorityPriority: 0.5,
    diversityPriority: 0.5,
  },
  subject: {
    type: "technology",
    name: "TypeScript",
    description: "TypeScript developer tooling and workflow",
  },
  targetEntityTypes: ["technology"],
  buyerHypotheses: ["TypeScript"],
  temporal: { intent: "current", maxAgeDays: 30 },
  languages: ["en"],
  exclusions: ["private Reddit", "buyer identity inference", "contact enrichment", "outreach"],
  discoveryMode: "free_only",
  providerPreference: "free_first",
});
const sourceConfiguration = project.parseSourceAdapterConfiguration({
  DISCOVERY_SOURCE_ADAPTER_MODE: "selected_sources",
  DISCOVERY_SOURCE_FAMILIES: "community",
  DISCOVERY_REDDIT_DEPTH: "quick",
  DISCOVERY_REDDIT_MAX_QUERIES: "1",
  DISCOVERY_REDDIT_MAX_DISCOVERED_SUBREDDITS: "1",
  DISCOVERY_REDDIT_MAX_SELECTED_SUBREDDITS: "1",
  DISCOVERY_REDDIT_MAX_THREADS: "10",
  DISCOVERY_REDDIT_MAX_THREADS_DRILLED_QUICK: "1",
  DISCOVERY_REDDIT_MAX_COMMENTS_PER_THREAD: "3",
  DISCOVERY_REDDIT_MAX_TOTAL_COMMENTS: "3",
  DISCOVERY_REDDIT_MAX_CONCURRENCY: "2",
  DISCOVERY_REDDIT_MAX_DOMAIN_CONCURRENCY: "1",
  DISCOVERY_REDDIT_RSS_TIMEOUT_MS: "20000",
  DISCOVERY_REDDIT_LISTING_TIMEOUT_MS: "20000",
  DISCOVERY_REDDIT_COMMENT_TIMEOUT_MS: "15000",
  DISCOVERY_REDDIT_ENRICH_BUDGET_MS: "30000",
});
const community = await project.runSelectedCommunitySourceAdapters({
  request,
  searchResults,
  sourceConfiguration,
});
await writeFile(
  resolve(outputDirectory, "community-bundle.json"),
  JSON.stringify({ searchResults, ...community }, null, 2) + "\n",
  "utf8",
);
console.log(
  "C1J2_PROJECT_A_REDDIT=" +
    JSON.stringify({
      queries: community.plan.summary.queriesSelected,
      subreddits: community.plan.summary.subredditsSelected,
      rssRequests: community.telemetry.totals.redditRssRequests,
      listingRequests: community.telemetry.totals.redditListingRequests,
      commentRequests: community.telemetry.totals.redditCommentRequests,
      arcticRequests: community.telemetry.totals.arcticShiftRequests,
      threads: community.threads.length,
      threadsDrilled: community.telemetry.totals.threadsDrilled,
      comments: community.telemetry.totals.commentsAccepted,
      signals: community.signals.summary.painSignals +
        community.signals.summary.complaintSignals +
        community.signals.summary.workflowFrictionSignals +
        community.signals.summary.switchingSignals +
        community.signals.summary.alternativeSearchSignals +
        community.signals.summary.recommendationSignals +
        community.signals.summary.competitorDissatisfactionSignals +
        community.signals.summary.featureRequestSignals +
        community.signals.summary.implementationDifficultySignals +
        community.signals.summary.pricingConcernSignals +
        community.signals.summary.supportProblemSignals +
        community.signals.summary.manualWorkaroundSignals,
      paidRequests: community.telemetry.totals.paidRequests,
      paidCredits: community.telemetry.totals.paidCredits,
      redditOAuth: 0,
      redditLogin: 0,
      cookies: 0,
    }),
);
`;

afterAll(async () => {
  await Promise.all(
    cleanupDirectories.splice(0).map((path) => rm(path, { recursive: true, force: true })),
  );
});

integration("C1-J.2 real Project A → Project B public Reddit bridge", () => {
  it("pins Project A, performs real keyless Reddit retrieval, validates independent Project B contracts, and carries cautious community provenance into Buyer Map", async () => {
    const { stdout: shaOutput } = await execFileAsync("git", ["rev-parse", "HEAD"], {
      cwd: projectAPath,
      windowsHide: true,
    });
    expect(shaOutput.trim()).toBe(EXPECTED_PROJECT_A_SHA);

    const directory = await mkdtemp(join(tmpdir(), "cluvvi-c1j2-real-reddit-"));
    cleanupDirectories.push(directory);
    const helperPath = resolve(directory, "run-project-a-live-reddit.mjs");
    await writeFile(helperPath, projectAHelper, "utf8");
    let stdout = "";
    let stderr = "";
    let lastError: unknown;
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      try {
        const execution = await execFileAsync(process.execPath, [helperPath, directory], {
          cwd: projectAPath,
          windowsHide: true,
          timeout: 90_000,
          maxBuffer: 2_000_000,
        });
        stdout = execution.stdout;
        stderr = execution.stderr;
        lastError = undefined;
        break;
      } catch (error) {
        lastError = error;
        const safeText = error instanceof Error ? error.message : String(error);
        if (!safeText.includes("REDDIT_ALL_KEYLESS_ROUTES_FAILED") || attempt === 3) throw error;
        await new Promise((resolveDelay) => setTimeout(resolveDelay, 8_000));
      }
    }
    if (lastError !== undefined) throw lastError;
    expect(stderr.trim()).toBe("");
    expect(stdout).toContain("C1J2_PROJECT_A_REDDIT=");
    console.info(stdout.trim());

    const bundle = JSON.parse(
      await readFile(resolve(directory, "community-bundle.json"), "utf8"),
    ) as Record<string, unknown>;
    const searchResults = SearchResultsArtifactV2Schema.parse(bundle["searchResults"]);
    const validated = validateCommunityArtifactSet({
      plan: bundle["plan"],
      threadManifest: bundle["threadManifest"],
      threadContext: bundle["threadContext"],
      threads: Array.isArray(bundle["threads"]) ? bundle["threads"] : [],
      commentManifest: bundle["commentManifest"],
      commentContext: bundle["commentContext"],
      commentCollections: Array.isArray(bundle["commentCollections"])
        ? bundle["commentCollections"]
        : [],
      signals: bundle["signals"],
      telemetry: bundle["telemetry"],
    });
    expect(validated.plan.requestId).toBe(searchResults.requestId);
    expect(validated.threadManifest.summary.threadCount).toBeGreaterThan(0);
    expect(validated.telemetry.totals.redditRssRequests).toBeGreaterThan(0);
    expect(validated.telemetry.totals.paidRequests).toBe(0);
    expect(validated.telemetry.totals.paidCredits).toBe(0);

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
        validated,
      ),
    );
    expect(evidence.evidenceSourceMode).toBe("snippet_plus_public_community_intelligence");
    expect(evidence.materials.some((material) => material.kind === "reddit_thread")).toBe(true);
    expect(
      evidence.materials
        .filter(
          (material) => material.kind.startsWith("reddit_") || material.kind === "community_signal",
        )
        .every((material) => material.trustClassification === "untrusted_public_content"),
    ).toBe(true);
    expect(evidence.warning).toMatch(/anecdotal|representative/iu);

    const hypotheses = buildBuyerHypotheses(evidence, generatedAt);
    const identity = buildIdentityEnrichment(hypotheses, generatedAt);
    expect(identity.fabricatedContacts).toBe(false);
    const observedHandles = validated.threads
      .map((thread) => thread.author?.handle)
      .filter((value): value is string => value !== undefined && value.length > 0);
    const identityJson = JSON.stringify(identity);
    for (const handle of observedHandles) expect(identityJson).not.toContain(handle);
    expect(
      identity.hypotheses.flatMap((entry) =>
        entry.communityIdentityEvidence === undefined
          ? []
          : [entry.communityIdentityEvidence.userIdentityUsed],
      ),
    ).not.toContain(true);
    const ranked = buildRankedOpportunities({
      identity,
      evidence,
      mission: {
        id: createOpaqueId("mission"),
        input: {
          schemaVersion: "1.0",
          name: "C1-J.2 real public Reddit bridge",
          description:
            "Review sampled public TypeScript community evidence without treating it as representative demand or purchase intent.",
          customerOutcome: "Use public community evidence cautiously.",
          desiredOpportunities: 10,
          exclusions: [
            "private Reddit",
            "buyer identity inference",
            "contact enrichment",
            "outreach",
          ],
          goodCustomerExamples: [],
          badCustomerExamples: [],
          geographies: ["global"],
        },
        sourceFile: "integration://project-a-live-reddit",
        createdAt: generatedAt,
      },
      generatedAt,
    });
    expect(
      ranked.opportunities.every((opportunity) => opportunity.communityContribution.points <= 1),
    ).toBe(true);
    expect(
      ranked.opportunities.map(
        (opportunity) => opportunity.communityContribution.maximumShareOfPositiveScore,
      ),
    ).toEqual(ranked.opportunities.map(() => 0.08));

    const buyerMap = BuyerMapArtifactV1Schema.parse(
      buildBuyerMap({ ranked, identity, evidence, searchResults, generatedAt }),
    );
    expect(buyerMap.summary.redditThreadCitationCount).toBeGreaterThan(0);
    expect(buyerMap.warning).toMatch(/anecdotal|representative/iu);
    expect(JSON.stringify(buyerMap)).not.toMatch(
      /authorization|oauth|accessToken|refreshToken|cookies|rawHtml|requestHeaders|responseHeaders/iu,
    );

    console.info(
      `C1J2_REAL_PROJECT_A_BRIDGE=${JSON.stringify({
        projectCommitSha: EXPECTED_PROJECT_A_SHA,
        threads: validated.threadManifest.summary.threadCount,
        comments: validated.commentManifest.summary.totalComments,
        signals: validated.signals.signals.length,
        rssRequests: validated.telemetry.totals.redditRssRequests,
        listingRequests: validated.telemetry.totals.redditListingRequests,
        commentRequests: validated.telemetry.totals.redditCommentRequests,
        arcticRequests: validated.telemetry.totals.arcticShiftRequests,
        paidRequests: validated.telemetry.totals.paidRequests,
        paidCredits: validated.telemetry.totals.paidCredits,
        buyerMapRedditThreadCitations: buyerMap.summary.redditThreadCitationCount,
        buyerMapRedditCommentCitations: buyerMap.summary.redditCommentCitationCount,
        buyerMapCommunitySignalCitations: buyerMap.summary.communitySignalCitationCount,
      })}`,
    );
  }, 120_000);
});
