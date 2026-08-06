import { z } from "zod";
import {
  StructuredParseOutcomeV1Schema,
  StructuredParserProviderIdV1Schema,
  StructuredResourceKindV1Schema,
} from "./structured-content-v1";

export const ContentParseAttemptTelemetryV1Schema = z
  .object({
    structuredContentItemId: z.string().min(1),
    sourceResultId: z.string().min(1),
    frontierItemId: z.string().min(1),
    domain: z.string().min(1),
    resourceKind: StructuredResourceKindV1Schema,
    parserProviderId: StructuredParserProviderIdV1Schema,
    attempted: z.boolean(),
    outcome: StructuredParseOutcomeV1Schema,
    downloadedBytes: z.number().int().nonnegative(),
    markdownCharacters: z.number().int().nonnegative(),
    sectionCount: z.number().int().nonnegative(),
    tableCount: z.number().int().nonnegative(),
    assetCount: z.number().int().nonnegative(),
    durationMs: z.number().int().nonnegative(),
    workerExitCode: z.number().int().optional(),
    workerTerminated: z.boolean().optional(),
    safeFailureCode: z.string().min(1).optional(),
    safeFailureMessage: z.string().min(1).optional(),
  })
  .strict();
export type ContentParseAttemptTelemetryV1 = z.infer<typeof ContentParseAttemptTelemetryV1Schema>;

export const ContentParseTelemetryV1Schema = z
  .object({
    schemaVersion: z.literal("1.0"),
    artifactKind: z.literal("content_parse_telemetry.v1"),
    artifactId: z.string().min(1),
    requestId: z.string().min(1),
    structuredContentArtifactId: z.string().min(1),
    startedAt: z.iso.datetime(),
    completedAt: z.iso.datetime(),
    totalRuntimeMs: z.number().int().nonnegative(),
    parserPolicyVersion: z.string().min(1),
    attempts: z.array(ContentParseAttemptTelemetryV1Schema),
    totals: z
      .object({
        resourcesConsidered: z.number().int().nonnegative(),
        resourcesAttempted: z.number().int().nonnegative(),
        htmlAttempts: z.number().int().nonnegative(),
        documentAttempts: z.number().int().nonnegative(),
        successfulParses: z.number().int().nonnegative(),
        partialParses: z.number().int().nonnegative(),
        failedParses: z.number().int().nonnegative(),
        blockedResources: z.number().int().nonnegative(),
        manualRequiredResources: z.number().int().nonnegative(),
        ocrRequiredResources: z.number().int().nonnegative(),
        downloadedBytes: z.number().int().nonnegative(),
        markdownCharacters: z.number().int().nonnegative(),
        parserWorkerStarts: z.number().int().nonnegative(),
        parserWorkerFailures: z.number().int().nonnegative(),
        parserWorkerTimeouts: z.number().int().nonnegative(),
        parserWorkerCancellations: z.number().int().nonnegative(),
      })
      .strict(),
    warnings: z.array(z.string().min(1)),
  })
  .strict()
  .superRefine((value, context) => {
    const outcomeCount = (outcome: string) =>
      value.attempts.filter((attempt) => attempt.outcome === outcome).length;
    const checks: Array<[number, number, Array<string | number>]> = [
      [value.totals.resourcesConsidered, value.attempts.length, ["totals", "resourcesConsidered"]],
      [
        value.totals.resourcesAttempted,
        value.attempts.filter((attempt) => attempt.attempted).length,
        ["totals", "resourcesAttempted"],
      ],
      [
        value.totals.htmlAttempts,
        value.attempts.filter(
          (attempt) => attempt.attempted && attempt.parserProviderId === "basic_html_structurer",
        ).length,
        ["totals", "htmlAttempts"],
      ],
      [
        value.totals.documentAttempts,
        value.attempts.filter(
          (attempt) => attempt.attempted && attempt.parserProviderId === "anydoc_document_parser",
        ).length,
        ["totals", "documentAttempts"],
      ],
      [value.totals.successfulParses, outcomeCount("success"), ["totals", "successfulParses"]],
      [value.totals.partialParses, outcomeCount("partial"), ["totals", "partialParses"]],
      [value.totals.failedParses, outcomeCount("failed"), ["totals", "failedParses"]],
      [value.totals.blockedResources, outcomeCount("blocked"), ["totals", "blockedResources"]],
      [
        value.totals.manualRequiredResources,
        outcomeCount("manual_required"),
        ["totals", "manualRequiredResources"],
      ],
      [
        value.totals.ocrRequiredResources,
        outcomeCount("ocr_required"),
        ["totals", "ocrRequiredResources"],
      ],
      [
        value.totals.downloadedBytes,
        value.attempts.reduce((sum, attempt) => sum + attempt.downloadedBytes, 0),
        ["totals", "downloadedBytes"],
      ],
      [
        value.totals.markdownCharacters,
        value.attempts.reduce((sum, attempt) => sum + attempt.markdownCharacters, 0),
        ["totals", "markdownCharacters"],
      ],
    ];
    for (const [actual, expected, path] of checks) {
      if (actual !== expected) {
        context.addIssue({ code: "custom", path, message: "telemetry total mismatch" });
      }
    }
  });
export type ContentParseTelemetryV1 = z.infer<typeof ContentParseTelemetryV1Schema>;
