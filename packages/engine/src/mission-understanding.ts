import {
  MissionUnderstandingArtifactV1Schema,
  type MissionInputV1,
  type MissionUnderstandingArtifactV1,
  type MissionUnderstandingPriority,
  type MissionUnderstandingSourceType,
} from "@cluvvi/core";

import {
  CATEGORY_CONFIGS,
  INTENT_SIGNALS,
  SOURCE_PLAN,
  type BuyerTemplate,
  type CategoryConfig,
  type CategoryKey,
} from "./mission-understanding-config";
type BuyerHypothesis = MissionUnderstandingArtifactV1["buyerHypotheses"][number];
type SearchQuery = MissionUnderstandingArtifactV1["searchQueries"][number];

function uniqueStrings(values: readonly string[], maximum = Number.POSITIVE_INFINITY): string[] {
  const seen = new Set<string>();
  const output: string[] = [];
  for (const rawValue of values) {
    const value = rawValue.replace(/\s+/g, " ").trim();
    if (value.length === 0) continue;
    const key = value.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    output.push(value);
    if (output.length >= maximum) break;
  }
  return output;
}

function truncate(value: string, maximum: number): string {
  const compact = value.replace(/\s+/g, " ").trim();
  return compact.length <= maximum ? compact : `${compact.slice(0, maximum - 1).trimEnd()}…`;
}

function lowerFirst(value: string): string {
  const trimmed = value.trim();
  return trimmed.length === 0 ? trimmed : `${trimmed[0]?.toLowerCase() ?? ""}${trimmed.slice(1)}`;
}

function withoutTerminalPunctuation(value: string): string {
  return value.trim().replace(/[.!?]+$/, "");
}

function categoryScore(text: string, config: CategoryConfig): number {
  return config.keywords.reduce((score, keyword) => score + (text.includes(keyword) ? 1 : 0), 0);
}

function detectCategory(mission: MissionInputV1): {
  key: CategoryKey;
  config: CategoryConfig;
  confidence: number;
} {
  const text = [
    mission.description,
    mission.customerOutcome,
    mission.additionalContext,
    ...mission.goodCustomerExamples,
  ]
    .filter((value): value is string => value !== undefined)
    .join(" ")
    .toLowerCase();
  const orderedKeys: CategoryKey[] = ["video", "sales", "recruiting", "finance", "support"];
  const scored = orderedKeys.map((key) => ({
    key,
    score: categoryScore(text, CATEGORY_CONFIGS[key]),
  }));
  scored.sort(
    (left, right) =>
      right.score - left.score || orderedKeys.indexOf(left.key) - orderedKeys.indexOf(right.key),
  );
  const winner = scored[0];
  if (winner === undefined || winner.score === 0) {
    return { key: "fallback", config: CATEGORY_CONFIGS.fallback, confidence: 0.55 };
  }
  return {
    key: winner.key,
    config: CATEGORY_CONFIGS[winner.key],
    confidence: winner.score >= 3 ? 0.9 : winner.score === 2 ? 0.82 : 0.72,
  };
}

function likelySalesMotion(mission: MissionInputV1, category: CategoryKey) {
  const text = `${mission.description} ${mission.additionalContext ?? ""}`.toLowerCase();
  if (/\b(agency|service|consulting|done-for-you|done for you)\b/.test(text))
    return "agency_service" as const;
  if (
    /\b(self[- ]serve|sign up|subscription|free trial)\b/.test(text) ||
    (mission.price?.maximum !== undefined && mission.price.maximum <= 200)
  ) {
    return "self_serve" as const;
  }
  if (
    /\b(enterprise|book a demo|sales team|annual contract|procurement)\b/.test(text) ||
    (mission.price?.minimum !== undefined && mission.price.minimum >= 1_000)
  ) {
    return "sales_led" as const;
  }
  if (["video", "sales", "recruiting", "finance", "support"].includes(category)) {
    return "founder_led" as const;
  }
  return "unknown" as const;
}

function buildBuyerHypotheses(mission: MissionInputV1, config: CategoryConfig): BuyerHypothesis[] {
  const templates: BuyerTemplate[] = [...config.buyers];
  for (const example of mission.goodCustomerExamples.slice(0, 2)) {
    templates.push({
      label: `Teams similar to ${truncate(example, 90)}`,
      whyTheyMightNeedIt:
        "The user supplied this as a positive customer example, so similar teams deserve explicit research priority.",
      likelyBuyerTitles: ["Founder", "Department head", "Operations leader"],
      likelyUserTitles: ["Team lead", "Specialist", "Operator"],
      confidence: 0.8,
      searchModifiers: [truncate(example, 120), config.label],
    });
  }

  const seenLabels = new Set<string>();
  const buyers: BuyerHypothesis[] = [];
  for (const template of templates) {
    const labelKey = template.label.toLowerCase();
    if (seenLabels.has(labelKey)) continue;
    seenLabels.add(labelKey);
    buyers.push({
      id: `buyer_${String(buyers.length + 1).padStart(2, "0")}`,
      label: template.label,
      whyTheyMightNeedIt: template.whyTheyMightNeedIt,
      likelyBuyerTitles: uniqueStrings(template.likelyBuyerTitles),
      likelyUserTitles: uniqueStrings(template.likelyUserTitles),
      confidence: template.confidence,
      searchModifiers: uniqueStrings(template.searchModifiers),
    });
    if (buyers.length >= 8) break;
  }
  return buyers;
}

interface QueryCandidate {
  query: string;
  sourceType: MissionUnderstandingSourceType;
  buyerHypothesisId?: string;
  intentSignal?: string;
  priority: MissionUnderstandingPriority;
}

function buildSearchQueries(input: {
  buyers: BuyerHypothesis[];
  pains: string[];
  competitors: string[];
  config: CategoryConfig;
}): SearchQuery[] {
  const candidates: QueryCandidate[] = [];
  const push = (candidate: QueryCandidate) => candidates.push(candidate);

  input.buyers.slice(0, 4).forEach((buyer, buyerIndex) => {
    input.pains.slice(0, 4).forEach((pain, painIndex) => {
      const priority: MissionUnderstandingPriority =
        buyerIndex * 4 + painIndex < 12 ? "high" : "medium";
      const modifier = buyer.searchModifiers[0] ?? buyer.label;
      const templates = [
        `${modifier} struggling with ${pain}`,
        `${modifier} need help with ${pain}`,
        `${modifier} ${pain} bottleneck`,
        `${modifier} looking for ${input.config.label}`,
      ];
      const intents = [
        "complaining_about_manual_work",
        "looking_for_agency_or_vendor",
        "urgent_deadline_or_bottleneck",
        "asking_for_tool_recommendation",
      ];
      const selectedIndex = (buyerIndex + painIndex) % templates.length;
      push({
        query: templates[selectedIndex] ?? `${modifier} ${pain}`,
        sourceType: "search_web",
        buyerHypothesisId: buyer.id,
        intentSignal: intents[selectedIndex] ?? "complaining_about_manual_work",
        priority,
      });
    });
  });

  input.pains.slice(0, 6).forEach((pain, index) => {
    push({
      query: `how to solve ${pain}`,
      sourceType: "search_web",
      intentSignal: "complaining_about_manual_work",
      priority: index < 2 ? "high" : "medium",
    });
    push({
      query: `best tool for ${pain}`,
      sourceType: "search_web",
      intentSignal: "asking_for_tool_recommendation",
      priority: index < 2 ? "high" : "medium",
    });
    push({
      query: `site:reddit.com "${pain}"`,
      sourceType: "reddit",
      intentSignal: "complaining_about_manual_work",
      priority: index < 4 ? "high" : "medium",
    });
  });

  input.competitors.slice(0, 6).forEach((competitor, index) => {
    push({
      query: `alternative to ${competitor}`,
      sourceType: "search_web",
      intentSignal: "mentioning_competitor_or_workaround",
      priority: index < 3 ? "high" : "medium",
    });
    push({
      query: `${competitor} too expensive or not working`,
      sourceType: "reviews",
      intentSignal: "budget_or_price_mentioned",
      priority: index < 2 ? "high" : "medium",
    });
  });

  input.config.workflowTerms.slice(0, 4).forEach((workflow, index) => {
    push({
      query: `site:greenhouse.io "${workflow}" hiring`,
      sourceType: "job_posts",
      intentSignal: "hiring_for_related_role",
      priority: index < 2 ? "high" : "medium",
    });
    push({
      query: `site:lever.co "${workflow}" hiring`,
      sourceType: "job_posts",
      intentSignal: "hiring_for_related_role",
      priority: index < 2 ? "high" : "medium",
    });
  });

  input.pains.slice(0, 3).forEach((pain) => {
    push({
      query: `site:reddit.com "looking for" "${pain}"`,
      sourceType: "reddit",
      intentSignal: "looking_for_agency_or_vendor",
      priority: "medium",
    });
  });

  push({
    query: `site:news.ycombinator.com "Ask HN" "${input.config.label}"`,
    sourceType: "hacker_news",
    intentSignal: "asking_for_tool_recommendation",
    priority: "medium",
  });
  push({
    query: `site:news.ycombinator.com "${input.pains[0] ?? input.config.label}"`,
    sourceType: "hacker_news",
    intentSignal: "complaining_about_manual_work",
    priority: "medium",
  });

  const seen = new Set<string>();
  const deduped: QueryCandidate[] = [];
  for (const candidate of candidates) {
    const query = candidate.query.replace(/\s+/g, " ").trim();
    if (query.length === 0) continue;
    const key = query.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push({ ...candidate, query });
    if (deduped.length >= 60) break;
  }

  return deduped.map((candidate, index) => ({
    id: `query_${String(index + 1).padStart(3, "0")}`,
    query: candidate.query,
    sourceType: candidate.sourceType,
    ...(candidate.buyerHypothesisId === undefined
      ? {}
      : { buyerHypothesisId: candidate.buyerHypothesisId }),
    ...(candidate.intentSignal === undefined ? {} : { intentSignal: candidate.intentSignal }),
    priority: candidate.priority,
  }));
}

export function generateMissionUnderstandingArtifactV1(
  mission: MissionInputV1,
): MissionUnderstandingArtifactV1 {
  const detected = detectCategory(mission);
  const buyers = buildBuyerHypotheses(mission, detected.config);
  const painKeywords = uniqueStrings(detected.config.painKeywords, 30);
  const competitorOrWorkaroundKeywords = uniqueStrings(detected.config.competitorKeywords, 30);
  const exclusionKeywords = uniqueStrings(
    [...mission.exclusions, ...mission.badCustomerExamples],
    100,
  );
  const primaryBuyer = buyers[0]?.label.toLowerCase() ?? "relevant teams";
  const outcome = withoutTerminalPunctuation(
    mission.customerOutcome ?? detected.config.defaultOutcome,
  );
  const conciseValueProposition = `Helps ${primaryBuyer} ${lowerFirst(outcome)} by ${detected.config.productAction}.`;
  const searchQueries = buildSearchQueries({
    buyers,
    pains: painKeywords,
    competitors: competitorOrWorkaroundKeywords,
    config: detected.config,
  });

  return MissionUnderstandingArtifactV1Schema.parse({
    schemaVersion: "1.0",
    artifactKind: "mission_understanding.v1",
    inputSummary: {
      description: mission.description,
      ...(mission.website === undefined ? {} : { website: mission.website }),
      geographies: mission.geographies,
      desiredOpportunities: mission.desiredOpportunities,
      ...(mission.price === undefined ? {} : { price: mission.price }),
    },
    productUnderstanding: {
      productCategory: detected.config.label,
      conciseValueProposition,
      ...(mission.customerOutcome === undefined
        ? {}
        : { customerOutcome: mission.customerOutcome }),
      likelySalesMotion: likelySalesMotion(mission, detected.key),
      confidence: detected.confidence,
    },
    buyerHypotheses: buyers,
    painKeywords,
    intentSignals: INTENT_SIGNALS,
    competitorOrWorkaroundKeywords,
    exclusionKeywords,
    sourcePlan: SOURCE_PLAN,
    searchQueries,
    risksAndUnknowns: uniqueStrings([
      "Buyer hypotheses are deterministic and have not yet been validated against live market evidence.",
      ...(mission.website === undefined
        ? [
            "No product website was supplied, so positioning and feature claims cannot be verified yet.",
          ]
        : ["The supplied website has not been fetched or verified in this phase."]),
      ...(mission.customerOutcome === undefined
        ? [
            "The customer outcome was inferred from the description rather than supplied explicitly.",
          ]
        : []),
      ...(mission.price === undefined
        ? ["Pricing and likely procurement friction are unknown."]
        : []),
      ...(mission.goodCustomerExamples.length === 0
        ? ["No known-good customer examples were supplied to calibrate segment fit."]
        : []),
    ]),
    nextSteps: [
      "Review and edit the buyer hypotheses before connecting live market discovery.",
      "Execute the high-priority search queries against approved public sources in a later phase.",
      "Collect source evidence and separate observed facts from inferred fit before ranking opportunities.",
      "Keep LinkedIn research manual; do not scrape profiles or automate messaging in the MVP.",
    ],
  });
}
