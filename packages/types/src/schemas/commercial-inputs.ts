import { z } from "zod";
import {
  isoDateStringSchema,
  nonEmptyStringSchema,
  optionalTrimmedStringSchema,
  privacyConsentSchema,
  uploadMetadataSchema,
} from "./common.js";
/* Proposal and estimate writes. */

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

export const costEstimateLineSchema = z.object({
  category: nonEmptyStringSchema,
  description: nonEmptyStringSchema,
  quantity: z.number().positive(),
  unitAmount: z.number().int().nonnegative(),
  sourceLineId: optionalTrimmedStringSchema,
});
export type CostEstimateLineInput = z.infer<typeof costEstimateLineSchema>;

export const createCostEstimateSchema = z.object({
  budgetAmount: z.number().int().positive(),
  lines: z.array(costEstimateLineSchema).min(1),
  notes: z.string().trim().default(''),
  reuseEstimateId: optionalTrimmedStringSchema,
});
export type CreateCostEstimateInput = z.infer<typeof createCostEstimateSchema>;

export const issueProposalVersionSchema = z.object({
  title: nonEmptyStringSchema,
  summary: z.string().trim().default(''),
  costEstimateId: nonEmptyStringSchema,
  revisionNote: z.string().trim().default(''),
});
export type IssueProposalVersionInput = z.infer<typeof issueProposalVersionSchema>;

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
}).extend(privacyConsentSchema.shape);
export type CreateSupplierApplicationInput = z.infer<typeof createSupplierApplicationSchema>;

export const supplierApplicationStatusQuerySchema = z.object({
  applicationId: nonEmptyStringSchema,
  email: z.string().trim().email(),
});
export type SupplierApplicationStatusQuery = z.infer<typeof supplierApplicationStatusQuerySchema>;

export const createSupplierReviewSchema = z.object({
  eventId: optionalTrimmedStringSchema,
  rating: z.number().int().min(1).max(5),
  notes: nonEmptyStringSchema,
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

export const createSupplierScheduleSchema = z.object({
  requestId: nonEmptyStringSchema,
  ingressAt: z.string().datetime({ offset: true }),
  egressAt: z.string().datetime({ offset: true }),
  location: optionalTrimmedStringSchema,
  notes: optionalTrimmedStringSchema,
}).superRefine((value, ctx) => {
  if (new Date(value.egressAt) <= new Date(value.ingressAt)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['egressAt'], message: 'Egress must be after ingress' });
  }
});
export type CreateSupplierScheduleInput = z.infer<typeof createSupplierScheduleSchema>;

export const uploadContractSchema = uploadMetadataSchema.extend({
  idempotencyKey: nonEmptyStringSchema,
});
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

export const supplierAvailabilitySchema = z.object({
  availableOn: isoDateStringSchema,
  capacity: z.number().int().min(0).max(1000),
  blocked: z.boolean().optional(),
  notes: optionalTrimmedStringSchema,
});
export type SupplierAvailabilityInput = z.infer<typeof supplierAvailabilitySchema>;
