import { z } from "zod";
import {
  isoDateStringSchema,
  nonEmptyStringSchema,
  optionalTrimmedStringSchema,
  privacyConsentSchema,
} from "./common.js";
export const eventDecisionSchema = z.object({
  decision: z.enum(["cancelled", "postponed", "date_to_be_confirmed"]),
  reason: nonEmptyStringSchema,
  newEventDate: isoDateStringSchema.optional(),
  cancellationFeeAmount: z.number().int().nonnegative().default(0),
  depositTreatment: z.enum(["retain", "credit", "waive", "pending_review"]).default("pending_review"),
  supplierImpact: z.enum(["release_obligations", "preserve_obligations", "pending_review"]).default("pending_review"),
  idempotencyKey: nonEmptyStringSchema.optional(),
}).superRefine((value, ctx) => {
  if (value.decision === "postponed" && !value.newEventDate) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["newEventDate"], message: "A new date is required for postponement" });
  }
});
export type EventDecisionInput = z.infer<typeof eventDecisionSchema>;

/**
 * Write DTOs for portal ↔ API mutations.
 * Schemas are the source of truth; types are `z.infer`.
 * Nest controllers should validate with `ZodValidationPipe` + these schemas.
 */

/* ── Inquiry / onboarding ─────────────────────────────────────── */
export const createPrismInquirySchema = privacyConsentSchema.extend({
  clientName: nonEmptyStringSchema,
  companyName: optionalTrimmedStringSchema,
  email: z.string().trim().email(),
  eventName: nonEmptyStringSchema,
  eventType: optionalTrimmedStringSchema,
  eventDate: isoDateStringSchema,
  clientType: nonEmptyStringSchema,
  source: z.enum([
    "P.R.I.S.M Website",
    "PMCM Facebook",
    "BNI Referral",
    "Colleague or Friend",
    "Attended a PMCM Event",
    "Other",
  ]),
  channel: optionalTrimmedStringSchema,
  referralDetails: optionalTrimmedStringSchema,
  message: nonEmptyStringSchema,
});
export type CreatePrismInquiryInput = z.infer<typeof createPrismInquirySchema>;

/** PMCM-only organization merge. The target inquiry comes from the route; public writers cannot reach this schema. */
export const mergeInquirySchema = z.object({
  sourceInquiryId: nonEmptyStringSchema,
  reason: nonEmptyStringSchema,
});
export type MergeInquiryInput = z.infer<typeof mergeInquirySchema>;

export const updateInquiryStatusSchema = z.object({
  status: z.enum(["new", "accepted", "pending", "declined"]),
  declineReason: z
    .enum(["Date Unavailable", "Outside Service Scope", "Budget Too Low", "Prior Issue", "Other"])
    .optional(),
});
export type UpdateInquiryStatusInput = z.infer<typeof updateInquiryStatusSchema>;

export const uploadConformeSchema = z.object({
  type: optionalTrimmedStringSchema,
  fileName: z
    .string()
    .trim()
    .min(1)
    .regex(/\.pdf$/i, "fileName must have a .pdf extension"),
  mimeType: optionalTrimmedStringSchema,
  sizeBytes: z.number().int().nonnegative().optional(),
  storageObjectId: optionalTrimmedStringSchema,
});
export type UploadConformeInput = z.infer<typeof uploadConformeSchema>;

export const submitBriefingSchema = z.object({
  venue: nonEmptyStringSchema,
  guestCount: z.number().int().min(1),
  budgetRange: nonEmptyStringSchema,
  serviceRequirements: z.array(z.string()),
  notes: nonEmptyStringSchema,
  confirmedDate: isoDateStringSchema.optional(),
  confirmedStartTime: optionalTrimmedStringSchema,
  confirmedEndTime: optionalTrimmedStringSchema,
  program: z.array(z.object({ time: optionalTrimmedStringSchema, activity: nonEmptyStringSchema })).optional().default([]),
  moodAndStyling: optionalTrimmedStringSchema,
  stylingBudget: z.number().int().nonnegative().optional(),
});
type ParsedSubmitBriefingInput = z.infer<typeof submitBriefingSchema>;
export type SubmitBriefingInput = Omit<ParsedSubmitBriefingInput, "program"> & { program?: ParsedSubmitBriefingInput["program"] };

export const archiveSearchFiltersSchema = z.object({
  venue: optionalTrimmedStringSchema,
  eventType: optionalTrimmedStringSchema,
  eventName: optionalTrimmedStringSchema,
  clientName: optionalTrimmedStringSchema,
  month: z
    .string()
    .trim()
    .optional()
    .refine((value) => !value || /^\d{4}-\d{2}$/.test(value), "month must be YYYY-MM"),
});
export type ArchiveSearchFilters = z.infer<typeof archiveSearchFiltersSchema>;

export const wrapUpModeSchema = z.enum(["full", "quick"]);
export type WrapUpMode = z.infer<typeof wrapUpModeSchema>;

export const wrapUpSectionSchema = z.object({
  status: z.enum(["pending", "complete", "blocked"]).default("pending"),
  evidence: z.string().trim().max(4000).default(""),
  completedAt: z.string().datetime({ offset: true }).nullable().default(null),
});

export const startEventWrapUpSchema = z.object({ mode: wrapUpModeSchema.default("full") });
export type StartEventWrapUpInput = z.infer<typeof startEventWrapUpSchema>;

export const updateEventWrapUpSchema = z.object({
  mode: wrapUpModeSchema.optional(),
  requiredItems: z.record(z.string(), z.boolean()).optional(),
  sections: z.object({
    logistics: wrapUpSectionSchema.optional(),
    issues: wrapUpSectionSchema.optional(),
    feedback: wrapUpSectionSchema.optional(),
  }).optional(),
  clientAcknowledged: z.boolean().optional(),
  clientAcknowledgementNote: z.string().trim().max(2000).optional(),
});
export type UpdateEventWrapUpInput = z.infer<typeof updateEventWrapUpSchema>;
export const setClientEventDayViewSchema = z.object({
  enabled: z.boolean(),
});
export type SetClientEventDayViewInput = z.infer<typeof setClientEventDayViewSchema>;

export const submitClientOcularVisitSchema = z.object({
  clientNote: optionalTrimmedStringSchema,
});
export type SubmitClientOcularVisitInput = z.infer<typeof submitClientOcularVisitSchema>;

export const scheduleOcularVisitSchema = z.object({
  scheduledAt: z.string().datetime({ offset: true }),
});
export type ScheduleOcularVisitInput = z.infer<typeof scheduleOcularVisitSchema>;

export const waiveOcularVisitSchema = z.object({
  reason: nonEmptyStringSchema,
});
export type WaiveOcularVisitInput = z.infer<typeof waiveOcularVisitSchema>;

export const grantSecondaryClientAccessSchema = z.object({
  userId: nonEmptyStringSchema,
});
export type GrantSecondaryClientAccessInput = z.infer<typeof grantSecondaryClientAccessSchema>;


