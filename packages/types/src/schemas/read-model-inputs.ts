import { z } from "zod";
export const PRISM_PMCM_COMMAND_INBOX_MAX_PAGE = 100;
export const pmcmCommandInboxQuerySchema = z.object({
  page: z.coerce.number().int().min(0).max(PRISM_PMCM_COMMAND_INBOX_MAX_PAGE).default(0),
});
export type PrismPmcmCommandInboxQueryInput = z.infer<typeof pmcmCommandInboxQuerySchema>;

/** FL-019 Decision Log: every decision source the PMCM log composes for one event. */
export const PRISM_DECISION_LOG_KINDS = [
  "postponement",
  "cancellation",
  "freeze_exception",
  "addendum",
  "archive_override",
  "compliance_override",
  "risk_change",
  "ocular_waiver",
  "billing_correction",
  "billing_waiver",
  "payment_terms_override",
  "reassignment",
  "inquiry_merge",
] as const;
export const decisionLogKindSchema = z.enum(PRISM_DECISION_LOG_KINDS);
export type PrismDecisionLogKind = z.infer<typeof decisionLogKindSchema>;
export const PRISM_DECISION_LOG_MAX_PAGE = 100;
export const PRISM_DECISION_LOG_MAX_PAGE_SIZE = 100;
export const PRISM_DECISION_LOG_DEFAULT_PAGE_SIZE = 25;
export const decisionLogQuerySchema = z.object({
  kind: decisionLogKindSchema.optional(),
  page: z.coerce.number().int().min(0).max(PRISM_DECISION_LOG_MAX_PAGE).default(0),
  pageSize: z.coerce
    .number()
    .int()
    .min(1)
    .max(PRISM_DECISION_LOG_MAX_PAGE_SIZE)
    .default(PRISM_DECISION_LOG_DEFAULT_PAGE_SIZE),
});
export type PrismDecisionLogQuery = z.infer<typeof decisionLogQuerySchema>;
/** Caller-side filters (page and size are optional and defaulted by the schema). */
export type PrismDecisionLogQueryInput = Partial<PrismDecisionLogQuery>;
