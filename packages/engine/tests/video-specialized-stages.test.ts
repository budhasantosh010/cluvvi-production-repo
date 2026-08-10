import { describe, expect, it } from "vitest";
import { createDownstreamFixtureStages } from "../src/downstream-stages";

const expected = [
  "video_planning",
  "video_retrieval",
  "video_transcript_retrieval",
  "video_comment_retrieval",
  "video_analysis",
  "video_source_telemetry",
  "specialized_context",
  "specialized_candidate_discovery",
  "specialized_planning",
  "specialized_retrieval",
  "specialized_analysis",
  "specialized_source_telemetry",
] as const;

describe("C1-J.4/J.5 durable downstream stages", () => {
  it("registers the twelve new stages after developer telemetry and before normalization", () => {
    const names = createDownstreamFixtureStages().map((stage) => stage.name);
    const developerIndex = names.indexOf("developer_source_telemetry");
    const normalizationIndex = names.indexOf("normalization");
    expect(names.slice(developerIndex + 1, normalizationIndex)).toEqual(expected);
  });
});
