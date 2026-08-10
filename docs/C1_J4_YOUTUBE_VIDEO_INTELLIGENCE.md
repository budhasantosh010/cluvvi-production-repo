# C1-J.4 YouTube Video Intelligence — Project B

## Status

C1-J.4 is implemented on `feature/c1-j4-j5-video-specialized-intelligence` as the opt-in `video` source family consumed across the existing Project A process/file boundary.

Project A is pinned at:

```text
298446dcfa53b2c8c517c28e9d56a0816ed12480
```

Project B does not import Project A source code.

## Boundary

C1-J.4 is public YouTube metadata/text intelligence only. Project A uses the already-installed local `yt-dlp` binary with configuration ignored, cookies disabled, and media download skipped. There is no runtime installation, login, cookies, browser automation, proxy bypass, challenge bypass, audio/video download, private/premium/subscriber-only retrieval, contact enrichment, monitoring, or outreach.

Creator names, channel names/IDs, handles, and comment authors are source attribution only. They never become buyer/contact identity.

## Artifact flow

```text
Mission → discovery_request.v1 → Project A
  → video_source_plan.v1
  → video_collection.v1
  → transcript_manifest.v1 + video/transcripts/*.transcript.v1.json
  → video_comment_manifest.v1 + video/comments/*.video_comment_collection.v1.json
  → video_signals.v1
  → video_source_run_telemetry.v1
  → Project B strict validation
  → Evidence → role-only Identity → separate capped ranking → Buyer Map
```

The frozen `transcript.v1` contract is reused unchanged. YouTube comments use the video-specific companion contract because the frozen universal comment collection is semantically thread-bound.

## Durable stages

1. `video_planning`
2. `video_retrieval`
3. `video_transcript_retrieval`
4. `video_comment_retrieval`
5. `video_analysis`
6. `video_source_telemetry`

Missing or malformed sidecars fail at their exact durable stage. Earlier stages are reusable on same-run repair/resume.

## Project B configuration

```text
CLUVVI_DISCOVERY_MODE=local_discovery_engine
CLUVVI_DISCOVERY_SOURCE_ADAPTER_MODE=selected_sources
CLUVVI_DISCOVERY_SOURCE_FAMILIES=video
CLUVVI_DISCOVERY_YOUTUBE_DEPTH=default
```

Project B forwards only bounded, non-secret YouTube controls. It does not accept or forward cookie files, browser-cookie extraction, account credentials, proxy/bypass controls, arbitrary binaries, or media format/download arguments.

## Validation and evidence

Project B validates request IDs, deterministic artifact IDs/digests, manifest lineage/membership, public YouTube URLs, transcript/comment counts, signal references, telemetry reconciliation, and zero paid usage. Restricted/private/premium/subscriber-only or age-restricted search records may cross only as metadata-only candidates with no transcript/comment selection; any transcript, comment, or supporting signal must resolve to a public, non-age-restricted video. Manifest paths are confined to the run exchange directory.

Imported video materials are `untrusted_public_content`: `youtube_video`, `youtube_transcript_segment`, `youtube_comment`, and `video_signal`. Prompt-like text inside titles, descriptions, subtitles, or comments remains inert source data.

## Ranking and Buyer Map

Normal score components do not silently absorb video evidence. A separate `videoContribution` is capped at exactly `+1` and requires sufficiently relevant, confident, independently corroborated video evidence. Single/weak/ambiguous evidence contributes zero.

Buyer Map preserves video/channel/transcript/comment/signal provenance while keeping creators/commenters out of identity enrichment.

## UI and verification

The run view shows selected videos, subtitle source, transcript previews, selected comments, deterministic signals, yt-dlp/degraded telemetry, zero-paid usage, attribution boundaries, and the +1 cap. The operations page exposes the `video` family and its no-media/no-cookie/no-bypass boundary.

Controlled Project B verification includes all missing/invalid sidecar boundaries and same-run repair/resume. Browser Visual QA covers desktop and 390px mobile layouts with no horizontal overflow.

## Scope stop

C1-J.4 does not start monitoring, outreach, creator/contact enrichment, media downloading, or a later cross-source fusion milestone.
