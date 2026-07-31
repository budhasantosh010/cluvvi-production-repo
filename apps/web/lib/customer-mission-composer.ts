const URL_CANDIDATE =
  /(?:https?:\/\/|www\.)[^\s]+|(?:^|\s)([a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z]{2,})(?:\/[^\s]*)?)/i;
const TRAILING_PUNCTUATION = /[),.;!?]+$/;

export type MissionPromptKind = "empty" | "text" | "url_only" | "text_with_url";

export interface MissionPromptAnalysis {
  kind: MissionPromptKind;
  original: string;
  websiteSuggestion?: string;
}

function normalizeWebsiteCandidate(candidate: string): string | undefined {
  const cleaned = candidate.trim().replace(TRAILING_PUNCTUATION, "");
  if (cleaned.length === 0) return undefined;
  const withProtocol = /^https?:\/\//i.test(cleaned) ? cleaned : `https://${cleaned}`;
  try {
    const parsed = new URL(withProtocol);
    if (!/^https?:$/.test(parsed.protocol) || !parsed.hostname.includes(".")) return undefined;
    parsed.hash = "";
    return parsed.toString();
  } catch {
    return undefined;
  }
}

export function analyzeMissionPrompt(value: string): MissionPromptAnalysis {
  const original = value.trim();
  if (original.length === 0) return { kind: "empty", original };

  const match = original.match(URL_CANDIDATE);
  if (match === null) return { kind: "text", original };

  const rawCandidate = match[0].trim() || match[1]?.trim() || "";
  const websiteSuggestion = normalizeWebsiteCandidate(rawCandidate);
  if (websiteSuggestion === undefined) return { kind: "text", original };

  const withoutCandidate = original.replace(match[0], "").trim();
  return {
    kind: withoutCandidate.length === 0 ? "url_only" : "text_with_url",
    original,
    websiteSuggestion,
  };
}

export function createMissionName(description: string): string {
  const compact = description.replace(/\s+/g, " ").trim();
  const base = compact.length > 72 ? `${compact.slice(0, 69).trimEnd()}…` : compact;
  return `${base} customer discovery`;
}
