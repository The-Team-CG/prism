import { z } from "zod";

const id = z.string().trim().min(1).max(200);
const note = z.string().trim().max(2000);
const positiveMoney = z.number().int().positive().max(2_000_000_000);
const dateTime = z.string().datetime({ offset: true });

export const bindSupplierContractSchema = z.object({
  storedObjectId: id,
  checksumSha256: z.string().regex(/^[a-f0-9]{64}$/i),
}).strict();
export type BindSupplierContractInput = z.infer<typeof bindSupplierContractSchema>;

export const reviewSupplierContractSchema = z.object({
  decision: z.enum(["accepted", "changes_requested"]),
  reason: note,
}).strict().superRefine((value, context) => {
  if (value.decision === "changes_requested" && !value.reason) {
    context.addIssue({ code: "custom", path: ["reason"], message: "A reason is required when requesting a correction" });
  }
});
export type ReviewSupplierContractInput = z.infer<typeof reviewSupplierContractSchema>;

export const acknowledgeSupplierScheduleSchema = z.object({
  expectedRevision: z.number().int().positive(),
}).strict();
export type AcknowledgeSupplierScheduleInput = z.infer<typeof acknowledgeSupplierScheduleSchema>;

export const requestSupplierScheduleChangeSchema = z.object({
  expectedRevision: z.number().int().positive(),
  reason: z.string().trim().min(1).max(2000),
}).strict();
export type RequestSupplierScheduleChangeInput = z.infer<typeof requestSupplierScheduleChangeSchema>;

export const createSupplierCreativeTaskSchema = z.object({
  requestId: id,
  idempotencyKey: z.string().uuid(),
  title: z.string().trim().min(1).max(160),
  brief: z.string().trim().min(1).max(5000),
  dueAt: dateTime.nullable().optional(),
}).strict();
export type CreateSupplierCreativeTaskInput = z.infer<typeof createSupplierCreativeTaskSchema>;

export const updateSupplierCreativeTaskSchema = z.object({
  status: z.enum(["accepted", "changes_requested", "cancelled"]),
  reviewNote: note.optional(),
}).strict().superRefine((value, context) => {
  if (["accepted", "changes_requested", "cancelled"].includes(value.status) && !value.reviewNote?.trim()) {
    context.addIssue({ code: "custom", path: ["reviewNote"], message: "A review note is required for this decision" });
  }
});
export type UpdateSupplierCreativeTaskInput = z.infer<typeof updateSupplierCreativeTaskSchema>;

export const updateSupplierCreativeProgressSchema = z.object({
  note,
}).strict();
export type UpdateSupplierCreativeProgressInput = z.infer<typeof updateSupplierCreativeProgressSchema>;

export const submitSupplierCreativeTaskSchema = z.object({
  storedObjectId: id.nullable().optional(),
  note: z.string().trim().max(2000),
}).strict().superRefine((value, context) => {
  if (!value.storedObjectId && !value.note) {
    context.addIssue({ code: "custom", path: ["note"], message: "Add a note or attach a file" });
  }
});
export type SubmitSupplierCreativeTaskInput = z.infer<typeof submitSupplierCreativeTaskSchema>;

export const createSupplierPayableMilestoneSchema = z.object({
  requestId: id,
  quoteId: id,
  label: z.string().trim().min(1).max(120),
  amount: positiveMoney,
  dueDate: dateTime.nullable().optional(),
  idempotencyKey: id,
}).strict();
export type CreateSupplierPayableMilestoneInput = z.infer<typeof createSupplierPayableMilestoneSchema>;

export const releaseSupplierPayoutSchema = z.object({
  amount: positiveMoney,
  paymentDate: dateTime,
  method: z.string().trim().min(1).max(80),
  referenceNumber: z.string().trim().max(160).default(""),
  notes: note.optional(),
  idempotencyKey: id,
}).strict();
export type ReleaseSupplierPayoutInput = z.infer<typeof releaseSupplierPayoutSchema>;

export const reverseSupplierPayoutSchema = z.object({
  paymentDate: dateTime,
  reason: z.string().trim().min(1).max(2000),
  idempotencyKey: id,
}).strict();
export type ReverseSupplierPayoutInput = z.infer<typeof reverseSupplierPayoutSchema>;
