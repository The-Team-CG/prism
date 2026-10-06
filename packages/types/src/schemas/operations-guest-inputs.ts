import { z } from "zod";
import {
  nonEmptyStringSchema,
  optionalTrimmedStringSchema,
  privacyConsentSchema,
  uploadMetadataSchema,
} from "./common.js";
/* Guest check-in and feedback. */

export const createGuestCheckInSchema = z.discriminatedUnion("checkInMode", [
  privacyConsentSchema.extend({
    idempotencyKey: z.string().uuid(),
    checkInMode: z.literal("name_search"),
    guestName: nonEmptyStringSchema,
  }).strict(),
  privacyConsentSchema.extend({
    idempotencyKey: z.string().uuid(),
    checkInMode: z.literal("headcount"),
  }).strict(),
]);
export type CreateGuestCheckInInput = z.infer<typeof createGuestCheckInSchema>;

export const guestCheckInReceiptSchema = z.object({
  accepted: z.literal(true),
}).strict();
export type GuestCheckInReceipt = z.infer<typeof guestCheckInReceiptSchema>;

export const guestPrivacyClassificationSchema = z.enum(["private", "public", "unclassified"]);
export type GuestPrivacyClassification = z.infer<typeof guestPrivacyClassificationSchema>;

export const updateGuestPrivacyClassificationSchema = z.object({
  classification: guestPrivacyClassificationSchema,
}).strict();
export type UpdateGuestPrivacyClassificationInput = z.infer<typeof updateGuestPrivacyClassificationSchema>;

/** Event-scoped registration-staff walk-in input. The server fixes walk-in and verification state. */
export const coordinatorWalkInCheckInSchema = z.object({
  guestName: nonEmptyStringSchema,
  privacyConsentAccepted: z.literal(true),
});
export type CoordinatorWalkInCheckInInput = z.infer<typeof coordinatorWalkInCheckInSchema>;

export const createGuestFeedbackSchema = privacyConsentSchema.extend({
  guestName: nonEmptyStringSchema,
  rating: z.number().int().min(1).max(5),
  comment: optionalTrimmedStringSchema,
  photo: uploadMetadataSchema.optional(),
  video: uploadMetadataSchema.optional(),
});
export type CreateGuestFeedbackInput = z.infer<typeof createGuestFeedbackSchema>;

export const moderateGuestFeedbackSchema = z.object({
  action: z.enum(["approve", "reject", "hide"]),
  reason: optionalTrimmedStringSchema,
}).superRefine((value, ctx) => {
  if (value.action !== "approve" && !value.reason?.trim()) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "A reason is required for rejected or hidden feedback", path: ["reason"] });
  }
});
export type ModerateGuestFeedbackInput = z.infer<typeof moderateGuestFeedbackSchema>;

export const withdrawGuestFeedbackConsentSchema = z.object({
  withdrawPrivacyConsent: z.boolean().optional(),
  withdrawMarketingConsent: z.boolean().optional(),
}).refine((value) => value.withdrawPrivacyConsent || value.withdrawMarketingConsent, {
  message: "Select at least one consent to withdraw",
});
export type WithdrawGuestFeedbackConsentInput = z.infer<typeof withdrawGuestFeedbackConsentSchema>;

/* ── Registration platform (PMCM) ─────────────────────────────── */

export const prismRegistrationPlatformTypeSchema = z.enum(["xperto", "clickpass", "custom", "none"]);
export const prismRegistrationPlatformStatusSchema = z.enum([
  "not_started",
  "configuring",
  "live",
  "closed",
]);

export const createRegistrationPlatformSchema = z.object({
  platformType: prismRegistrationPlatformTypeSchema,
  supplierId: optionalTrimmedStringSchema,
  expectedPaxMin: z.number().int().min(0).optional(),
  expectedPaxMax: z.number().int().min(0).optional(),
  setupNotes: optionalTrimmedStringSchema,
});
export type CreateRegistrationPlatformInput = z.infer<typeof createRegistrationPlatformSchema>;

export const updateRegistrationPlatformSchema = z.object({
  platformType: prismRegistrationPlatformTypeSchema.optional(),
  supplierId: optionalTrimmedStringSchema,
  expectedPaxMin: z.number().int().min(0).optional(),
  expectedPaxMax: z.number().int().min(0).optional(),
  status: prismRegistrationPlatformStatusSchema.optional(),
  setupNotes: optionalTrimmedStringSchema,
});
export type UpdateRegistrationPlatformInput = z.infer<typeof updateRegistrationPlatformSchema>;

export const importHeadcountSchema = z.object({
  headcountSource: nonEmptyStringSchema,
  importedHeadcount: z.number().int().min(0),
  importedFileName: optionalTrimmedStringSchema,
});
export type ImportHeadcountInput = z.infer<typeof importHeadcountSchema>;

export const recordActualEventEndSchema = z.object({
  actualEndedAt: z.string().datetime({ offset: true }),
  correctionReason: optionalTrimmedStringSchema,
});
export type RecordActualEventEndInput = z.infer<typeof recordActualEventEndSchema>;

export const importGuestRosterSchema = z.object({
  source: nonEmptyStringSchema,
  rows: z.array(z.object({
    sourceKey: nonEmptyStringSchema,
    guestName: nonEmptyStringSchema,
    email: optionalTrimmedStringSchema,
    phone: optionalTrimmedStringSchema,
    category: optionalTrimmedStringSchema,
    table: optionalTrimmedStringSchema,
    eligibility: z.enum(["eligible", "ineligible"]).optional(),
  })).min(1).max(1000),
});
export type ImportGuestRosterInput = z.infer<typeof importGuestRosterSchema>;

/** Walk-in policy vocabulary: closed rejects all walk-ins; open permits them;
 * threshold permits them while checked-in attendance is below the threshold. */
export const walkInPolicySchema = z.enum(["closed", "open", "threshold"]);
export type WalkInPolicy = z.infer<typeof walkInPolicySchema>;

export const updateWalkInPolicySchema = z.object({
  policy: walkInPolicySchema,
  threshold: z.number().int().min(1).optional(),
}).superRefine((value, ctx) => {
  if (value.policy === "threshold" && value.threshold === undefined) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["threshold"], message: "A threshold is required when walk-ins use threshold policy" });
  }
});
export type UpdateWalkInPolicyInput = z.infer<typeof updateWalkInPolicySchema>;

export const guestRosterSearchSchema = z.object({
  query: optionalTrimmedStringSchema,
  namePrefix: optionalTrimmedStringSchema,
  eligibility: z.enum(["eligible", "ineligible"]).optional(),
  checkedIn: z.boolean().optional(),
  reviewQueue: z.boolean().optional(),
});
export type GuestRosterSearchInput = z.infer<typeof guestRosterSearchSchema>;

export const updateGuestVerificationSchema = z.object({
  status: z.enum(["pending", "verified", "rejected"]),
});
export type UpdateGuestVerificationInput = z.infer<typeof updateGuestVerificationSchema>;
