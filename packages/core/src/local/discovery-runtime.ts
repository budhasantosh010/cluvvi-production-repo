import { z } from "zod";
import { OpaqueIdSchema } from "./ids";

export const DiscoveryRuntimeModeSchema = z.enum(["fixture", "local_discovery_engine"]);
export type DiscoveryRuntimeMode = z.infer<typeof DiscoveryRuntimeModeSchema>;

export const LocalDiscoveryExecutionRecordV1Schema = z
  .object({
    schemaVersion: z.literal("1.0"),
    artifactKind: z.literal("local_discovery_execution.v1"),
    runId: OpaqueIdSchema,
    requestId: z.string().min(1),
    projectPath: z.string().min(1),
    projectCommitSha: z
      .string()
      .regex(/^[a-f0-9]{40}$/)
      .optional(),
    command: z.string().min(1),
    arguments: z.array(z.string()),
    startedAt: z.iso.datetime({ offset: true }),
    completedAt: z.iso.datetime({ offset: true }).optional(),
    durationMs: z.number().int().nonnegative().optional(),
    exitCode: z.number().int().optional(),
    timedOut: z.boolean(),
    cancelled: z.boolean(),
    requestPath: z.string().min(1),
    outputPath: z.string().min(1),
    stdoutPath: z.string().min(1),
    stderrPath: z.string().min(1),
    providerIds: z.array(z.string().min(1)).optional(),
    success: z.boolean(),
    errorCode: z.string().min(1).optional(),
    errorMessage: z.string().min(1).optional(),
  })
  .strict();
export type LocalDiscoveryExecutionRecordV1 = z.infer<typeof LocalDiscoveryExecutionRecordV1Schema>;
