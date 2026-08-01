import {
  DiscoveryRequestV1Schema,
  LocalMissionSchema,
  MissionInputSchemaV1,
  createOpaqueId,
} from "@cluvvi/core";
import { describe, expect, it } from "vitest";
import { createDiscoveryRequestV1, generateMissionUnderstandingArtifactV1 } from "../src";

function localMission(geographies: string[]) {
  const input = MissionInputSchemaV1.parse({
    schemaVersion: "1.0",
    name: "Video editing customer discovery",
    description:
      "Managed AI video editing software that creates rough cuts for long-form podcast and YouTube teams.",
    customerOutcome: "Publish long-form content faster with less manual editing.",
    geographies,
    desiredOpportunities: 24,
    exclusions: ["full internal team"],
    badCustomerExamples: ["long-term vendor contract"],
  });
  return LocalMissionSchema.parse({
    id: createOpaqueId("mission"),
    input,
    sourceFile: "browser://mission-form",
    createdAt: "2026-08-01T10:00:00.000Z",
  });
}

describe("Mission Understanding to discovery_request.v1 adapter", () => {
  it("preserves identity and product semantics while enforcing fixture_only", () => {
    const mission = localMission(["global"]);
    const runId = createOpaqueId("run");
    const request = createDiscoveryRequestV1({
      runId,
      mission,
      understanding: generateMissionUnderstandingArtifactV1(mission.input),
    });

    expect(DiscoveryRequestV1Schema.parse(request)).toEqual(request);
    expect(request.requestId).toBe(runId);
    expect(request.description).toBe(mission.input.description);
    expect(request.goal).toBe("customer_opportunities");
    expect(request.providerPreference).toBe("fixture_only");
    expect(request.discoveryMode).toBe("free_only");
    expect(request.domainPackIds).toEqual(["content-production"]);
    expect(request.answerRequirement.maximumResults).toBe(24);
    expect(request.buyerHypotheses?.length).toBeGreaterThanOrEqual(3);
    expect(request.exclusions).toContain("full internal team");
    expect(request.exclusions).toContain("long-term vendor contract");
    expect(request.geography).toBeUndefined();
  });

  it("maps only explicitly structured geography", () => {
    const mission = localMission(["country: US", "region: California", "city: Los Angeles"]);
    const request = createDiscoveryRequestV1({
      runId: createOpaqueId("run"),
      mission,
      understanding: generateMissionUnderstandingArtifactV1(mission.input),
    });
    expect(request.geography).toEqual({
      country: "US",
      region: "California",
      city: "Los Angeles",
    });
  });
});
