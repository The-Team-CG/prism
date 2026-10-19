import { z } from "zod";
import { nonEmptyStringSchema, optionalTrimmedStringSchema } from "./common.js";

export const scopeChangeCategorySchema = z.enum(["program", "venue", "guest_count", "styling", "supplier", "schedule", "other"]);
export type ScopeChangeCategory = z.infer<typeof scopeChangeCategorySchema>;

/** Client (primary, verified) or PMCM on the client's behalf. The actor decides the requester role server-side. */
export const submitScopeChangeRequestSchema = z.object({
  title: nonEmptyStringSchema,
  description: nonEmptyStringSchema,
  category: scopeChangeCategorySchema,
});
export type SubmitScopeChangeRequestInput = z.infer<typeof submitScopeChangeRequestSchema>;

export const scopeChangeImpactSchema = z.object({
  billing: z.boolean(),
  supplier: z.boolean(),
  coordinator: z.boolean(),
  floorplan: z.boolean(),
});
export type ScopeChangeImpactInput = z.infer<typeof scopeChangeImpactSchema>;

/**
 * PMCM review. Approval is the only path that needs the impact review and, on a frozen event, an approved
 * freeze exception. Rejection always carries a PMCM-only reason; the optional client response is the only
 * decision text a client sees.
 */
export const reviewScopeChangeRequestSchema = z.discriminatedUnion("decision", [
  z.object({ decision: z.literal("start_review") }),
  z.object({
    decision: z.literal("approve"),
    impacts: scopeChangeImpactSchema,
    impactReviewAcknowledged: z.literal(true, { message: "Confirm the billing, supplier, coordinator, and floorplan impact review before approving this scope change" }),
    freezeExceptionId: optionalTrimmedStringSchema,
    addendumId: optionalTrimmedStringSchema,
    clientResponse: optionalTrimmedStringSchema,
  }),
  z.object({
    decision: z.literal("reject"),
    decisionReason: nonEmptyStringSchema,
    clientResponse: optionalTrimmedStringSchema,
  }),
]);
export type ReviewScopeChangeRequestInput = z.infer<typeof reviewScopeChangeRequestSchema>;

export const riskLevelSchema = z.enum(["low", "medium", "high", "critical"]);
export type RiskLevel = z.infer<typeof riskLevelSchema>;

/**
 * PMCM records the authoritative event risk level. `expectedRevision` is the revision the PMCM user last read
 * (0 when no assessment exists yet), so two concurrent assessments cannot silently overwrite each other.
 * `reason` is required by the service when the level is lowered.
 */
export const recordEventRiskAssessmentSchema = z.object({
  level: riskLevelSchema,
  summary: nonEmptyStringSchema,
  mitigations: optionalTrimmedStringSchema,
  expectedRevision: z.number().int().min(0),
  reason: optionalTrimmedStringSchema,
});
export type RecordEventRiskAssessmentInput = z.infer<typeof recordEventRiskAssessmentSchema>;
