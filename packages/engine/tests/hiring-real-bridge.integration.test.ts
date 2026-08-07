import {
  HiringSignalsArtifactV1Schema,
  JobCollectionArtifactV1Schema,
  SearchResultsArtifactV2Schema,
  SourceAdapterRunTelemetryV1Schema,
  SourceTargetPlanArtifactV1Schema,
  createOpaqueId,
} from "@cluvvi/core";
import { validateHiringArtifactSet } from "@cluvvi/core/hiring-validation";
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
const EXPECTED_PROJECT_A_SHA = "19cf88710241b3337df4f7c401728741bffab384";
const defaultProjectAPath = resolve(process.cwd(), "..", "Separate Discovery engine");
const projectAPath = process.env["CLUVVI_DISCOVERY_ENGINE_PATH"]?.trim() || defaultProjectAPath;
const runReal = process.env["RUN_HIRING_DISCOVERY_INTEGRATION"] === "1";
const integration = runReal ? describe : describe.skip;
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
const requestId = "req_c1j_real_project_a_greenhouse";
const seededResult = {
  ...template.results[0],
  id: "result_real_greenhouse_discord",
  queryId: "query_real_greenhouse_discord",
  query: "Discord public Greenhouse careers",
  providerId: "fixture_search_provider",
  providerCategory: "fixture",
  discoveryGoal: "customer_opportunities",
  searchMethod: "keyword_search",
  sourceZone: "job_boards",
  signalIntent: "hiring",
  title: "Discord",
  snippet: "Operator-reviewed official company result used only to isolate the real public hiring-provider boundary.",
  url: "https://discord.com/",
  domain: "discord.com",
  authorOrCompany: "Discord",
  publishedAt: now,
  discoveredAt: now,
  language: "en",
  credibility: "high",
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
      sourceZone: "job_boards",
      searchMethod: "keyword_search",
      queriesExecuted: 1,
      resultsReturned: 1,
      errors: 0,
    },
  ],
  results: [seededResult],
  coverage: {
    searchedSourceZones: ["job_boards"],
    skippedSourceZones: [],
    providersUsed: ["fixture_search_provider"],
    providersUnavailable: [],
    manualReviewRecommended: [],
    confidenceLimitations: [
      "Search discovery is seeded only so this integration test isolates real public ATS retrieval.",
    ],
    nextBestSearches: [],
  },
  warnings: [
    "The official-company search result is an operator-reviewed integration seed; the Greenhouse provider request is real public network I/O.",
  ],
});
const request = project.DiscoveryRequestV1Schema.parse({
  schemaVersion: "1.0",
  artifactKind: "discovery_request.v1",
  requestId,
  goal: "customer_opportunities",
  description:
    "Use current public Discord hiring evidence cautiously. Public jobs never prove budget or purchase intent.",
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
    authorityPriority: 1,
    diversityPriority: 0.3,
  },
  subject: { type: "company", name: "Discord", description: "Discord public careers" },
  targetEntityTypes: ["company"],
  buyerHypotheses: ["Discord"],
  languages: ["en"],
  exclusions: ["candidate data", "private ATS data"],
  discoveryMode: "free_only",
  providerPreference: "free_first",
});
const sourceConfiguration = project.parseSourceAdapterConfiguration({
  DISCOVERY_SOURCE_ADAPTER_MODE: "selected_sources",
  DISCOVERY_SOURCE_FAMILIES: "hiring",
  DISCOVERY_HIRING_MAX_TARGETS: "1",
  DISCOVERY_HIRING_MAX_BOARDS_PER_TARGET: "1",
  DISCOVERY_HIRING_MAX_JOBS_PER_BOARD: "10",
  DISCOVERY_HIRING_MAX_TOTAL_JOBS: "10",
  DISCOVERY_HIRING_MIN_TARGET_CONFIDENCE: "0.25",
  DISCOVERY_HIRING_MIN_BOARD_RELATIONSHIP_CONFIDENCE: "0.45",
  DISCOVERY_HIRING_PROVIDER_TIMEOUT_MS: "20000",
  DISCOVERY_HIRING_MAX_DISCOVERY_QUERIES_PER_TARGET: "1",
  DISCOVERY_HIRING_MAX_CONVENTIONAL_PATH_PROBES: "1",
  DISCOVERY_HIRING_INCLUDE_PUBLIC_COMPENSATION: "false",
  DISCOVERY_HIRING_ALLOW_AUTHENTICATED_FREE: "false",
});
const extractionConfiguration = project.parseExtractionConfiguration(
  {
    DISCOVERY_EXTRACTION_TIMEOUT_MS: "20000",
    DISCOVERY_EXTRACTION_MAX_URLS: "2",
    DISCOVERY_EXTRACTION_MAX_URLS_PER_QUERY: "2",
    DISCOVERY_EXTRACTION_MAX_URLS_PER_DOMAIN: "2",
  },
  "none",
  2,
);
const hiring = await project.runSelectedHiringSourceAdapters({
  request,
  searchResults,
  sourceConfiguration,
  extractionConfiguration,
  providerPolicy: "free_only",
  dependencies: {
    fetchPage: async () => {
      throw new Error("CONTROLLED_CAREERS_PROBE_SKIPPED");
    },
    search: async () => [
      {
        url: "https://boards.greenhouse.io/discord",
        companyNameObserved: "Discord",
      },
    ],
  },
});
await Promise.all([
  writeFile(resolve(outputDirectory, "search-results.v2.json"), JSON.stringify(searchResults, null, 2) + "\n"),
  writeFile(resolve(outputDirectory, "source-target-plan.v1.json"), JSON.stringify(hiring.sourceTargetPlan, null, 2) + "\n"),
  writeFile(resolve(outputDirectory, "job-collection.v1.json"), JSON.stringify(hiring.jobCollection, null, 2) + "\n"),
  writeFile(resolve(outputDirectory, "hiring-signals.v1.json"), JSON.stringify(hiring.hiringSignals, null, 2) + "\n"),
  writeFile(resolve(outputDirectory, "source-adapter-run-telemetry.v1.json"), JSON.stringify(hiring.telemetry, null, 2) + "\n"),
]);
console.log(
  "C1J_PROJECT_A_LIVE=" +
    JSON.stringify({
      targets: hiring.sourceTargetPlan.summary.targetsSelected,
      boards: hiring.jobCollection.summary.boardsValidated,
      jobs: hiring.jobCollection.summary.acceptedJobs,
      signals: hiring.hiringSignals.summary.signalsGenerated,
      providers: hiring.jobCollection.summary.providersUsed,
      keylessRequests: hiring.telemetry.totals.keylessRequests,
      paidRequests: hiring.telemetry.totals.paidRequests,
    }),
);
`;

afterAll(async () => {
  await Promise.all(
    cleanupDirectories.splice(0).map((path) => rm(path, { recursive: true, force: true })),
  );
});

integration("C1-J real Project A → Project B public hiring bridge", () => {
  it("pins Project A, performs real keyless Greenhouse retrieval, validates canonical sidecars, and carries hiring provenance into Buyer Map", async () => {
    const { stdout: shaOutput } = await execFileAsync("git", ["rev-parse", "HEAD"], {
      cwd: projectAPath,
      windowsHide: true,
    });
    expect(shaOutput.trim()).toBe(EXPECTED_PROJECT_A_SHA);

    const directory = await mkdtemp(join(tmpdir(), "cluvvi-c1j-real-hiring-"));
    cleanupDirectories.push(directory);
    const helperPath = resolve(directory, "run-project-a-live-hiring.mjs");
    await writeFile(helperPath, projectAHelper, "utf8");
    const { stdout, stderr } = await execFileAsync(process.execPath, [helperPath, directory], {
      cwd: projectAPath,
      windowsHide: true,
      timeout: 60_000,
      maxBuffer: 1_000_000,
    });
    expect(stderr.trim()).toBe("");
    console.info(stdout.trim());
    expect(stdout).toContain("C1J_PROJECT_A_LIVE=");

    const searchResults = SearchResultsArtifactV2Schema.parse(
      JSON.parse(await readFile(resolve(directory, "search-results.v2.json"), "utf8")) as unknown,
    );
    const sourceTargetPlan = SourceTargetPlanArtifactV1Schema.parse(
      JSON.parse(
        await readFile(resolve(directory, "source-target-plan.v1.json"), "utf8"),
      ) as unknown,
    );
    const jobCollection = JobCollectionArtifactV1Schema.parse(
      JSON.parse(await readFile(resolve(directory, "job-collection.v1.json"), "utf8")) as unknown,
    );
    const hiringSignals = HiringSignalsArtifactV1Schema.parse(
      JSON.parse(await readFile(resolve(directory, "hiring-signals.v1.json"), "utf8")) as unknown,
    );
    const telemetry = SourceAdapterRunTelemetryV1Schema.parse(
      JSON.parse(
        await readFile(resolve(directory, "source-adapter-run-telemetry.v1.json"), "utf8"),
      ) as unknown,
    );

    const validated = validateHiringArtifactSet({
      searchResults,
      sourceTargetPlan,
      jobCollection,
      hiringSignals,
      telemetry,
      providerPolicy: "free_only",
    });
    expect(validated.sourceTargetPlan.summary.targetsSelected).toBe(1);
    expect(validated.jobCollection.summary.boardsValidated).toBeGreaterThan(0);
    expect(validated.jobCollection.summary.acceptedJobs).toBeGreaterThan(0);
    expect(validated.jobCollection.summary.providersUsed).toContain("greenhouse_public_jobs");
    expect(
      validated.jobCollection.jobs.every(
        (job) =>
          job.sourceProviderId === "greenhouse_public_jobs" && /^https:\/\//u.test(job.jobUrl),
      ),
    ).toBe(true);
    expect(validated.telemetry.totals.keylessRequests).toBeGreaterThan(0);
    expect(validated.telemetry.totals.paidRequests).toBe(0);

    const generatedAt = new Date().toISOString();
    const candidates = buildDiscoveryCandidates(searchResults, generatedAt);
    const evidence = buildEvidenceFindings(
      candidates,
      generatedAt,
      undefined,
      undefined,
      validated.jobCollection,
      validated.hiringSignals,
    );
    expect(evidence.materials.some((material) => material.kind === "public_job_posting")).toBe(
      true,
    );
    expect(
      evidence.materials
        .filter((material) => material.kind !== "search_snippet")
        .every((material) => material.trustClassification === "untrusted_public_content"),
    ).toBe(true);
    expect(evidence.warning).toMatch(/do not prove budget|does not prove budget|purchase intent/iu);

    const hypotheses = buildBuyerHypotheses(evidence, generatedAt);
    const identity = buildIdentityEnrichment(hypotheses, generatedAt);
    const ranked = buildRankedOpportunities({
      identity,
      evidence,
      mission: {
        id: createOpaqueId("mission"),
        input: {
          schemaVersion: "1.0",
          name: "C1-J real public hiring bridge",
          description:
            "Review current public hiring evidence without inferring private candidate data, budget, or purchase intent.",
          customerOutcome: "Use public hiring evidence cautiously.",
          desiredOpportunities: 10,
          exclusions: ["candidate data", "private ATS data"],
          goodCustomerExamples: [],
          badCustomerExamples: [],
          geographies: ["global"],
        },
        sourceFile: "integration://project-a-live-hiring",
        createdAt: generatedAt,
      },
      generatedAt,
    });
    expect(
      ranked.opportunities
        .flatMap((opportunity) => opportunity.scoreComponents)
        .filter((component) => component.key === "related_hiring")
        .every((component) => component.points <= 1),
    ).toBe(true);

    const buyerMap = buildBuyerMap({ ranked, identity, evidence, searchResults, generatedAt });
    expect(buyerMap.summary.publicJobCitationCount).toBeGreaterThan(0);
    expect(
      buyerMap.opportunities.some((opportunity) =>
        opportunity.evidence.some(
          (citation) =>
            citation.materialKind === "public_job_posting" &&
            citation.hiringProviderId === "greenhouse_public_jobs",
        ),
      ),
    ).toBe(true);
    expect(JSON.stringify(buyerMap)).not.toMatch(
      /candidateEmail|candidatePhone|applicationAnswers|resumeText|coverLetter|rawHtml|requestHeaders|responseHeaders|authorization|api[_-]?key/iu,
    );

    console.info(
      `C1J_REAL_PROJECT_A_BRIDGE=${JSON.stringify({
        projectCommitSha: EXPECTED_PROJECT_A_SHA,
        targets: validated.sourceTargetPlan.summary.targetsSelected,
        boards: validated.jobCollection.summary.boardsValidated,
        jobs: validated.jobCollection.summary.acceptedJobs,
        signals: validated.hiringSignals.summary.signalsGenerated,
        providers: validated.jobCollection.summary.providersUsed,
        keylessRequests: validated.telemetry.totals.keylessRequests,
        paidRequests: validated.telemetry.totals.paidRequests,
        buyerMapPublicJobCitations: buyerMap.summary.publicJobCitationCount,
        buyerMapHiringSignalCitations: buyerMap.summary.hiringSignalCitationCount,
      })}`,
    );
  }, 90_000);
});
