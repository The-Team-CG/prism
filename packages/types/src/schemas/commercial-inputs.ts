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

/** A comment on the issued proposal. Any client contact of the event may comment; only the primary contact decides. */
export const createProposalCommentSchema = z.object({
  body: z.string().trim().min(1).max(2000),
  idempotencyKey: nonEmptyStringSchema,
});
export type CreateProposalCommentInput = z.infer<typeof createProposalCommentSchema>;

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
  /** FR-62: a second package (Option B) for a client whose budget is a range or not yet confirmed. */
  alternativeCostEstimateId: optionalTrimmedStringSchema,
  /** FR-62: needed to offer two packages when the briefing names one fixed budget. */
  packageOverrideReason: z.string().trim().min(1).max(500).optional(),
  revisionNote: z.string().trim().default(''),
  /** One key per drafted proposal: an identical retry replays the issued version instead of creating another. */
  idempotencyKey: nonEmptyStringSchema.optional(),
});
export type IssueProposalVersionInput = z.infer<typeof issueProposalVersionSchema>;

/**
 * FR-62: how many packages a proposal should offer. One when the briefing names a single fixed budget, up to two when
 * the budget is a range or not given. PMCM can override with a reason.
 */
export function proposalPackageLimit(budgetRange: string | null | undefined): 1 | 2 {
  const value = (budgetRange ?? "").trim();
  if (!value) return 2;
  const amounts = value.replace(/,/g, "").match(/\d+(?:\.\d+)?\s*[kKmM]?/g) ?? [];
  const isRange = /(-|–|—|\bto\b|~)/i.test(value) || amounts.length > 1;
  return amounts.length === 1 && !isRange ? 1 : 2;
}

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

/** Files one message may carry. */
export const COMMUNICATION_MESSAGE_ATTACHMENT_LIMIT = 10;

/** A message has text, files, or both: a file-only message has an empty body. */
export const sendCommunicationMessageSchema = z.object({
  body: z.string().trim().default(""),
  attachmentObjectIds: z.array(nonEmptyStringSchema).max(COMMUNICATION_MESSAGE_ATTACHMENT_LIMIT).optional(),
  idempotencyKey: nonEmptyStringSchema,
}).superRefine((value, ctx) => {
  const ids = value.attachmentObjectIds ?? [];
  if (new Set(ids).size !== ids.length) ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'A file can be attached to a message only once', path: ['attachmentObjectIds'] });
  if (!value.body && ids.length === 0) ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'A message needs text or at least one file', path: ['body'] });
});
export type SendCommunicationMessageInput = z.infer<typeof sendCommunicationMessageSchema>;

/** Without an event the count is the whole inbox; with one it is that event's conversations only. */
export const communicationUnreadCountQuerySchema = z.object({
  eventId: nonEmptyStringSchema.optional(),
});
export type CommunicationUnreadCountQuery = z.infer<typeof communicationUnreadCountQuerySchema>;

/** A conversation is open until PMCM closes it; a closed one takes no new messages until reopened. */
export const communicationThreadStatusSchema = z.enum(["open", "closed"]);
export type CommunicationThreadStatus = z.infer<typeof communicationThreadStatusSchema>;

export const updateCommunicationThreadStatusSchema = z.object({
  status: communicationThreadStatusSchema,
});
export type UpdateCommunicationThreadStatusInput = z.infer<typeof updateCommunicationThreadStatusSchema>;

/** Paging and search shared by the inbox and one event's conversation list. An empty `q` means no search. */
const communicationThreadPageFields = {
  cursor: z.string().min(1).max(500).optional(),
  limit: z.coerce.number().int().min(1).max(50).default(30),
  q: z.string().trim().max(100).transform((value) => value || undefined).optional(),
  status: communicationThreadStatusSchema.default("open"),
};
export const communicationInboxQuerySchema = z.object(communicationThreadPageFields);
export type CommunicationInboxQuery = z.infer<typeof communicationInboxQuerySchema>;

export const communicationThreadsQuerySchema = z.object({ eventId: nonEmptyStringSchema, ...communicationThreadPageFields });
export type CommunicationThreadsQuery = z.infer<typeof communicationThreadsQuerySchema>;

export const addCommunicationParticipantsSchema = z.object({
  actorIds: z.array(nonEmptyStringSchema).min(1).max(20),
}).superRefine((value, ctx) => {
  if (new Set(value.actorIds).size !== value.actorIds.length) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Duplicate people are not allowed", path: ["actorIds"] });
});
export type AddCommunicationParticipantsInput = z.infer<typeof addCommunicationParticipantsSchema>;

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

export const updateSupplierEventStatusSchema = z.object({
  status: z.enum(["arrived", "set_up_ready", "done_leaving"]),
  notes: optionalTrimmedStringSchema,
  /** Optional status photo: a confirmed upload from the supplier's storage upload, verified server-side. */
  storedObjectId: nonEmptyStringSchema.optional(),
});
export type UpdateSupplierEventStatusInput = z.infer<typeof updateSupplierEventStatusSchema>;

/** PMCM-only correction of a supplier's event-day status; may also reset it to "not_started". */
export const correctSupplierEventStatusSchema = z.object({
  status: z.enum(["not_started", "arrived", "set_up_ready", "done_leaving"]),
  reason: z.string().trim().min(1).max(500),
});
export type CorrectSupplierEventStatusInput = z.infer<typeof correctSupplierEventStatusSchema>;

export const submitSupplierQuoteSchema = z.object({
  amount: z.number().int().min(0).max(2147483647),
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
