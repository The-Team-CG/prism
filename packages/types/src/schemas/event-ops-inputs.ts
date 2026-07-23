import { z } from "zod";
import {
  isoDateStringSchema,
  nonEmptyStringSchema,
  optionalTrimmedStringSchema,
  privacyConsentSchema,
  uploadMetadataSchema,
} from "./common.js";

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
  loggedByRole: optionalTrimmedStringSchema,
  loggedByName: optionalTrimmedStringSchema,
  message: nonEmptyStringSchema,
});
export type CreatePrismInquiryInput = z.infer<typeof createPrismInquirySchema>;

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
});
export type UploadConformeInput = z.infer<typeof uploadConformeSchema>;

export const submitBriefingSchema = z.object({
  venue: nonEmptyStringSchema,
  guestCount: z.number().int().min(1),
  budgetRange: nonEmptyStringSchema,
  serviceRequirements: z.array(z.string()),
  notes: nonEmptyStringSchema,
});
export type SubmitBriefingInput = z.infer<typeof submitBriefingSchema>;

/* ── Guest ────────────────────────────────────────────────────── */

export const createGuestCheckInSchema = privacyConsentSchema.extend({
  guestName: nonEmptyStringSchema,
  checkInMode: z.enum(["name_search", "walk_in"]).or(z.string().trim().min(1)).optional(),
  walkIn: z.boolean().optional(),
  verificationStatus: z.enum(["verified", "flagged"]).or(z.string().trim().min(1)).optional(),
});
export type CreateGuestCheckInInput = z.infer<typeof createGuestCheckInSchema>;

export const createGuestFeedbackSchema = privacyConsentSchema.extend({
  guestName: nonEmptyStringSchema,
  rating: z.number().int().min(1).max(5),
  comment: optionalTrimmedStringSchema,
  photo: uploadMetadataSchema.optional(),
  video: uploadMetadataSchema.optional(),
});
export type CreateGuestFeedbackInput = z.infer<typeof createGuestFeedbackSchema>;

/* ── Supplier ─────────────────────────────────────────────────── */

export const confirmSupplierReadinessSchema = z.object({
  notes: optionalTrimmedStringSchema,
});
export type ConfirmSupplierReadinessInput = z.infer<typeof confirmSupplierReadinessSchema>;

export const uploadContractSchema = uploadMetadataSchema;
export type UploadContractInput = z.infer<typeof uploadContractSchema>;

export const updateSupplierEventStatusSchema = z.object({
  status: z.enum(["arrived", "set_up_ready", "done_leaving"]),
  notes: optionalTrimmedStringSchema,
  photo: uploadMetadataSchema.optional(),
});
export type UpdateSupplierEventStatusInput = z.infer<typeof updateSupplierEventStatusSchema>;

export const submitSupplierQuoteSchema = z.object({
  amount: z.number().min(0),
  inclusions: z.array(z.string()).optional(),
  paymentTerms: optionalTrimmedStringSchema,
  notes: optionalTrimmedStringSchema,
});
export type SubmitSupplierQuoteInput = z.infer<typeof submitSupplierQuoteSchema>;

/* ── Live ops ─────────────────────────────────────────────────── */

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

export const updateCoordinatorAttendanceSchema = z.object({
  status: nonEmptyStringSchema,
  notes: optionalTrimmedStringSchema,
  markedBy: optionalTrimmedStringSchema,
});
export type UpdateCoordinatorAttendanceInput = z.infer<typeof updateCoordinatorAttendanceSchema>;

export const createUrgentIssueSchema = z.object({
  title: nonEmptyStringSchema,
  description: optionalTrimmedStringSchema,
  severity: optionalTrimmedStringSchema,
  ownerRole: optionalTrimmedStringSchema,
  ownerName: optionalTrimmedStringSchema,
  openedBy: optionalTrimmedStringSchema,
  slaDueAt: optionalTrimmedStringSchema,
});
export type CreateUrgentIssueInput = z.infer<typeof createUrgentIssueSchema>;

/* ── Floorplan preference (client layout notes) ───────────────── */

export const createFloorPlanPreferenceSchema = z.object({
  name: nonEmptyStringSchema,
  seatingStyle: optionalTrimmedStringSchema,
  stagePreference: optionalTrimmedStringSchema,
  flowNotes: optionalTrimmedStringSchema,
  guestCount: z.number().int().min(1).optional(),
  constraints: optionalTrimmedStringSchema,
  notes: optionalTrimmedStringSchema,
  venue: optionalTrimmedStringSchema,
  width: z.number().positive().optional(),
  height: z.number().positive().optional(),
  gridSize: z.number().positive().optional(),
  objects: z.array(z.unknown()).optional(),
});
export type CreateFloorPlanPreferenceInput = z.infer<typeof createFloorPlanPreferenceSchema>;
