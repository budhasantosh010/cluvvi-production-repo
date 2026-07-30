import { z } from "zod";
import { OpaqueIdSchema } from "./ids";
import { RunFailureSchema } from "./run";

export const RunRequestActionSchema = z.enum(["start", "resume", "cancel"]);
export type RunRequestAction = z.infer<typeof RunRequestActionSchema>;

export const RunRequestStatusSchema = z.enum([
  "pending",
  "claimed",
  "completed",
  "failed",
  "cancelled",
]);
export type RunRequestStatus = z.infer<typeof RunRequestStatusSchema>;

export const RunRequestSchema = z
  .object({
    id: OpaqueIdSchema,
    runId: OpaqueIdSchema,
    action: RunRequestActionSchema,
    status: RunRequestStatusSchema,
    idempotencyKey: z.string().min(8).max(200),
    claimedBy: z.string().min(1).max(200).optional(),
    claimedAt: z.iso.datetime({ offset: true }).optional(),
    leaseExpiresAt: z.iso.datetime({ offset: true }).optional(),
    attempt: z.number().int().nonnegative(),
    failure: RunFailureSchema.optional(),
    createdAt: z.iso.datetime({ offset: true }),
    updatedAt: z.iso.datetime({ offset: true }),
    completedAt: z.iso.datetime({ offset: true }).optional(),
  })
  .strict();
export type RunRequest = z.infer<typeof RunRequestSchema>;

export const RunnerHeartbeatSchema = z
  .object({
    runnerId: z.string().min(1).max(200),
    hostname: z.string().min(1).max(255),
    processId: z.number().int().positive(),
    startedAt: z.iso.datetime({ offset: true }),
    lastSeenAt: z.iso.datetime({ offset: true }),
    metadata: z.record(z.string(), z.unknown()),
  })
  .strict();
export type RunnerHeartbeat = z.infer<typeof RunnerHeartbeatSchema>;
