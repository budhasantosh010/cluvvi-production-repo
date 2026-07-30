import { z } from "zod";
import { IsoDateTimeSchema, JsonObjectSchema, UuidSchema } from "./common";

export const QUEUE_MESSAGE_VERSION = 1 as const;
export const QueueJobTypeSchema = z.enum(["mission_compile"]);
export type QueueJobType = z.infer<typeof QueueJobTypeSchema>;

export const QueueMessageEnvelopeSchema = z.object({
  version: z.literal(QUEUE_MESSAGE_VERSION),
  messageId: UuidSchema,
  jobType: QueueJobTypeSchema,
  runId: UuidSchema,
  entityId: UuidSchema.nullable().default(null),
  attempt: z.number().int().min(1).max(10),
  idempotencyKey: z.string().trim().min(8).max(200),
  createdAt: IsoDateTimeSchema,
  payload: JsonObjectSchema,
});
export type QueueMessageEnvelope = z.infer<typeof QueueMessageEnvelopeSchema>;

export const LeasedQueueMessageSchema = z.object({
  queueMessageId: z.number().int().positive(),
  readCount: z.number().int().nonnegative(),
  enqueuedAt: IsoDateTimeSchema,
  visibilityDeadline: IsoDateTimeSchema,
  message: QueueMessageEnvelopeSchema,
});
export type LeasedQueueMessage = z.infer<typeof LeasedQueueMessageSchema>;

export function createMissionCompileMessage(input: {
  messageId: string;
  runId: string;
  idempotencyKey: string;
  createdAt: string;
}): QueueMessageEnvelope {
  return QueueMessageEnvelopeSchema.parse({
    version: QUEUE_MESSAGE_VERSION,
    messageId: input.messageId,
    jobType: "mission_compile",
    runId: input.runId,
    entityId: null,
    attempt: 1,
    idempotencyKey: input.idempotencyKey,
    createdAt: input.createdAt,
    payload: {},
  });
}
