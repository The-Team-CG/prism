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
