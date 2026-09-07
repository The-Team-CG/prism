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

export const reviewEventProposalSchema = z.object({
  action: z.enum(["approve", "request_revision"]),
  revisionNote: optionalTrimmedStringSchema,
  idempotencyKey: optionalTrimmedStringSchema,
}).superRefine((value, ctx) => {
  if (value.action === "request_revision" && !value.revisionNote?.trim()) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Revision note is required",
      path: ["revisionNote"],
    });
  }
});
export type ReviewEventProposalInput = z.infer<typeof reviewEventProposalSchema>;

export const archiveSearchFiltersSchema = z.object({
  venue: optionalTrimmedStringSchema,
  eventType: optionalTrimmedStringSchema,
  month: z
    .string()
    .trim()
    .optional()
    .refine((value) => !value || /^\d{4}-\d{2}$/.test(value), "month must be YYYY-MM"),
});
export type ArchiveSearchFilters = z.infer<typeof archiveSearchFiltersSchema>;

export const createGuestCheckInSchema = privacyConsentSchema.extend({
  guestName: nonEmptyStringSchema,
  rosterEntryId: optionalTrimmedStringSchema,
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
    eligibility: z.enum(["eligible", "ineligible"]).optional(),
  })).min(1),
});
export type ImportGuestRosterInput = z.infer<typeof importGuestRosterSchema>;

export const guestRosterSearchSchema = z.object({ query: optionalTrimmedStringSchema });
export type GuestRosterSearchInput = z.infer<typeof guestRosterSearchSchema>;

/* ── Supplier ─────────────────────────────────────────────────── */

export const reviewSupplierApplicationSchema = z.object({
  action: z.enum(["request_proposal", "schedule", "approve", "decline"]),
  declineReason: optionalTrimmedStringSchema,
  notes: optionalTrimmedStringSchema,
  idempotencyKey: optionalTrimmedStringSchema,
}).superRefine((value, ctx) => {
  if (value.action === "decline" && !value.declineReason?.trim()) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Decline reason is required",
      path: ["declineReason"],
    });
  }
});
export type ReviewSupplierApplicationInput = z.infer<typeof reviewSupplierApplicationSchema>;

export const createSupplierApplicationSchema = z.object({
  companyName: nonEmptyStringSchema,
  contactName: nonEmptyStringSchema,
  email: z.string().trim().email(),
  phone: optionalTrimmedStringSchema,
  categoryId: optionalTrimmedStringSchema,
  pastEvents: optionalTrimmedStringSchema,
  serviceInclusions: optionalTrimmedStringSchema,
  certifications: optionalTrimmedStringSchema,
  priceRange: optionalTrimmedStringSchema,
  bniMember: z.boolean().optional(),
  portfolioUrl: optionalTrimmedStringSchema,
  additionalNotes: optionalTrimmedStringSchema,
  privacyConsentAccepted: z.boolean().optional(),
  privacyNoticeVersion: optionalTrimmedStringSchema,
});
export type CreateSupplierApplicationInput = z.infer<typeof createSupplierApplicationSchema>;

export const createSupplierReviewSchema = z.object({
  eventId: optionalTrimmedStringSchema,
  rating: z.number().int().min(1).max(5),
  notes: nonEmptyStringSchema,
  reviewedBy: optionalTrimmedStringSchema,
  dimensionRatings: z
    .array(
      z.object({
        dimensionId: nonEmptyStringSchema,
        rating: z.number().int().min(1).max(5),
      }),
    )
    .optional(),
  idempotencyKey: optionalTrimmedStringSchema,
});
export type CreateSupplierReviewInput = z.infer<typeof createSupplierReviewSchema>;

export const createSupplierReliabilityNoteSchema = z.object({
  eventId: nonEmptyStringSchema,
  note: nonEmptyStringSchema,
  idempotencyKey: optionalTrimmedStringSchema,
});
export type CreateSupplierReliabilityNoteInput = z.infer<typeof createSupplierReliabilityNoteSchema>;

export const promoteSupplierSchema = z.object({
  eventId: nonEmptyStringSchema,
  tier: z.enum(["tier_1", "tier_2"]),
  reason: nonEmptyStringSchema,
  idempotencyKey: optionalTrimmedStringSchema,
});
export type PromoteSupplierInput = z.infer<typeof promoteSupplierSchema>;

export const createCommunicationThreadSchema = z.object({
  eventId: nonEmptyStringSchema,
  subject: nonEmptyStringSchema,
  participantActorIds: z.array(nonEmptyStringSchema).max(20).optional(),
}).superRefine((value, ctx) => {
  const ids = value.participantActorIds ?? [];
  if (new Set(ids).size !== ids.length) ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Duplicate thread participants are not allowed', path: ['participantActorIds'] });
});
export type CreateCommunicationThreadInput = z.infer<typeof createCommunicationThreadSchema>;

export const sendCommunicationMessageSchema = z.object({
  body: nonEmptyStringSchema,
  idempotencyKey: nonEmptyStringSchema,
});
export type SendCommunicationMessageInput = z.infer<typeof sendCommunicationMessageSchema>;

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
});
export type UpdateCoordinatorAttendanceInput = z.infer<typeof updateCoordinatorAttendanceSchema>;

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

export const replaceCoordinatorAssignmentSchema = z.object({
  replacementCoordinatorId: nonEmptyStringSchema,
  role: nonEmptyStringSchema,
  reason: nonEmptyStringSchema,
});
export type ReplaceCoordinatorAssignmentInput = z.infer<typeof replaceCoordinatorAssignmentSchema>;

export const verifySupplierStatusSchema = z.object({
  verificationStatus: z.enum(["verified", "disputed"]),
  notes: optionalTrimmedStringSchema,
});
export type VerifySupplierStatusInput = z.infer<typeof verifySupplierStatusSchema>;

/* ── Audit and privacy operations ────────────────────────────── */

export const createPrivacyRequestSchema = z.object({
  subjectType: nonEmptyStringSchema,
  subjectEmail: optionalTrimmedStringSchema,
  subjectName: optionalTrimmedStringSchema,
  eventId: optionalTrimmedStringSchema,
  requestType: z.enum(["access", "correction", "deletion", "export"]),
  requestNotes: optionalTrimmedStringSchema,
});
export type CreatePrivacyRequestInput = z.infer<typeof createPrivacyRequestSchema>;

export const reviewPrivacyRequestSchema = z.object({
  status: z.enum(["approved", "rejected"]),
  reviewReason: optionalTrimmedStringSchema,
});
export type ReviewPrivacyRequestInput = z.infer<typeof reviewPrivacyRequestSchema>;

export const auditLogFiltersSchema = z.object({
  query: optionalTrimmedStringSchema,
  category: optionalTrimmedStringSchema,
  eventId: optionalTrimmedStringSchema,
  actor: optionalTrimmedStringSchema,
  actionType: optionalTrimmedStringSchema,
  severity: optionalTrimmedStringSchema,
  dateRange: optionalTrimmedStringSchema,
  limit: optionalTrimmedStringSchema,
});
export type AuditLogFilters = z.infer<typeof auditLogFiltersSchema>;

/* ── Floorplan preference (client layout notes) ───────────────── */

export const createFloorPlanDraftSchema = z.object({
  name: z.string(),
  sourceType: z.enum(["blank", "template", "client_preference"]),
  venue: optionalTrimmedStringSchema,
  width: z.number().int().positive().optional(),
  height: z.number().int().positive().optional(),
  gridSize: z.number().int().positive().optional(),
  pax: z.number().int().nonnegative().optional(),
  objects: z.array(z.unknown()).optional(),
  guests: z.array(z.unknown()).optional(),
  suppliers: z.array(z.unknown()).optional(),
});
export type CreateFloorPlanDraftInput = z.infer<typeof createFloorPlanDraftSchema>;

export const createFloorPlanPreferenceSchema = z.object({
  name: z.string(),
  seatingStyle: z.string(),
  stagePreference: z.string(),
  flowNotes: z.string(),
  guestCount: z.number().int().min(1),
  constraints: z.array(z.string()),
  notes: optionalTrimmedStringSchema,
  venue: optionalTrimmedStringSchema,
  width: z.number().int().positive().optional(),
  height: z.number().int().positive().optional(),
  gridSize: z.number().int().positive().optional(),
  objects: z.array(z.unknown()).optional(),
});
export type CreateFloorPlanPreferenceInput = z.infer<typeof createFloorPlanPreferenceSchema>;
