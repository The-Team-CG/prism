import { z } from "zod";
import { isoDateStringSchema } from "./common.js";

/* FR-53 Pre-Conforme Context Notes Log. */
export const INQUIRY_CONTEXT_NOTE_KINDS = ["discussion", "scope_flag", "follow_up"] as const;
export const INQUIRY_CONTEXT_NOTE_LABELS: Record<(typeof INQUIRY_CONTEXT_NOTE_KINDS)[number], string> = {
  discussion: "Discussion note",
  scope_flag: "Scope flag",
  follow_up: "Follow-up reminder",
};
export const createInquiryContextNoteSchema = z.object({
  kind: z.enum(INQUIRY_CONTEXT_NOTE_KINDS),
  body: z.string().trim().min(1).max(2000),
  followUpAt: isoDateStringSchema.optional(),
}).strict().superRefine((value, ctx) => {
  if (value.kind === "follow_up" && !value.followUpAt) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["followUpAt"], message: "A follow-up needs a date" });
});
export type CreateInquiryContextNoteInput = z.infer<typeof createInquiryContextNoteSchema>;

export interface PrismInquiryContextNote {
  id: string;
  inquiryId: string;
  kind: (typeof INQUIRY_CONTEXT_NOTE_KINDS)[number];
  body: string;
  followUpAt: string | null;
  createdBy: string;
  createdAt: string;
}

/* FR-70 Accreditation Document Tracker: its own SLA timer, never a planning gate. */
export const ACCREDITATION_SLA_DAYS = 7;
export const ACCREDITATION_STATUSES = ["pending", "submitted", "accepted"] as const;
export const createAccreditationRequirementSchema = z.object({
  documentName: z.string().trim().min(1).max(200),
  dueInDays: z.number().int().min(1).max(90).default(ACCREDITATION_SLA_DAYS),
  note: z.string().trim().max(1000).default(""),
}).strict();
export type CreateAccreditationRequirementInput = z.input<typeof createAccreditationRequirementSchema>;
export const updateAccreditationRequirementSchema = z.object({
  status: z.enum(ACCREDITATION_STATUSES),
  note: z.string().trim().max(1000).optional(),
}).strict();
export type UpdateAccreditationRequirementInput = z.infer<typeof updateAccreditationRequirementSchema>;

export interface PrismAccreditationRequirement {
  id: string;
  eventId: string;
  documentName: string;
  status: (typeof ACCREDITATION_STATUSES)[number];
  dueAt: string;
  submittedAt: string | null;
  note: string;
  /** Past its SLA and not yet accepted. */
  overdue: boolean;
  updatedBy: string;
}

/* New-P4 Logistics Booking Record: returning client assets by courier. */
export const LOGISTICS_PROVIDERS = ["grab", "lalamove", "transportify", "other"] as const;
export const LOGISTICS_PROVIDER_LABELS: Record<(typeof LOGISTICS_PROVIDERS)[number], string> = {
  grab: "Grab", lalamove: "Lalamove", transportify: "Transportify", other: "Other courier",
};
export const createLogisticsBookingSchema = z.object({
  provider: z.enum(LOGISTICS_PROVIDERS),
  bookingReference: z.string().trim().min(1).max(120),
  description: z.string().trim().min(1).max(1000),
  /** Whole pesos; above zero raises a draft logistics billing item for PMCM approval. */
  amount: z.number().int().min(0).max(10_000_000),
}).strict();
export type CreateLogisticsBookingInput = z.infer<typeof createLogisticsBookingSchema>;

export interface PrismLogisticsBooking {
  id: string;
  eventId: string;
  provider: (typeof LOGISTICS_PROVIDERS)[number];
  bookingReference: string;
  description: string;
  amount: number;
  billingSourceId: string | null;
  createdBy: string;
  createdAt: string;
}
