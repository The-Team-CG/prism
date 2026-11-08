import { z } from "zod";
import { nonEmptyStringSchema, optionalTrimmedStringSchema } from "./common.js";

export const addSupplierQuoteSchema = z.object({
  requestId: optionalTrimmedStringSchema,
  supplierId: optionalTrimmedStringSchema,
  categoryId: optionalTrimmedStringSchema,
  supplierName: optionalTrimmedStringSchema,
  category: optionalTrimmedStringSchema,
  amount: z.number().int().min(0).optional(),
  inclusions: z.array(nonEmptyStringSchema).optional(),
  paymentTerms: optionalTrimmedStringSchema,
  notes: optionalTrimmedStringSchema,
  status: optionalTrimmedStringSchema,
});
export type AddSupplierQuoteInput = z.infer<typeof addSupplierQuoteSchema>;

export const requestSupplierQuotesSchema = z.object({
  categoryId: nonEmptyStringSchema,
  supplierIds: z.array(nonEmptyStringSchema).optional(),
  confidentialBid: z.boolean().optional(),
  deadline: optionalTrimmedStringSchema,
  /** FR-16: needed to ask a Tier 2 supplier while a free Tier 1 supplier can serve the event. */
  tierOverrideReason: z.string().trim().min(1).max(500).optional(),
});
export type RequestSupplierQuotesInput = z.infer<typeof requestSupplierQuotesSchema>;

/** FR-63: PMCM accepts the risk of a category with no available Tier 1 or Tier 2 supplier. */
export const acknowledgeSupplierGapSchema = z.object({ reason: nonEmptyStringSchema.max(500) });
export type AcknowledgeSupplierGapInput = z.infer<typeof acknowledgeSupplierGapSchema>;

/** PMCM's own sizing of how big an event a supplier can serve, relative to their category (catalog FR-14, FR-35). */
export const SUPPLIER_CAPACITY_RATINGS = ["small", "medium", "large"] as const;
export const supplierCapacityRatingSchema = z.enum(SUPPLIER_CAPACITY_RATINGS);
export type SupplierCapacityRating = z.infer<typeof supplierCapacityRatingSchema>;

/** FR-16: the scale an event needs, from its briefing guest count (up to 100 small, up to 300 medium, above that large). */
export function eventSupplierScale(guestCount: number | null | undefined): SupplierCapacityRating | null {
  if (!guestCount || guestCount < 1) return null;
  if (guestCount <= 100) return "small";
  return guestCount <= 300 ? "medium" : "large";
}

/** A supplier rated at or above the event scale can serve it; an unrated supplier is not ruled out. */
export function supplierServesScale(rating: string | null | undefined, scale: SupplierCapacityRating | null): boolean {
  if (!scale || !rating) return true;
  return SUPPLIER_CAPACITY_RATINGS.indexOf(rating as SupplierCapacityRating) >= SUPPLIER_CAPACITY_RATINGS.indexOf(scale);
}

export const createSupplierSchema = z.object({
  categoryId: nonEmptyStringSchema,
  name: nonEmptyStringSchema,
  contactName: optionalTrimmedStringSchema,
  email: z.string().email().optional(),
  phone: optionalTrimmedStringSchema,
  tier: z.enum(["tier_1", "tier_2", "pending_first_event"]).optional(),
  bniMember: z.boolean().optional(),
  serviceInclusions: optionalTrimmedStringSchema,
  performanceNotes: optionalTrimmedStringSchema,
  /** Null clears the rating back to unrated. */
  capacityRating: supplierCapacityRatingSchema.nullable().optional(),
});
export type CreateSupplierInput = z.infer<typeof createSupplierSchema>;

export const updateSupplierSchema = createSupplierSchema.omit({ tier: true }).partial().strict();
export type UpdateSupplierInput = z.infer<typeof updateSupplierSchema>;

export const changeSupplierTierSchema = z.object({
  tier: z.enum(["tier_1", "tier_2", "pending_first_event"]),
  reason: nonEmptyStringSchema,
});
export type ChangeSupplierTierInput = z.infer<typeof changeSupplierTierSchema>;

export const createSupplierCertificationSchema = z.object({
  fileName: nonEmptyStringSchema,
  documentType: nonEmptyStringSchema,
  issuer: optionalTrimmedStringSchema,
  expiresAt: z.string().trim().pipe(z.iso.date()).optional(),
  status: z.enum(["submitted", "verified", "expired", "rejected"]).optional(),
  notes: optionalTrimmedStringSchema,
});
export type CreateSupplierCertificationInput = z.infer<typeof createSupplierCertificationSchema>;

export const createBillingSourceSchema = z.object({
  sourceType: optionalTrimmedStringSchema,
  sourceLabel: nonEmptyStringSchema,
  sourceDocumentId: optionalTrimmedStringSchema,
  lineItems: z.array(z.object({ label: nonEmptyStringSchema, amount: z.number().int().positive().max(2147483647) })).min(1),
  paymentSchedule: z.array(z.object({ label: nonEmptyStringSchema, percentage: z.number(), dueDate: optionalTrimmedStringSchema })).optional(),
  paymentMethods: z.array(z.object({ label: nonEmptyStringSchema, details: z.string().default("") })).optional(),
  paymentTermsPolicy: z.enum(["standard", "repeat_client_override"]).optional(),
  paymentTermsOverrideReason: optionalTrimmedStringSchema,
  /** PMCM reason for citing a superseded proposal version as evidence. */
  evidenceOverrideReason: optionalTrimmedStringSchema,
  /** PMCM reason for a source total that differs from the cited proposal total; a different PMCM admin must approve it. */
  totalOverrideReason: optionalTrimmedStringSchema,
  idempotencyKey: optionalTrimmedStringSchema,
}).superRefine((value, ctx) => {
  if (value.paymentTermsPolicy === "repeat_client_override" && !value.paymentTermsOverrideReason?.trim()) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["paymentTermsOverrideReason"], message: "A reason is required for repeat-client payment term overrides" });
  }
});
export type CreateBillingSourceInput = z.infer<typeof createBillingSourceSchema>;

export const approveBillingSourceSchema = z.object({
  approvalNotes: optionalTrimmedStringSchema,
});
export type ApproveBillingSourceInput = z.infer<typeof approveBillingSourceSchema>;

export const generateBillingStatementSchema = z.object({ sourceId: optionalTrimmedStringSchema, idempotencyKey: optionalTrimmedStringSchema }).default({});
export type GenerateBillingStatementInput = z.infer<typeof generateBillingStatementSchema>;

export const markPaymentSchema = z.object({ status: z.enum(["pending", "paid", "at_risk"]) });
export type MarkPaymentInput = z.infer<typeof markPaymentSchema>;

export const recordPaymentSchema = z.object({
  amountReceived: z.number().int().min(1),
  paymentDate: z.string().min(1).refine((value) => !Number.isNaN(Date.parse(value)), "paymentDate must be a valid date"),
  paymentMethod: z.enum(["Bank Transfer", "GCash", "Cheque"]),
  referenceNumber: optionalTrimmedStringSchema,
  idempotencyKey: optionalTrimmedStringSchema,
});
export type RecordPaymentInput = z.infer<typeof recordPaymentSchema>;

export const BILLING_DISCREPANCY_SEVERITIES = ["typo_correction", "amount_discrepancy"] as const;
export const billingDiscrepancySeveritySchema = z.enum(BILLING_DISCREPANCY_SEVERITIES);
export type BillingDiscrepancySeverity = z.infer<typeof billingDiscrepancySeveritySchema>;
export const BILLING_DISCREPANCY_SEVERITY_LABELS: Record<BillingDiscrepancySeverity, string> = {
  typo_correction: "Typo correction",
  amount_discrepancy: "Amount discrepancy",
};

export const requestBillingCorrectionSchema = z.object({
  statementId: nonEmptyStringSchema,
  reason: nonEmptyStringSchema,
  severity: billingDiscrepancySeveritySchema,
  correctedTotalAmount: z.number().int().positive().optional(),
  idempotencyKey: nonEmptyStringSchema,
}).superRefine((value, ctx) => {
  if (value.severity === "typo_correction" && value.correctedTotalAmount !== undefined) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["correctedTotalAmount"], message: "A typo correction cannot change the statement amount" });
  }
});
export type RequestBillingCorrectionInput = z.infer<typeof requestBillingCorrectionSchema>;

export const resolveBillingCorrectionSchema = z.object({
  action: z.enum(["approve", "reject"]),
  resolutionNotes: optionalTrimmedStringSchema,
}).superRefine((value, ctx) => {
  if (value.action === "reject" && !value.resolutionNotes?.trim()) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["resolutionNotes"], message: "A reason is required when rejecting a billing correction" });
  }
});
export type ResolveBillingCorrectionInput = z.infer<typeof resolveBillingCorrectionSchema>;

export const createBillingDisputeSchema = z.object({
  statementId: nonEmptyStringSchema,
  milestoneId: optionalTrimmedStringSchema,
  amount: z.number().int().positive(),
  reason: nonEmptyStringSchema,
  severity: billingDiscrepancySeveritySchema,
  idempotencyKey: nonEmptyStringSchema,
});
export type CreateBillingDisputeInput = z.infer<typeof createBillingDisputeSchema>;

export const resolveBillingDisputeSchema = z.object({
  action: z.enum(["resolve", "reject"]),
  resolutionNotes: nonEmptyStringSchema,
});
export type ResolveBillingDisputeInput = z.infer<typeof resolveBillingDisputeSchema>;

export const createAdditionalBillingSchema = z.object({
  urgentIssueId: nonEmptyStringSchema,
  /** The approved billing source the additional charge is issued against; the API verifies it is approved for this event. */
  billingSourceId: nonEmptyStringSchema,
  description: nonEmptyStringSchema,
  amount: z.number().int().positive(),
  idempotencyKey: nonEmptyStringSchema,
});
export type CreateAdditionalBillingInput = z.infer<typeof createAdditionalBillingSchema>;

export const waiveAdditionalBillingSchema = z.object({
  reason: nonEmptyStringSchema,
});
export type WaiveAdditionalBillingInput = z.infer<typeof waiveAdditionalBillingSchema>;

export const runComplianceSchema = z.object({
  phase: optionalTrimmedStringSchema,
  trigger: z.enum(["manual", "scheduled", "state_change"]).optional(),
}).default({});
export type RunComplianceInput = z.infer<typeof runComplianceSchema>;

export const resolveComplianceSchema = z.object({
  action: z.enum(["resolve", "override"]).optional(),
  note: optionalTrimmedStringSchema,
  overrideReason: optionalTrimmedStringSchema,
});
export type ResolveComplianceInput = z.infer<typeof resolveComplianceSchema>;

export const createComplianceRuleSchema = z.object({
  eventId: optionalTrimmedStringSchema,
  eventType: optionalTrimmedStringSchema,
  phase: optionalTrimmedStringSchema,
  severity: optionalTrimmedStringSchema,
  layer: optionalTrimmedStringSchema,
  conditionKey: nonEmptyStringSchema,
  title: nonEmptyStringSchema,
  note: optionalTrimmedStringSchema,
  active: z.boolean().optional(),
});
export type CreateComplianceRuleInput = z.infer<typeof createComplianceRuleSchema>;
export const updateComplianceRuleSchema = createComplianceRuleSchema.partial();
export type UpdateComplianceRuleInput = z.infer<typeof updateComplianceRuleSchema>;

export const RISK_RATINGS = ["low", "medium", "high"] as const;
export const riskRatingSchema = z.enum(RISK_RATINGS);
export type RiskRating = z.infer<typeof riskRatingSchema>;
export type RiskSeverity = "low" | "medium" | "high" | "critical";

/**
 * Severity from a likelihood and impact rating (low 1, medium 2, high 3, multiplied): 1-2 low, 3-4 medium, 6 high,
 * 9 critical. A recorded severity always wins over this; it only fills in when none was given.
 */
export function riskSeverityFromRatings(likelihood: RiskRating, impact: RiskRating): RiskSeverity {
  const weight = (rating: RiskRating) => RISK_RATINGS.indexOf(rating) + 1;
  const score = weight(likelihood) * weight(impact);
  if (score >= 9) return "critical";
  if (score >= 6) return "high";
  if (score >= 3) return "medium";
  return "low";
}

export const createComplianceRiskSchema = z.object({
  phase: nonEmptyStringSchema,
  title: nonEmptyStringSchema,
  severity: z.enum(["low", "medium", "high", "critical"]).optional(),
  likelihood: riskRatingSchema.optional(),
  impact: riskRatingSchema.optional(),
  owner: optionalTrimmedStringSchema,
  mitigation: optionalTrimmedStringSchema,
  status: z.enum(["open", "mitigated", "accepted", "closed"]).default("open"),
  reason: optionalTrimmedStringSchema,
});
export type CreateComplianceRiskInput = z.infer<typeof createComplianceRiskSchema>;

export const updateComplianceRiskSchema = createComplianceRiskSchema.partial();
export type UpdateComplianceRiskInput = z.infer<typeof updateComplianceRiskSchema>;

export const archiveEventSchema = z.object({ overrideReason: optionalTrimmedStringSchema }).default({});
export type ArchiveEventInput = z.infer<typeof archiveEventSchema>;
