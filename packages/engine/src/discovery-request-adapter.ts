import {
  DiscoveryRequestV1Schema,
  type DiscoveryProviderMode,
  type DiscoveryRequestV1,
  type LocalMission,
  type MissionUnderstandingArtifactV1,
} from "@cluvvi/core";

export type BridgeDiscoveryRequestV1 = DiscoveryRequestV1 & { requestId: string };

function unique(values: readonly string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter((value) => value.length > 0))];
}

function domainPackIdsFor(input: string): string[] {
  const text = input.toLowerCase();
  if (/video|editing|podcast|creator|content|youtube/.test(text)) return ["content-production"];
  if (/construction|contractor|building|permit/.test(text)) return ["construction"];
  if (/real estate|property|realtor|housing/.test(text)) return ["real-estate"];
  if (/agriculture|farm|crop|livestock/.test(text)) return ["agriculture"];
  if (/bio|science|laboratory|clinical|research/.test(text)) return ["bio-science"];
  if (/government|procurement|tender|rfp/.test(text)) return ["government-procurement"];
  if (/document|pdf|form|paperwork/.test(text)) return ["document-automation-function"];
  if (/sales|gtm|revenue|prospect|outbound|saas/.test(text)) return ["saas-gtm"];
  if (/software|technology|developer|engineering|ai/.test(text)) return ["technology-function"];
  if (/operations|support|recruit|finance|accounting/.test(text)) {
    return ["operations-function"];
  }
  return ["generic-business"];
}

function explicitGeography(
  geographies: readonly string[],
): DiscoveryRequestV1["geography"] | undefined {
  const geography: NonNullable<DiscoveryRequestV1["geography"]> = {};
  for (const entry of geographies) {
    const value = entry.trim();
    if (value.length === 0 || value.toLowerCase() === "global") continue;
    const prefixed = /^(country|region|city|road)\s*:\s*(.+)$/i.exec(value);
    if (prefixed !== null) {
      const key = prefixed[1]?.toLowerCase() as "country" | "region" | "city" | "road";
      const explicitValue = prefixed[2]?.trim();
      if (explicitValue !== undefined && explicitValue.length > 0 && geography[key] === undefined) {
        geography[key] = explicitValue;
      }
      continue;
    }
    if (/^[A-Z]{2}$/.test(value) && geography.country === undefined) {
      geography.country = value;
    }
  }
  return Object.keys(geography).length === 0 ? undefined : geography;
}

export function createDiscoveryRequestV1(input: {
  runId: string;
  mission: LocalMission;
  understanding: MissionUnderstandingArtifactV1;
  providerMode?: DiscoveryProviderMode;
}): BridgeDiscoveryRequestV1 {
  const { mission, understanding } = input;
  const providerMode = input.providerMode ?? "fixture_only";
  const geography = explicitGeography(mission.input.geographies);
  const domainSource = [
    understanding.productUnderstanding.productCategory,
    understanding.productUnderstanding.conciseValueProposition,
    mission.input.description,
  ].join(" ");
  const exclusions = unique([
    ...mission.input.exclusions,
    ...understanding.exclusionKeywords,
    ...mission.input.badCustomerExamples,
  ]);
  const request = DiscoveryRequestV1Schema.parse({
    schemaVersion: "1.0",
    artifactKind: "discovery_request.v1",
    requestId: input.runId,
    goal: "customer_opportunities",
    description: mission.input.description,
    answerRequirement: {
      outputType: "evidence_collection",
      completenessTarget: "balanced",
      evidenceRequirement: "multiple_sources",
      maximumResults: mission.input.desiredOpportunities,
    },
    retrievalObjective: {
      recallPriority: 0.7,
      precisionPriority: 0.8,
      freshnessPriority: 0.8,
      authorityPriority: 0.6,
      diversityPriority: understanding.sourcePlan.length >= 6 ? 0.8 : 0.7,
    },
    subject: {
      type: "product_or_service",
      name: understanding.productUnderstanding.productCategory,
      description: mission.input.description,
    },
    buyerHypotheses: unique(understanding.buyerHypotheses.map((buyer) => buyer.label)),
    ...(geography === undefined ? {} : { geography }),
    ...(exclusions.length === 0 ? {} : { exclusions }),
    domainPackIds: domainPackIdsFor(domainSource),
    discoveryMode: providerMode === "live_search" ? "balanced" : "free_only",
    providerPreference: providerMode === "live_search" ? "paid_allowed" : "fixture_only",
  });
  if (request.requestId === undefined) {
    throw new Error("The Cluvvi bridge must produce a stable discovery request ID.");
  }
  return request as BridgeDiscoveryRequestV1;
}
