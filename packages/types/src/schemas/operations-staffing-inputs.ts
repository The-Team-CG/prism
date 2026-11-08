import { z } from "zod";
import { nonEmptyStringSchema, optionalTrimmedStringSchema } from "./common.js";
import { canonicalCoordinatorRole, coordinatorRoleSchema } from "./coordinator-roles.js";

/* Coordinator staffing writes. */
export const createCoordinatorAssignmentSchema = z.object({
  coordinatorId: optionalTrimmedStringSchema,
  coordinatorName: optionalTrimmedStringSchema,
  role: coordinatorRoleSchema.optional(),
  overrideConflict: z.boolean().optional(),
}).refine((value) => Boolean(value.coordinatorId || value.coordinatorName), {
  message: "Coordinator id or name is required",
  path: ["coordinatorId"],
});
export type CreateCoordinatorAssignmentInput = z.infer<typeof createCoordinatorAssignmentSchema>;

export const coordinatorAssignmentAcknowledgementSchema = z.object({
  decision: z.enum(["acknowledged", "declined"]),
  reason: optionalTrimmedStringSchema,
}).superRefine((value, ctx) => {
  if (value.decision === "declined" && !value.reason?.trim()) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Decline reason is required", path: ["reason"] });
  }
});
export type CoordinatorAssignmentAcknowledgementInput = z.infer<typeof coordinatorAssignmentAcknowledgementSchema>;

export const withdrawCoordinatorAssignmentSchema = z.object({
  reason: nonEmptyStringSchema,
});
export type WithdrawCoordinatorAssignmentInput = z.infer<typeof withdrawCoordinatorAssignmentSchema>;

export const createCoordinatorAvailabilitySchema = z.object({
  startsAt: z.string().datetime({ offset: true }),
  endsAt: z.string().datetime({ offset: true }),
  kind: z.enum(["unavailable", "blocked"]).default("unavailable"),
  note: optionalTrimmedStringSchema,
}).refine((value) => new Date(value.endsAt).getTime() > new Date(value.startsAt).getTime(), {
  message: "endsAt must be after startsAt",
  path: ["endsAt"],
});
export type CreateCoordinatorAvailabilityInput = z.infer<typeof createCoordinatorAvailabilitySchema>;

export const createCoordinatorCoverageRequirementSchema = z.object({
  role: coordinatorRoleSchema,
  mapFromRole: z.string().trim().min(1).refine((role) => !canonicalCoordinatorRole(role), {
    message: "Only an unmapped historical role can be mapped",
  }).optional(),
  required: z.number().int().min(0),
  requiredSkills: z.array(nonEmptyStringSchema).default([]),
});
export type CreateCoordinatorCoverageRequirementInput = z.infer<typeof createCoordinatorCoverageRequirementSchema>;

export const replaceCoordinatorAssignmentSchema = z.object({
  replacementCoordinatorId: nonEmptyStringSchema,
  replacementCoordinatorName: optionalTrimmedStringSchema,
  role: coordinatorRoleSchema.optional(),
  replacementRole: coordinatorRoleSchema.optional(),
  reason: nonEmptyStringSchema,
  overrideConflict: z.boolean().optional(),
}).superRefine((value, context) => {
  if (!value.role && !value.replacementRole) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["role"], message: "A replacement role is required" });
  }
});
export type ReplaceCoordinatorAssignmentInput = z.infer<typeof replaceCoordinatorAssignmentSchema>;

export const coordinatorSuggestionsQuerySchema = z.object({
  role: coordinatorRoleSchema,
  skills: z.preprocess(
    (value) => value === undefined ? [] : Array.isArray(value) ? value : [value],
    z.array(nonEmptyStringSchema).max(20),
  ),
});
export type CoordinatorSuggestionsQueryInput = z.infer<typeof coordinatorSuggestionsQuerySchema>;

/** FR-AI-04 PARE coordinator mode: PMCM approves one recommended replacement, or rejects the package. Nothing happens before that. */
export const decideCoordinatorReplacementSchema = z.object({
  action: z.enum(["approve", "reject"]),
  coordinatorId: optionalTrimmedStringSchema,
  note: z.string().trim().max(1000).default(""),
}).superRefine((value, ctx) => {
  if (value.action === "approve" && !value.coordinatorId) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["coordinatorId"], message: "Choose the replacement coordinator" });
});
export type DecideCoordinatorReplacementInput = z.input<typeof decideCoordinatorReplacementSchema>;

export interface PrismCoordinatorReplacementCandidate {
  coordinatorId: string;
  name: string;
  matchedSkills: string[];
  missingSkills: string[];
}

export interface PrismCoordinatorReplacementRecommendation {
  id: string;
  eventId: string;
  withdrawnAssignmentId: string;
  withdrawnCoordinatorName: string;
  role: string;
  hoursToEvent: number;
  riskLevel: "high" | "critical";
  riskSummary: string;
  candidates: PrismCoordinatorReplacementCandidate[];
  draftMessage: string;
  status: "pending" | "approved" | "rejected";
  selectedCoordinatorId: string | null;
  reviewedBy: string | null;
  reviewedAt: string | null;
  createdAt: string;
}
