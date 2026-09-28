import { describe, expect, it } from "vitest";
import {
  aiAuditEvidenceSchema,
  aiGatewayRequestSchema,
  aiGatewayStreamEventSchema,
  aiRouteProfileSchema,
  commsDraftRequestSchema,
  pareBudgetAnalysisSchema,
  pareRiskSchema,
} from "./ai-governance.js";

const pareInput = {
  triggerId: "trigger-1",
  eventId: "event-1",
  eventName: "Synthetic event",
  eventDate: "2026-10-01",
  daysUntilEvent: 7,
  clientName: "Sample Client",
  totalBudget: 100_000,
  spentBudget: 20_000,
  remainingBudget: 80_000,
  withdrawnSupplier: {
    id: "supplier-withdrawn",
    name: "Sample Supplier",
    category: "catering",
    tier: "standard",
    quotedAmount: 25_000,
  },
  clientPreferences: ["vegetarian menu"],
};

const mockRoute = {
  provider: "mock",
  model: "deterministic-v1",
  endpointPolicyId: "deterministic-mock",
  adapterRevision: "deterministic-v1",
  zdrBasis: "none",
  allowedDataClasses: ["synthetic", "public", "internal", "personal", "sensitive"],
};

const anthropicRoute = {
  provider: "anthropic",
  model: "claude-sonnet-4-6",
  endpointPolicyId: "anthropic-direct",
  adapterRevision: "anthropic-conformance-v1",
  zdrBasis: "none",
  allowedDataClasses: ["synthetic"],
};

describe("AI governance contracts", () => {
  it("accepts the default mock profile and synthetic-only Anthropic profile", () => {
    expect(
      aiRouteProfileSchema.safeParse({
        id: "mock",
        routesByTier: { fast: mockRoute, strong: mockRoute },
      }).success,
    ).toBe(true);
    expect(
      aiRouteProfileSchema.safeParse({
        id: "test-anthropic",
        routesByTier: { fast: anthropicRoute, strong: anthropicRoute },
      }).success,
    ).toBe(true);
  });

  it("accepts route overrides and audits provider-neutral policy evidence", () => {
    const alternateProviderProfile = {
      id: "test-openrouter",
      routesByTier: { fast: { ...mockRoute, provider: "openrouter", model: "glm-test", endpointPolicyId: "fake-openrouter", adapterRevision: "fake-openrouter-v1", zdrBasis: "none", allowedDataClasses: ["synthetic"] }, strong: { ...mockRoute, provider: "openrouter", model: "glm-test", endpointPolicyId: "fake-openrouter", adapterRevision: "fake-openrouter-v1", zdrBasis: "none", allowedDataClasses: ["synthetic"] } },
      routesByUseCase: { "pare.risk": { ...mockRoute, provider: "openrouter", model: "glm-risk-test", endpointPolicyId: "fake-openrouter", adapterRevision: "fake-openrouter-v1", zdrBasis: "none", allowedDataClasses: ["synthetic"] } },
    };
    const evidence = {
      requestId: "request-1",
      useCaseId: "pare.risk",
      promptVersion: "pare-risk-v1",
      profileId: "test-openrouter",
      provider: "openrouter",
      requestedModel: "glm-risk-test",
      endpointTag: "fake-openrouter",
      routeRevision: "a".repeat(64),
      routePolicyOutcome: "synthetic_verified",
      zdrBasis: "none",
      dataClasses: ["synthetic"],
      latencyMs: 12,
      outcome: "completed",
      approvalState: "pending",
      syntheticProvenance: {
        source: "test-fixture",
        sourceId: "pare-fixture-event-1",
        verifiedAt: "2026-09-24T00:00:00.000Z",
        verifier: "test-fixture-registry",
      },
    };

    expect(aiRouteProfileSchema.safeParse(alternateProviderProfile).success).toBe(true);
    expect(aiAuditEvidenceSchema.safeParse(evidence).success).toBe(true);
  });

  it("rejects any non-ZDR external route that allows non-synthetic data", () => {
    expect(
      aiRouteProfileSchema.safeParse({
        id: "test-external",
        routesByTier: {
          fast: { ...anthropicRoute, provider: "openrouter", allowedDataClasses: ["synthetic", "personal"] },
          strong: anthropicRoute,
        },
      }).success,
    ).toBe(false);
    expect(
      aiRouteProfileSchema.safeParse({
        id: "approved-zdr-route",
        routesByTier: {
          fast: { ...anthropicRoute, provider: "openrouter", zdrBasis: "provider-enforced", allowedDataClasses: ["synthetic", "personal"] },
          strong: anthropicRoute,
        },
      }).success,
    ).toBe(true);
  });

  it("binds each POST use-case ID to its own input schema", () => {
    expect(
      aiGatewayRequestSchema.safeParse({
        useCaseId: "pare.budget",
        input: pareInput,
        correlationId: "request-1",
      }).success,
    ).toBe(true);
    expect(
      aiGatewayRequestSchema.safeParse({
        useCaseId: "comms.draft",
        input: pareInput,
      }).success,
    ).toBe(false);
    expect(
      aiGatewayRequestSchema.safeParse({
        useCaseId: "comms.draft",
        input: { inquiryId: "inquiry-1", message: "raw user text" },
      }).success,
    ).toBe(false);
  });

  it("validates PARE model output and rejects invalid numeric values", () => {
    const candidate = {
      supplierId: "supplier-1",
      supplierName: "Sample Supplier",
      tier: "standard",
      quotedAmount: 25_000,
      reliabilityScore: 0.9,
      halal: true,
      priorPmcmEvents: 3,
      reason: "Fits the synthetic event requirements",
    };

    expect(
      pareBudgetAnalysisSchema.safeParse({
        feasible: true,
        selectedCandidate: candidate,
        costDelta: -1_000,
        costDeltaLabel: "₱1,000 under budget",
        summary: "The replacement fits the remaining budget.",
      }).success,
    ).toBe(true);
    expect(
      pareRiskSchema.safeParse({
        level: "HIGH",
        factors: ["Short lead time"],
        recommendation: "PMCM should review before approval.",
        rawPrompt: "must not be accepted",
      }).success,
    ).toBe(false);
    expect(
      pareBudgetAnalysisSchema.safeParse({
        feasible: true,
        selectedCandidate: {
          supplierId: "supplier-1",
          supplierName: "Sample Supplier",
          tier: "standard",
          quotedAmount: 25_000,
          reliabilityScore: 0.9,
          halal: true,
          priorPmcmEvents: 3,
          reason: "Fits the synthetic event requirements",
        },
        costDelta: Number.NaN,
        costDeltaLabel: "invalid",
        summary: "invalid numeric data",
      }).success,
    ).toBe(false);
  });

  it("keeps audit evidence metadata-only and validates stream event shapes", () => {
    const evidence = {
      requestId: "request-1",
      useCaseId: "comms.draft",
      promptVersion: "comms-draft-v1",
      profileId: "test-anthropic",
      provider: "anthropic",
      requestedModel: "claude-sonnet-4-6",
      zdrBasis: "none",
      routeRevision: "a".repeat(64),
      routePolicyOutcome: "synthetic_verified",
      dataClasses: ["synthetic"],
      latencyMs: 124,
      outcome: "completed",
      approvalState: "pending",
      syntheticProvenance: {
        source: "seeded-sample",
        sourceId: "sample-inquiry-1",
        verifiedAt: "2026-09-24T00:00:00.000Z",
        verifier: "sample-seed-registry",
      },
    };

    expect(aiAuditEvidenceSchema.safeParse(evidence).success).toBe(true);
    expect(
      aiAuditEvidenceSchema.safeParse({
        ...evidence,
        dataClasses: ['internal', 'personal'],
        syntheticProvenance: undefined,
        routePolicyOutcome: 'denied',
        outcome: 'blocked',
      }).success,
    ).toBe(true);
    expect(aiAuditEvidenceSchema.safeParse({ ...evidence, payload: pareInput }).success).toBe(false);
    expect(aiAuditEvidenceSchema.safeParse({ ...evidence, syntheticProvenance: undefined }).success).toBe(false);
    expect(aiAuditEvidenceSchema.safeParse({ ...evidence, provider: "openrouter" }).success).toBe(true);
    expect(
      aiGatewayStreamEventSchema.safeParse({
        type: "delta",
        requestId: "request-1",
        sequence: 0,
        text: "Draft",
      }).success,
    ).toBe(true);
    expect(
      aiGatewayStreamEventSchema.safeParse({
        type: "delta",
        requestId: "request-1",
        sequence: 0,
        text: "",
      }).success,
    ).toBe(false);
  });

  it("accepts only inquiry identity for a communication draft request", () => {
    expect(commsDraftRequestSchema.safeParse({ inquiryId: "inquiry-1" }).success).toBe(true);
    expect(
      commsDraftRequestSchema.safeParse({ inquiryId: "inquiry-1", clientEmail: "person@example.com" }).success,
    ).toBe(false);
  });
});
