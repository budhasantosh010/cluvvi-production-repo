import { z } from "zod";
import { OpaqueIdSchema } from "./ids";

const PriceSchema = z
  .object({
    minimum: z.number().finite().nonnegative().optional(),
    maximum: z.number().finite().nonnegative().optional(),
    currency: z
      .string()
      .trim()
      .length(3)
      .transform((value) => value.toUpperCase())
      .default("USD"),
    billingPeriod: z.enum(["one_time", "monthly", "annual", "usage", "unknown"]).default("unknown"),
  })
  .strict()
  .superRefine((value, context) => {
    if (
      value.minimum !== undefined &&
      value.maximum !== undefined &&
      value.minimum > value.maximum
    ) {
      context.addIssue({
        code: "custom",
        path: ["maximum"],
        message: "Maximum price must be greater than or equal to minimum price.",
      });
    }
  });

export const MissionInputSchemaV1 = z
  .object({
    schemaVersion: z.literal("1.0"),
    name: z.string().trim().min(1).max(160),
    website: z.url({ protocol: /^https?$/ }).optional(),
    description: z.string().trim().min(20).max(20_000),
    customerOutcome: z.string().trim().max(2_000).optional(),
    price: PriceSchema.optional(),
    geographies: z.array(z.string().trim().min(1).max(120)).max(50).default(["global"]),
    desiredOpportunities: z.number().int().min(1).max(100).default(20),
    exclusions: z.array(z.string().trim().min(1).max(300)).max(100).default([]),
    goodCustomerExamples: z.array(z.string().trim().min(1).max(500)).max(50).default([]),
    badCustomerExamples: z.array(z.string().trim().min(1).max(500)).max(50).default([]),
    capacityNotes: z.string().trim().max(2_000).optional(),
    additionalContext: z.string().trim().max(10_000).optional(),
  })
  .strict();

export type MissionInputV1 = z.infer<typeof MissionInputSchemaV1>;

export const LocalMissionSchema = z.object({
  id: OpaqueIdSchema,
  input: MissionInputSchemaV1,
  sourceFile: z.string().min(1),
  createdAt: z.iso.datetime({ offset: true }),
});
export type LocalMission = z.infer<typeof LocalMissionSchema>;
