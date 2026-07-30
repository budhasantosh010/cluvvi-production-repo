import { z } from "zod";
import { CurrencyCodeSchema, UuidSchema } from "./common";

export const MissionStatusSchema = z.enum(["draft", "active", "archived"]);
export type MissionStatus = z.infer<typeof MissionStatusSchema>;

const optionalMoneySchema = z.number().finite().nonnegative().nullable();

export const CreateMissionInputSchema = z
  .object({
    workspaceId: UuidSchema,
    name: z.string().trim().min(3, "Give this mission a clear name.").max(120),
    websiteUrl: z.url({ protocol: /^https?$/ }),
    rawDescription: z
      .string()
      .trim()
      .min(20, "Explain what you sell in at least 20 characters.")
      .max(5_000),
    customerOutcome: z
      .string()
      .trim()
      .min(10, "Describe the result the customer receives.")
      .max(2_000),
    priceMin: optionalMoneySchema.default(null),
    priceMax: optionalMoneySchema.default(null),
    currency: CurrencyCodeSchema.default("USD"),
    geographies: z.array(z.string().trim().min(2).max(80)).min(1).max(20),
    desiredCount: z.number().int().min(1).max(100).default(20),
    exclusions: z.array(z.string().trim().min(2).max(200)).max(50).default([]),
    capacityNotes: z.string().trim().max(2_000).nullable().default(null),
  })
  .superRefine((value, context) => {
    if (value.priceMin !== null && value.priceMax !== null && value.priceMin > value.priceMax) {
      context.addIssue({
        code: "custom",
        path: ["priceMax"],
        message: "Maximum price must be greater than or equal to minimum price.",
      });
    }
  });

export type CreateMissionInput = z.infer<typeof CreateMissionInputSchema>;

export const MissionSchema = CreateMissionInputSchema.extend({
  id: UuidSchema,
  status: MissionStatusSchema,
  createdAt: z.iso.datetime({ offset: true }),
  updatedAt: z.iso.datetime({ offset: true }),
});
export type Mission = z.infer<typeof MissionSchema>;
