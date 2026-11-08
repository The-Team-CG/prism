import { z } from "zod";
import { nonEmptyStringSchema, optionalTrimmedStringSchema } from "./common.js";
/* ── Audit and privacy operations ────────────────────────────── */

export const privacyRequestTypeSchema = z.enum(["access", "correction", "deletion", "export"]);

export const createPrivacyRequestSchema = z.object({
  subjectType: nonEmptyStringSchema,
  subjectEmail: optionalTrimmedStringSchema,
  subjectName: optionalTrimmedStringSchema,
  eventId: optionalTrimmedStringSchema,
  requestType: privacyRequestTypeSchema,
  requestNotes: optionalTrimmedStringSchema,
});
export type CreatePrivacyRequestInput = z.infer<typeof createPrivacyRequestSchema>;

/** A client or supplier files their own request; PMCM verifies identity before acting on it. */
export const submitOwnPrivacyRequestSchema = z
  .object({
    requestType: privacyRequestTypeSchema,
    details: z.string().trim().max(1000).optional(),
  })
  .superRefine((input, context) => {
    if (input.requestType === "correction" && !input.details) {
      context.addIssue({ code: "custom", path: ["details"], message: "Describe what should be corrected" });
    }
  });
export type SubmitOwnPrivacyRequestInput = z.infer<typeof submitOwnPrivacyRequestSchema>;

export const reviewPrivacyRequestSchema = z.object({
  status: z.enum(["approved", "rejected"]),
  reviewReason: optionalTrimmedStringSchema,
});
export type ReviewPrivacyRequestInput = z.infer<typeof reviewPrivacyRequestSchema>;

export const createPrivacyLegalHoldSchema = z.object({
  subjectType: z.enum(["client", "supplier", "guest"]),
  subjectEmail: z.string().trim().email().optional(),
  subjectName: z.string().trim().min(1).optional(),
  eventId: z.string().trim().min(1).optional(),
  reason: z.string().trim().min(1).max(1000),
}).superRefine((input, context) => {
  if (input.subjectType !== "guest" && !input.subjectEmail) {
    context.addIssue({ code: "custom", path: ["subjectEmail"], message: "Client and supplier holds require an email identity" });
  }
  if (input.subjectType === "guest" && !input.subjectName) {
    context.addIssue({ code: "custom", path: ["subjectName"], message: "Guest holds require a name identity" });
  }
});
export type CreatePrivacyLegalHoldInput = z.infer<typeof createPrivacyLegalHoldSchema>;

export const releasePrivacyLegalHoldSchema = z.object({
  reason: z.string().trim().min(1).max(1000),
});
export type ReleasePrivacyLegalHoldInput = z.infer<typeof releasePrivacyLegalHoldSchema>;

export const listPrivacyLegalHoldsQuerySchema = z.object({
  eventId: z.string().trim().min(1).optional(),
});
export type ListPrivacyLegalHoldsQuery = z.infer<typeof listPrivacyLegalHoldsQuerySchema>;

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
