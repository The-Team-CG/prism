import { z } from "zod";
import { isoDateStringSchema, nonEmptyStringSchema, privacyConsentSchema } from "./common.js";

/**
 * Write DTOs for portal → API mutations.
 * Schemas are the source of truth; types are `z.infer`.
 * Nest `class-validator` DTOs stay until a module is actively migrated.
 */

export const createPrismInquirySchema = privacyConsentSchema.extend({
  clientName: nonEmptyStringSchema,
  companyName: z.string().trim().optional(),
  email: z.string().trim().email(),
  eventName: nonEmptyStringSchema,
  eventType: z.string().trim().optional(),
  eventDate: isoDateStringSchema,
  clientType: nonEmptyStringSchema,
  /** Portal / API source label; Nest may further constrain known channels. */
  source: z.string().trim().min(1).optional(),
  referralDetails: z.string().trim().optional(),
  message: nonEmptyStringSchema,
});
export type CreatePrismInquiryInput = z.infer<typeof createPrismInquirySchema>;

export const createGuestCheckInSchema = privacyConsentSchema.extend({
  guestName: nonEmptyStringSchema,
  checkInMode: z.string().trim().optional(),
  walkIn: z.boolean().optional(),
  verificationStatus: z.string().trim().optional(),
});
export type CreateGuestCheckInInput = z.infer<typeof createGuestCheckInSchema>;

export const createGuestFeedbackSchema = privacyConsentSchema.extend({
  guestName: nonEmptyStringSchema,
  rating: z.number().min(1).max(5),
  comment: z.string().trim().optional(),
});
export type CreateGuestFeedbackInput = z.infer<typeof createGuestFeedbackSchema>;

export const confirmSupplierReadinessSchema = z.object({
  notes: z.string().trim().optional(),
});
export type ConfirmSupplierReadinessInput = z.infer<typeof confirmSupplierReadinessSchema>;

export const uploadContractSchema = z.object({
  fileName: nonEmptyStringSchema,
  mimeType: z.string().trim().optional(),
  sizeBytes: z.number().nonnegative().optional(),
});
export type UploadContractInput = z.infer<typeof uploadContractSchema>;

export const updateSupplierEventStatusSchema = z.object({
  status: z.enum(["arrived", "set_up_ready", "done_leaving"]),
  notes: z.string().trim().optional(),
});
export type UpdateSupplierEventStatusInput = z.infer<typeof updateSupplierEventStatusSchema>;

export const createEventDayTaskSchema = z.object({
  title: nonEmptyStringSchema,
  assignedRole: z.string().trim().optional(),
  ownerName: z.string().trim().optional(),
  priority: z.string().trim().optional(),
  notes: z.string().trim().optional(),
  dueAt: z.string().trim().optional(),
  slaDueAt: z.string().trim().optional(),
});
export type CreateEventDayTaskInput = z.infer<typeof createEventDayTaskSchema>;

export const updateEventDayTaskSchema = z.object({
  status: z.string().trim().optional(),
  notes: z.string().trim().optional(),
  ownerName: z.string().trim().optional(),
  slaDueAt: z.string().trim().optional(),
});
export type UpdateEventDayTaskInput = z.infer<typeof updateEventDayTaskSchema>;

export const updateCoordinatorAttendanceSchema = z.object({
  status: nonEmptyStringSchema,
  notes: z.string().trim().optional(),
  markedBy: z.string().trim().optional(),
});
export type UpdateCoordinatorAttendanceInput = z.infer<typeof updateCoordinatorAttendanceSchema>;

export const createUrgentIssueSchema = z.object({
  title: nonEmptyStringSchema,
  description: z.string().trim().optional(),
  severity: z.string().trim().optional(),
  ownerRole: z.string().trim().optional(),
  ownerName: z.string().trim().optional(),
  openedBy: z.string().trim().optional(),
  slaDueAt: z.string().trim().optional(),
});
export type CreateUrgentIssueInput = z.infer<typeof createUrgentIssueSchema>;
