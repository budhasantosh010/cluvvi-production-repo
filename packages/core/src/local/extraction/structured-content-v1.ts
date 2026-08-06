import { z } from "zod";

export const StructuredResourceKindV1Schema = z.enum([
  "html_page",
  "pdf_document",
  "word_document",
  "presentation",
  "spreadsheet",
  "opendocument_text",
  "opendocument_presentation",
  "opendocument_spreadsheet",
  "rich_text_document",
  "epub_document",
  "csv_document",
  "unknown_document",
]);
export type StructuredResourceKindV1 = z.infer<typeof StructuredResourceKindV1Schema>;

export const StructuredParseOutcomeV1Schema = z.enum([
  "success",
  "partial",
  "failed",
  "blocked",
  "manual_required",
  "ocr_required",
]);
export type StructuredParseOutcomeV1 = z.infer<typeof StructuredParseOutcomeV1Schema>;

export const StructuredParserProviderIdV1Schema = z.enum([
  "basic_html_structurer",
  "anydoc_document_parser",
]);
export type StructuredParserProviderIdV1 = z.infer<typeof StructuredParserProviderIdV1Schema>;

export const StructuredSectionTypeV1Schema = z.enum([
  "heading",
  "paragraph",
  "ordered_list",
  "unordered_list",
  "task_list",
  "table",
  "blockquote",
  "code_block",
  "footnotes",
  "slide",
  "sheet",
  "page",
  "unknown",
]);
export type StructuredSectionTypeV1 = z.infer<typeof StructuredSectionTypeV1Schema>;

export const ExtractionCompletenessV1Schema = z.enum(["high", "medium", "low", "none"]);
export type ExtractionCompletenessV1 = z.infer<typeof ExtractionCompletenessV1Schema>;

export const StructuredSourceMetadataV1Schema = z
  .object({
    title: z.string().min(1).optional(),
    description: z.string().min(1).optional(),
    authorNames: z.array(z.string().min(1)).max(100).optional(),
    organizationName: z.string().min(1).optional(),
    publisherName: z.string().min(1).optional(),
    language: z.string().min(1).optional(),
    publishedAt: z.iso.datetime().optional(),
    modifiedAt: z.iso.datetime().optional(),
    pageCount: z.number().int().positive().optional(),
    slideCount: z.number().int().positive().optional(),
    sheetCount: z.number().int().positive().optional(),
    subject: z.string().min(1).optional(),
    keywords: z.array(z.string().min(1)).max(500).optional(),
    originalFileNameHint: z.string().min(1).max(1_024).optional(),
  })
  .strict();
export type StructuredSourceMetadataV1 = z.infer<typeof StructuredSourceMetadataV1Schema>;

export const StructuredMarkdownV1Schema = z
  .object({
    content: z.string().min(1).max(1_000_000),
    characterCount: z.number().int().positive().max(1_000_000),
    wordCount: z.number().int().nonnegative(),
    truncated: z.boolean(),
    contentHash: z.string().regex(/^[a-f0-9]{64}$/),
    flavor: z.literal("gfm"),
    generationMethod: z.enum(["sanitized_html_to_gfm", "anydoc_to_gfm"]),
  })
  .strict()
  .superRefine((value, context) => {
    if (value.characterCount !== value.content.length) {
      context.addIssue({
        code: "custom",
        path: ["characterCount"],
        message: "characterCount must equal content.length",
      });
    }
  });
export type StructuredMarkdownV1 = z.infer<typeof StructuredMarkdownV1Schema>;

export const StructuredSectionV1Schema = z
  .object({
    sectionId: z.string().min(1),
    parentSectionId: z.string().min(1).optional(),
    sectionType: StructuredSectionTypeV1Schema,
    heading: z.string().min(1).optional(),
    headingLevel: z.number().int().min(1).max(6).optional(),
    sequence: z.number().int().nonnegative(),
    sourceLocator: z
      .object({
        pageNumber: z.number().int().positive().optional(),
        slideNumber: z.number().int().positive().optional(),
        sheetName: z.string().min(1).optional(),
        anchor: z.string().min(1).optional(),
      })
      .strict()
      .optional(),
    text: z.string().max(1_000_000),
    markdown: z.string().max(1_000_000),
    characterCount: z.number().int().nonnegative().max(1_000_000),
    wordCount: z.number().int().nonnegative(),
    contentHash: z.string().regex(/^[a-f0-9]{64}$/),
    tableIds: z.array(z.string().min(1)),
    linkIds: z.array(z.string().min(1)),
    footnoteIds: z.array(z.string().min(1)),
    limitations: z.array(z.string().min(1)),
  })
  .strict()
  .superRefine((value, context) => {
    if (value.characterCount !== value.text.length) {
      context.addIssue({
        code: "custom",
        path: ["characterCount"],
        message: "characterCount must equal text.length",
      });
    }
    if (value.headingLevel !== undefined && value.heading === undefined) {
      context.addIssue({
        code: "custom",
        path: ["headingLevel"],
        message: "headingLevel requires heading",
      });
    }
  });
export type StructuredSectionV1 = z.infer<typeof StructuredSectionV1Schema>;

const StructuredTableRowsV1Schema = z.array(z.array(z.string().max(10_000)).max(100)).max(2_000);

export const StructuredTableV1Schema = z
  .object({
    tableId: z.string().min(1),
    caption: z.string().min(1).optional(),
    sourceSectionId: z.string().min(1).optional(),
    sequence: z.number().int().nonnegative(),
    headerRows: StructuredTableRowsV1Schema,
    bodyRows: StructuredTableRowsV1Schema,
    columnCount: z.number().int().nonnegative().max(100),
    rowCount: z.number().int().nonnegative().max(2_000),
    hasMergedCells: z.boolean(),
    truncated: z.boolean(),
    markdown: z.string().max(1_000_000),
    contentHash: z.string().regex(/^[a-f0-9]{64}$/),
    limitations: z.array(z.string().min(1)),
  })
  .strict();
export type StructuredTableV1 = z.infer<typeof StructuredTableV1Schema>;

export const StructuredLinkV1Schema = z
  .object({
    linkId: z.string().min(1),
    text: z.string().min(1).optional(),
    url: z.string().min(1).max(4_096).optional(),
    internal: z.boolean(),
    sourceSectionId: z.string().min(1).optional(),
    safe: z.boolean(),
    rejectedReason: z.string().min(1).optional(),
  })
  .strict();
export type StructuredLinkV1 = z.infer<typeof StructuredLinkV1Schema>;

export const StructuredFootnoteV1Schema = z
  .object({
    footnoteId: z.string().min(1),
    label: z.string().min(1).optional(),
    text: z.string().min(1).max(100_000),
    markdown: z.string().min(1).max(100_000),
    sourceSectionId: z.string().min(1).optional(),
  })
  .strict();
export type StructuredFootnoteV1 = z.infer<typeof StructuredFootnoteV1Schema>;

export const StructuredAssetMetadataV1Schema = z
  .object({
    assetId: z.string().min(1),
    mediaType: z.string().min(1).optional(),
    fileNameHint: z.string().min(1).max(1_024).optional(),
    altText: z.string().min(1).max(10_000).optional(),
    byteLength: z.number().int().nonnegative().optional(),
    contentHash: z
      .string()
      .regex(/^[a-f0-9]{64}$/)
      .optional(),
    relationship: z.enum(["embedded", "external", "linked", "unknown"]),
    persisted: z.literal(false),
    limitations: z.array(z.string().min(1)),
  })
  .strict();
export type StructuredAssetMetadataV1 = z.infer<typeof StructuredAssetMetadataV1Schema>;

export const ExtractionQualityV1Schema = z
  .object({
    usefulCharacterCount: z.number().int().nonnegative(),
    headingCount: z.number().int().nonnegative(),
    paragraphCount: z.number().int().nonnegative(),
    listCount: z.number().int().nonnegative(),
    tableCount: z.number().int().nonnegative(),
    blockquoteCount: z.number().int().nonnegative(),
    codeBlockCount: z.number().int().nonnegative(),
    footnoteCount: z.number().int().nonnegative(),
    linkCount: z.number().int().nonnegative(),
    assetCount: z.number().int().nonnegative(),
    structurePreservationScore: z.number().min(0).max(1),
    textQualityScore: z.number().min(0).max(1),
    boilerplateScore: z.number().min(0).max(1),
    completenessScore: z.number().min(0).max(1),
    completeness: ExtractionCompletenessV1Schema,
    requiresJavaScript: z.boolean(),
    requiresOcr: z.boolean(),
    encrypted: z.boolean(),
    malformed: z.boolean(),
    truncated: z.boolean(),
    limitations: z.array(z.string().min(1)),
  })
  .strict();
export type ExtractionQualityV1 = z.infer<typeof ExtractionQualityV1Schema>;

export const StructuredContentItemV1Schema = z
  .object({
    structuredContentItemId: z.string().min(1),
    sourceResultId: z.string().min(1),
    frontierItemId: z.string().min(1),
    extractionItemId: z.string().min(1).optional(),
    requestedUrl: z.url(),
    finalUrl: z.url().optional(),
    canonicalUrl: z.url().optional(),
    resourceKind: StructuredResourceKindV1Schema,
    declaredContentType: z.string().min(1).optional(),
    detectedFormat: z.string().min(1).optional(),
    detectedExtension: z.string().min(1).optional(),
    outcome: StructuredParseOutcomeV1Schema,
    trustClassification: z.literal("untrusted_public_content"),
    parserProviderId: StructuredParserProviderIdV1Schema,
    parserVersion: z.string().min(1),
    fetchedAt: z.iso.datetime().optional(),
    parsedAt: z.iso.datetime().optional(),
    sourceMetadata: StructuredSourceMetadataV1Schema,
    markdown: StructuredMarkdownV1Schema.optional(),
    sections: z.array(StructuredSectionV1Schema).max(10_000),
    tables: z.array(StructuredTableV1Schema).max(1_000),
    links: z.array(StructuredLinkV1Schema).max(50_000),
    footnotes: z.array(StructuredFootnoteV1Schema).max(10_000),
    assets: z.array(StructuredAssetMetadataV1Schema).max(10_000),
    quality: ExtractionQualityV1Schema,
    contentHash: z
      .string()
      .regex(/^[a-f0-9]{64}$/)
      .optional(),
    failureCode: z.string().min(1).optional(),
    safeFailureMessage: z.string().min(1).optional(),
    limitations: z.array(z.string().min(1)),
  })
  .strict();
export type StructuredContentItemV1 = z.infer<typeof StructuredContentItemV1Schema>;

export const StructuredContentArtifactV1Schema = z
  .object({
    schemaVersion: z.literal("1.0"),
    artifactKind: z.literal("structured_content.v1"),
    artifactId: z.string().min(1),
    requestId: z.string().min(1),
    searchResultsDigest: z.string().regex(/^[a-f0-9]{64}$/),
    frontierArtifactId: z.string().min(1),
    frontierDigest: z.string().regex(/^[a-f0-9]{64}$/),
    extractedContentArtifactId: z.string().min(1).optional(),
    extractedContentDigest: z
      .string()
      .regex(/^[a-f0-9]{64}$/)
      .optional(),
    parserPolicy: z
      .object({
        policyVersion: z.string().min(1),
        maximumResources: z.number().int().positive(),
        maximumMarkdownCharactersPerResource: z.number().int().min(10_000).max(1_000_000),
        maximumSectionsPerResource: z.number().int().positive(),
        maximumTablesPerResource: z.number().int().positive(),
        maximumLinksPerResource: z.number().int().positive(),
        maximumAssetsPerResource: z.number().int().positive(),
      })
      .strict(),
    items: z.array(StructuredContentItemV1Schema),
    summary: z
      .object({
        selectedResources: z.number().int().nonnegative(),
        attemptedResources: z.number().int().nonnegative(),
        successfulParses: z.number().int().nonnegative(),
        partialParses: z.number().int().nonnegative(),
        failedParses: z.number().int().nonnegative(),
        blockedResources: z.number().int().nonnegative(),
        manualRequiredResources: z.number().int().nonnegative(),
        ocrRequiredResources: z.number().int().nonnegative(),
        htmlResources: z.number().int().nonnegative(),
        documentResources: z.number().int().nonnegative(),
        totalDownloadedBytes: z.number().int().nonnegative(),
        totalMarkdownCharacters: z.number().int().nonnegative(),
        totalSections: z.number().int().nonnegative(),
        totalTables: z.number().int().nonnegative(),
        totalRuntimeMs: z.number().int().nonnegative(),
      })
      .strict(),
    coverage: z
      .object({
        resourceKinds: z.array(StructuredResourceKindV1Schema),
        parserProviderIds: z.array(StructuredParserProviderIdV1Schema),
        successfulDomains: z.array(z.string().min(1)),
        failedDomains: z.array(z.string().min(1)),
        limitations: z.array(z.string().min(1)),
      })
      .strict(),
    warnings: z.array(z.string().min(1)),
  })
  .strict()
  .superRefine((value, context) => {
    const itemIds = new Set<string>();
    for (const [index, item] of value.items.entries()) {
      if (itemIds.has(item.structuredContentItemId)) {
        context.addIssue({
          code: "custom",
          path: ["items", index, "structuredContentItemId"],
          message: "structuredContentItemId values must be unique",
        });
      }
      itemIds.add(item.structuredContentItemId);
    }
    const outcomeCount = (outcome: StructuredParseOutcomeV1) =>
      value.items.filter((item) => item.outcome === outcome).length;
    const documentKinds = new Set<StructuredResourceKindV1>([
      "pdf_document",
      "word_document",
      "presentation",
      "spreadsheet",
      "opendocument_text",
      "opendocument_presentation",
      "opendocument_spreadsheet",
      "rich_text_document",
      "epub_document",
      "csv_document",
      "unknown_document",
    ]);
    const checks: Array<[number, number, Array<string | number>]> = [
      [value.summary.selectedResources, value.items.length, ["summary", "selectedResources"]],
      [
        value.summary.attemptedResources,
        value.items.filter((item) => item.fetchedAt !== undefined).length,
        ["summary", "attemptedResources"],
      ],
      [value.summary.successfulParses, outcomeCount("success"), ["summary", "successfulParses"]],
      [value.summary.partialParses, outcomeCount("partial"), ["summary", "partialParses"]],
      [value.summary.failedParses, outcomeCount("failed"), ["summary", "failedParses"]],
      [value.summary.blockedResources, outcomeCount("blocked"), ["summary", "blockedResources"]],
      [
        value.summary.manualRequiredResources,
        outcomeCount("manual_required"),
        ["summary", "manualRequiredResources"],
      ],
      [
        value.summary.ocrRequiredResources,
        outcomeCount("ocr_required"),
        ["summary", "ocrRequiredResources"],
      ],
      [
        value.summary.htmlResources,
        value.items.filter((item) => item.resourceKind === "html_page").length,
        ["summary", "htmlResources"],
      ],
      [
        value.summary.documentResources,
        value.items.filter((item) => documentKinds.has(item.resourceKind)).length,
        ["summary", "documentResources"],
      ],
      [
        value.summary.totalMarkdownCharacters,
        value.items.reduce((sum, item) => sum + (item.markdown?.characterCount ?? 0), 0),
        ["summary", "totalMarkdownCharacters"],
      ],
      [
        value.summary.totalSections,
        value.items.reduce((sum, item) => sum + item.sections.length, 0),
        ["summary", "totalSections"],
      ],
      [
        value.summary.totalTables,
        value.items.reduce((sum, item) => sum + item.tables.length, 0),
        ["summary", "totalTables"],
      ],
    ];
    for (const [actual, expected, path] of checks) {
      if (actual !== expected) {
        context.addIssue({ code: "custom", path, message: "summary count mismatch" });
      }
    }
  });
export type StructuredContentArtifactV1 = z.infer<typeof StructuredContentArtifactV1Schema>;
