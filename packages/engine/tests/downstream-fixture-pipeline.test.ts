import {
  BuyerMapArtifactV1Schema,
  EvidenceFindingsArtifactV1Schema,
  IdentityEnrichmentArtifactV1Schema,
  LocalMissionSchema,
  RankedOpportunitiesArtifactV1Schema,
  SearchResultsArtifactV2Schema,
} from "@cluvvi/core";
import { describe, expect, it } from "vitest";
import {
  buildBuyerHypotheses,
  buildBuyerMap,
  buildDiscoveryCandidates,
  buildEvidenceFindings,
  buildIdentityEnrichment,
  buildRankedOpportunities,
  loadProjectACompatibilityFixture,
  loadProjectBPipelineFixture,
} from "../src/index";

const now = "2026-08-01T00:00:00.000Z";
const mission = LocalMissionSchema.parse({
  id: "mission_00000000000000000000000000000000",
  input: {
    schemaVersion: "1.0",
    name: "Video editing SaaS customer discovery",
    description:
      "AI-assisted video editing software that creates rough cuts for long-form talking-head videos.",
    customerOutcome: "Publish long-form videos faster with less manual editing work.",
    geographies: ["global"],
    desiredOpportunities: 20,
    exclusions: [],
    goodCustomerExamples: [],
    badCustomerExamples: [],
  },
  sourceFile: "examples/video-editing-saas.json",
  createdAt: now,
});

function pipeline(rawOverride?: unknown) {
  const searchResults = loadProjectBPipelineFixture();
  if (rawOverride !== undefined) {
    for (const result of searchResults.results) result.raw = rawOverride;
  }
  const candidates = buildDiscoveryCandidates(searchResults, now);
  const evidence = buildEvidenceFindings(candidates, now);
  const buyerHypotheses = buildBuyerHypotheses(evidence, now);
  const identity = buildIdentityEnrichment(buyerHypotheses, now);
  const ranked = buildRankedOpportunities({ identity, evidence, mission, generatedAt: now });
  const buyerMap = buildBuyerMap({
    ranked,
    identity,
    evidence,
    searchResults,
    generatedAt: now,
  });
  return { searchResults, candidates, evidence, buyerHypotheses, identity, ranked, buyerMap };
}

describe("Project B downstream fixture pipeline", () => {
  it("validates and consumes the exact Project A compatibility artifact in Cluvvi", () => {
    const artifact = loadProjectACompatibilityFixture();
    expect(SearchResultsArtifactV2Schema.parse(artifact)).toStrictEqual(artifact);
    expect(artifact.results).toHaveLength(6);
    expect(artifact.artifactKind).toBe("search_results.v2");
    const candidates = buildDiscoveryCandidates(artifact, now);
    const evidence = buildEvidenceFindings(candidates, now);
    expect(evidence.findings.length).toBeGreaterThan(0);
    expect(evidence.findings.some((finding) => finding.positive)).toBe(true);
    expect(evidence.findings.some((finding) => !finding.positive)).toBe(true);
    expect(
      evidence.findings.every((finding) =>
        artifact.results.some((result) => result.id === finding.searchResultId),
      ),
    ).toBe(true);
  });

  it("provides the richer three-entity fixture without altering the Project A artifact", () => {
    const artifact = loadProjectBPipelineFixture();
    const companies = new Set(artifact.results.map((result) => result.authorOrCompany));
    expect(artifact.results).toHaveLength(9);
    expect(companies.size).toBe(3);
    expect(artifact.summary.rawResults - artifact.summary.dedupedResults).toBe(4);
    expect(artifact.coverage.manualReviewRecommended).toHaveLength(1);
    expect(artifact.results.some((result) => result.signalIntent === "negative_evidence")).toBe(
      true,
    );
  });

  it("creates positive and negative findings with complete normalized provenance", () => {
    const { evidence } = pipeline();
    expect(EvidenceFindingsArtifactV1Schema.parse(evidence)).toStrictEqual(evidence);
    expect(evidence.entities).toHaveLength(3);
    expect(evidence.findings.some((finding) => finding.positive)).toBe(true);
    expect(evidence.findings.some((finding) => !finding.positive)).toBe(true);
    expect(evidence.findings.some((finding) => finding.stale)).toBe(true);
    expect(
      evidence.findings.every(
        (finding) =>
          finding.searchResultId === finding.provenance.searchResultId &&
          finding.sourceUrl === finding.provenance.sourceUrl &&
          finding.provenance.query.length > 0 &&
          finding.provenance.providerId.length > 0,
      ),
    ).toBe(true);
  });

  it("creates role hypotheses and public manual routes without fabricated contacts", () => {
    const { identity } = pipeline();
    expect(IdentityEnrichmentArtifactV1Schema.parse(identity)).toStrictEqual(identity);
    expect(identity.hypotheses).toHaveLength(3);
    expect(identity.fabricatedContacts).toBe(false);
    expect(identity.publicManualRoutesOnly).toBe(true);
    expect(
      identity.hypotheses.every(
        (hypothesis) =>
          hypothesis.likelyDecisionMakerTitles.length > 0 &&
          hypothesis.likelyDepartment.length > 0 &&
          hypothesis.manualContactRoute.instructions.includes("Do not") &&
          !("email" in hypothesis) &&
          !("phone" in hypothesis) &&
          !("personName" in hypothesis),
      ),
    ).toBe(true);
  });

  it("uses the exact transparent scorecard and lowers stale or negative opportunities", () => {
    const first = pipeline().ranked;
    const second = pipeline().ranked;
    expect(RankedOpportunitiesArtifactV1Schema.parse(first)).toStrictEqual(first);
    expect(first).toStrictEqual(second);
    expect(first.opportunities).toHaveLength(3);
    expect(
      first.opportunities.every((opportunity) => opportunity.scoreComponents.length === 8),
    ).toBe(true);
    const northstar = first.opportunities.find(
      (opportunity) => opportunity.companyName === "Fixture Northstar Media",
    );
    const frame = first.opportunities.find(
      (opportunity) => opportunity.companyName === "Fixture Frame Studio",
    );
    expect(northstar).toBeDefined();
    expect(frame).toBeDefined();
    expect(northstar?.score).toBeLessThan(frame?.score ?? 0);
    expect(
      northstar?.scoreComponents.find((component) => component.key === "exclusion_conflict")
        ?.points,
    ).toBe(-5);
    expect(
      northstar?.scoreComponents.find((component) => component.key === "weak_or_stale_signal")
        ?.points,
    ).toBe(-3);
  });

  it("builds a Buyer Map with ranked evidence, citations, risks, and coverage gaps", () => {
    const { buyerMap } = pipeline();
    expect(BuyerMapArtifactV1Schema.parse(buyerMap)).toStrictEqual(buyerMap);
    expect(buyerMap.opportunities).toHaveLength(3);
    expect(buyerMap.summary.negativeEvidenceCount).toBeGreaterThan(0);
    expect(buyerMap.coverageGaps).toHaveLength(1);
    expect(buyerMap.opportunities.every((opportunity) => opportunity.evidence.length > 0)).toBe(
      true,
    );
    expect(
      buyerMap.opportunities
        .flatMap((opportunity) => opportunity.evidence)
        .every(
          (citation) =>
            citation.sourceUrl.endsWith(".invalid") || citation.sourceUrl.includes(".invalid/"),
        ),
    ).toBe(true);
  });

  it("does not consume provider-specific raw payloads", () => {
    const baseline = pipeline({ fixture: true, hidden: "first" });
    const mutated = pipeline({ fixture: true, hidden: "completely different" });
    expect(mutated.candidates.entities).toStrictEqual(baseline.candidates.entities);
    expect(mutated.evidence).toStrictEqual(baseline.evidence);
    expect(mutated.identity).toStrictEqual(baseline.identity);
    expect(mutated.ranked).toStrictEqual(baseline.ranked);
    expect(mutated.buyerMap).toStrictEqual(baseline.buyerMap);
  });
});
