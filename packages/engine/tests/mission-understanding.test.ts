import {
  MissionInputSchemaV1,
  MissionUnderstandingArtifactV1Schema,
  type MissionInputV1,
} from "@cluvvi/core";
import { describe, expect, it } from "vitest";
import { generateMissionUnderstandingArtifactV1 } from "../src/mission-understanding";

function mission(description: string, overrides: Partial<MissionInputV1> = {}): MissionInputV1 {
  return MissionInputSchemaV1.parse({
    schemaVersion: "1.0",
    name: "Mission understanding test",
    description,
    geographies: ["Global"],
    desiredOpportunities: 20,
    exclusions: [],
    goodCustomerExamples: [],
    badCustomerExamples: [],
    ...overrides,
  });
}

function normalizedQueries(artifact: ReturnType<typeof generateMissionUnderstandingArtifactV1>) {
  return artifact.searchQueries.map((entry) => entry.query.trim().toLowerCase());
}

describe("generateMissionUnderstandingArtifactV1", () => {
  it("understands an AI video-editing mission and produces a deduped search plan", () => {
    const artifact = generateMissionUnderstandingArtifactV1(
      mission(
        "AI-assisted video-editing software that creates rough cuts for long-form talking-head YouTube videos and podcasts.",
      ),
    );

    expect(artifact.productUnderstanding.productCategory.toLowerCase()).toMatch(/video|editing/);
    expect(artifact.buyerHypotheses.map((buyer) => buyer.label.toLowerCase()).join(" ")).toMatch(
      /podcast agencies|youtube production agencies|content teams|creator-led media/,
    );
    expect(artifact.painKeywords.join(" ").toLowerCase()).toMatch(
      /editing turnaround|rough cuts|video editing backlog|podcast production/,
    );
    expect(artifact.searchQueries.length).toBeGreaterThanOrEqual(25);
    expect(artifact.sourcePlan.map((entry) => entry.sourceType)).toEqual(
      expect.arrayContaining(["reddit", "job_posts", "search_web", "company_websites"]),
    );
    expect(new Set(normalizedQueries(artifact)).size).toBe(artifact.searchQueries.length);
  });

  it("understands an AI sales and GTM mission", () => {
    const artifact = generateMissionUnderstandingArtifactV1(
      mission(
        "AI tool that finds high-intent leads and helps B2B SaaS teams start warm outbound conversations.",
      ),
    );

    expect(artifact.productUnderstanding.productCategory.toLowerCase()).toMatch(/sales|gtm/);
    expect(artifact.buyerHypotheses.map((buyer) => buyer.label.toLowerCase()).join(" ")).toMatch(
      /b2b saas founders|small sales teams/,
    );
    expect(artifact.painKeywords.join(" ").toLowerCase()).toMatch(
      /lead generation|warm leads|outbound|booked demos|sales pipeline/,
    );
    expect(artifact.competitorOrWorkaroundKeywords).toEqual(
      expect.arrayContaining(["Apollo", "Clay", "spreadsheets"]),
    );
    expect(artifact.searchQueries.length).toBeGreaterThanOrEqual(25);
  });

  it("falls back safely for an unknown workflow", () => {
    const artifact = generateMissionUnderstandingArtifactV1(
      mission(
        "Software that helps companies organize complex internal work and reduce manual process delays.",
      ),
    );

    expect(artifact.productUnderstanding.productCategory).toBe("B2B software or service");
    expect(artifact.buyerHypotheses.length).toBeGreaterThanOrEqual(3);
    expect(artifact.painKeywords.length).toBeGreaterThanOrEqual(5);
    expect(artifact.searchQueries.length).toBeGreaterThanOrEqual(25);
  });

  it("carries exclusions into the artifact without targeting excluded segments", () => {
    const artifact = generateMissionUnderstandingArtifactV1(
      mission(
        "AI-assisted video editing software for professional long-form content production teams.",
        {
          exclusions: ["hobby creators", "inactive channels"],
          badCustomerExamples: ["short-form-only creators"],
        },
      ),
    );

    expect(artifact.exclusionKeywords).toEqual(
      expect.arrayContaining(["hobby creators", "inactive channels", "short-form-only creators"]),
    );
    const excludedQueryCount = normalizedQueries(artifact).filter(
      (query) => query.includes("hobby creators") || query.includes("inactive channels"),
    ).length;
    expect(excludedQueryCount).toBe(0);
  });

  it("always returns an artifact that passes the canonical schema", () => {
    const artifact = generateMissionUnderstandingArtifactV1(
      mission(
        "Customer support software that reduces repetitive helpdesk tickets for B2B SaaS teams.",
      ),
    );

    expect(MissionUnderstandingArtifactV1Schema.safeParse(artifact).success).toBe(true);
    expect(artifact.artifactKind).toBe("mission_understanding.v1");
    expect(artifact.searchQueries.every((entry) => entry.query === entry.query.trim())).toBe(true);
  });
});
