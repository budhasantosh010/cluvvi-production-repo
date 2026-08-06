import type { SearchResultsArtifactV2 } from "../search-results";
import { canonicalDigest, sha256Hex } from "./artifact-identity";
import {
  ContentParseTelemetryV1Schema,
  type ContentParseTelemetryV1,
} from "./content-parse-telemetry-v1";
import type { CrawlFrontierArtifactV1 } from "./crawl-frontier-v1";
import type { ExtractedContentArtifactV1 } from "./extracted-content-v1";
import {
  deterministicContentParseTelemetryId,
  deterministicStructuredArtifactId,
} from "./structured-identity";
import {
  StructuredContentArtifactV1Schema,
  type StructuredContentArtifactV1,
} from "./structured-content-v1";

export class StructuredContentValidationError extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "StructuredContentValidationError";
  }
}

function fail(code: string, message: string): never {
  throw new StructuredContentValidationError(code, message);
}

const FORBIDDEN_KEYS = new Set([
  "rawHtml",
  "raw_html",
  "rawBytes",
  "raw_bytes",
  "documentBytes",
  "assetBytes",
  "base64",
  "requestHeaders",
  "responseHeaders",
  "headers",
  "cookies",
  "cookie",
  "authorization",
  "environment",
  "env",
  "tempPath",
  "temporaryPath",
  "inputFilePath",
  "responseFilePath",
  "dnsAddress",
  "remoteAddress",
]);

function assertNoForbiddenFields(value: unknown, path = "$", depth = 0): void {
  if (depth > 40) fail("STRUCTURED_CONTENT_INVALID", "Structured content nesting is too deep.");
  if (Array.isArray(value)) {
    value.forEach((entry, index) =>
      assertNoForbiddenFields(entry, `${path}[${String(index)}]`, depth + 1),
    );
    return;
  }
  if (value === null || typeof value !== "object") return;
  for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
    if (FORBIDDEN_KEYS.has(key) || /api.?key|secret|token/iu.test(key)) {
      fail(
        "STRUCTURED_CONTENT_BINARY_DATA_REJECTED",
        `Forbidden field ${path}.${key} was present.`,
      );
    }
    if (
      typeof entry === "string" &&
      (/^data:/iu.test(entry) || /(?:^|[\\/])(?:temp|tmp)(?:[\\/]|$)/iu.test(entry))
    ) {
      fail(
        "STRUCTURED_CONTENT_BINARY_DATA_REJECTED",
        `Forbidden binary or temporary-path value was present at ${path}.${key}.`,
      );
    }
    assertNoForbiddenFields(entry, `${path}.${key}`, depth + 1);
  }
}

function ipv4Number(address: string): number | undefined {
  const parts = address.split(".");
  if (parts.length !== 4) return undefined;
  const octets = parts.map(Number);
  if (octets.some((entry) => !Number.isInteger(entry) || entry < 0 || entry > 255)) {
    return undefined;
  }
  return (
    (((octets[0] ?? 0) << 24) |
      ((octets[1] ?? 0) << 16) |
      ((octets[2] ?? 0) << 8) |
      (octets[3] ?? 0)) >>>
    0
  );
}

function ipv4InRange(value: number, start: string, bits: number): boolean {
  const base = ipv4Number(start);
  if (base === undefined) return false;
  const mask = bits === 0 ? 0 : (0xffffffff << (32 - bits)) >>> 0;
  return (value & mask) === (base & mask);
}

function blockedIpv4(address: string): boolean {
  const value = ipv4Number(address);
  if (value === undefined) return false;
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
  return blocked.some(([start, bits]) => ipv4InRange(value, start, bits));
}

function blockedIpv6(address: string): boolean {
  const normalized = address.replace(/^\[|\]$/gu, "").toLowerCase();
  const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/u.exec(normalized)?.[1];
  if (mapped !== undefined) return blockedIpv4(mapped);
  return (
    normalized === "::" ||
    normalized === "::1" ||
    normalized.startsWith("fc") ||
    normalized.startsWith("fd") ||
    /^fe[89ab]/u.test(normalized) ||
    normalized.startsWith("ff") ||
    normalized.startsWith("2001:db8")
  );
}

function assertPublicUrl(value: string): string {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return fail(
      "STRUCTURED_CONTENT_PRIVATE_URL_REJECTED",
      "A structured-content artifact contained an invalid URL.",
    );
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    return fail(
      "STRUCTURED_CONTENT_PRIVATE_URL_REJECTED",
      "Only public HTTP and HTTPS structured-content URLs are allowed.",
    );
  }
  if (url.username.length > 0 || url.password.length > 0) {
    return fail(
      "STRUCTURED_CONTENT_PRIVATE_URL_REJECTED",
      "Structured-content URLs cannot contain user information.",
    );
  }
  const hostname = url.hostname
    .toLowerCase()
    .replace(/\.$/u, "")
    .replace(/^\[|\]$/gu, "");
  if (
    hostname === "localhost" ||
    hostname.endsWith(".localhost") ||
    hostname.endsWith(".local") ||
    hostname.endsWith(".internal") ||
    hostname.endsWith(".home") ||
    hostname === "metadata.google.internal"
  ) {
    return fail(
      "STRUCTURED_CONTENT_PRIVATE_URL_REJECTED",
      "A structured-content artifact contained a private hostname.",
    );
  }
  const isIpv4 = ipv4Number(hostname) !== undefined;
  const isIpv6 = hostname.includes(":");
  if ((isIpv4 && blockedIpv4(hostname)) || (isIpv6 && blockedIpv6(hostname))) {
    return fail(
      "STRUCTURED_CONTENT_PRIVATE_URL_REJECTED",
      "A structured-content artifact contained a non-public IP URL.",
    );
  }
  url.hash = "";
  return url.toString();
}

function assertLink(link: StructuredContentArtifactV1["items"][number]["links"][number]): void {
  if (link.url === undefined) return;
  if (link.internal) {
    if (!link.url.startsWith("#") && !/^\.?\.?\//u.test(link.url)) {
      fail("STRUCTURED_CONTENT_PRIVATE_URL_REJECTED", "An internal link had an invalid target.");
    }
    return;
  }
  if (!link.safe) {
    if (link.rejectedReason === undefined) {
      fail("STRUCTURED_CONTENT_INVALID", "A rejected link omitted its rejection reason.");
    }
    return;
  }
  assertPublicUrl(link.url);
}

function assertUnique(values: string[], code: string, label: string): void {
  if (new Set(values).size !== values.length) fail(code, `${label} values must be unique.`);
}

function assertSectionGraph(item: StructuredContentArtifactV1["items"][number]): void {
  const sections = new Map(item.sections.map((section) => [section.sectionId, section]));
  assertUnique(
    item.sections.map((section) => section.sectionId),
    "STRUCTURED_CONTENT_INVALID",
    "sectionId",
  );
  assertUnique(
    item.sections.map((section) => String(section.sequence)),
    "STRUCTURED_CONTENT_INVALID",
    "section sequence",
  );
  for (const section of item.sections) {
    if (section.parentSectionId !== undefined && !sections.has(section.parentSectionId)) {
      fail("STRUCTURED_CONTENT_ORPHAN_REFERENCE", "A section references a missing parent section.");
    }
    const visited = new Set<string>();
    let current = section;
    while (current.parentSectionId !== undefined) {
      if (visited.has(current.sectionId)) {
        fail("STRUCTURED_CONTENT_INVALID", "A section parent cycle was detected.");
      }
      visited.add(current.sectionId);
      const parent = sections.get(current.parentSectionId);
      if (parent === undefined) break;
      current = parent;
    }
    if (sha256Hex(section.markdown) !== section.contentHash) {
      fail("STRUCTURED_CONTENT_HASH_MISMATCH", "A section Markdown hash does not match.");
    }
  }
}

export interface ValidatedStructuredContentArtifactSet {
  structuredContent: StructuredContentArtifactV1;
  telemetry: ContentParseTelemetryV1;
}

export function validateStructuredContentArtifactSet(
  searchResults: SearchResultsArtifactV2,
  frontier: CrawlFrontierArtifactV1,
  extractedContent: ExtractedContentArtifactV1 | undefined,
  structuredInput: unknown,
  telemetryInput: unknown,
): ValidatedStructuredContentArtifactSet {
  assertNoForbiddenFields(structuredInput);
  assertNoForbiddenFields(telemetryInput);

  const structuredParsed = StructuredContentArtifactV1Schema.safeParse(structuredInput);
  if (!structuredParsed.success) {
    const issue = structuredParsed.error.issues[0];
    return fail(
      "STRUCTURED_CONTENT_INVALID",
      `The structured content does not satisfy structured_content.v1${
        issue === undefined ? "." : `: ${issue.path.join(".")} ${issue.message}`
      }`,
    );
  }
  const telemetryParsed = ContentParseTelemetryV1Schema.safeParse(telemetryInput);
  if (!telemetryParsed.success) {
    const issue = telemetryParsed.error.issues[0];
    return fail(
      "CONTENT_PARSE_TELEMETRY_INVALID",
      `The parse telemetry does not satisfy content_parse_telemetry.v1${
        issue === undefined ? "." : `: ${issue.path.join(".")} ${issue.message}`
      }`,
    );
  }
  const structuredContent = structuredParsed.data;
  const telemetry = telemetryParsed.data;

  if (
    new Set([
      searchResults.requestId,
      frontier.requestId,
      structuredContent.requestId,
      telemetry.requestId,
      ...(extractedContent === undefined ? [] : [extractedContent.requestId]),
    ]).size !== 1
  ) {
    return fail("STRUCTURED_CONTENT_MISMATCH", "Structured artifact request IDs do not match.");
  }
  const searchDigest = canonicalDigest(searchResults);
  if (structuredContent.searchResultsDigest !== searchDigest) {
    return fail(
      "STRUCTURED_CONTENT_DIGEST_MISMATCH",
      "Structured content does not reference the exact search_results.v2 input.",
    );
  }
  if (
    structuredContent.frontierArtifactId !== frontier.artifactId ||
    structuredContent.frontierDigest !== canonicalDigest(frontier)
  ) {
    return fail(
      "STRUCTURED_CONTENT_REFERENCE_MISMATCH",
      "Structured content does not reference the exact frontier.",
    );
  }
  if (extractedContent !== undefined) {
    if (
      structuredContent.extractedContentArtifactId !== extractedContent.artifactId ||
      structuredContent.extractedContentDigest !== canonicalDigest(extractedContent)
    ) {
      return fail(
        "STRUCTURED_CONTENT_REFERENCE_MISMATCH",
        "Structured content does not reference the exact extracted-content artifact.",
      );
    }
  } else if (
    structuredContent.extractedContentArtifactId !== undefined ||
    structuredContent.extractedContentDigest !== undefined
  ) {
    return fail(
      "STRUCTURED_CONTENT_REFERENCE_MISMATCH",
      "Structured content references extracted content that was not supplied.",
    );
  }
  if (telemetry.structuredContentArtifactId !== structuredContent.artifactId) {
    return fail(
      "CONTENT_PARSE_TELEMETRY_MISMATCH",
      "Parse telemetry references the wrong structured-content artifact.",
    );
  }
  const searchById = new Map(searchResults.results.map((result) => [result.id, result]));
  const frontierById = new Map(frontier.items.map((item) => [item.frontierItemId, item]));
  const extractionById = new Map(
    (extractedContent?.items ?? []).map((item) => [item.extractionItemId, item]),
  );
  const structuredIds = structuredContent.items.map((item) => item.structuredContentItemId);
  assertUnique(structuredIds, "STRUCTURED_CONTENT_INVALID", "structuredContentItemId");

  for (const item of structuredContent.items) {
    if (!searchById.has(item.sourceResultId)) {
      return fail(
        "STRUCTURED_CONTENT_ORPHAN_REFERENCE",
        "A structured item references an unknown search result.",
      );
    }
    const frontierItem = frontierById.get(item.frontierItemId);
    if (frontierItem === undefined || frontierItem.sourceResultId !== item.sourceResultId) {
      return fail(
        "STRUCTURED_CONTENT_ORPHAN_REFERENCE",
        "A structured item references an unknown frontier item.",
      );
    }
    if (item.extractionItemId !== undefined && !extractionById.has(item.extractionItemId)) {
      return fail(
        "STRUCTURED_CONTENT_ORPHAN_REFERENCE",
        "A structured item references an unknown extraction item.",
      );
    }
    const requested = assertPublicUrl(item.requestedUrl);
    if (frontierItem.canonicalUrl === undefined || requested !== frontierItem.canonicalUrl) {
      return fail(
        "STRUCTURED_CONTENT_REFERENCE_MISMATCH",
        "A structured requested URL does not match its frontier item.",
      );
    }
    if (item.finalUrl !== undefined) assertPublicUrl(item.finalUrl);
    if (item.canonicalUrl !== undefined) assertPublicUrl(item.canonicalUrl);
    if (item.markdown !== undefined) {
      if (sha256Hex(item.markdown.content) !== item.markdown.contentHash) {
        return fail("STRUCTURED_CONTENT_HASH_MISMATCH", "Markdown content hash does not match.");
      }
      if (item.contentHash !== item.markdown.contentHash) {
        return fail(
          "STRUCTURED_CONTENT_HASH_MISMATCH",
          "Item content hash does not match Markdown.",
        );
      }
    }
    assertSectionGraph(item);
    assertUnique(
      item.tables.map((table) => table.tableId),
      "STRUCTURED_CONTENT_INVALID",
      "tableId",
    );
    assertUnique(
      item.links.map((link) => link.linkId),
      "STRUCTURED_CONTENT_INVALID",
      "linkId",
    );
    assertUnique(
      item.footnotes.map((note) => note.footnoteId),
      "STRUCTURED_CONTENT_INVALID",
      "footnoteId",
    );
    const sectionIds = new Set(item.sections.map((section) => section.sectionId));
    const tableIds = new Set(item.tables.map((table) => table.tableId));
    const linkIds = new Set(item.links.map((link) => link.linkId));
    const footnoteIds = new Set(item.footnotes.map((note) => note.footnoteId));
    for (const section of item.sections) {
      if (
        section.tableIds.some((id) => !tableIds.has(id)) ||
        section.linkIds.some((id) => !linkIds.has(id)) ||
        section.footnoteIds.some((id) => !footnoteIds.has(id))
      ) {
        return fail(
          "STRUCTURED_CONTENT_ORPHAN_REFERENCE",
          "A section references a missing table, link, or footnote.",
        );
      }
    }
    for (const table of item.tables) {
      const rows = [...table.headerRows, ...table.bodyRows];
      const width = rows.reduce((maximum, row) => Math.max(maximum, row.length), 0);
      if (
        table.rowCount !== rows.length ||
        table.columnCount !== width ||
        rows.some((row) => row.length > table.columnCount) ||
        (table.sourceSectionId !== undefined && !sectionIds.has(table.sourceSectionId)) ||
        sha256Hex(table.markdown) !== table.contentHash
      ) {
        return fail("STRUCTURED_CONTENT_INVALID", "A structured table is inconsistent.");
      }
    }
    item.links.forEach(assertLink);
    if (item.markdown === undefined && (item.outcome === "success" || item.outcome === "partial")) {
      return fail("STRUCTURED_CONTENT_INVALID", "A successful parse has no Markdown.");
    }
  }

  const attemptsById = new Map(
    telemetry.attempts.map((attempt) => [attempt.structuredContentItemId, attempt]),
  );
  if (attemptsById.size !== telemetry.attempts.length) {
    return fail("CONTENT_PARSE_TELEMETRY_INVALID", "Parse attempt IDs must be unique.");
  }
  for (const item of structuredContent.items) {
    const attempt = attemptsById.get(item.structuredContentItemId);
    if (
      attempt === undefined ||
      attempt.sourceResultId !== item.sourceResultId ||
      attempt.frontierItemId !== item.frontierItemId ||
      attempt.outcome !== item.outcome ||
      attempt.resourceKind !== item.resourceKind ||
      attempt.parserProviderId !== item.parserProviderId ||
      attempt.markdownCharacters !== (item.markdown?.characterCount ?? 0) ||
      attempt.sectionCount !== item.sections.length ||
      attempt.tableCount !== item.tables.length ||
      attempt.assetCount !== item.assets.length
    ) {
      return fail(
        "CONTENT_PARSE_TELEMETRY_MISMATCH",
        "Parse telemetry does not match a structured item.",
      );
    }
  }
  if (
    structuredContent.summary.totalDownloadedBytes !== telemetry.totals.downloadedBytes ||
    structuredContent.summary.totalMarkdownCharacters !== telemetry.totals.markdownCharacters
  ) {
    return fail(
      "CONTENT_PARSE_TELEMETRY_MISMATCH",
      "Structured summary usage does not match parse telemetry.",
    );
  }
  const structuredWithoutId = Object.fromEntries(
    Object.entries(structuredContent).filter(([key]) => key !== "artifactId"),
  ) as Omit<StructuredContentArtifactV1, "artifactId">;
  if (structuredContent.artifactId !== deterministicStructuredArtifactId(structuredWithoutId)) {
    return fail(
      "STRUCTURED_CONTENT_DIGEST_MISMATCH",
      "Structured artifact ID is not deterministic.",
    );
  }
  const telemetryWithoutId = Object.fromEntries(
    Object.entries(telemetry).filter(([key]) => key !== "artifactId"),
  ) as Omit<ContentParseTelemetryV1, "artifactId">;
  if (telemetry.artifactId !== deterministicContentParseTelemetryId(telemetryWithoutId)) {
    return fail(
      "CONTENT_PARSE_TELEMETRY_MISMATCH",
      "Parse telemetry artifact ID is not deterministic.",
    );
  }
  return { structuredContent, telemetry };
}
