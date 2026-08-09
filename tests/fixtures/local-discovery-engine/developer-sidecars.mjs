import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

function canonicalValue(value) {
  if (Array.isArray(value)) return value.map(canonicalValue);
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .filter((key) => value[key] !== undefined)
        .map((key) => [key, canonicalValue(value[key])]),
    );
  }
  return value;
}
function canonicalJson(value) {
  return JSON.stringify(canonicalValue(value));
}
function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}
function digest(value) {
  return sha256(canonicalJson(value));
}
function artifactId(value) {
  return `artifact_${sha256(`${value.requestId}\n${value.artifactKind}\n${canonicalJson(value)}`)}`;
}
function withId(value) {
  return { ...value, artifactId: artifactId(value) };
}
function queryId(requestId, intent, query) {
  return `developer_query_${sha256([requestId, intent, query.trim().toLowerCase()].join("\n"))}`;
}
function repositoryTargetId(requestId, fullName) {
  return `developer_repo_target_${sha256([requestId, fullName.trim().toLowerCase()].join("\n"))}`;
}
function repositoryId(fullName) {
  return `developer_repo_${sha256(`github:${fullName.trim().toLowerCase()}`)}`;
}
function threadId(requestId, fullName, kind, nativeNumber) {
  return `thread_${sha256([requestId, "github", fullName.trim().toLowerCase(), kind, String(nativeNumber)].join("\n"))}`;
}
function commentId(threadArtifactId, commentKind, sourceNativeId, canonicalUrl, body) {
  return `comment_${sha256(
    [
      threadArtifactId,
      commentKind,
      sourceNativeId ?? "",
      canonicalUrl ?? "",
      sha256(body.trim().normalize("NFKC")),
    ].join("\n"),
  )}`;
}
function releaseId(repoId, sourceNativeId, tagName) {
  return `developer_release_${sha256([repoId, String(sourceNativeId ?? ""), tagName.trim().toLowerCase()].join("\n"))}`;
}
function signalId(input) {
  return `developer_signal_${sha256(
    [
      input.requestId,
      input.type,
      input.ruleId,
      [...new Set(input.repositoryIds)].sort().join(","),
      [...new Set(input.threadIds)].sort().join(","),
      [...new Set(input.commentIds)].sort().join(","),
    ].join("\n"),
  )}`;
}
function companion(outputPath, fileName) {
  return /search-results\.v2\.json$/iu.test(outputPath)
    ? outputPath.replace(/search-results\.v2\.json$/iu, fileName)
    : `${outputPath}.${fileName}`;
}
async function writeJson(path, value) {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

export async function writeControlledDeveloperSidecars(input) {
  if (input.sourceAdapterMode !== "selected_sources" || !input.sourceFamilies.includes("developer"))
    return;

  const outputPath = input.outputPath;
  const mode = input.behavior.mode;
  const requestId = input.searchResults.requestId;
  const observedAt = "2026-08-08T12:00:00.000Z";
  const primaryEntity =
    mode === "developer-ambiguous" ? "Unrelated Developer Entity" : "Fixture Frame Studio";
  const query = `${primaryEntity} integration bug migration dependency workflow`;
  const qid = queryId(requestId, "integration_problem", query);
  const repositoryNames =
    mode === "developer-single-repo"
      ? ["fixture-frame/studio"]
      : ["fixture-frame/studio", "fixture-labs/frame-plugin"];

  const planBase = {
    schemaVersion: "1.0",
    artifactKind: "developer_source_plan.v1",
    requestId,
    sourceFamily: "developer",
    platform: "github",
    temporalWindow: {
      preset: "last_30_days",
      from: "2026-07-09T12:00:00.000Z",
      to: observedAt,
    },
    queries: [
      {
        queryId: qid,
        plainTextQuery: query,
        intent: "integration_problem",
        primaryEntity,
        concepts: [primaryEntity, "integration", "bug", "migration", "dependency"],
        temporalField: "created",
        importance: 0.95,
        selected: true,
        selectionReasons: ["Controlled C1-J.3 public developer fixture query."],
        limitations: ["Fixture query only."],
      },
    ],
    repositoryTargets: repositoryNames.map((fullName) => {
      const [owner, repository] = fullName.split("/");
      return {
        targetId: repositoryTargetId(requestId, fullName),
        owner,
        repository,
        fullName,
        source: "issue_search",
        explicit: false,
        relevanceConfidence: 0.9,
        evidenceReferences: [qid],
        selected: true,
        selectionReasons: ["Controlled public repository fixture."],
        limitations: ["Fixture repository relationship only."],
      };
    }),
    policy: {
      depth: input.githubDepth ?? "default",
      maximumQueries: input.maximumGitHubQueries ?? 4,
      maximumRepositoryTargets: input.maximumGitHubRepositories ?? 8,
      maximumDiscoveryItems: 30,
      maximumThreadsDrilled: input.maximumGitHubThreadDrill ?? 5,
      maximumCommentsPerThread: 15,
      maximumTotalComments: 120,
      maximumReleasesPerRepository: 5,
    },
    summary: {
      queryCandidates: 1,
      queriesSelected: 1,
      repositoryCandidates: repositoryNames.length,
      repositoriesSelected: repositoryNames.length,
      explicitRepositories: 0,
      discoveredRepositories: repositoryNames.length,
    },
    warnings: [],
  };
  const plan = withId(planBase);

  const repositories = repositoryNames.map((fullName, index) => {
    const [owner, name] = fullName.split("/");
    const repoId = repositoryId(fullName);
    const tagName = index === 0 ? "v2.4.0" : "v1.8.2";
    const relId = releaseId(repoId, 9000 + index, tagName);
    return {
      repositoryId: repoId,
      sourceNativeId: 1000 + index,
      owner,
      name,
      fullName,
      url: `https://github.com/${fullName}`,
      description:
        index === 0
          ? "Fixture Frame Studio public editing workflow repository."
          : "Fixture Frame Studio integration plugin used by public developer workflows.",
      homepage: "https://frame-studio.invalid",
      primaryLanguage: index === 0 ? "TypeScript" : "Python",
      topics: ["video-editing", "workflow", "integration"],
      fork: false,
      archived: false,
      disabled: false,
      visibility: "public",
      stars: index === 0 ? 420 : 180,
      forks: index === 0 ? 42 : 12,
      subscribers: index === 0 ? 21 : 9,
      openIssues: index === 0 ? 18 : 7,
      createdAt: "2024-01-01T00:00:00.000Z",
      updatedAt: "2026-08-07T12:00:00.000Z",
      pushedAt: "2026-08-07T11:00:00.000Z",
      hasIssues: true,
      hasDiscussions: false,
      releases: [
        {
          releaseId: relId,
          sourceNativeId: 9000 + index,
          tagName,
          name: `${tagName} public release`,
          bodyExcerpt: "Improves integration reliability and migration compatibility.",
          draft: false,
          prerelease: false,
          createdAt: "2026-08-05T10:00:00.000Z",
          publishedAt: "2026-08-05T11:00:00.000Z",
          url: `https://github.com/${fullName}/releases/tag/${tagName}`,
          assetCount: 1,
          totalKnownDownloadCount: 25,
          limitations: ["Release metadata only; no release asset was downloaded."],
        },
      ],
      trustClassification: "untrusted_public_content",
      provenance: ["github_repository_metadata"],
      limitations: ["Public repository metadata only."],
    };
  });
  const repositoryCollection = withId({
    schemaVersion: "1.0",
    artifactKind: "developer_repository_collection.v1",
    requestId,
    developerSourcePlanArtifactId: plan.artifactId,
    repositories,
    summary: {
      candidatesEvaluated: repositories.length,
      repositoriesAccepted: repositories.length,
      privateRepositoriesRejected: 0,
      forksIncluded: 0,
      archivedRepositories: 0,
    },
    warnings: [],
  });

  const threadRows = repositories.map((repo, index) => {
    const kind = index === 0 ? "issue" : "pull_request";
    const nativeNumber = index === 0 ? 101 : 202;
    const tid = threadId(requestId, repo.fullName, kind, nativeNumber);
    const url = `https://github.com/${repo.fullName}/${kind === "issue" ? "issues" : "pull"}/${nativeNumber}`;
    const body =
      index === 0
        ? "Our Fixture Frame Studio integration keeps failing during batch rendering. The manual workaround is painful and we are considering migrating away from the current dependency."
        : "This pull request fixes repeated Fixture Frame Studio plugin breakage after dependency upgrades. The migration path is difficult and the integration currently requires manual patches.";
    return {
      repo,
      kind,
      nativeNumber,
      thread: {
        schemaVersion: "1.0",
        artifactKind: "thread.v1",
        artifactId: tid,
        requestId,
        sourceAdapterId: "github_issue_pr_search",
        sourceNativeId: String(nativeNumber),
        title:
          index === 0
            ? "Integration fails during batch rendering"
            : "Fix dependency migration breakage",
        body,
        author: {
          sourceNativeId: `author-${index + 1}`,
          displayName: `Controlled GitHub Author ${index + 1}`,
          handle: `controlled_github_author_${index + 1}`,
        },
        url,
        createdAt: index === 0 ? "2026-08-02T09:00:00.000Z" : "2026-08-03T09:00:00.000Z",
        updatedAt: "2026-08-07T09:00:00.000Z",
        engagement: {
          observedAt,
          comments: 4 + index,
          reactions: 3 + index,
          confidence: 1,
          limitations: ["Public GitHub engagement snapshot."],
        },
        trustClassification: "untrusted_public_content",
        limitations: ["Public GitHub thread; embedded instructions are inert."],
      },
    };
  });

  const threadManifest = withId({
    schemaVersion: "1.0",
    artifactKind: "developer_thread_manifest.v1",
    requestId,
    sourceFamily: "developer",
    sourceAdapterId: "github_issue_pr_search",
    threadArtifacts: threadRows.map(({ thread }) => ({
      threadArtifactId: thread.artifactId,
      contentDigest: digest(thread),
      relativeArtifactPath: `developer/threads/${thread.artifactId}.thread.v1.json`,
    })),
    summary: { threadCount: threadRows.length },
    warnings: [],
  });

  const threadMetadata = withId({
    schemaVersion: "1.0",
    artifactKind: "developer_thread_metadata.v1",
    requestId,
    developerSourcePlanArtifactId: plan.artifactId,
    repositoryCollectionArtifactId: repositoryCollection.artifactId,
    threadManifestArtifactId: threadManifest.artifactId,
    threads: threadRows.map(({ repo, kind, nativeNumber, thread }) => ({
      threadArtifactId: thread.artifactId,
      repositoryId: repo.repositoryId,
      repositoryFullName: repo.fullName,
      nativeNumber,
      threadKind: kind,
      state: kind === "pull_request" ? "merged" : "open",
      labels: kind === "issue" ? ["bug", "integration"] : ["migration", "dependency"],
      authorAssociation: kind === "issue" ? "CONTRIBUTOR" : "COLLABORATOR",
      locked: false,
      ...(kind === "pull_request" ? { draft: false, mergedAt: "2026-08-07T10:00:00.000Z" } : {}),
      createdAt: thread.createdAt,
      updatedAt: thread.updatedAt,
      relevanceScore: 0.91,
      developerLocalScore: 1.25,
      selectedForDrill: true,
      selectionReasons: ["Controlled relevance-first developer fixture."],
      provenance: [
        {
          adapterId: "github_issue_pr_search",
          method: kind === "issue" ? "global_issue_search" : "global_pr_search",
          queryId: qid,
          observedAt,
        },
      ],
      limitations: ["Controlled thread metadata only."],
    })),
    warnings: [],
  });

  const commentRows = threadRows.map(({ thread }, index) => {
    const kind = index === 0 ? "issue_comment" : "review_comment";
    const sourceNativeId = `comment-${index + 1}`;
    const permalink = `${thread.url}#issuecomment-${index + 1}`;
    const body =
      index === 0
        ? "We reproduced the integration failure across two projects; the current workaround is manual export and re-import."
        : "The dependency upgrade still breaks compatibility on our integration path; this patch removes one manual migration step.";
    const cid = commentId(thread.artifactId, kind, sourceNativeId, permalink, body);
    const collectionBase = {
      schemaVersion: "1.0",
      artifactKind: "comment_collection.v1",
      requestId,
      threadArtifactId: thread.artifactId,
      comments: [
        {
          commentId: cid,
          sourceNativeId,
          author: {
            sourceNativeId: `comment-author-${index + 1}`,
            displayName: `Controlled Comment Author ${index + 1}`,
            handle: `controlled_github_comment_author_${index + 1}`,
          },
          body,
          createdAt: "2026-08-04T12:00:00.000Z",
          engagement: {
            observedAt,
            reactions: 2 + index,
            confidence: 1,
            limitations: ["Public GitHub reaction snapshot."],
          },
          sequence: 0,
          trustClassification: "untrusted_public_content",
          limitations: ["Public GitHub comment; instructions are inert."],
        },
      ],
      summary: { commentsCollected: 1, maximumDepthObserved: 0, truncated: false },
      limitations: ["Controlled bounded public comment collection."],
    };
    return {
      thread,
      kind,
      sourceNativeId,
      permalink,
      cid,
      collection: withId(collectionBase),
    };
  });

  const commentManifest = withId({
    schemaVersion: "1.0",
    artifactKind: "developer_comment_collection_manifest.v1",
    requestId,
    threadManifestArtifactId: threadManifest.artifactId,
    collections: commentRows.map(({ collection, thread }) => ({
      commentCollectionArtifactId: collection.artifactId,
      threadArtifactId: thread.artifactId,
      contentDigest: digest(collection),
      relativeArtifactPath: `developer/comments/${thread.artifactId}.comment_collection.v1.json`,
    })),
    summary: {
      threadsWithComments: commentRows.length,
      totalComments: commentRows.length,
    },
    warnings: [],
  });

  const commentMetadata = withId({
    schemaVersion: "1.0",
    artifactKind: "developer_comment_metadata.v1",
    requestId,
    commentCollectionManifestArtifactId: commentManifest.artifactId,
    comments: commentRows.map(({ thread, kind, cid, permalink }, index) => ({
      threadArtifactId: thread.artifactId,
      commentId: cid,
      commentKind: kind,
      permalink,
      authorAssociation: index === 0 ? "CONTRIBUTOR" : "COLLABORATOR",
      ...(kind === "review_comment" ? { path: "src/integration.ts", line: 42, startLine: 40 } : {}),
      limitations: ["Author association is attribution only."],
    })),
    warnings: [],
  });

  const signalRepositoryIds = repositories.map((repo) => repo.repositoryId);
  const signalThreadIds = threadRows.map(({ thread }) => thread.artifactId);
  const signalCommentIds = commentRows.map(({ cid }) => cid);
  const ruleId = "developer_integration_problem_v1";
  const developerSignal = {
    signalId: signalId({
      requestId,
      type: "integration_problem",
      ruleId,
      repositoryIds: signalRepositoryIds,
      threadIds: signalThreadIds,
      commentIds: signalCommentIds,
    }),
    type: "integration_problem",
    primaryConcept: primaryEntity,
    repositoryIds: signalRepositoryIds,
    supportingThreadArtifactIds: signalThreadIds,
    supportingCommentIds: signalCommentIds,
    independentThreadCount: signalThreadIds.length,
    independentRepositoryCount: signalRepositoryIds.length,
    independentAuthorCount: signalThreadIds.length + signalCommentIds.length,
    observedFacts: [
      "Multiple public developer threads describe Fixture Frame Studio integration breakage and manual migration workarounds.",
      "The supporting evidence spans independent public repositories in the controlled fixture.",
    ],
    inference:
      "The bounded public GitHub sample suggests recurring integration friction around Fixture Frame Studio.",
    confidence: 0.84,
    missionRelevance: {
      relevant: mode !== "developer-ambiguous",
      score: mode === "developer-ambiguous" ? 0.2 : 0.92,
      matchedConcepts:
        mode === "developer-ambiguous" ? [] : [primaryEntity, "integration", "migration"],
    },
    ruleId,
    ruleVersion: "c1-j3.developer-signals.v1",
    limitations: [
      "Bounded public GitHub evidence is not representative market demand and does not identify or qualify a buyer.",
    ],
  };
  const signals = withId({
    schemaVersion: "1.0",
    artifactKind: "developer_signals.v1",
    requestId,
    developerSourcePlanArtifactId: plan.artifactId,
    repositoryCollectionArtifactId: repositoryCollection.artifactId,
    threadManifestArtifactId: threadManifest.artifactId,
    commentCollectionManifestArtifactId: commentManifest.artifactId,
    rulesVersion: "c1-j3.developer-signals.v1",
    signals: [developerSignal],
    summary: {
      repositoriesAnalyzed: repositories.length,
      threadsAnalyzed: threadRows.length,
      commentsAnalyzed: commentRows.length,
      bugPainSignals: 0,
      featureDemandSignals: 0,
      integrationProblemSignals: 1,
      implementationDifficultySignals: 0,
      migrationSignals: 0,
      alternativeSearchSignals: 0,
      performanceProblemSignals: 0,
      securityProblemSignals: 0,
      dependencyProblemSignals: 0,
      breakingChangeSignals: 0,
      maintenanceInactivitySignals: 0,
      releaseActivitySignals: 0,
      technologyAdoptionSignals: 0,
      independentRepositoryCount: repositories.length,
    },
    limitations: ["Controlled bounded developer signals only."],
    warnings:
      mode === "developer-rate-limited"
        ? [
            "GitHub search rate limit stopped one request lane after useful public evidence was retained.",
          ]
        : [],
  });

  const telemetry = withId({
    schemaVersion: "1.0",
    artifactKind: "developer_source_run_telemetry.v1",
    requestId,
    developerSourcePlanArtifactId: plan.artifactId,
    repositoryCollectionArtifactId: repositoryCollection.artifactId,
    threadManifestArtifactId: threadManifest.artifactId,
    commentCollectionManifestArtifactId: commentManifest.artifactId,
    developerSignalsArtifactId: signals.artifactId,
    accessMode: "anonymous",
    startedAt: "2026-08-08T11:59:58.000Z",
    completedAt: observedAt,
    totalRuntimeMs: 2_000,
    rateLimits: [
      {
        resource: "search",
        limit: 10,
        remaining: mode === "developer-rate-limited" ? 0 : 7,
        used: mode === "developer-rate-limited" ? 10 : 3,
        resetAt: "2026-08-08T12:01:00.000Z",
        observedAt,
      },
    ],
    attempts: [
      {
        adapterId: "github_issue_pr_search",
        queryId: qid,
        accessCategory: "keyless_free",
        attempted: true,
        requests: 2,
        durationMs: 250,
        rawItems: threadRows.length,
        acceptedItems: threadRows.length,
        outcome: "success",
      },
      ...(mode === "developer-rate-limited"
        ? [
            {
              adapterId: "github_repository_search",
              queryId: qid,
              accessCategory: "keyless_free",
              attempted: true,
              requests: 1,
              durationMs: 50,
              rawItems: 0,
              acceptedItems: 0,
              outcome: "rate_limited",
              safeFailureCode: "GITHUB_RATE_LIMITED",
              safeFailureMessage:
                "GitHub search budget was exhausted after useful evidence was retained.",
            },
          ]
        : []),
    ],
    totals: {
      repositorySearchRequests: mode === "developer-rate-limited" ? 1 : 0,
      issueSearchRequests: 2,
      repositoryMetadataRequests: repositories.length,
      issueDetailRequests: threadRows.filter((row) => row.kind === "issue").length,
      pullRequestDetailRequests: threadRows.filter((row) => row.kind === "pull_request").length,
      issueCommentRequests: threadRows.length,
      pullReviewCommentRequests: threadRows.filter((row) => row.kind === "pull_request").length,
      pullReviewRequests: 0,
      releaseRequests: repositories.length,
      graphqlDiscussionRequests: 0,
      repositoriesDiscovered: repositories.length,
      repositoriesAccepted: repositories.length,
      threadsDiscovered: threadRows.length,
      threadsAccepted: threadRows.length,
      duplicateThreadsRemoved: 0,
      threadsDrilled: threadRows.length,
      commentsAccepted: commentRows.length,
      duplicateCommentsRemoved: 0,
      releasesAccepted: repositories.reduce((sum, repo) => sum + repo.releases.length, 0),
      signalsGenerated: 1,
      rateLimitEvents: mode === "developer-rate-limited" ? 1 : 0,
      privateResourcesRejected: 0,
      anonymousRequests: 2 + repositories.length * 4 + (mode === "developer-rate-limited" ? 1 : 0),
      authenticatedFreeRequests: 0,
      paidRequests: 0,
      paidCredits: 0,
    },
    warnings:
      mode === "developer-rate-limited"
        ? ["GITHUB_RATE_LIMITED: completed public evidence was preserved."]
        : [],
  });

  const baseDirectory = dirname(outputPath);
  const paths = {
    plan: companion(outputPath, "developer-source-plan.v1.json"),
    repositories: companion(outputPath, "developer-repository-collection.v1.json"),
    threadManifest: companion(outputPath, "developer-thread-manifest.v1.json"),
    threadMetadata: companion(outputPath, "developer-thread-metadata.v1.json"),
    commentManifest: companion(outputPath, "developer-comment-collection-manifest.v1.json"),
    commentMetadata: companion(outputPath, "developer-comment-metadata.v1.json"),
    signals: companion(outputPath, "developer-signals.v1.json"),
    telemetry: companion(outputPath, "developer-source-run-telemetry.v1.json"),
  };

  if (mode === "developer-plan-invalid-json") await writeFile(paths.plan, "{invalid-json", "utf8");
  else if (mode !== "developer-plan-missing") await writeJson(paths.plan, plan);

  if (mode === "developer-repositories-invalid-json")
    await writeFile(paths.repositories, "{invalid-json", "utf8");
  else if (mode !== "developer-repositories-missing")
    await writeJson(paths.repositories, repositoryCollection);

  if (mode === "developer-thread-manifest-invalid-json")
    await writeFile(paths.threadManifest, "{invalid-json", "utf8");
  else if (mode !== "developer-thread-manifest-missing")
    await writeJson(paths.threadManifest, threadManifest);

  if (mode === "developer-thread-metadata-invalid-json")
    await writeFile(paths.threadMetadata, "{invalid-json", "utf8");
  else if (mode !== "developer-thread-metadata-missing")
    await writeJson(paths.threadMetadata, threadMetadata);

  if (mode === "developer-comment-manifest-invalid-json")
    await writeFile(paths.commentManifest, "{invalid-json", "utf8");
  else if (mode !== "developer-comment-manifest-missing")
    await writeJson(paths.commentManifest, commentManifest);

  if (mode === "developer-comment-metadata-invalid-json")
    await writeFile(paths.commentMetadata, "{invalid-json", "utf8");
  else if (mode !== "developer-comment-metadata-missing")
    await writeJson(paths.commentMetadata, commentMetadata);
  for (const { thread } of threadRows) {
    await writeJson(
      resolve(baseDirectory, "developer", "threads", `${thread.artifactId}.thread.v1.json`),
      thread,
    );
  }
  for (const { thread, collection } of commentRows) {
    await writeJson(
      resolve(
        baseDirectory,
        "developer",
        "comments",
        `${thread.artifactId}.comment_collection.v1.json`,
      ),
      collection,
    );
  }

  if (mode === "developer-signals-missing") {
    await writeJson(paths.telemetry, telemetry);
    return;
  }
  if (mode === "developer-signals-invalid-json") {
    await writeFile(paths.signals, "{invalid-json", "utf8");
    await writeJson(paths.telemetry, telemetry);
    return;
  }
  if (mode === "developer-signals-invalid-contract") {
    await writeJson(paths.signals, { ...signals, rulesVersion: "tampered-rules" });
    await writeJson(paths.telemetry, telemetry);
    return;
  }
  await writeJson(paths.signals, signals);
  if (mode === "developer-telemetry-missing") return;
  if (mode === "developer-telemetry-invalid-json") {
    await writeFile(paths.telemetry, "{invalid-json", "utf8");
    return;
  }
  await writeJson(paths.telemetry, telemetry);
}
