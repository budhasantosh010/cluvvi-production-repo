import { z } from "zod";
import { UuidSchema } from "./common";

export const WorkspaceRoleSchema = z.enum(["owner", "admin", "member"]);
export type WorkspaceRole = z.infer<typeof WorkspaceRoleSchema>;

export const CreateWorkspaceInputSchema = z.object({
  name: z.string().trim().min(2, "Workspace name is too short.").max(80),
});
export type CreateWorkspaceInput = z.infer<typeof CreateWorkspaceInputSchema>;

export const WorkspaceSchema = z.object({
  id: UuidSchema,
  name: z.string().min(1),
  ownerUserId: UuidSchema,
  createdAt: z.iso.datetime({ offset: true }),
  updatedAt: z.iso.datetime({ offset: true }),
});
export type Workspace = z.infer<typeof WorkspaceSchema>;
