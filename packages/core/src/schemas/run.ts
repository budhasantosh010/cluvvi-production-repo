import { z } from "zod";
import { RunEventTypeSchema, RunStatusSchema } from "../domain/run";
import { JsonObjectSchema, UuidSchema } from "./common";

export const StartRunInputSchema = z.object({
  missionId: UuidSchema,
  requestedCount: z.number().int().min(1).max(100).default(20),
  budgetUsd: z.number().finite().positive().max(100_000),
  idempotencyKey: z.string().trim().min(8).max(200),
});
export type StartRunInput = z.infer<typeof StartRunInputSchema>;

export const RunSchema = z.object({
  id: UuidSchema,
  workspaceId: UuidSchema,
  missionId: UuidSchema,
  status: RunStatusSchema,
  phase: z.string().trim().min(1),
  requestedCount: z.number().int().positive(),
  budgetUsd: z.number().nonnegative(),
  createdAt: z.iso.datetime({ offset: true }),
  startedAt: z.iso.datetime({ offset: true }).nullable(),
  completedAt: z.iso.datetime({ offset: true }).nullable(),
});
export type Run = z.infer<typeof RunSchema>;

export const RunEventSchema = z.object({
  id: UuidSchema,
  workspaceId: UuidSchema,
  runId: UuidSchema,
  eventType: RunEventTypeSchema,
  fromStatus: RunStatusSchema.nullable(),
  toStatus: RunStatusSchema,
  actorType: z.enum(["user", "worker", "system"]),
  actorId: UuidSchema.nullable(),
  idempotencyKey: z.string().min(1),
  metadata: JsonObjectSchema,
  createdAt: z.iso.datetime({ offset: true }),
});
export type RunEvent = z.infer<typeof RunEventSchema>;

export const ProcessCompileResultSchema = z.object({
  outcome: z.enum(["processed", "duplicate", "missing_run", "invalid_state"]),
  runId: UuidSchema,
  status: RunStatusSchema.nullable(),
});
export type ProcessCompileResult = z.infer<typeof ProcessCompileResultSchema>;
