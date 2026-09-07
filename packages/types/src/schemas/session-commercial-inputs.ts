import { z } from "zod";
import { nonEmptyStringSchema, optionalTrimmedStringSchema } from "./common.js";

export const createBillingSourceSchema = z.object({
  sourceType: optionalTrimmedStringSchema,
  sourceLabel: nonEmptyStringSchema,
  sourceDocumentId: optionalTrimmedStringSchema,
  lineItems: z.array(z.object({ label: nonEmptyStringSchema, amount: z.number() })),
  paymentSchedule: z.array(z.object({ label: nonEmptyStringSchema, percentage: z.number(), dueDate: optionalTrimmedStringSchema })).optional(),
  paymentMethods: z.array(z.object({ label: nonEmptyStringSchema, details: z.string().default("") })).optional(),
});
export type CreateBillingSourceInput = z.infer<typeof createBillingSourceSchema>;

export const approveBillingSourceSchema = z.object({
  approvedBy: optionalTrimmedStringSchema,
  approvalNotes: optionalTrimmedStringSchema,
});
export type ApproveBillingSourceInput = z.infer<typeof approveBillingSourceSchema>;

export const generateBillingStatementSchema = z.object({ sourceId: optionalTrimmedStringSchema }).default({});
export type GenerateBillingStatementInput = z.infer<typeof generateBillingStatementSchema>;

export const markPaymentSchema = z.object({ status: z.enum(["pending", "paid", "at_risk"]) });
export type MarkPaymentInput = z.infer<typeof markPaymentSchema>;

export const recordPaymentSchema = z.object({
  amountReceived: z.number().int().min(1),
  paymentDate: z.string().min(1).refine((value) => !Number.isNaN(Date.parse(value)), "paymentDate must be a valid date"),
  paymentMethod: z.enum(["Bank Transfer", "GCash", "Cheque"]),
  referenceNumber: optionalTrimmedStringSchema,
});
export type RecordPaymentInput = z.infer<typeof recordPaymentSchema>;

export const runComplianceSchema = z.object({ phase: optionalTrimmedStringSchema }).default({});
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

export const archiveEventSchema = z.object({ overrideReason: optionalTrimmedStringSchema }).default({});
export type ArchiveEventInput = z.infer<typeof archiveEventSchema>;
