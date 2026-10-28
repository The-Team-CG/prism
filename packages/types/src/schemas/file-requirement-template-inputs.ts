import { z } from "zod";
import { fileRequirementKeySchema, fileRequirementRoleSchema, FILE_REQUIREMENT_ROLES } from "./file-requirement-inputs.js";

const templateVisibilitySchema = z.array(fileRequirementRoleSchema).min(1).max(FILE_REQUIREMENT_ROLES.length)
  .refine((roles) => new Set(roles).size === roles.length, "Visibility roles must be unique")
  .refine((roles) => roles.includes("pmcm-admin"), "PMCM must always see file requirements");

export const fileRequirementTemplateItemSchema = z.object({
  key: fileRequirementKeySchema,
  label: z.string().trim().min(1).max(120),
  ownerRole: fileRequirementRoleSchema,
  visibleToRoles: templateVisibilitySchema,
  required: z.boolean().default(true),
  dueOffsetDays: z.number().int().min(0).max(3650).optional(),
  notes: z.string().trim().max(1000).optional(),
}).strict().refine((item) => item.visibleToRoles.includes(item.ownerRole), {
  message: "The owner role must be able to see the requirement",
  path: ["visibleToRoles"],
});

export const upsertFileRequirementTemplateSchema = z.object({
  eventType: z.string().trim().min(1).max(100),
  requirements: z.array(fileRequirementTemplateItemSchema).max(50)
    .refine((items) => new Set(items.map(({ key }) => key)).size === items.length, "Requirement keys must be unique"),
}).strict();

export type FileRequirementTemplateItemInput = z.infer<typeof fileRequirementTemplateItemSchema>;
export type UpsertFileRequirementTemplateInput = z.infer<typeof upsertFileRequirementTemplateSchema>;
