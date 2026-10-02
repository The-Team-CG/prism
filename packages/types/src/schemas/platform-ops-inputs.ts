import { z } from "zod";
import { nonEmptyStringSchema, optionalTrimmedStringSchema } from "./common.js";
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
