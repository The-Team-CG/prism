import { z } from "zod";
import { isoDateStringSchema, nonEmptyStringSchema, optionalTrimmedStringSchema } from "./common.js";
/* ── Live ops ─────────────────────────────────────────────────── */

export const createEventScheduleDaySchema = z.object({
  dayDate: isoDateStringSchema,
  label: optionalTrimmedStringSchema,
});
export type CreateEventScheduleDayInput = z.infer<typeof createEventScheduleDaySchema>;

export const createEventScheduleSegmentSchema = z.object({
  title: nonEmptyStringSchema,
  plannedStartAt: z.string().datetime({ offset: true }),
  plannedEndAt: z.string().datetime({ offset: true }),
  ownerRole: nonEmptyStringSchema,
  location: optionalTrimmedStringSchema,
  sequence: z.number().int().min(0).optional(),
}).refine((value) => new Date(value.plannedEndAt).getTime() > new Date(value.plannedStartAt).getTime(), {
  message: "plannedEndAt must be after plannedStartAt",
  path: ["plannedEndAt"],
});
export type CreateEventScheduleSegmentInput = z.infer<typeof createEventScheduleSegmentSchema>;

export const updateEventScheduleSegmentStatusSchema = z.object({
  action: z.enum(["start", "stop", "skip"]),
});
export type UpdateEventScheduleSegmentStatusInput = z.infer<typeof updateEventScheduleSegmentStatusSchema>;

export const createEventOperatorDesignationSchema = z.object({
  coordinatorId: nonEmptyStringSchema,
});
export type CreateEventOperatorDesignationInput = z.infer<typeof createEventOperatorDesignationSchema>;

export const createEventHandoffSchema = z.object({
  dayId: nonEmptyStringSchema,
  role: nonEmptyStringSchema,
  fromAssignmentId: nonEmptyStringSchema,
  toAssignmentId: nonEmptyStringSchema,
  outstandingItems: z.array(nonEmptyStringSchema).max(100).default([]),
  handedOffAt: z.string().datetime({ offset: true }).optional(),
});
export type CreateEventHandoffInput = z.infer<typeof createEventHandoffSchema>;

export const createEventEodReportSchema = z.object({
  dayId: nonEmptyStringSchema,
  progress: z.array(nonEmptyStringSchema).max(100).default([]),
  issues: z.array(nonEmptyStringSchema).max(100).default([]),
  risksForTomorrow: z.array(nonEmptyStringSchema).max(100).default([]),
  submittedAt: z.string().datetime({ offset: true }).optional(),
});
export type CreateEventEodReportInput = z.infer<typeof createEventEodReportSchema>;

export const createEventEodReplySchema = z.object({
  body: nonEmptyStringSchema,
});
export type CreateEventEodReplyInput = z.infer<typeof createEventEodReplySchema>;

export const createEventDayTaskSchema = z.object({
  title: nonEmptyStringSchema,
  assignedRole: optionalTrimmedStringSchema,
  ownerName: optionalTrimmedStringSchema,
  priority: optionalTrimmedStringSchema,
  notes: optionalTrimmedStringSchema,
  dueAt: optionalTrimmedStringSchema,
  slaDueAt: optionalTrimmedStringSchema,
});
export type CreateEventDayTaskInput = z.infer<typeof createEventDayTaskSchema>;

export const updateEventDayTaskSchema = z.object({
  status: optionalTrimmedStringSchema,
  notes: optionalTrimmedStringSchema,
  ownerName: optionalTrimmedStringSchema,
  slaDueAt: optionalTrimmedStringSchema,
});
export type UpdateEventDayTaskInput = z.infer<typeof updateEventDayTaskSchema>;

export const createEventTaskReassignmentSchema = z.object({
  toOwnerRole: nonEmptyStringSchema,
  toOwnerName: optionalTrimmedStringSchema,
  reason: nonEmptyStringSchema,
});
export type CreateEventTaskReassignmentInput = z.infer<typeof createEventTaskReassignmentSchema>;

export const decideEventTaskReassignmentSchema = z.object({
  decision: z.enum(["approved", "rejected"]),
  reason: optionalTrimmedStringSchema,
}).superRefine((value, context) => {
  if (value.decision === "rejected" && !value.reason?.trim()) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["reason"], message: "A rejection reason is required" });
  }
});
export type DecideEventTaskReassignmentInput = z.infer<typeof decideEventTaskReassignmentSchema>;

export const updateCoordinatorAttendanceSchema = z.object({
  status: nonEmptyStringSchema,
  notes: optionalTrimmedStringSchema,
});
export type UpdateCoordinatorAttendanceInput = z.infer<typeof updateCoordinatorAttendanceSchema>;

/* Issue reporting and live supplier-status verification. */

export const createUrgentIssueSchema = z.object({
  title: nonEmptyStringSchema,
  description: optionalTrimmedStringSchema,
  severity: optionalTrimmedStringSchema,
  affectedArea: optionalTrimmedStringSchema,
  ownerRole: optionalTrimmedStringSchema,
  ownerName: optionalTrimmedStringSchema,
  slaDueAt: optionalTrimmedStringSchema,
});
export type CreateUrgentIssueInput = z.infer<typeof createUrgentIssueSchema>;

export const updateUrgentIssueSchema = z.object({
  status: optionalTrimmedStringSchema,
  affectedArea: optionalTrimmedStringSchema,
  ownerRole: optionalTrimmedStringSchema,
  ownerName: optionalTrimmedStringSchema,
  resolution: optionalTrimmedStringSchema,
  slaDueAt: optionalTrimmedStringSchema,
});
export type UpdateUrgentIssueInput = z.infer<typeof updateUrgentIssueSchema>;

export const escalateLiveOpsRecordSchema = z.object({
  escalationLevel: optionalTrimmedStringSchema,
  notes: optionalTrimmedStringSchema,
  ownerRole: optionalTrimmedStringSchema,
  ownerName: optionalTrimmedStringSchema,
});
export type EscalateLiveOpsInput = z.infer<typeof escalateLiveOpsRecordSchema>;

export const verifySupplierStatusSchema = z.object({
  verificationStatus: z.enum(["verified", "disputed"]),
  notes: optionalTrimmedStringSchema,
});
export type VerifySupplierStatusInput = z.infer<typeof verifySupplierStatusSchema>;
