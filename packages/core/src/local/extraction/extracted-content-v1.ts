import { z } from "zod";

export const ExtractionTypeV1Schema = z.enum(["page_metadata", "page_text", "json_ld"]);
export type ExtractionTypeV1 = z.infer<typeof ExtractionTypeV1Schema>;

export const ExtractionOutcomeV1Schema = z.enum([
  "success",
  "partial",
  "failed",
  "blocked",
  "manual_required",
]);
export type ExtractionOutcomeV1 = z.infer<typeof ExtractionOutcomeV1Schema>;

export const PageMetadataV1Schema = z
  .object({
    title: z.string().min(1).optional(),
    description: z.string().min(1).optional(),
    canonicalUrl: z.url().optional(),
    author: z.string().min(1).optional(),
    siteName: z.string().min(1).optional(),
    language: z.string().min(1).optional(),
    publishedAt: z.iso.datetime().optional(),
    modifiedAt: z.iso.datetime().optional(),
    openGraph: z
      .object({
        title: z.string().min(1).optional(),
        description: z.string().min(1).optional(),
        type: z.string().min(1).optional(),
        url: z.url().optional(),
        siteName: z.string().min(1).optional(),
        imageUrl: z.url().optional(),
      })
      .strict()
      .optional(),
    twitterCard: z
      .object({
        card: z.string().min(1).optional(),
        title: z.string().min(1).optional(),
        description: z.string().min(1).optional(),
      })
      .strict()
      .optional(),
  })
  .strict();
export type PageMetadataV1 = z.infer<typeof PageMetadataV1Schema>;

const JsonLdAddressV1Schema = z
  .object({
    streetAddress: z.string().min(1).optional(),
    locality: z.string().min(1).optional(),
    region: z.string().min(1).optional(),
    postalCode: z.string().min(1).optional(),
    country: z.string().min(1).optional(),
  })
  .strict();

export const JsonLdEntityV1Schema = z
  .object({
    types: z.array(z.string().min(1)).min(1),
    id: z.string().min(1).optional(),
    url: z.url().optional(),
    name: z.string().min(1).optional(),
    headline: z.string().min(1).optional(),
    description: z.string().min(1).optional(),
    authorNames: z.array(z.string().min(1)).optional(),
    publisherName: z.string().min(1).optional(),
    datePublished: z.iso.datetime().optional(),
    dateModified: z.iso.datetime().optional(),
    sameAs: z.array(z.url()).max(25).optional(),
    organizationName: z.string().min(1).optional(),
    hiringOrganizationName: z.string().min(1).optional(),
    employmentType: z.array(z.string().min(1)).max(20).optional(),
    jobLocationText: z.array(z.string().min(1)).max(20).optional(),
    validThrough: z.iso.datetime().optional(),
    address: JsonLdAddressV1Schema.optional(),
    price: z.string().min(1).optional(),
    priceCurrency: z.string().min(1).optional(),
    sourceBlockIndex: z.number().int().nonnegative(),
    confidence: z.number().min(0).max(1),
    limitations: z.array(z.string().min(1)),
  })
  .strict();
export type JsonLdEntityV1 = z.infer<typeof JsonLdEntityV1Schema>;

export const ExtractedContentItemV1Schema = z
  .object({
    extractionItemId: z.string().min(1),
    sourceResultId: z.string().min(1),
    frontierItemId: z.string().min(1),
    requestedUrl: z.url(),
    finalUrl: z.url().optional(),
    canonicalUrl: z.url().optional(),
    outcome: ExtractionOutcomeV1Schema,
    trustClassification: z.literal("untrusted_public_content"),
    fetchedAt: z.iso.datetime().optional(),
    http: z
      .object({
        statusCode: z.number().int().min(100).max(599),
        contentType: z.string().min(1).optional(),
        declaredContentLength: z.number().int().nonnegative().optional(),
        downloadedBytes: z.number().int().nonnegative(),
        redirectCount: z.number().int().nonnegative(),
      })
      .strict()
      .optional(),
    metadata: PageMetadataV1Schema.optional(),
    text: z
      .object({
        content: z.string().min(1).max(200_000),
        characterCount: z.number().int().positive().max(200_000),
        wordCount: z.number().int().nonnegative(),
        truncated: z.boolean(),
        contentHash: z.string().regex(/^[a-f0-9]{64}$/),
        extractionMethod: z.string().min(1),
      })
      .strict()
      .optional(),
    structuredData: z.array(JsonLdEntityV1Schema).max(100).optional(),
    extractionTypes: z.array(ExtractionTypeV1Schema),
    extractorProviderId: z.literal("basic_public_html_extractor"),
    extractorVersion: z.string().min(1),
    extractionConfidence: z.number().min(0).max(1),
    failureCode: z.string().min(1).optional(),
    safeFailureMessage: z.string().min(1).optional(),
    limitations: z.array(z.string().min(1)),
  })
  .strict()
  .superRefine((value, context) => {
    if (value.text !== undefined && value.text.characterCount !== value.text.content.length) {
      context.addIssue({
        code: "custom",
        path: ["text", "characterCount"],
        message: "characterCount must equal content.length",
      });
    }
    if (value.text !== undefined && !value.extractionTypes.includes("page_text")) {
      context.addIssue({
        code: "custom",
        path: ["extractionTypes"],
        message: "page_text type missing",
      });
    }
    if (value.metadata !== undefined && !value.extractionTypes.includes("page_metadata")) {
      context.addIssue({
        code: "custom",
        path: ["extractionTypes"],
        message: "page_metadata type missing",
      });
    }
    if ((value.structuredData?.length ?? 0) > 0 && !value.extractionTypes.includes("json_ld")) {
      context.addIssue({
        code: "custom",
        path: ["extractionTypes"],
        message: "json_ld type missing",
      });
    }
  });
export type ExtractedContentItemV1 = z.infer<typeof ExtractedContentItemV1Schema>;

export const ExtractedContentArtifactV1Schema = z
  .object({
    schemaVersion: z.literal("1.0"),
    artifactKind: z.literal("extracted_content.v1"),
    artifactId: z.string().min(1),
    requestId: z.string().min(1),
    searchResultsDigest: z.string().regex(/^[a-f0-9]{64}$/),
    frontierArtifactId: z.string().min(1),
    frontierDigest: z.string().regex(/^[a-f0-9]{64}$/),
    items: z.array(ExtractedContentItemV1Schema),
    summary: z
      .object({
        selectedUrls: z.number().int().nonnegative(),
        attemptedUrls: z.number().int().nonnegative(),
        successfulExtractions: z.number().int().nonnegative(),
        partialExtractions: z.number().int().nonnegative(),
        failedExtractions: z.number().int().nonnegative(),
        blockedUrls: z.number().int().nonnegative(),
        skippedUrls: z.number().int().nonnegative(),
        downloadedBytes: z.number().int().nonnegative(),
        extractedCharacters: z.number().int().nonnegative(),
        totalRuntimeMs: z.number().int().nonnegative(),
      })
      .strict(),
    coverage: z
      .object({
        selectedDomains: z.array(z.string().min(1)),
        openedDomains: z.array(z.string().min(1)),
        failedDomains: z.array(z.string().min(1)),
        blockedDomains: z.array(z.string().min(1)),
        extractionTypes: z.array(ExtractionTypeV1Schema),
        limitations: z.array(z.string().min(1)),
      })
      .strict(),
    warnings: z.array(z.string().min(1)),
  })
  .strict()
  .superRefine((value, context) => {
    const ids = new Set<string>();
    for (const [index, item] of value.items.entries()) {
      if (ids.has(item.extractionItemId)) {
        context.addIssue({
          code: "custom",
          path: ["items", index, "extractionItemId"],
          message: "extractionItemId values must be unique",
        });
      }
      ids.add(item.extractionItemId);
    }
    const count = (outcome: string) =>
      value.items.filter((item) => item.outcome === outcome).length;
    if (value.summary.successfulExtractions !== count("success")) {
      context.addIssue({
        code: "custom",
        path: ["summary", "successfulExtractions"],
        message: "success count mismatch",
      });
    }
    if (value.summary.partialExtractions !== count("partial")) {
      context.addIssue({
        code: "custom",
        path: ["summary", "partialExtractions"],
        message: "partial count mismatch",
      });
    }
    if (value.summary.failedExtractions !== count("failed")) {
      context.addIssue({
        code: "custom",
        path: ["summary", "failedExtractions"],
        message: "failed count mismatch",
      });
    }
    if (value.summary.blockedUrls < count("blocked")) {
      context.addIssue({
        code: "custom",
        path: ["summary", "blockedUrls"],
        message: "blockedUrls cannot be lower than blocked extraction item count",
      });
    }
  });
export type ExtractedContentArtifactV1 = z.infer<typeof ExtractedContentArtifactV1Schema>;
