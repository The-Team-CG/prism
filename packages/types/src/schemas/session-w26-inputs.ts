import { z } from "zod";
import { nonEmptyStringSchema, optionalTrimmedStringSchema } from "./common.js";

const snapshotEntrySchema = z.record(z.string(), z.unknown());

export const freezeEventSchema = z.object({
  reason: nonEmptyStringSchema,
  deadline: optionalTrimmedStringSchema.refine((value) => !value || !Number.isNaN(Date.parse(value)), "deadline must be a valid date"),
});
export type FreezeEventInput = z.infer<typeof freezeEventSchema>;

export const requestFreezeExceptionSchema = z.object({
  requestedChange: nonEmptyStringSchema,
  reason: nonEmptyStringSchema,
});
export type RequestFreezeExceptionInput = z.infer<typeof requestFreezeExceptionSchema>;

export const decideFreezeExceptionSchema = z.object({
  decision: z.enum(["approve", "reject"]),
  decisionNote: optionalTrimmedStringSchema,
}).superRefine((value, ctx) => {
  if (value.decision === "reject" && !value.decisionNote?.trim()) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["decisionNote"], message: "A reason is required when rejecting a freeze exception" });
  }
});
export type DecideFreezeExceptionInput = z.infer<typeof decideFreezeExceptionSchema>;

export const issueAddendumSchema = z.object({
  title: nonEmptyStringSchema,
  summary: optionalTrimmedStringSchema,
  documentId: nonEmptyStringSchema,
  contractSnapshot: z.array(snapshotEntrySchema),
  quoteSnapshot: z.array(snapshotEntrySchema),
  financialDelta: z.number().int().default(0),
  freezeExceptionId: optionalTrimmedStringSchema,
});
export type IssueAddendumInput = z.infer<typeof issueAddendumSchema>;

export const withdrawAddendumSchema = z.object({
  reason: nonEmptyStringSchema,
});
export type WithdrawAddendumInput = z.infer<typeof withdrawAddendumSchema>;

/**
 * Commercial effect of a pending addendum, stored at issue and applied only on countersignature. Each baseline is the
 * value read at issue; apply refuses to write when the current value differs, so a stale plan never lands silently.
 */
export const addendumPlannedImpactsSchema = z.object({
  financialDelta: z.number().int(),
  billing: z.object({
    billingSourceId: nonEmptyStringSchema,
    baselineTotalAmount: z.number().int(),
    baselineLineItems: z.array(z.record(z.string(), z.unknown())),
  }).nullable(),
  quotes: z.array(z.object({
    quoteId: nonEmptyStringSchema,
    baselineAmount: z.number().int(),
    targetAmount: z.number().int(),
  })),
}).refine((plan) => (plan.financialDelta === 0) === (plan.billing === null), {
  message: "A billing plan is present exactly when the financial delta is non-zero",
});
export type AddendumPlannedImpacts = z.infer<typeof addendumPlannedImpactsSchema>;
