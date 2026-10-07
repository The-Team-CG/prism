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
});
export type RequestSupplierQuotesInput = z.infer<typeof requestSupplierQuotesSchema>;

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
  lineItems: z.array(z.object({ label: nonEmptyStringSchema, amount: z.number() })),
  paymentSchedule: z.array(z.object({ label: nonEmptyStringSchema, percentage: z.number(), dueDate: optionalTrimmedStringSchema })).optional(),
  paymentMethods: z.array(z.object({ label: nonEmptyStringSchema, details: z.string().default("") })).optional(),
  paymentTermsPolicy: z.enum(["standard", "repeat_client_override"]).optional(),
  paymentTermsOverrideReason: optionalTrimmedStringSchema,
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

export const requestBillingCorrectionSchema = z.object({
  statementId: nonEmptyStringSchema,
  reason: nonEmptyStringSchema,
  correctedTotalAmount: z.number().int().positive().optional(),
  idempotencyKey: nonEmptyStringSchema,
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

export const createComplianceRiskSchema = z.object({
  phase: nonEmptyStringSchema,
  title: nonEmptyStringSchema,
  severity: z.enum(["low", "medium", "high", "critical"]).default("medium"),
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
