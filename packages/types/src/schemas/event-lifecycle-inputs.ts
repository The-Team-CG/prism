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

/** Client categories offered for new inquiries (product policy, 2026-09-08). */
export const INQUIRY_CLIENT_CATEGORIES = ["Corporate", "Government", "Individual", "Non-profit"] as const;
export type InquiryClientCategory = (typeof INQUIRY_CLIENT_CATEGORIES)[number];

/** Legacy values rewritten to a current category on write. School/Other have no mapping and remain historical values. */
const LEGACY_INQUIRY_CLIENT_TYPE_MAPPINGS: ReadonlyMap<string, InquiryClientCategory> = new Map([["Private", "Individual"]]);

export function normalizeInquiryClientType(value: string): string {
  const trimmed = value.trim();
  return LEGACY_INQUIRY_CLIENT_TYPE_MAPPINGS.get(trimmed) ?? trimmed;
}

export const inquiryClientCategorySchema = z
  .string()
  .transform(normalizeInquiryClientType)
  .pipe(z.enum(INQUIRY_CLIENT_CATEGORIES));

export const createPrismInquirySchema = privacyConsentSchema.extend({
  clientName: nonEmptyStringSchema,
  companyName: optionalTrimmedStringSchema,
  email: z.string().trim().email(),
  eventName: nonEmptyStringSchema,
  eventType: optionalTrimmedStringSchema,
  eventDate: isoDateStringSchema,
  clientType: inquiryClientCategorySchema,
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
  // Logistics is not writable here: its checklist state mirrors the PMCM logistics completion record.
  sections: z.object({
    issues: wrapUpSectionSchema.optional(),
    feedback: wrapUpSectionSchema.optional(),
  }).strict().optional(),
  clientAcknowledged: z.boolean().optional(),
  clientAcknowledgementNote: z.string().trim().max(2000).optional(),
});
export type UpdateEventWrapUpInput = z.infer<typeof updateEventWrapUpSchema>;

/** PMCM-recorded logistics completion. Notes are PMCM-only and never returned to portals. */
export const recordLogisticsCompletionSchema = z.object({
  assetReturnsVerified: z.literal(true),
  completionSummary: z.string().trim().min(1).max(2000),
  privateNotes: z.string().trim().max(4000).default(""),
  correctionReason: z.string().trim().min(1).max(500).optional(),
});
export type RecordLogisticsCompletionInput = z.infer<typeof recordLogisticsCompletionSchema>;

/** Side-by-side archive comparison: 2 to 4 distinct archived event ids, comma-separated in the query. */
export const archiveComparisonQuerySchema = z.object({
  eventIds: z
    .string()
    .trim()
    .transform((value) => value.split(",").map((id) => id.trim()).filter(Boolean))
    .pipe(
      z
        .array(z.string().min(1))
        .min(2, "Select at least two archived events to compare")
        .max(4, "Compare at most four archived events")
        .refine((ids) => new Set(ids).size === ids.length, "Compared events must be distinct"),
    ),
});
export type ArchiveComparisonQuery = z.infer<typeof archiveComparisonQuerySchema>;
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


