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
function companion(outputPath, fileName) {
  return /search-results\.v2\.json$/iu.test(outputPath)
    ? outputPath.replace(/search-results\.v2\.json$/iu, fileName)
    : `${outputPath}.${fileName}`;
}
async function writeJson(path, value) {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}
function invalid(mode, stem) {
  return mode === `${stem}-invalid-json`;
}
function missing(mode, stem) {
  return mode === `${stem}-missing`;
}
async function writeControlled(path, value, mode, stem) {
  if (missing(mode, stem)) return;
  if (invalid(mode, stem)) {
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, "{invalid-json", "utf8");
    return;
  }
  await writeJson(path, value);
}

function videoQueryId(requestId, intent, query) {
  return `video_query_${sha256([requestId, intent, query.trim().toLowerCase()].join("\n"))}`;
}
function transcriptId(requestId, videoId) {
  return `transcript_${sha256([requestId, videoId].join("\n"))}`;
}
function transcriptSegmentId(videoId, sequence, text) {
  return `video_segment_${sha256([videoId, String(sequence), "0", "10", text.trim()].join("\n"))}`;
}
function videoCommentId(videoId, sourceNativeId, body) {
  return `video_comment_${sha256([videoId, sourceNativeId, "", body.trim()].join("\n"))}`;
}
function videoSignalId(requestId, type, ruleId, videoIds, segmentIds, commentIds) {
  return `video_signal_${sha256(
    [
      requestId,
      type,
      ruleId,
      [...new Set(videoIds)].sort().join(","),
      [...new Set(segmentIds)].sort().join(","),
      [...new Set(commentIds)].sort().join(","),
    ].join("\n"),
  )}`;
}
function specializedFindingId(requestId, sourceDomain, sourceNativeId, url, title) {
  return `specialized_finding_${sha256(
    [
      requestId,
      sourceDomain.toLowerCase(),
      sourceNativeId ?? "",
      url,
      title.trim().toLowerCase(),
    ].join("\n"),
  )}`;
}
function specializedSignalId(requestId, type, ruleId, findingIds) {
  return `specialized_signal_${sha256(
    [requestId, type, ruleId, [...new Set(findingIds)].sort().join(",")].join("\n"),
  )}`;
}

export async function writeControlledVideoSidecars(input) {
  if (input.sourceAdapterMode !== "selected_sources" || !input.sourceFamilies.includes("video"))
    return;
  const mode = input.behavior.mode;
  const requestId = input.searchResults.requestId;
  const observedAt = "2026-08-10T08:00:00.000Z";
  const query = "Fixture Frame Studio workflow friction migration tutorial";
  const qid = videoQueryId(requestId, "implementation", query);
  const videoIds = ["ctrlvid001", "ctrlvid002"];
  const channels = [
    { channelId: "channel_fixture_one", name: "Fixture Workflow Lab" },
    { channelId: "channel_fixture_two", name: "Fixture Editor Research" },
  ];
  const transcriptIds = videoIds.map((id) => transcriptId(requestId, id));
  const transcriptTexts = [
    "Fixture Frame Studio requires repeated manual export steps and slows the editing workflow.",
    "Teams describe Fixture Frame Studio migration workarounds because the current workflow is difficult.",
  ];
  const segmentIds = videoIds.map((id, index) =>
    transcriptSegmentId(id, 0, transcriptTexts[index]),
  );
  const commentBodies = [
    "Our team still uses a manual workaround for this Fixture Frame Studio workflow.",
    "We hit the same migration friction and would prefer a simpler workflow.",
  ];
  const commentIds = videoIds.map((id, index) =>
    videoCommentId(id, `native_comment_${index + 1}`, commentBodies[index]),
  );

  const planBase = {
    schemaVersion: "1.0",
    artifactKind: "video_source_plan.v1",
    requestId,
    sourceFamily: "video",
    platform: "youtube",
    temporalWindow: { from: "2026-07-10T08:00:00.000Z", to: observedAt },
    queries: [
      {
        queryId: qid,
        query,
        intent: "implementation",
        concepts: ["Fixture Frame Studio", "workflow", "migration"],
        primaryEntity: "Fixture Frame Studio",
        importance: 0.95,
        selected: true,
        selectionReasons: ["Controlled C1-J.4 public video fixture query."],
        limitations: ["Fixture query only."],
      },
    ],
    policy: {
      depth: input.youtubeDepth ?? "default",
      maximumQueries: 4,
      maximumSearchResults: 20,
      maximumMetadataDetails: 10,
      maximumTranscriptDrill: 5,
      maximumCommentVideos: 5,
      maximumCommentsPerVideo: 20,
    },
    summary: { queryCandidates: 1, queriesSelected: 1 },
    warnings: [],
  };
  const plan = withId(planBase);
  const videos = videoIds.map((videoId, index) => ({
    videoId,
    sourceNativeId: videoId,
    url: `https://www.youtube.com/watch?v=${videoId}`,
    title: `Fixture Frame Studio workflow friction ${index + 1}`,
    description: transcriptTexts[index],
    channel: {
      channelId: channels[index].channelId,
      name: channels[index].name,
      url: `https://www.youtube.com/channel/${channels[index].channelId}`,
    },
    uploadDate: `2026-08-0${index + 1}T08:00:00.000Z`,
    durationSeconds: 120,
    tags: ["Fixture Frame Studio", "workflow"],
    categories: ["Technology"],
    liveStatus: "not_live",
    availability: "public",
    ageRestricted: false,
    subtitles: [{ language: "en", source: "automatic", formats: ["vtt"] }],
    transcriptArtifactId: transcriptIds[index],
    relevance: 0.95,
    temporalConfidence: 0.95,
    localScore: 0.95,
    selectedForTranscript: true,
    selectedForComments: true,
    trustClassification: "untrusted_public_content",
    provenance: [
      { adapterId: "youtube_ytdlp", method: "youtube_search", observedAt, queryId: qid },
      { adapterId: "youtube_ytdlp", method: "youtube_metadata", observedAt },
    ],
    limitations: ["Controlled public video fixture."],
  }));
  const collection = withId({
    schemaVersion: "1.0",
    artifactKind: "video_collection.v1",
    requestId,
    videoSourcePlanArtifactId: plan.artifactId,
    videos,
    summary: {
      searchCandidates: 2,
      videosAccepted: 2,
      duplicatesRemoved: 0,
      metadataDetailsFetched: 2,
      videosWithHumanSubtitles: 0,
      videosWithAutomaticCaptions: 2,
      videosWithKnownViews: 0,
      videosWithKnownLikes: 0,
    },
    warnings: [],
    limitations: ["Controlled public video collection."],
  });

  const transcripts = videoIds.map((videoId, index) => ({
    schemaVersion: "1.0",
    artifactKind: "transcript.v1",
    artifactId: transcriptIds[index],
    requestId,
    sourceAdapterId: "youtube_ytdlp",
    sourceNativeId: videoId,
    mediaUrl: `https://www.youtube.com/watch?v=${videoId}`,
    title: videos[index].title,
    language: "en",
    autoGenerated: true,
    durationSeconds: 120,
    segments: [
      {
        segmentId: segmentIds[index],
        sequence: 0,
        startSeconds: 0,
        endSeconds: 10,
        text: transcriptTexts[index],
        contentHash: sha256(transcriptTexts[index]),
      },
    ],
    trustClassification: "untrusted_public_content",
    limitations: ["Automatic transcript may contain transcription errors."],
  }));
  const transcriptEntries = transcripts.map((transcript, index) => ({
    videoId: videoIds[index],
    transcriptArtifactId: transcript.artifactId,
    contentDigest: digest(transcript),
    relativeArtifactPath: `video/transcripts/${transcript.artifactId}.transcript.v1.json`,
    subtitleSource: "automatic",
    language: "en",
    segmentCount: 1,
    characterCount: transcriptTexts[index].length,
    durationCoverage: 10 / 120,
    truncated: false,
    limitations: ["Controlled automatic transcript fixture."],
  }));
  const transcriptManifest = withId({
    schemaVersion: "1.0",
    artifactKind: "transcript_manifest.v1",
    requestId,
    videoCollectionArtifactId: collection.artifactId,
    entries: transcriptEntries,
    summary: { transcripts: 2, human: 0, automatic: 2, unavailable: 0 },
    limitations: ["Controlled transcript manifest."],
  });

  const commentCollections = videoIds.map((videoId, index) =>
    withId({
      schemaVersion: "1.0",
      artifactKind: "video_comment_collection.v1",
      requestId,
      videoId,
      videoUrl: `https://www.youtube.com/watch?v=${videoId}`,
      comments: [
        {
          commentId: commentIds[index],
          sourceNativeId: `native_comment_${index + 1}`,
          author: {
            displayName: `Controlled commenter ${index + 1}`,
            handle: `@fixture${index + 1}`,
          },
          body: commentBodies[index],
          likeCount: 2 + index,
          createdAt: `2026-08-0${index + 2}T08:00:00.000Z`,
          sourceUrl: `https://www.youtube.com/watch?v=${videoId}&lc=native_comment_${index + 1}`,
          sequence: 0,
          trustClassification: "untrusted_public_content",
          limitations: ["Comment author identity is attribution only."],
        },
      ],
      summary: { commentsCollected: 1, truncated: false },
      limitations: ["Controlled public comment collection."],
    }),
  );
  const commentEntries = commentCollections.map((comments, index) => ({
    videoId: videoIds[index],
    commentCollectionArtifactId: comments.artifactId,
    contentDigest: digest(comments),
    relativeArtifactPath: `video/comments/${comments.artifactId}.video_comment_collection.v1.json`,
    commentsCollected: 1,
    truncated: false,
  }));
  const commentManifest = withId({
    schemaVersion: "1.0",
    artifactKind: "video_comment_manifest.v1",
    requestId,
    videoCollectionArtifactId: collection.artifactId,
    entries: commentEntries,
    summary: { videosAttempted: 2, videosWithComments: 2, commentsCollected: 2 },
    limitations: ["Controlled public comment manifest."],
  });

  const ruleId = "controlled_video_workflow_friction";
  const signal = {
    signalId: videoSignalId(
      requestId,
      "workflow_friction",
      ruleId,
      videoIds,
      segmentIds,
      commentIds,
    ),
    type: "workflow_friction",
    supportingVideoIds: videoIds,
    supportingTranscriptSegmentIds: segmentIds,
    supportingCommentIds: commentIds,
    independentVideoCount: 2,
    independentChannelCount: 2,
    observedFacts: [
      "Two public videos from separate channels describe Fixture Frame Studio workflow friction.",
      "Two public comments describe manual workaround or migration friction.",
    ],
    inference: "Repeated public video evidence cautiously suggests workflow friction may exist.",
    confidence: 0.9,
    missionRelevance: {
      relevant: true,
      score: 0.95,
      matchedConcepts: ["Fixture Frame Studio", "workflow", "migration"],
    },
    ruleId,
    ruleVersion: "c1-j4.video-signals.v1",
    limitations: [
      "Public video evidence does not establish buyer identity, budget, authority, purchase intent, or representative demand.",
    ],
  };
  const signals = withId({
    schemaVersion: "1.0",
    artifactKind: "video_signals.v1",
    requestId,
    videoCollectionArtifactId: collection.artifactId,
    transcriptManifestArtifactId: transcriptManifest.artifactId,
    videoCommentManifestArtifactId: commentManifest.artifactId,
    rulesVersion: "c1-j4.video-signals.v1",
    signals: [signal],
    summary: {
      videosAnalyzed: 2,
      transcriptsAnalyzed: 2,
      commentsAnalyzed: 2,
      signalsGenerated: 1,
    },
    warnings: [],
    limitations: ["Controlled deterministic video signal fixture."],
  });
  const telemetry = withId({
    schemaVersion: "1.0",
    artifactKind: "video_source_run_telemetry.v1",
    requestId,
    observedAt,
    ytDlpVersion: "controlled-fixture",
    queries: 1,
    searchProcessStarts: 1,
    metadataProcessStarts: 2,
    subtitleAttempts: 2,
    humanTranscripts: 0,
    automaticTranscripts: 2,
    noTranscriptVideos: 0,
    commentAttempts: 2,
    commentsAccepted: 2,
    timeouts: 0,
    rateLimits: mode === "video-rate-limited" ? 1 : 0,
    challenges: 0,
    signals: 1,
    processFailures: 0,
    paidRequests: 0,
    paidCredits: 0,
    limitations: [
      ...(mode === "video-rate-limited"
        ? ["A controlled rate-limit event preserved accepted evidence."]
        : []),
      "Controlled public video telemetry.",
    ],
  });

  const planPath = companion(input.outputPath, "video-source-plan.v1.json");
  const collectionPath = companion(input.outputPath, "video-collection.v1.json");
  const transcriptManifestPath = companion(input.outputPath, "transcript-manifest.v1.json");
  const commentManifestPath = companion(input.outputPath, "video-comment-manifest.v1.json");
  const signalsPath = companion(input.outputPath, "video-signals.v1.json");
  const telemetryPath = companion(input.outputPath, "video-source-run-telemetry.v1.json");
  await writeControlled(planPath, plan, mode, "video-plan");
  await writeControlled(collectionPath, collection, mode, "video-collection");
  await writeControlled(
    transcriptManifestPath,
    transcriptManifest,
    mode,
    "video-transcript-manifest",
  );
  await writeControlled(commentManifestPath, commentManifest, mode, "video-comment-manifest");
  await writeControlled(signalsPath, signals, mode, "video-signals");
  await writeControlled(telemetryPath, telemetry, mode, "video-telemetry");

  const exchangeDirectory = dirname(input.outputPath);
  if (!missing(mode, "video-transcript-manifest") && !invalid(mode, "video-transcript-manifest")) {
    for (const [index, transcript] of transcripts.entries()) {
      const entry = transcriptEntries[index];
      await writeJson(resolve(exchangeDirectory, entry.relativeArtifactPath), transcript);
    }
  }
  if (!missing(mode, "video-comment-manifest") && !invalid(mode, "video-comment-manifest")) {
    for (const [index, comments] of commentCollections.entries()) {
      const entry = commentEntries[index];
      await writeJson(resolve(exchangeDirectory, entry.relativeArtifactPath), comments);
    }
  }
}

export async function writeControlledSpecializedSidecars(input) {
  if (
    input.sourceAdapterMode !== "selected_sources" ||
    !input.sourceFamilies.includes("specialized")
  )
    return;
  const mode = input.behavior.mode;
  const requestId = input.searchResults.requestId;
  const observedAt = "2026-08-10T08:00:00.000Z";
  const context = withId({
    schemaVersion: "1.0",
    artifactKind: "specialized_source_context.v1",
    requestId,
    industries: [{ industryId: "human_resources", label: "Human resources", confidence: 0.95 }],
    subIndustries: [],
    geographies: [{ type: "country", code: "GB", label: "United Kingdom", confidence: 0.95 }],
    desiredSignals: [
      {
        signalType: "regulation_change",
        importance: 0.95,
        concepts: ["Fixture Frame Studio", "employment", "workflow"],
      },
    ],
    entityHints: [{ type: "company", name: "Fixture Frame Studio" }],
    languagePreferences: ["en"],
    derivation: {
      sourceArtifactKind: "discovery_request.v1",
      sourceRequestId: requestId,
      rulesVersion: "c1-j5.specialized-context.v1",
    },
    limitations: ["Controlled deterministic specialized context."],
  });
  const candidates = withId({
    schemaVersion: "1.0",
    artifactKind: "specialized_source_candidates.v1",
    requestId,
    specializedSourceContextArtifactId: context.artifactId,
    candidates: [],
    summary: {
      searchResultsEvaluated: 0,
      uniqueDomains: 0,
      candidatesAccepted: 0,
      candidatesRejected: 0,
    },
    warnings: [],
  });
  const registryDigest = sha256("controlled-specialized-registry");
  const coverage = {
    overallScore: 1,
    level: "high",
    signalCoverage: [
      {
        signalType: "regulation_change",
        score: 1,
        selectedSourceCount: 2,
        sourceTypeDiversity: 2,
        gaps: [],
      },
    ],
    geographyCoverage: 1,
    industryCoverage: 1,
    limitations: ["Controlled bounded coverage score."],
  };
  const knownSources = [
    {
      selectionId: "specialized_selection_gov_uk",
      sourceId: "gov_uk",
      domain: "gov.uk",
      registered: true,
      sourceType: "government",
      authorityClass: "official_primary",
      score: 0.98,
      matchedIndustries: ["human_resources"],
      matchedGeographies: ["GB"],
      matchedSignals: ["regulation_change"],
      selectedRoute: { route: "generic_page_extraction" },
      selectionReasons: ["Controlled official source."],
      limitations: ["Fixture source selection."],
    },
    {
      selectionId: "specialized_selection_acas",
      sourceId: "acas_public",
      domain: "acas.org.uk",
      registered: true,
      sourceType: "professional_body",
      authorityClass: "industry_body",
      score: 0.94,
      matchedIndustries: ["human_resources"],
      matchedGeographies: ["GB"],
      matchedSignals: ["regulation_change"],
      selectedRoute: { route: "generic_page_extraction" },
      selectionReasons: ["Controlled independent specialist source."],
      limitations: ["Fixture source selection."],
    },
  ];
  const plan = withId({
    schemaVersion: "1.0",
    artifactKind: "specialized_source_plan.v1",
    requestId,
    sourceFamily: "specialized",
    contextArtifactId: context.artifactId,
    registryVersion: "c1-j5.0",
    registryDigest,
    selectedPacks: [],
    desiredSignals: ["regulation_change"],
    knownSources,
    coverageBeforeDiscovery: coverage,
    dynamicDiscoveryTriggered: false,
    discoveryQueries: [],
    selectedDynamicSources: [],
    coverageAfterDiscovery: coverage,
    policy: {
      mode: "known_only",
      maximumPacks: 3,
      maximumDiscoveryQueries: 4,
      maximumCandidates: 20,
      maximumSelectedSources: 10,
    },
    warnings: [],
  });
  const findingInputs = [
    {
      sourceId: "gov_uk",
      sourceDomain: "gov.uk",
      sourceType: "government",
      authorityClass: "official_primary",
      findingType: "regulatory_update",
      sourceNativeId: "controlled-guidance-1",
      title: "Controlled employment guidance affecting Fixture Frame Studio workflows",
      summary:
        "Official public guidance describes a compliance workflow change relevant to Fixture Frame Studio.",
      url: "https://www.gov.uk/example-guidance",
    },
    {
      sourceId: "acas_public",
      sourceDomain: "acas.org.uk",
      sourceType: "professional_body",
      authorityClass: "industry_body",
      findingType: "guidance",
      sourceNativeId: "controlled-guidance-2",
      title: "Independent guidance on the same Fixture Frame Studio workflow change",
      summary: "A separate public specialist source describes the same employment workflow change.",
      url: "https://www.acas.org.uk/example-guidance",
    },
  ];
  const findingRecords = findingInputs.map((finding) => ({
    findingId: specializedFindingId(
      requestId,
      finding.sourceDomain,
      finding.sourceNativeId,
      finding.url,
      finding.title,
    ),
    sourceId: finding.sourceId,
    sourceDomain: finding.sourceDomain,
    sourceType: finding.sourceType,
    authorityClass: finding.authorityClass,
    route: "generic_page_extraction",
    findingType: finding.findingType,
    sourceNativeId: finding.sourceNativeId,
    title: finding.title,
    summary: finding.summary,
    url: finding.url,
    publishedAt: "2026-08-09T08:00:00.000Z",
    organizationNames: ["Fixture Frame Studio"],
    categories: ["employment", "workflow"],
    relatedUrls: [],
    relevance: 0.95,
    sourceConfidence: 0.95,
    trustClassification: "untrusted_public_content",
    provenance: [{ sourceMethod: "generic_page_extraction", observedAt }],
    limitations: ["Controlled public specialized-source finding."],
  }));
  const findings = withId({
    schemaVersion: "1.0",
    artifactKind: "specialized_findings.v1",
    requestId,
    specializedSourcePlanArtifactId: plan.artifactId,
    findings: findingRecords,
    summary: {
      sourcesAttempted: 2,
      sourcesSuccessful: 2,
      sourcesPartial: 0,
      sourcesFailed: 0,
      dedicatedAdapterFindings: 0,
      genericSearchFindings: 0,
      feedFindings: 0,
      pageFindings: 2,
      findingsAccepted: 2,
      duplicatesRemoved: 0,
    },
    limitations: ["Controlled bounded specialized findings."],
    warnings: [],
  });
  const ruleId = "controlled_specialized_regulatory_change";
  const signal = {
    signalId: specializedSignalId(
      requestId,
      "regulatory_change",
      ruleId,
      findingRecords.map((finding) => finding.findingId),
    ),
    type: "regulatory_change",
    supportingFindingIds: findingRecords.map((finding) => finding.findingId),
    independentSourceCount: 2,
    observedFacts: ["Two independent public sources describe the same relevant workflow change."],
    inference:
      "A regulatory workflow change may create a timely operational problem to investigate.",
    confidence: 0.9,
    missionRelevance: {
      relevant: true,
      score: 0.95,
      matchedConcepts: ["Fixture Frame Studio", "workflow", "employment"],
    },
    ruleId,
    ruleVersion: "c1-j5.specialized-signals.v1",
    limitations: [
      "Specialized-source evidence does not establish buyer identity, budget, authority, purchase intent, or representative market demand.",
    ],
  };
  const signals = withId({
    schemaVersion: "1.0",
    artifactKind: "specialized_signals.v1",
    requestId,
    specializedFindingsArtifactId: findings.artifactId,
    rulesVersion: "c1-j5.specialized-signals.v1",
    signals: [signal],
    summary: {
      findingsAnalyzed: 2,
      signalsGenerated: 1,
      sourceTypesRepresented: 2,
      independentSourcesRepresented: 2,
    },
    warnings: [],
    limitations: ["Controlled deterministic specialized signal fixture."],
  });
  const telemetry = withId({
    schemaVersion: "1.0",
    artifactKind: "specialized_source_run_telemetry.v1",
    requestId,
    observedAt,
    knownPacksEvaluated: 1,
    packsSelected: 0,
    coverageBefore: 1,
    dynamicDiscoveryTriggered: false,
    sourceDiscoveryQueries: 0,
    candidateDomains: 0,
    selectedRegisteredSources: 2,
    selectedDynamicSources: 0,
    registeredSourceAttempts: 2,
    dynamicSourceAttempts: 0,
    genericSiteSearchRequests: 0,
    feedRequests: 0,
    pageExtractionAttempts: 2,
    dedicatedAdapterAttempts: 0,
    arxivRequests: 0,
    arxivPdfDrills: 0,
    techmemeAttempts: 0,
    diggProcessStarts: 0,
    findings: 2,
    signals: 1,
    sourceFailures: mode === "specialized-degraded" ? 1 : 0,
    coverageAfter: 1,
    paidRequests: 0,
    paidCredits: 0,
    warnings:
      mode === "specialized-degraded" ? ["One controlled source attempt degraded safely."] : [],
  });

  await writeControlled(
    companion(input.outputPath, "specialized-source-context.v1.json"),
    context,
    mode,
    "specialized-context",
  );
  await writeControlled(
    companion(input.outputPath, "specialized-source-candidates.v1.json"),
    candidates,
    mode,
    "specialized-candidates",
  );
  await writeControlled(
    companion(input.outputPath, "specialized-source-plan.v1.json"),
    plan,
    mode,
    "specialized-plan",
  );
  await writeControlled(
    companion(input.outputPath, "specialized-findings.v1.json"),
    findings,
    mode,
    "specialized-findings",
  );
  await writeControlled(
    companion(input.outputPath, "specialized-signals.v1.json"),
    signals,
    mode,
    "specialized-signals",
  );
  await writeControlled(
    companion(input.outputPath, "specialized-source-run-telemetry.v1.json"),
    telemetry,
    mode,
    "specialized-telemetry",
  );
}
