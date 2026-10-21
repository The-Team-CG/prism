import { z } from "zod";
import { optionalTrimmedStringSchema } from "./common.js";

/* ── Privacy retention policies and review queue ─────────────── */

/** Categories that have a retention policy row. Only a subset has a sweep candidate source and executor. */
export const PRIVACY_RETENTION_CATEGORIES = [
  "inquiry",
  "approval_request",
  "supplier",
  "guest_check_in",
  "guest_feedback",
  "documents",
  "audit",
  "legal_hold",
] as const;
export const privacyRetentionCategorySchema = z.enum(PRIVACY_RETENTION_CATEGORIES);
export type PrivacyRetentionCategory = z.infer<typeof privacyRetentionCategorySchema>;

export const PRIVACY_RETENTION_ANCHORS = ["event_archived_at", "event_end", "record_created_at", "inquiry_declined_at"] as const;
export const privacyRetentionAnchorSchema = z.enum(PRIVACY_RETENTION_ANCHORS);
export type PrivacyRetentionAnchor = z.infer<typeof privacyRetentionAnchorSchema>;

export const PRIVACY_RETENTION_ACTIONS = ["review_anonymize", "review_delete"] as const;
export const privacyRetentionActionSchema = z.enum(PRIVACY_RETENTION_ACTIONS);
export type PrivacyRetentionAction = z.infer<typeof privacyRetentionActionSchema>;

export const PRIVACY_RETENTION_ITEM_STATUSES = ["pending", "held", "executed", "dismissed"] as const;
export const privacyRetentionItemStatusSchema = z.enum(PRIVACY_RETENTION_ITEM_STATUSES);
export type PrivacyRetentionItemStatus = z.infer<typeof privacyRetentionItemStatusSchema>;

/** Policy edits are PMCM-admin only. `expectedRevision` guards against overwriting a concurrent edit. */
export const updatePrivacyRetentionPolicySchema = z.object({
  enabled: z.boolean().optional(),
  periodDays: z.number().int().min(30).max(3650).optional(),
  action: privacyRetentionActionSchema.optional(),
  expectedRevision: z.number().int().positive(),
  reason: z.string().trim().min(1).max(1000),
}).superRefine((input, context) => {
  if (input.enabled === undefined && input.periodDays === undefined && input.action === undefined) {
    context.addIssue({ code: "custom", path: ["enabled"], message: "A policy edit must change enabled, periodDays, or action" });
  }
});
export type UpdatePrivacyRetentionPolicyInput = z.infer<typeof updatePrivacyRetentionPolicySchema>;

export const listPrivacyRetentionReviewItemsQuerySchema = z.object({
  status: z.enum([...PRIVACY_RETENTION_ITEM_STATUSES, "all"]).optional(),
  category: privacyRetentionCategorySchema.optional(),
  eventId: optionalTrimmedStringSchema,
});
export type ListPrivacyRetentionReviewItemsQuery = z.infer<typeof listPrivacyRetentionReviewItemsQuerySchema>;

export const executePrivacyRetentionReviewItemSchema = z.object({
  executionNotes: optionalTrimmedStringSchema,
});
export type ExecutePrivacyRetentionReviewItemInput = z.infer<typeof executePrivacyRetentionReviewItemSchema>;

export const dismissPrivacyRetentionReviewItemSchema = z.object({
  reason: z.string().trim().min(1).max(1000),
});
export type DismissPrivacyRetentionReviewItemInput = z.infer<typeof dismissPrivacyRetentionReviewItemSchema>;
