import { z } from "zod";

/** Roles that can own or see an event file requirement. Guests never take part in the matrix. */
export const FILE_REQUIREMENT_ROLES = ["pmcm-admin", "client", "supplier", "coordinator"] as const;
export const fileRequirementRoleSchema = z.enum(FILE_REQUIREMENT_ROLES);
export type FileRequirementRole = z.infer<typeof fileRequirementRoleSchema>;

export const FILE_REQUIREMENT_SOURCE_WORKFLOWS = [
  "client_onboarding",
  "commercial",
  "floorplans",
  "supplier_network",
  "live_ops",
  "closure",
  "custom",
] as const;
export const fileRequirementSourceWorkflowSchema = z.enum(FILE_REQUIREMENT_SOURCE_WORKFLOWS);

/** Keys the API derives from workflow records; PMCM may override them but cannot create them. */
export const DERIVED_FILE_REQUIREMENT_KEYS = [
  "signed_conforme",
  "post_event_documents",
  "billing_statement",
  "official_floorplan",
  "supplier_reviews",
  "client_feedback",
  "logistics",
  "issues",
] as const;

export const fileRequirementKeySchema = z
  .string()
  .trim()
  .regex(/^[a-z][a-z0-9_]{1,62}$/, "Use 2-63 lowercase letters, digits, or underscores, starting with a letter");

const visibleToRolesSchema = z
  .array(fileRequirementRoleSchema)
  .min(1)
  .max(FILE_REQUIREMENT_ROLES.length)
  .refine((roles) => new Set(roles).size === roles.length, "Visibility roles must be unique")
  .refine((roles) => roles.includes("pmcm-admin"), "PMCM must always see file requirements");

const dueAtSchema = z.iso.datetime({ offset: true }).nullable();

export const createFileRequirementSchema = z
  .object({
    key: fileRequirementKeySchema,
    label: z.string().trim().min(1).max(120),
    ownerRole: fileRequirementRoleSchema,
    visibleToRoles: visibleToRolesSchema,
    required: z.boolean().default(true),
    dueAt: dueAtSchema.optional(),
    sourceWorkflow: fileRequirementSourceWorkflowSchema.default("custom"),
    notes: z.string().trim().max(1000).optional(),
  })
  .strict()
  .refine((input) => input.visibleToRoles.includes(input.ownerRole), {
    message: "The owner role must be able to see the requirement",
    path: ["visibleToRoles"],
  });
export type CreateFileRequirementInput = z.infer<typeof createFileRequirementSchema>;

/**
 * PMCM override of a derived or custom requirement. `label` applies to custom
 * requirements only; `expectedRevision` rejects stale edits.
 */
export const updateFileRequirementSchema = z
  .object({
    label: z.string().trim().min(1).max(120).optional(),
    ownerRole: fileRequirementRoleSchema.optional(),
    visibleToRoles: visibleToRolesSchema.optional(),
    required: z.boolean().optional(),
    dueAt: dueAtSchema.optional(),
    notes: z.string().trim().max(1000).nullable().optional(),
    expectedRevision: z.number().int().nonnegative().optional(),
  })
  .strict()
  .refine(
    (input) => ["label", "ownerRole", "visibleToRoles", "required", "dueAt", "notes"].some((field) => input[field as keyof typeof input] !== undefined),
    "Change at least one requirement field",
  );
export type UpdateFileRequirementInput = z.infer<typeof updateFileRequirementSchema>;

export const bindFileRequirementUploadSchema = z.object({ objectId: z.string().trim().min(1).max(200) }).strict();
export type BindFileRequirementUploadInput = z.infer<typeof bindFileRequirementUploadSchema>;
