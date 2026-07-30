import {
  LeasedQueueMessageSchema,
  ProcessCompileResultSchema,
  type LeasedQueueMessage,
  type MissionCompileProcessor,
  type ProcessCompileResult,
} from "@cluvvi/core";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import type { Database } from "./types";

const leasedRowSchema = z.object({
  queue_message_id: z.number().int().positive(),
  read_count: z.number().int().nonnegative(),
  enqueued_at: z.iso.datetime({ offset: true }),
  visibility_deadline: z.iso.datetime({ offset: true }),
  message: z.unknown(),
});

export class MissionCompileGateway implements MissionCompileProcessor {
  readonly #client: SupabaseClient<Database>;

  constructor(client: SupabaseClient<Database>) {
    this.#client = client;
  }

  async lease(options: {
    quantity: number;
    visibilityTimeoutSeconds: number;
  }): Promise<LeasedQueueMessage[]> {
    const { data, error } = await this.#client.rpc("lease_mission_compile_messages", {
      p_quantity: options.quantity,
      p_visibility_timeout_seconds: options.visibilityTimeoutSeconds,
    });

    if (error) {
      throw new Error(`Unable to lease mission_compile messages: ${error.message}`);
    }

    return data.map((rawRow) => {
      const row = leasedRowSchema.parse(rawRow);
      return LeasedQueueMessageSchema.parse({
        queueMessageId: row.queue_message_id,
        readCount: row.read_count,
        enqueuedAt: row.enqueued_at,
        visibilityDeadline: row.visibility_deadline,
        message: row.message,
      });
    });
  }

  async process(message: LeasedQueueMessage): Promise<ProcessCompileResult> {
    const { data, error } = await this.#client.rpc("process_mission_compile_message", {
      p_queue_message_id: message.queueMessageId,
      p_run_id: message.message.runId,
      p_message_id: message.message.messageId,
      p_idempotency_key: message.message.idempotencyKey,
    });

    if (error) {
      throw new Error(`Unable to process mission_compile message: ${error.message}`);
    }

    return ProcessCompileResultSchema.parse({
      outcome: data.outcome,
      runId: data.run_id,
      status: data.status,
    });
  }
}
