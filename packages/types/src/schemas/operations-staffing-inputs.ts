import { z } from "zod";
import { nonEmptyStringSchema, optionalTrimmedStringSchema } from "./common.js";

/* Coordinator staffing writes. */
export const createCoordinatorAssignmentSchema = z.object({
  coordinatorId: optionalTrimmedStringSchema,
  coordinatorName: optionalTrimmedStringSchema,
  role: optionalTrimmedStringSchema,
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
  role: nonEmptyStringSchema,
  required: z.number().int().min(0),
  requiredSkills: z.array(nonEmptyStringSchema).default([]),
});
export type CreateCoordinatorCoverageRequirementInput = z.infer<typeof createCoordinatorCoverageRequirementSchema>;

export const replaceCoordinatorAssignmentSchema = z.object({
  replacementCoordinatorId: nonEmptyStringSchema,
  replacementCoordinatorName: optionalTrimmedStringSchema,
  role: optionalTrimmedStringSchema,
  replacementRole: optionalTrimmedStringSchema,
  reason: nonEmptyStringSchema,
  overrideConflict: z.boolean().optional(),
}).superRefine((value, context) => {
  if (!value.role && !value.replacementRole) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["role"], message: "A replacement role is required" });
  }
});
export type ReplaceCoordinatorAssignmentInput = z.infer<typeof replaceCoordinatorAssignmentSchema>;
