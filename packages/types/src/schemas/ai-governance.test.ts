import { describe, expect, it } from "vitest";
import {
  aiAuditEvidenceSchema,
  aiPareProvenanceChainEvidenceSchema,
  aiGatewayRequestSchema,
  aiGatewayStreamEventSchema,
  aiRouteProfileSchema,
  commsDraftRequestSchema,
  inquiryTriageInputSchema,
  inquiryTriageResultSchema,
  proposalDraftRequestSchema,
  proposalDraftResultSchema,
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

const openRouterRoute = {
  provider: "openrouter",
  model: "glm-test",
  endpointPolicyId: "fake-openrouter",
  adapterRevision: "fake-openrouter-v1",
  zdrBasis: "none",
  allowedDataClasses: ["synthetic"],
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
  it("accepts the synthetic-only and ZDR Anthropic profiles and the OpenRouter ZDR profile", () => {
    const zdrRoute = {
      ...anthropicRoute,
      zdrBasis: "provider-enforced",
      allowedDataClasses: ["synthetic", "public", "internal", "personal"],
    };
    for (const route of [
      anthropicRoute,
      zdrRoute,
      { ...zdrRoute, provider: "openrouter", endpointPolicyId: "fireworks" },
    ]) {
      expect(
        aiRouteProfileSchema.safeParse({ id: "test-profile", routesByTier: { fast: route, strong: route } }).success,
      ).toBe(true);
    }
  });

  it("no longer recognizes a mock provider", () => {
    const mockRoute = { ...anthropicRoute, provider: "mock", allowedDataClasses: ["synthetic", "personal"] };

    expect(
      aiRouteProfileSchema.safeParse({ id: "mock", routesByTier: { fast: mockRoute, strong: mockRoute } }).success,
    ).toBe(false);
  });

  it("accepts route overrides and audits provider-neutral policy evidence", () => {
    const alternateProviderProfile = {
      id: "test-openrouter",
      routesByTier: { fast: openRouterRoute, strong: openRouterRoute },
      routesByUseCase: { "pare.risk": { ...openRouterRoute, model: "glm-risk-test" } },
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

  it("validates linear and dependency-based PARE provenance evidence using digests and audit IDs only", () => {
    const pareChain = {
      chainId: "chain-1",
      rootFixtureId: "ai-pare-chain-root-v1",
      rootDigest: "a".repeat(64),
      stage: "pare.risk",
      stageIndex: 1,
      auditId: "aia_risk-request",
      inputDigest: "b".repeat(64),
      outputDigest: "c".repeat(64),
      toolResultDigests: ["d".repeat(64)],
      priorAuditIds: ["aia_budget-request"],
      priorOutputDigests: ["e".repeat(64)],
    } as const;

    expect(aiPareProvenanceChainEvidenceSchema.safeParse(pareChain).success).toBe(true);
    expect(aiPareProvenanceChainEvidenceSchema.safeParse({
      ...pareChain,
      stageIndex: 0,
      priorAuditIds: [],
      priorOutputDigests: [],
    }).success).toBe(true);
    expect(aiPareProvenanceChainEvidenceSchema.safeParse({
      ...pareChain,
      stageIndex: 2,
    }).success).toBe(false);
    expect(aiPareProvenanceChainEvidenceSchema.safeParse({
      ...pareChain,
      generatedOutput: "Do not persist draft text in chain evidence",
    }).success).toBe(false);
    expect(aiPareProvenanceChainEvidenceSchema.safeParse({
      ...pareChain,
      toolResultDigests: [],
    }).success).toBe(false);
  });

  it("rejects any non-ZDR external route that allows non-synthetic data", () => {
    expect(
      aiRouteProfileSchema.safeParse({
        id: "test-anthropic-real-data",
        routesByTier: {
          fast: { ...anthropicRoute, allowedDataClasses: ["synthetic", "personal"] },
          strong: anthropicRoute,
        },
      }).success,
    ).toBe(false);
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

  it("keeps applicant identity out of the triage input and bounds the triage result", () => {
    const input = {
      inquiryId: "inq_1", eventType: "Gala", clientType: "corporate", eventDate: "2026-12-16", daysUntilEvent: 40,
      hasOrganization: true, source: "Referral", referralDetails: "", message: "Hello", duplicateInquiryCount: 0,
      previouslyDeclined: false,
    };
    expect(inquiryTriageInputSchema.safeParse(input).success).toBe(true);
    expect(inquiryTriageInputSchema.safeParse({ ...input, email: "person@example.com" }).success).toBe(false);
    expect(inquiryTriageInputSchema.safeParse({ ...input, clientName: "Jane" }).success).toBe(false);

    const result = {
      fit: "high", summary: "Clear request.", signals: [], risks: [], suggestedAction: "accept", suggestedQuestions: [],
    };
    expect(inquiryTriageResultSchema.safeParse(result).success).toBe(true);
    expect(inquiryTriageResultSchema.safeParse({ ...result, fit: "great" }).success).toBe(false);
    expect(inquiryTriageResultSchema.safeParse({ ...result, suggestedAction: "approve" }).success).toBe(false);
    expect(inquiryTriageResultSchema.safeParse({ ...result, signals: Array(7).fill("x") }).success).toBe(false);
  });

  it("requires at least one estimate line for a proposal draft and bounds the drafted wording", () => {
    const line = { category: "Venue", description: "Garden", quantity: 1, unitAmount: 1000 };
    const request = { eventId: "evt_1", budgetAmount: 5000, lines: [line] };
    expect(proposalDraftRequestSchema.safeParse(request).success).toBe(true);
    expect(proposalDraftRequestSchema.safeParse({ ...request, lines: [] }).success).toBe(false);
    expect(proposalDraftRequestSchema.safeParse({ ...request, clientName: "Jane" }).success).toBe(false);

    const draft = { title: "Package", summary: "Summary", revisionNote: "", highlights: [] };
    expect(proposalDraftResultSchema.safeParse(draft).success).toBe(true);
    expect(proposalDraftResultSchema.safeParse({ ...draft, title: "x".repeat(121) }).success).toBe(false);
  });

  it("lets a test-data-only route carry personal data but never a route with no ZDR basis", () => {
    const route = {
      provider: "anthropic", model: "claude-sonnet-5-5", endpointPolicyId: "anthropic-direct",
      adapterRevision: "anthropic-messages-test-data-v1", zdrBasis: "test-data-only", allowedDataClasses: ["internal", "personal"],
    };
    const profile = (r: object) => ({ id: "p", routesByTier: { fast: r, strong: r } });
    expect(aiRouteProfileSchema.safeParse(profile(route)).success).toBe(true);
    expect(aiRouteProfileSchema.safeParse(profile({ ...route, zdrBasis: "none" })).success).toBe(false);
    expect(aiRouteProfileSchema.safeParse(profile({ ...route, zdrBasis: "none", allowedDataClasses: ["synthetic"] })).success).toBe(true);
  });
});
