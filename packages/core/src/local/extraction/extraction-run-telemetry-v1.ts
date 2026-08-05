import { z } from "zod";
import { ExtractionTypeV1Schema } from "./extracted-content-v1";

export const RobotsDecisionV1Schema = z.enum([
  "allowed",
  "disallowed",
  "unavailable_allowed_with_warning",
  "not_checked",
]);

export const ExtractionFetchTelemetryV1Schema = z
  .object({
    frontierItemId: z.string().min(1),
    sourceResultId: z.string().min(1),
    requestedDomain: z.string().min(1),
    finalDomain: z.string().min(1).optional(),
    attempted: z.boolean(),
    success: z.boolean(),
    attempts: z.number().int().nonnegative(),
    durationMs: z.number().int().nonnegative(),
    statusCode: z.number().int().min(100).max(599).optional(),
    contentType: z.string().min(1).optional(),
    downloadedBytes: z.number().int().nonnegative(),
    extractedCharacters: z.number().int().nonnegative(),
    redirectCount: z.number().int().nonnegative(),
    robotsDecision: RobotsDecisionV1Schema,
    extractionTypes: z.array(ExtractionTypeV1Schema),
    safeFailureCode: z.string().min(1).optional(),
    safeFailureMessage: z.string().min(1).optional(),
  })
  .strict();
export type ExtractionFetchTelemetryV1 = z.infer<typeof ExtractionFetchTelemetryV1Schema>;

export const ExtractionRunTelemetryV1Schema = z
  .object({
    schemaVersion: z.literal("1.0"),
    artifactKind: z.literal("extraction_run_telemetry.v1"),
    artifactId: z.string().min(1),
    requestId: z.string().min(1),
    extractionMode: z.literal("selected_public_pages"),
    frontierArtifactId: z.string().min(1),
    extractedContentArtifactId: z.string().min(1),
    startedAt: z.iso.datetime(),
    completedAt: z.iso.datetime(),
    totalRuntimeMs: z.number().int().nonnegative(),
    frontier: z
      .object({
        evaluated: z.number().int().nonnegative(),
        selected: z.number().int().nonnegative(),
        skipped: z.number().int().nonnegative(),
        blocked: z.number().int().nonnegative(),
      })
      .strict(),
    fetches: z.array(ExtractionFetchTelemetryV1Schema),
    totals: z
      .object({
        attemptedRequests: z.number().int().nonnegative(),
        successfulRequests: z.number().int().nonnegative(),
        failedRequests: z.number().int().nonnegative(),
        downloadedBytes: z.number().int().nonnegative(),
        extractedCharacters: z.number().int().nonnegative(),
        redirects: z.number().int().nonnegative(),
        retries: z.number().int().nonnegative(),
      })
      .strict(),
    warnings: z.array(z.string().min(1)),
  })
  .strict()
  .superRefine((value, context) => {
    const attempted = value.fetches.filter((fetch) => fetch.attempted).length;
    const successful = value.fetches.filter((fetch) => fetch.success).length;
    if (value.totals.attemptedRequests !== attempted) {
      context.addIssue({
        code: "custom",
        path: ["totals", "attemptedRequests"],
        message: "attempted request total mismatch",
      });
    }
    if (value.totals.successfulRequests !== successful) {
      context.addIssue({
        code: "custom",
        path: ["totals", "successfulRequests"],
        message: "successful request total mismatch",
      });
    }
    if (value.totals.failedRequests !== attempted - successful) {
      context.addIssue({
        code: "custom",
        path: ["totals", "failedRequests"],
        message: "failed request total mismatch",
      });
    }
  });
export type ExtractionRunTelemetryV1 = z.infer<typeof ExtractionRunTelemetryV1Schema>;
