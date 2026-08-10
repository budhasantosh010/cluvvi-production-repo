import {
  EvidenceFindingsArtifactV1Schema,
  RankedOpportunitiesArtifactV1Schema,
  TranscriptManifestArtifactV1Schema,
  VideoCollectionArtifactV1Schema,
  VideoCommentManifestArtifactV1Schema,
  VideoSignalsArtifactV1Schema,
  VideoSourcePlanArtifactV1Schema,
  VideoSourceRunTelemetryArtifactV1Schema,
  type ArtifactRecord,
  type CluvviSourceAdapterMode,
  type CluvviSourceFamily,
} from "@cluvvi/core";

interface VideoIntelligenceViewProps {
  artifacts: ArtifactRecord[];
  sourceAdapterMode: CluvviSourceAdapterMode;
  sourceFamilies: CluvviSourceFamily[];
  youtubeDepth: "quick" | "default" | "deep";
  videoSignalRuleVersion: string;
  runStatus: string;
  failureCode?: string;
}

function number(value: number): string {
  return new Intl.NumberFormat("en-US").format(value);
}

export function VideoIntelligenceView({
  artifacts,
  sourceAdapterMode,
  sourceFamilies,
  youtubeDepth,
  videoSignalRuleVersion,
  runStatus,
  failureCode,
}: VideoIntelligenceViewProps) {
  if (sourceAdapterMode === "none" || !sourceFamilies.includes("video")) return null;

  const byType = (type: ArtifactRecord["artifactType"]) =>
    artifacts.find((artifact) => artifact.artifactType === type);
  const planRecord = byType("video_source_plan");
  const collectionRecord = byType("video_collection");
  const transcriptRecord = byType("transcript_manifest");
  const commentRecord = byType("video_comment_manifest");
  const signalsRecord = byType("video_signals");
  const telemetryRecord = byType("video_source_telemetry");
  const evidenceRecord = byType("evidence_findings");
  const rankingRecord = byType("ranked_opportunities");

  const plan =
    planRecord === undefined ? null : VideoSourcePlanArtifactV1Schema.parse(planRecord.data);
  const collection =
    collectionRecord === undefined
      ? null
      : VideoCollectionArtifactV1Schema.parse(collectionRecord.data);
  const transcriptManifest =
    transcriptRecord === undefined
      ? null
      : TranscriptManifestArtifactV1Schema.parse(transcriptRecord.data);
  const commentManifest =
    commentRecord === undefined
      ? null
      : VideoCommentManifestArtifactV1Schema.parse(commentRecord.data);
  const signals =
    signalsRecord === undefined ? null : VideoSignalsArtifactV1Schema.parse(signalsRecord.data);
  const telemetry =
    telemetryRecord === undefined
      ? null
      : VideoSourceRunTelemetryArtifactV1Schema.parse(telemetryRecord.data);
  const evidence =
    evidenceRecord === undefined
      ? null
      : EvidenceFindingsArtifactV1Schema.parse(evidenceRecord.data);
  const ranking =
    rankingRecord === undefined
      ? null
      : RankedOpportunitiesArtifactV1Schema.parse(rankingRecord.data);

  if (
    plan === null ||
    collection === null ||
    transcriptManifest === null ||
    commentManifest === null ||
    signals === null ||
    telemetry === null
  ) {
    const failed = runStatus === "failed" && /VIDEO|YOUTUBE|TRANSCRIPT/iu.test(failureCode ?? "");
    return (
      <section
        className={`rounded-3xl border p-6 sm:p-8 ${failed ? "border-rose-200 bg-rose-50" : "border-neutral-200 bg-neutral-50"}`}
        data-testid={failed ? "video-intelligence-failure" : "video-intelligence-running"}
      >
        <p className={`eyebrow ${failed ? "text-rose-700" : "text-neutral-500"}`}>
          C1-J.4 YouTube video intelligence
        </p>
        <h2
          className={`mt-2 text-xl font-semibold ${failed ? "text-rose-950" : "text-neutral-950"}`}
        >
          {failed
            ? "Video artifacts were rejected at a durable boundary"
            : "Collecting bounded public YouTube evidence"}
        </h2>
        <p
          className={`mt-3 max-w-3xl text-sm leading-6 ${failed ? "text-rose-900" : "text-neutral-600"}`}
        >
          {failed
            ? `Earlier completed stages remain reusable. Repair the rejected video sidecar and resume the same run. Failure: ${failureCode}.`
            : `Depth ${youtubeDepth}. Metadata, subtitle text, selected public comments, and deterministic signals only; no media download, cookies, authentication, or challenge bypass.`}
        </p>
      </section>
    );
  }

  const videoMaterials =
    evidence?.materials.filter((material) =>
      ["youtube_video", "youtube_transcript_segment", "youtube_comment", "video_signal"].includes(
        material.kind,
      ),
    ) ?? [];
  const transcriptPreviews =
    evidence?.materials
      .filter((material) => material.kind === "youtube_transcript_segment")
      .slice(0, 6) ?? [];
  const commentPreviews =
    evidence?.materials.filter((material) => material.kind === "youtube_comment").slice(0, 6) ?? [];
  const appliedContribution =
    ranking?.opportunities.filter((opportunity) => opportunity.videoContribution.applied).length ??
    0;

  return (
    <section className="surface-card overflow-hidden" data-testid="video-intelligence-view">
      <div className="border-b border-neutral-200 bg-neutral-50/70 px-6 py-5 sm:px-8">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="eyebrow">C1-J.4 YouTube video intelligence</p>
            <h2 className="mt-2 text-xl font-semibold text-neutral-950">
              Public video metadata, transcripts, selected comments, and cautious signals
            </h2>
            <p className="mt-2 max-w-4xl text-sm leading-6 text-neutral-600">
              Video content is untrusted public evidence. Creators, channels, handles, and
              commenters remain source attribution only and cannot become buyer/contact identity. No
              media is downloaded and no cookies, login, proxy, or challenge bypass is used.
            </p>
          </div>
          <span className="fixture-badge">YouTube · {plan.policy.depth} · zero paid</span>
        </div>
      </div>

      <dl className="grid gap-3 border-b border-neutral-200 p-5 sm:grid-cols-2 xl:grid-cols-8 sm:p-7">
        {[
          ["Queries", plan.summary.queriesSelected],
          ["Videos", collection.videos.length],
          ["Human subs", transcriptManifest.summary.human],
          ["Auto subs", transcriptManifest.summary.automatic],
          ["Comments", commentManifest.summary.commentsCollected],
          ["Signals", signals.signals.length],
          ["Challenges", telemetry.challenges],
          ["Paid", telemetry.paidCredits],
        ].map(([label, value]) => (
          <div className="rounded-2xl border border-neutral-200 bg-white p-4" key={label}>
            <dt className="text-xs font-medium uppercase tracking-wide text-neutral-500">
              {label}
            </dt>
            <dd className="mt-2 text-xl font-semibold text-neutral-950">{number(Number(value))}</dd>
          </div>
        ))}
      </dl>

      <div className="border-b border-neutral-200 p-5 sm:p-7">
        <p className="eyebrow">Selected public videos</p>
        <div className="mt-3 grid gap-3 lg:grid-cols-2" data-testid="video-card-list">
          {collection.videos.length === 0 ? (
            <p className="text-sm text-neutral-600">
              No public video passed the bounded relevance checks.
            </p>
          ) : (
            collection.videos.map((video) => (
              <article
                className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4"
                data-testid="video-card"
                key={video.videoId}
              >
                <div className="flex flex-wrap gap-2">
                  <span className="fixture-badge">relevance {video.relevance.toFixed(2)}</span>
                  {video.selectedForTranscript && <span className="fixture-badge">transcript</span>}
                  {video.selectedForComments && <span className="fixture-badge">comments</span>}
                  <span className="fixture-badge">{video.availability}</span>
                </div>
                <h3 className="mt-3 text-sm font-semibold text-neutral-950">{video.title}</h3>
                <p className="mt-2 text-xs text-neutral-500">
                  {video.channel?.name ?? "channel unknown"} · {video.subtitles.length} subtitle
                  track(s)
                </p>
              </article>
            ))
          )}
        </div>
      </div>

      <div className="grid gap-5 border-b border-neutral-200 p-5 sm:p-7 lg:grid-cols-2">
        <article
          className="rounded-3xl border border-neutral-200 bg-neutral-50 p-5"
          data-testid="video-transcript-previews"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="eyebrow">Transcript previews</p>
            <span className="fixture-badge">
              {transcriptManifest.summary.human > 0 ? "human preferred" : "automatic fallback"}
            </span>
          </div>
          <div className="mt-3 grid gap-3">
            {transcriptPreviews.length === 0 ? (
              <p className="text-sm text-neutral-600">
                No transcript segment crossed into downstream evidence.
              </p>
            ) : (
              transcriptPreviews.map((material) => (
                <div
                  className="rounded-2xl border border-neutral-200 bg-white p-4"
                  key={material.id}
                >
                  <p className="line-clamp-4 text-sm leading-6 text-neutral-800">
                    {material.content}
                  </p>
                  <p className="mt-2 text-xs text-neutral-500">
                    untrusted public transcript · provenance retained
                  </p>
                </div>
              ))
            )}
          </div>
        </article>

        <article
          className="rounded-3xl border border-neutral-200 bg-neutral-50 p-5"
          data-testid="video-comment-previews"
        >
          <p className="eyebrow">Selected public comment previews</p>
          <div className="mt-3 grid gap-3">
            {commentPreviews.length === 0 ? (
              <p className="text-sm text-neutral-600">
                No selected comment crossed into downstream evidence.
              </p>
            ) : (
              commentPreviews.map((material) => (
                <div
                  className="rounded-2xl border border-neutral-200 bg-white p-4"
                  key={material.id}
                >
                  <p className="line-clamp-4 text-sm leading-6 text-neutral-800">
                    {material.content}
                  </p>
                  <p className="mt-2 text-xs text-neutral-500">
                    commenter identity unused · source attribution only
                  </p>
                </div>
              ))
            )}
          </div>
        </article>
      </div>

      <div className="border-b border-neutral-200 p-5 sm:p-7">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="eyebrow">Deterministic video signals</p>
          <span className="fixture-badge">{videoSignalRuleVersion}</span>
        </div>
        <div className="mt-3 grid gap-3">
          {signals.signals.length === 0 ? (
            <p className="text-sm text-neutral-600">
              Zero qualifying video signals is a valid bounded outcome.
            </p>
          ) : (
            signals.signals.map((signal) => (
              <article
                className="rounded-2xl border border-amber-200 bg-amber-50 p-4"
                data-testid="video-signal-card"
                key={signal.signalId}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <strong className="text-sm text-amber-950">
                    {signal.type.replaceAll("_", " ")}
                  </strong>
                  <span className="fixture-badge">
                    {signal.independentVideoCount} independent video(s)
                  </span>
                </div>
                <p className="mt-3 text-sm leading-6 text-amber-950">{signal.inference}</p>
              </article>
            ))
          )}
        </div>
      </div>

      <div className="grid gap-4 border-b border-neutral-200 p-5 sm:p-7 md:grid-cols-3">
        <article className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4">
          <p className="eyebrow">Evidence retained</p>
          <strong className="mt-2 block text-2xl text-neutral-950">
            {number(videoMaterials.length)}
          </strong>
        </article>
        <article className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4">
          <p className="eyebrow">Ranking contribution</p>
          <strong className="mt-2 block text-2xl text-neutral-950">+1 / max</strong>
          <p className="mt-2 text-xs leading-5 text-neutral-500">
            Applied to {number(appliedContribution)} opportunity/opportunities only after
            independent mission-relevant corroboration.
          </p>
        </article>
        <article className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4">
          <p className="eyebrow">Identity boundary</p>
          <strong className="mt-2 block text-lg text-neutral-950">
            Creator/commenter identity unused
          </strong>
        </article>
      </div>

      <div
        className="bg-neutral-950 px-6 py-5 text-sm text-neutral-200 sm:px-8"
        data-testid="video-telemetry"
      >
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-6">
          <p>
            yt-dlp: <strong className="text-white">{telemetry.ytDlpVersion ?? "unknown"}</strong>
          </p>
          <p>
            Search starts: <strong className="text-white">{telemetry.searchProcessStarts}</strong>
          </p>
          <p>
            Metadata starts:{" "}
            <strong className="text-white">{telemetry.metadataProcessStarts}</strong>
          </p>
          <p>
            Rate limits: <strong className="text-white">{telemetry.rateLimits}</strong>
          </p>
          <p>
            Challenges: <strong className="text-white">{telemetry.challenges}</strong>
          </p>
          <p>
            Paid credits: <strong className="text-white">{telemetry.paidCredits}</strong>
          </p>
        </div>
      </div>
    </section>
  );
}
