import {
  BuyerHypothesisV1Schema,
  BuyerMapArtifactV1Schema,
  BuyerMapCitationV1Schema,
  EvidenceMaterialV1Schema,
  EvidenceSignalTypeSchema,
  RankedOpportunityV1Schema,
} from "@cluvvi/core";
import { describe, expect, it } from "vitest";

const rankingComponents = [
  "clear_pain",
  "recent_signal",
  "related_hiring",
  "competitor_or_workaround",
  "clear_company",
  "decision_maker_route",
  "exclusion_conflict",
  "weak_or_stale_signal",
].map((key) => ({ key, applied: false, points: 0, reason: "Not applied." }));

const manualContactRoute = {
  type: "manual_research" as const,
  label: "Manual public research",
  instructions: "Use public company sources only.",
};

describe("C1-J.4/J.5 downstream contracts", () => {
  it("accepts video and specialized evidence materials with source-specific provenance", () => {
    expect(EvidenceSignalTypeSchema.parse("video_signal")).toBe("video_signal");
    expect(EvidenceSignalTypeSchema.parse("specialized_signal")).toBe("specialized_signal");

    expect(
      EvidenceMaterialV1Schema.parse({
        id: "material_video",
        kind: "youtube_transcript_segment",
        searchResultId: "result_1",
        entityKey: "example.com",
        sourceUrl: "https://www.youtube.com/watch?v=abc123xyz",
        content: "A public transcript segment describing workflow friction.",
        contentHash: "a".repeat(64),
        trustClassification: "untrusted_public_content",
        videoId: "abc123xyz",
        channelId: "channel_1",
        channelName: "Example channel",
        transcriptArtifactId: "transcript_1",
        transcriptSegmentId: "segment_1",
        subtitleSource: "automatic",
        subtitleLanguage: "en",
        videoLocalScore: 0.9,
        limitations: ["Public video evidence is attribution only."],
      }).kind,
    ).toBe("youtube_transcript_segment");

    expect(
      EvidenceMaterialV1Schema.parse({
        id: "material_specialized",
        kind: "specialized_finding",
        searchResultId: "result_1",
        entityKey: "example.com",
        sourceUrl: "https://www.gov.uk/example",
        content: "Official public guidance changed.",
        contentHash: "b".repeat(64),
        trustClassification: "untrusted_public_content",
        specializedFindingId: "finding_1",
        specializedFindingType: "guidance",
        specializedSourceId: "gov_uk",
        sourceDomain: "gov.uk",
        specializedSourceType: "government",
        sourceAuthorityClass: "official_primary",
        specializedRoute: "generic_page_extraction",
        limitations: ["One bounded public source."],
      }).kind,
    ).toBe("specialized_finding");
  });

  it("keeps video creators/comment authors and specialized publishers as attribution rather than buyer identity", () => {
    const hypothesis = BuyerHypothesisV1Schema.parse({
      id: "buyer_1",
      entityKey: "example.com",
      companyName: "Example",
      companyDomain: "example.com",
      likelyDepartment: "Operations",
      likelyDecisionMakerTitles: ["Head of Operations"],
      confidence: "low",
      rationale: "Conservative company-level match only.",
      sourceResultIds: ["result_1"],
      evidenceFindingIds: ["finding_1"],
      videoIdentityEvidence: {
        observedVideoFindingIds: ["finding_video"],
        observedTranscriptFindingIds: ["finding_transcript"],
        observedCommentFindingIds: ["finding_comment"],
        inferredSignalFindingIds: ["finding_video_signal"],
        confidence: "low",
        conservativeMatch: true,
        creatorIdentityUsed: false,
        commentAuthorIdentityUsed: false,
        limitations: ["Channel and commenter names are source attribution only."],
      },
      specializedIdentityEvidence: {
        observedFindingIds: ["finding_specialized"],
        inferredSignalFindingIds: ["finding_specialized_signal"],
        observedSourceDomains: ["gov.uk"],
        confidence: "low",
        conservativeMatch: true,
        publisherIdentityUsed: false,
        limitations: ["Publisher/source identity is attribution only."],
      },
    });
    expect(hypothesis.videoIdentityEvidence?.creatorIdentityUsed).toBe(false);
    expect(hypothesis.videoIdentityEvidence?.commentAuthorIdentityUsed).toBe(false);
    expect(hypothesis.specializedIdentityEvidence?.publisherIdentityUsed).toBe(false);
  });

  it("gives video and specialized their own independently capped +1 ranking contributions", () => {
    const opportunity = RankedOpportunityV1Schema.parse({
      id: "opportunity_1",
      rank: 1,
      entityKey: "example.com",
      companyName: "Example",
      companyDomain: "example.com",
      score: 22,
      confidence: "low",
      scoreComponents: rankingComponents,
      communityContribution: {
        applied: false,
        points: 0,
        maximumShareOfPositiveScore: 0.08,
        rationale: "No qualifying community support.",
        independentThreadCount: 0,
      },
      developerContribution: {
        applied: false,
        points: 0,
        maximumShareOfPositiveScore: 0.08,
        rationale: "No qualifying developer support.",
        independentRepositoryCount: 0,
        independentThreadCount: 0,
      },
      videoContribution: {
        applied: true,
        points: 1,
        maximumShareOfPositiveScore: 0.08,
        rationale: "Two independent videos from two channels support the same cautious signal.",
        independentVideoCount: 2,
        independentChannelCount: 2,
      },
      specializedContribution: {
        applied: true,
        points: 1,
        maximumShareOfPositiveScore: 0.08,
        rationale: "Two independent specialist sources support the same cautious signal.",
        independentSourceCount: 2,
      },
      hiringContribution: {
        applied: false,
        points: 0,
        maximumShareOfPositiveScore: 0.08,
        rationale: "No qualifying hiring support.",
      },
      evidenceSummary: "Bounded multi-source public evidence.",
      positiveEvidenceFindingIds: ["finding_1"],
      negativeEvidenceFindingIds: [],
      identityHypothesisId: "buyer_1",
      manualContactRoute,
      risks: [],
      limitations: ["Score is prioritization, not purchase probability."],
    });
    expect(opportunity.videoContribution.points).toBe(1);
    expect(opportunity.specializedContribution.points).toBe(1);
    expect(() =>
      RankedOpportunityV1Schema.parse({
        ...opportunity,
        videoContribution: { ...opportunity.videoContribution, points: 2 },
      }),
    ).toThrow();
  });

  it("carries video and specialized provenance through Buyer Map and counts it explicitly", () => {
    const citation = BuyerMapCitationV1Schema.parse({
      evidenceFindingId: "finding_1",
      searchResultId: "result_1",
      signalType: "specialized_signal",
      positive: true,
      strength: "moderate",
      summary: "Official guidance update.",
      sourceUrl: "https://www.gov.uk/example",
      sourceZone: "news_media",
      discoveredAt: "2026-08-10T00:00:00Z",
      materialId: "material_1",
      materialKind: "specialized_signal",
      specializedSignalId: "specialized_signal_1",
      specializedSignalType: "regulatory_change",
      specializedFindingId: "specialized_finding_1",
      sourceDomain: "gov.uk",
      sourceAuthorityClass: "official_primary",
      independentSourceCount: 2,
      trustClassification: "untrusted_public_content",
    });
    expect(citation.specializedSignalType).toBe("regulatory_change");

    const artifact = BuyerMapArtifactV1Schema.parse({
      schemaVersion: "1.0",
      artifactKind: "buyer_map.v1",
      fixture: true,
      warning: "Fixture warning.",
      generatedAt: "2026-08-10T00:00:00Z",
      summary: {
        rankedOpportunityCount: 0,
        positiveEvidenceCount: 0,
        negativeEvidenceCount: 0,
        coverageGapCount: 0,
        videoCitationCount: 3,
        videoSignalCitationCount: 1,
        specializedFindingCitationCount: 2,
        specializedSignalCitationCount: 1,
      },
      evidenceSourceMode: "snippet_plus_multi_source_intelligence",
      opportunities: [],
      coverageGaps: [],
      confidenceLimitations: [],
      warnings: [],
    });
    expect(artifact.summary.videoCitationCount).toBe(3);
    expect(artifact.summary.specializedFindingCitationCount).toBe(2);
  });
});
