import type { SearchResultsArtifactV2 } from "../search-results";
import { canonicalDigest, sha256Hex } from "./artifact-identity";
import { CrawlFrontierArtifactV1Schema, type CrawlFrontierArtifactV1 } from "./crawl-frontier-v1";
import {
  ExtractedContentArtifactV1Schema,
  type ExtractedContentArtifactV1,
} from "./extracted-content-v1";
import {
  ExtractionRunTelemetryV1Schema,
  type ExtractionRunTelemetryV1,
} from "./extraction-run-telemetry-v1";

export class ExtractionArtifactValidationError extends Error {
  readonly code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = "ExtractionArtifactValidationError";
    this.code = code;
  }
}

function fail(code: string, message: string): never {
  throw new ExtractionArtifactValidationError(code, message);
}

const forbiddenKeys = new Set([
  "rawHtml",
  "raw_html",
  "responseHeaders",
  "requestHeaders",
  "headers",
  "cookies",
  "cookie",
  "authorization",
  "environment",
  "env",
]);

function assertNoForbiddenFields(value: unknown, path = "$", depth = 0): void {
  if (depth > 30) fail("EXTRACTED_CONTENT_INVALID", "Extraction artifact nesting is too deep.");
  if (Array.isArray(value)) {
    value.forEach((entry, index) => assertNoForbiddenFields(entry, `${path}[${index}]`, depth + 1));
    return;
  }
  if (value === null || typeof value !== "object") return;
  for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
    if (forbiddenKeys.has(key) || /api.?key|secret|token/i.test(key)) {
      fail("EXTRACTED_CONTENT_FORBIDDEN_FIELD", `Forbidden field ${path}.${key} was present.`);
    }
    assertNoForbiddenFields(entry, `${path}.${key}`, depth + 1);
  }
}

function ipv4Number(address: string): number | undefined {
  const parts = address.split(".");
  if (parts.length !== 4) return undefined;
  const octets = parts.map(Number);
  if (octets.some((value) => !Number.isInteger(value) || value < 0 || value > 255))
    return undefined;
  return (
    (((octets[0] ?? 0) << 24) |
      ((octets[1] ?? 0) << 16) |
      ((octets[2] ?? 0) << 8) |
      (octets[3] ?? 0)) >>>
    0
  );
}

function inRange(value: number, start: string, bits: number): boolean {
  const base = ipv4Number(start);
  if (base === undefined) return false;
  const mask = bits === 0 ? 0 : (0xffffffff << (32 - bits)) >>> 0;
  return (value & mask) === (base & mask);
}

function assertPublicArtifactUrl(input: string): string {
  let url: URL;
  try {
    url = new URL(input);
  } catch {
    return fail(
      "EXTRACTED_CONTENT_PRIVATE_URL",
      "An extraction artifact contained an invalid URL.",
    );
  }
  if (!(["http:", "https:"] as const).includes(url.protocol as "http:" | "https:")) {
    return fail(
      "EXTRACTED_CONTENT_PRIVATE_URL",
      "Only HTTP and HTTPS extraction URLs are allowed.",
    );
  }
  if (url.username.length > 0 || url.password.length > 0) {
    return fail(
      "EXTRACTED_CONTENT_PRIVATE_URL",
      "Extraction URLs cannot contain user information.",
    );
  }
  const hostname = url.hostname.toLowerCase().replace(/\.$/u, "");
  if (
    hostname === "localhost" ||
    hostname.endsWith(".localhost") ||
    hostname.endsWith(".local") ||
    hostname.endsWith(".internal") ||
    hostname.endsWith(".home") ||
    hostname === "metadata.google.internal"
  ) {
    return fail("EXTRACTED_CONTENT_PRIVATE_URL", "A private or local hostname was rejected.");
  }
  const v4 = ipv4Number(hostname);
  if (v4 !== undefined) {
    const blocked = [
      ["0.0.0.0", 8],
      ["10.0.0.0", 8],
      ["100.64.0.0", 10],
      ["127.0.0.0", 8],
      ["169.254.0.0", 16],
      ["172.16.0.0", 12],
      ["192.0.0.0", 24],
      ["192.0.2.0", 24],
      ["192.168.0.0", 16],
      ["198.18.0.0", 15],
      ["198.51.100.0", 24],
      ["203.0.113.0", 24],
      ["224.0.0.0", 4],
      ["240.0.0.0", 4],
    ] as const;
    if (blocked.some(([start, bits]) => inRange(v4, start, bits))) {
      return fail("EXTRACTED_CONTENT_PRIVATE_URL", "A non-public IPv4 address was rejected.");
    }
  }
  if (hostname.includes(":")) {
    const normalized = hostname.replace(/^\[|\]$/g, "").toLowerCase();
    if (
      normalized === "::" ||
      normalized === "::1" ||
      normalized.startsWith("fc") ||
      normalized.startsWith("fd") ||
      /^fe[89ab]/u.test(normalized) ||
      normalized.startsWith("ff") ||
      normalized.startsWith("2001:db8")
    ) {
      return fail("EXTRACTED_CONTENT_PRIVATE_URL", "A non-public IPv6 address was rejected.");
    }
  }
  url.hash = "";
  return url.toString();
}

export interface ValidatedExtractionArtifactSet {
  frontier: CrawlFrontierArtifactV1;
  extractedContent: ExtractedContentArtifactV1;
  telemetry: ExtractionRunTelemetryV1;
}

export function validateExtractionArtifactSet(
  searchResults: SearchResultsArtifactV2,
  frontierInput: unknown,
  extractedInput: unknown,
  telemetryInput: unknown,
): ValidatedExtractionArtifactSet {
  assertNoForbiddenFields(frontierInput);
  assertNoForbiddenFields(extractedInput);
  assertNoForbiddenFields(telemetryInput);

  const frontierParsed = CrawlFrontierArtifactV1Schema.safeParse(frontierInput);
  if (!frontierParsed.success) {
    const issue = frontierParsed.error.issues[0];
    return fail(
      "FRONTIER_INPUT_INVALID",
      `The crawl frontier does not satisfy crawl_frontier.v1${issue === undefined ? "." : `: ${issue.path.join(".")} ${issue.message}`}`,
    );
  }
  const extractedParsed = ExtractedContentArtifactV1Schema.safeParse(extractedInput);
  if (!extractedParsed.success) {
    const issue = extractedParsed.error.issues[0];
    return fail(
      "EXTRACTED_CONTENT_INVALID",
      `The extracted content does not satisfy extracted_content.v1${issue === undefined ? "." : `: ${issue.path.join(".")} ${issue.message}`}`,
    );
  }
  const telemetryParsed = ExtractionRunTelemetryV1Schema.safeParse(telemetryInput);
  if (!telemetryParsed.success) {
    const issue = telemetryParsed.error.issues[0];
    return fail(
      "EXTRACTION_TELEMETRY_INVALID",
      `The extraction telemetry does not satisfy extraction_run_telemetry.v1${issue === undefined ? "." : `: ${issue.path.join(".")} ${issue.message}`}`,
    );
  }

  const frontier = frontierParsed.data;
  const extractedContent = extractedParsed.data;
  const telemetry = telemetryParsed.data;
  if (
    new Set([
      searchResults.requestId,
      frontier.requestId,
      extractedContent.requestId,
      telemetry.requestId,
    ]).size !== 1
  ) {
    return fail(
      "EXTRACTION_REQUEST_ID_MISMATCH",
      "Extraction artifact request IDs do not match search_results.v2.",
    );
  }
  const searchDigest = canonicalDigest(searchResults);
  if (
    frontier.searchResultsDigest !== searchDigest ||
    extractedContent.searchResultsDigest !== searchDigest
  ) {
    return fail(
      "FRONTIER_SEARCH_RESULTS_DIGEST_MISMATCH",
      "Extraction artifacts do not reference the exact search_results.v2 input.",
    );
  }
  if (
    extractedContent.frontierArtifactId !== frontier.artifactId ||
    telemetry.frontierArtifactId !== frontier.artifactId
  ) {
    return fail("CRAWL_FRONTIER_MISMATCH", "Frontier artifact references do not match.");
  }
  if (extractedContent.frontierDigest !== canonicalDigest(frontier)) {
    return fail("CRAWL_FRONTIER_MISMATCH", "The extracted-content frontier digest does not match.");
  }
  if (telemetry.extractedContentArtifactId !== extractedContent.artifactId) {
    return fail(
      "EXTRACTION_TELEMETRY_MISMATCH",
      "Telemetry references the wrong extracted-content artifact.",
    );
  }
  if (
    new Set([frontier.artifactId, extractedContent.artifactId, telemetry.artifactId]).size !== 3
  ) {
    return fail("EXTRACTION_ARTIFACT_ID_COLLISION", "Companion artifact IDs must be unique.");
  }

  const searchById = new Map(searchResults.results.map((result) => [result.id, result]));
  const frontierById = new Map(frontier.items.map((item) => [item.frontierItemId, item]));
  for (const item of frontier.items) {
    if (!searchById.has(item.sourceResultId)) {
      return fail(
        "FRONTIER_RESULT_ID_MISSING",
        "A frontier item references an unknown search result.",
      );
    }
    if (item.canonicalUrl !== undefined) assertPublicArtifactUrl(item.canonicalUrl);
  }
  const selectedItems = frontier.items.filter((item) => item.status === "selected");
  if (selectedItems.length > frontier.selectionPolicy.maximumUrls) {
    return fail("FRONTIER_CONFIGURATION_INVALID", "The frontier exceeds its total URL cap.");
  }
  const perDomain = new Map<string, number>();
  const perQuery = new Map<string, number>();
  for (const item of selectedItems) {
    const source = searchById.get(item.sourceResultId);
    if (source === undefined) continue;
    const domain = item.domain ?? "unknown";
    perDomain.set(domain, (perDomain.get(domain) ?? 0) + 1);
    perQuery.set(source.queryId, (perQuery.get(source.queryId) ?? 0) + 1);
  }
  if (
    [...perDomain.values()].some(
      (count) => count > frontier.selectionPolicy.maximumUrlsPerDomain,
    ) ||
    [...perQuery.values()].some((count) => count > frontier.selectionPolicy.maximumUrlsPerQuery)
  ) {
    return fail(
      "FRONTIER_CONFIGURATION_INVALID",
      "The frontier exceeds a per-domain or per-query cap.",
    );
  }

  for (const item of extractedContent.items) {
    const source = searchById.get(item.sourceResultId);
    const frontierItem = frontierById.get(item.frontierItemId);
    if (source === undefined || frontierItem === undefined) {
      return fail(
        "EXTRACTED_CONTENT_MISMATCH",
        "An extraction item references an unknown source or frontier item.",
      );
    }
    const requested = assertPublicArtifactUrl(item.requestedUrl);
    if (
      frontierItem.canonicalUrl === undefined ||
      requested !== assertPublicArtifactUrl(frontierItem.canonicalUrl)
    ) {
      return fail(
        "EXTRACTED_CONTENT_MISMATCH",
        "An extraction item requested URL does not match its frontier item.",
      );
    }
    if (item.finalUrl !== undefined) assertPublicArtifactUrl(item.finalUrl);
    if (item.canonicalUrl !== undefined) assertPublicArtifactUrl(item.canonicalUrl);
    if (item.metadata?.canonicalUrl !== undefined)
      assertPublicArtifactUrl(item.metadata.canonicalUrl);
    if (item.metadata?.openGraph?.url !== undefined)
      assertPublicArtifactUrl(item.metadata.openGraph.url);
    if (item.metadata?.openGraph?.imageUrl !== undefined)
      assertPublicArtifactUrl(item.metadata.openGraph.imageUrl);
    for (const entity of item.structuredData ?? []) {
      if (entity.url !== undefined) assertPublicArtifactUrl(entity.url);
      for (const sameAs of entity.sameAs ?? []) assertPublicArtifactUrl(sameAs);
    }
    if (item.text !== undefined && sha256Hex(item.text.content) !== item.text.contentHash) {
      return fail(
        "EXTRACTED_CONTENT_HASH_MISMATCH",
        "An extracted text content hash is incorrect.",
      );
    }
  }

  const contentByFrontier = new Map(
    extractedContent.items.map((item) => [item.frontierItemId, item]),
  );
  for (const fetch of telemetry.fetches) {
    const frontierItem = frontierById.get(fetch.frontierItemId);
    if (frontierItem === undefined || frontierItem.sourceResultId !== fetch.sourceResultId) {
      return fail(
        "EXTRACTION_TELEMETRY_MISMATCH",
        "Telemetry references an unknown frontier item.",
      );
    }
    const extracted = contentByFrontier.get(fetch.frontierItemId);
    if (extracted !== undefined) {
      if (fetch.downloadedBytes !== (extracted.http?.downloadedBytes ?? 0)) {
        return fail(
          "EXTRACTION_TELEMETRY_MISMATCH",
          "Telemetry byte totals do not match extracted content.",
        );
      }
      if (fetch.extractedCharacters !== (extracted.text?.characterCount ?? 0)) {
        return fail(
          "EXTRACTION_TELEMETRY_MISMATCH",
          "Telemetry character totals do not match extracted content.",
        );
      }
    }
  }
  const downloadedBytes = telemetry.fetches.reduce((sum, item) => sum + item.downloadedBytes, 0);
  const extractedCharacters = telemetry.fetches.reduce(
    (sum, item) => sum + item.extractedCharacters,
    0,
  );
  if (
    downloadedBytes !== telemetry.totals.downloadedBytes ||
    extractedCharacters !== telemetry.totals.extractedCharacters
  ) {
    return fail(
      "EXTRACTION_TELEMETRY_MISMATCH",
      "Telemetry aggregate totals do not match its fetch records.",
    );
  }
  if (
    extractedContent.summary.downloadedBytes !== telemetry.totals.downloadedBytes ||
    extractedContent.summary.extractedCharacters !== telemetry.totals.extractedCharacters
  ) {
    return fail(
      "EXTRACTION_TELEMETRY_MISMATCH",
      "Extracted-content totals do not match telemetry.",
    );
  }
  if (
    frontier.summary.selected !== extractedContent.summary.selectedUrls ||
    frontier.summary.selected !== telemetry.frontier.selected
  ) {
    return fail(
      "EXTRACTION_TELEMETRY_MISMATCH",
      "Selected URL totals do not agree across companion artifacts.",
    );
  }
  return { frontier, extractedContent, telemetry };
}
