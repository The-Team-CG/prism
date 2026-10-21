import { z } from "zod";
import { optionalTrimmedStringSchema } from "./common.js";

/**
 * Explicit field patch for an approved correction request. Only the subject's own identity and contact fields
 * can be corrected; any other key is rejected by `.strict()`.
 */
export const privacyCorrectionPatchSchema = z
  .object({
    name: z.string().trim().min(1).max(200).optional(),
    email: z.string().trim().email().max(254).optional(),
  })
  .strict()
  .refine((patch) => patch.name !== undefined || patch.email !== undefined, {
    message: "Correction must change at least one identity or contact field",
  });
export type PrivacyCorrectionPatch = z.infer<typeof privacyCorrectionPatchSchema>;

export const executePrivacyRequestSchema = z.object({
  executionNotes: optionalTrimmedStringSchema,
  correction: privacyCorrectionPatchSchema.optional(),
});
export type ExecutePrivacyRequestInput = z.infer<typeof executePrivacyRequestSchema>;

/** Days PMCM has to close a privacy request after it is logged; `dueAt` is set from this at creation. */
export const PRISM_PRIVACY_REQUEST_SLA_DAYS = 30;
export const PRISM_PRIVACY_REQUEST_MAX_PAGE_LIMIT = 100;
/** Assignee filter value that selects requests nobody owns yet. */
export const PRISM_PRIVACY_REQUEST_UNASSIGNED = "unassigned";

export const privacyRequestStatusFilterSchema = z.enum(["all", "open", "submitted", "approved", "rejected", "executed"]);
export type PrivacyRequestStatusFilter = z.infer<typeof privacyRequestStatusFilterSchema>;

/**
 * PMCM privacy queue query. `open` selects submitted and approved requests; `overdue` is a strict "true"/"false"
 * string so a query value of "false" never coerces to true; `assignedTo` is an operator id or "unassigned".
 */
export const listPrivacyRequestsQuerySchema = z.object({
  eventId: z.string().trim().min(1).max(200).optional(),
  status: privacyRequestStatusFilterSchema.default("all"),
  requestType: z.enum(["all", "access", "correction", "deletion", "export"]).default("all"),
  subjectType: z.enum(["all", "client", "supplier", "guest", "account"]).default("all"),
  overdue: z.enum(["true", "false"]).transform((value) => value === "true").optional(),
  assignedTo: z.string().trim().min(1).max(200).optional(),
  page: z.coerce.number().int().min(0).max(10_000).default(0),
  limit: z.coerce.number().int().min(1).max(PRISM_PRIVACY_REQUEST_MAX_PAGE_LIMIT).default(25),
}).strict();
export type ListPrivacyRequestsQueryInput = z.input<typeof listPrivacyRequestsQuerySchema>;
export type ListPrivacyRequestsQuery = z.infer<typeof listPrivacyRequestsQuerySchema>;

/** Assigns a PMCM operator (by user id) to a privacy request, or clears the assignment with `null`. */
export const assignPrivacyRequestSchema = z.object({
  assignedTo: z.string().trim().min(1).max(200).nullable(),
}).strict();
export type AssignPrivacyRequestInput = z.infer<typeof assignPrivacyRequestSchema>;

export const aiGovernanceDryRunSchema = z.object({
  eventId: optionalTrimmedStringSchema,
  featureName: z.string().trim().min(1),
  modelVersion: z.string().trim().min(1),
  zdrConfirmed: z.boolean(),
  payload: z.record(z.string(), z.unknown()),
});
export type AiGovernanceDryRunInput = z.infer<typeof aiGovernanceDryRunSchema>;
