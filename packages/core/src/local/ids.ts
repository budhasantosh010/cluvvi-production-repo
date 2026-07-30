import { z } from "zod";

export const IdPrefixSchema = z.enum([
  "mission",
  "run",
  "event",
  "stage",
  "artifact",
  "tool",
  "evaluation",
  "request",
]);
export type IdPrefix = z.infer<typeof IdPrefixSchema>;

export const OpaqueIdSchema = z
  .string()
  .regex(/^(mission|run|event|stage|artifact|tool|evaluation|request)_[a-f0-9]{32}$/);
export type OpaqueId = z.infer<typeof OpaqueIdSchema>;

export function createOpaqueId(prefix: IdPrefix): OpaqueId {
  return `${prefix}_${globalThis.crypto.randomUUID().replaceAll("-", "")}`;
}
