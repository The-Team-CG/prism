import { describe, expect, it } from "vitest";
import { recordEventRiskAssessmentSchema, reviewScopeChangeRequestSchema, submitScopeChangeRequestSchema } from "./scope-change-risk-inputs.js";

const impacts = { billing: false, supplier: false, coordinator: false, floorplan: false };

describe("scope change and risk write contracts", () => {
  it("requires a title, description, and known category before a scope change is submitted", () => {
    expect(submitScopeChangeRequestSchema.safeParse({ title: "Add a sunset slot", description: "Outside", category: "schedule" }).success).toBe(true);
    expect(submitScopeChangeRequestSchema.safeParse({ title: "  ", description: "Outside", category: "schedule" }).success).toBe(false);
    expect(submitScopeChangeRequestSchema.safeParse({ title: "Add a sunset slot", description: "Outside", category: "catering" }).success).toBe(false);
  });

  it("requires the impact review to be confirmed before a scope change is approved", () => {
    const approval = { decision: "approve", impacts };
    expect(reviewScopeChangeRequestSchema.safeParse(approval).success).toBe(false);
    expect(reviewScopeChangeRequestSchema.safeParse({ ...approval, impactReviewAcknowledged: false }).success).toBe(false);
    expect(reviewScopeChangeRequestSchema.safeParse({ ...approval, impactReviewAcknowledged: true }).success).toBe(true);
  });

  it("requires a PMCM reason to reject, and needs no reason to start a review", () => {
    expect(reviewScopeChangeRequestSchema.safeParse({ decision: "reject" }).success).toBe(false);
    expect(reviewScopeChangeRequestSchema.safeParse({ decision: "reject", decisionReason: "  " }).success).toBe(false);
    expect(reviewScopeChangeRequestSchema.safeParse({ decision: "reject", decisionReason: "Out of scope" }).success).toBe(true);
    expect(reviewScopeChangeRequestSchema.safeParse({ decision: "start_review" }).success).toBe(true);
  });

  it("accepts only the four risk levels and a non-negative revision for a recorded assessment", () => {
    const assessment = { level: "high", summary: "Venue access is uncertain", expectedRevision: 0 };
    expect(recordEventRiskAssessmentSchema.safeParse(assessment).success).toBe(true);
    expect(recordEventRiskAssessmentSchema.safeParse({ ...assessment, level: "severe" }).success).toBe(false);
    expect(recordEventRiskAssessmentSchema.safeParse({ ...assessment, expectedRevision: -1 }).success).toBe(false);
    expect(recordEventRiskAssessmentSchema.safeParse({ level: "high", summary: "Venue access is uncertain" }).success).toBe(false);
  });
});
