import { z } from "zod";
import { nonEmptyStringSchema, optionalTrimmedStringSchema } from "./common.js";

export const createClientReviewItemSchema = z.object({
  kind: z.enum(["venue", "styling"]),
  title: nonEmptyStringSchema,
  summary: nonEmptyStringSchema,
  budgetRange: optionalTrimmedStringSchema,
  documentId: optionalTrimmedStringSchema,
  idempotencyKey: nonEmptyStringSchema,
});
export type CreateClientReviewItemInput = z.infer<typeof createClientReviewItemSchema>;

export const decideClientReviewItemSchema = z.object({
  itemVersion: z.number().int().positive(),
  action: z.enum(["approve", "request_revision"]),
  comment: z.string().trim().max(4000).default(""),
  idempotencyKey: nonEmptyStringSchema.optional(),
}).superRefine((value, ctx) => {
  if (value.action === "request_revision" && value.comment.length === 0) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["comment"], message: "A revision request needs a comment" });
  }
});
export type DecideClientReviewItemInput = z.infer<typeof decideClientReviewItemSchema>;

export const decideClientFloorPlanSchema = z.object({
  snapshotHash: z.string().trim().min(32).max(128),
  action: z.enum(["approve", "request_revision"]),
  comment: z.string().trim().max(4000).default(""),
  idempotencyKey: nonEmptyStringSchema.optional(),
}).superRefine((value, ctx) => {
  if (value.action === "request_revision" && value.comment.length === 0) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["comment"], message: "A revision request needs a comment" });
  }
});
export type DecideClientFloorPlanInput = z.infer<typeof decideClientFloorPlanSchema>;

export const createClientFloorPlanAnnotationSchema = z.object({
  snapshotHash: z.string().trim().min(32).max(128),
  objectId: optionalTrimmedStringSchema,
  comment: nonEmptyStringSchema.max(2000),
  anchorX: z.number().min(0).max(1).optional(),
  anchorY: z.number().min(0).max(1).optional(),
});
export type CreateClientFloorPlanAnnotationInput = z.infer<typeof createClientFloorPlanAnnotationSchema>;

export const acknowledgeClientDeliverableSchema = z.object({
  note: z.string().trim().max(2000).default(""),
  idempotencyKey: nonEmptyStringSchema.optional(),
});
export type AcknowledgeClientDeliverableInput = z.infer<typeof acknowledgeClientDeliverableSchema>;

export const submitClientCloseoutResponseSchema = z.object({
  rating: z.number().int().min(1).max(5),
  feedback: z.string().trim().max(4000).default(""),
  testimonial: z.string().trim().max(2000).default(""),
  testimonialConsent: z.boolean().default(false),
}).superRefine((value, ctx) => {
  if (value.testimonialConsent && value.testimonial.length === 0) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["testimonial"],
      message: "A testimonial is required when publication consent is given",
    });
  }
});
export type SubmitClientCloseoutResponseInput = z.infer<typeof submitClientCloseoutResponseSchema>;

export const clientTestimonialModerationSchema = z.object({
  action: z.enum(["approve", "reject"]),
  reason: z.string().trim().max(2000).default(""),
}).superRefine((value, ctx) => {
  if (value.action === "reject" && value.reason.length === 0) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["reason"], message: "A rejection reason is required" });
  }
});
export type ClientTestimonialModerationInput = z.infer<typeof clientTestimonialModerationSchema>;
