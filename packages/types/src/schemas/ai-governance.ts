import { z } from "zod";
import { nonEmptyStringSchema } from "./common.js";

export const aiUseCaseIdSchema = z.enum([
  "pare.budget",
  "pare.risk",
  "pare.message-drafts",
  "comms.draft",
  "inquiry.triage",
  "proposal.draft",
]);
export type AiUseCaseId = z.infer<typeof aiUseCaseIdSchema>;

export const aiProviderIdSchema = z.enum(["anthropic", "openrouter"]);
export type AiProviderId = z.infer<typeof aiProviderIdSchema>;

export const aiRouteProfileIdSchema = nonEmptyStringSchema;
export type AiRouteProfileId = z.infer<typeof aiRouteProfileIdSchema>;

export const aiModelTierSchema = z.enum(["fast", "strong"]);
export type AiModelTier = z.infer<typeof aiModelTierSchema>;

/**
 * provider-enforced: zero data retention is enforced for this route.
 * test-data-only: no ZDR; the operator accepts that only UAT/test data is sent. Refused in production.
 * none: no ZDR and no real data; only verified synthetic fixtures may be sent.
 */
export const aiZdrBasisSchema = z.enum(["provider-enforced", "test-data-only", "none"]);
export type AiZdrBasis = z.infer<typeof aiZdrBasisSchema>;

export const aiRoutePolicyOutcomeSchema = z.enum([
  "synthetic_verified",
  "zdr_approved",
  "test_data_approved",
  "denied",
]);
export type AiRoutePolicyOutcome = z.infer<typeof aiRoutePolicyOutcomeSchema>;

export const aiDataClassSchema = z.enum([
  "synthetic",
  "public",
  "internal",
  "personal",
  "sensitive",
]);
export type AiDataClass = z.infer<typeof aiDataClassSchema>;

export const aiDeliveryModeSchema = z.enum(["run", "stream"]);
export type AiDeliveryMode = z.infer<typeof aiDeliveryModeSchema>;

export const aiApprovalPolicySchema = z.literal("pmcm-required");
export type AiApprovalPolicy = z.infer<typeof aiApprovalPolicySchema>;

export const aiUseCaseLimitsSchema = z
  .object({
    maxSteps: z.number().int().positive(),
    maxOutputTokens: z.number().int().positive(),
    timeoutMs: z.number().int().positive(),
    dailyTokenBudget: z.number().int().positive(),
  })
  .strict();
export type AiUseCaseLimits = z.infer<typeof aiUseCaseLimitsSchema>;

export const aiRouteSchema = z
  .object({
    provider: aiProviderIdSchema,
    model: nonEmptyStringSchema,
    endpointPolicyId: nonEmptyStringSchema,
    adapterRevision: nonEmptyStringSchema,
    zdrBasis: aiZdrBasisSchema,
    allowedDataClasses: z.array(aiDataClassSchema).min(1).max(5),
  })
  .strict();
export type AiRoute = z.infer<typeof aiRouteSchema>;

export const aiRouteProfileSchema = z
  .object({
    id: aiRouteProfileIdSchema,
    routesByTier: z.record(aiModelTierSchema, aiRouteSchema),
    routesByUseCase: z.partialRecord(aiUseCaseIdSchema, aiRouteSchema).optional(),
  })
  .strict()
  .superRefine((profile, ctx) => {
    const routes = [
      ...Object.entries(profile.routesByTier).map(([key, route]) => ({ key, route, field: "routesByTier" })),
      ...Object.entries(profile.routesByUseCase ?? {}).map(([key, route]) => ({ key, route, field: "routesByUseCase" })),
    ];
    for (const { key, route, field } of routes) {
      if (route.zdrBasis === "none" &&
        (route.allowedDataClasses.length !== 1 || route.allowedDataClasses[0] !== "synthetic")) {
        ctx.addIssue({
          code: "custom",
          path: [field, key, "allowedDataClasses"],
          message: "An external non-ZDR route can only accept synthetic data",
        });
      }
    }
  });
export type AiRouteProfile = z.infer<typeof aiRouteProfileSchema>;

export const aiUseCaseDefinitionSchema = z
  .object({
    id: aiUseCaseIdSchema,
    promptVersion: nonEmptyStringSchema,
    modelTier: aiModelTierSchema,
    dataClasses: z.array(aiDataClassSchema).min(1).max(5),
    requiresZdr: z.boolean(),
    approval: aiApprovalPolicySchema,
    limits: aiUseCaseLimitsSchema,
    delivery: aiDeliveryModeSchema,
  })
  .strict();
export type AiUseCaseDefinitionData = z.infer<typeof aiUseCaseDefinitionSchema>;

export const aiSyntheticProvenanceSchema = z
  .object({
    source: z.enum(["seeded-sample", "test-fixture"]),
    sourceId: nonEmptyStringSchema,
    verifiedAt: nonEmptyStringSchema,
    verifier: z.enum(["sample-seed-registry", "test-fixture-registry"]),
  })
  .strict();
export type AiSyntheticProvenance = z.infer<typeof aiSyntheticProvenanceSchema>;

export const pareCandidateSchema = z
  .object({
    supplierId: nonEmptyStringSchema,
    supplierName: nonEmptyStringSchema,
    tier: nonEmptyStringSchema,
    quotedAmount: z.number().nonnegative(),
    reliabilityScore: z.number().min(0).max(1),
    halal: z.boolean(),
    priorPmcmEvents: z.number().int().nonnegative(),
    reason: nonEmptyStringSchema,
  })
  .strict();
export type AiPareCandidate = z.infer<typeof pareCandidateSchema>;

export const pareRiskLevelSchema = z.enum(["LOW", "MEDIUM", "HIGH"]);
export type AiPareRiskLevel = z.infer<typeof pareRiskLevelSchema>;

export const pareBudgetAnalysisSchema = z
  .object({
    feasible: z.boolean(),
    selectedCandidate: pareCandidateSchema,
    costDelta: z.number(),
    costDeltaLabel: nonEmptyStringSchema,
    summary: nonEmptyStringSchema,
  })
  .strict();
export type AiPareBudgetAnalysis = z.infer<typeof pareBudgetAnalysisSchema>;

export const pareRiskSchema = z
  .object({
    level: pareRiskLevelSchema,
    factors: z.array(nonEmptyStringSchema),
    recommendation: nonEmptyStringSchema,
  })
  .strict();
export type AiPareRisk = z.infer<typeof pareRiskSchema>;

export const pareDraftsSchema = z
  .object({
    supplierNotification: nonEmptyStringSchema,
    clientReassurance: nonEmptyStringSchema,
  })
  .strict();
export type AiPareDrafts = z.infer<typeof pareDraftsSchema>;

export const pareContextSchema = z
  .object({
    triggerId: nonEmptyStringSchema,
    eventId: nonEmptyStringSchema,
    eventName: nonEmptyStringSchema,
    eventDate: nonEmptyStringSchema,
    daysUntilEvent: z.number().int(),
    clientName: nonEmptyStringSchema,
    totalBudget: z.number().nonnegative(),
    spentBudget: z.number().nonnegative(),
    remainingBudget: z.number(),
    withdrawnSupplier: z
      .object({
        id: nonEmptyStringSchema,
        name: nonEmptyStringSchema,
        category: nonEmptyStringSchema,
        tier: nonEmptyStringSchema,
        quotedAmount: z.number().nonnegative(),
      })
      .strict(),
    clientPreferences: z.array(nonEmptyStringSchema),
    candidates: z.array(pareCandidateSchema).optional(),
    budgetAnalysis: pareBudgetAnalysisSchema.optional(),
    riskAssessment: pareRiskSchema.optional(),
    drafts: pareDraftsSchema.optional(),
  })
  .strict();
export type AiPareContext = z.infer<typeof pareContextSchema>;

export const commsDraftRequestSchema = z
  .object({
    inquiryId: nonEmptyStringSchema,
  })
  .strict();
export type CommsDraftRequest = z.infer<typeof commsDraftRequestSchema>;

export const commsDraftResultSchema = z
  .object({
    subject: nonEmptyStringSchema,
    body: nonEmptyStringSchema,
  })
  .strict();
export type CommsDraftResult = z.infer<typeof commsDraftResultSchema>;

export const inquiryTriageRequestSchema = z
  .object({
    inquiryId: nonEmptyStringSchema,
  })
  .strict();
export type InquiryTriageRequest = z.infer<typeof inquiryTriageRequestSchema>;

/** The minimized, server-built view of an inquiry that the triage model sees. No name, email, phone or company. */
export const inquiryTriageInputSchema = z
  .object({
    inquiryId: nonEmptyStringSchema,
    eventType: z.string().trim(),
    clientType: z.string().trim(),
    eventDate: nonEmptyStringSchema,
    daysUntilEvent: z.number().int(),
    hasOrganization: z.boolean(),
    source: z.string().trim(),
    referralDetails: z.string().trim(),
    message: z.string().trim(),
    duplicateInquiryCount: z.number().int().nonnegative(),
    previouslyDeclined: z.boolean(),
  })
  .strict();
export type InquiryTriageInput = z.infer<typeof inquiryTriageInputSchema>;

export const inquiryTriageFitSchema = z.enum(["high", "medium", "low"]);
export type InquiryTriageFit = z.infer<typeof inquiryTriageFitSchema>;

export const inquiryTriageActionSchema = z.enum(["accept", "pend", "decline", "request_more_info"]);
export type InquiryTriageAction = z.infer<typeof inquiryTriageActionSchema>;

export const inquiryTriageResultSchema = z
  .object({
    fit: inquiryTriageFitSchema,
    summary: nonEmptyStringSchema.max(600),
    signals: z.array(nonEmptyStringSchema.max(200)).max(6),
    risks: z.array(nonEmptyStringSchema.max(200)).max(6),
    suggestedAction: inquiryTriageActionSchema,
    suggestedQuestions: z.array(nonEmptyStringSchema.max(200)).max(5),
  })
  .strict();
export type InquiryTriageResult = z.infer<typeof inquiryTriageResultSchema>;

export const inquiryTriageReviewSchema = z
  .object({
    reviewId: nonEmptyStringSchema,
    inquiryId: nonEmptyStringSchema,
    result: inquiryTriageResultSchema,
    requestedAt: nonEmptyStringSchema,
    requestedBy: nonEmptyStringSchema,
    requestId: nonEmptyStringSchema,
    modelVersion: nonEmptyStringSchema,
  })
  .strict();
export type InquiryTriageReview = z.infer<typeof inquiryTriageReviewSchema>;

const proposalDraftLineSchema = z
  .object({
    category: nonEmptyStringSchema,
    description: nonEmptyStringSchema,
    quantity: z.number().positive(),
    unitAmount: z.number().int().nonnegative(),
  })
  .strict();

/** What PMCM sends: the estimate being built for an event. Server adds the event context. */
export const proposalDraftRequestSchema = z
  .object({
    eventId: nonEmptyStringSchema,
    budgetAmount: z.number().int().positive(),
    notes: z.string().trim().default(""),
    lines: z.array(proposalDraftLineSchema).min(1).max(60),
  })
  .strict();
export type ProposalDraftRequest = z.infer<typeof proposalDraftRequestSchema>;

/** The minimized, server-built view of an event estimate that the drafting model sees. No client identity. */
export const proposalDraftInputSchema = z
  .object({
    eventId: nonEmptyStringSchema,
    eventName: z.string().trim(),
    eventType: z.string().trim(),
    eventDate: nonEmptyStringSchema,
    daysUntilEvent: z.number().int(),
    budgetAmount: z.number().int().nonnegative(),
    totalAmount: z.number().int().nonnegative(),
    budgetAlignment: z.enum(["within_budget", "over_budget"]),
    estimateNotes: z.string().trim(),
    lines: z
      .array(
        z
          .object({
            category: nonEmptyStringSchema,
            description: z.string().trim(),
            quantity: z.number().positive(),
            totalAmount: z.number().int().nonnegative(),
          })
          .strict(),
      )
      .min(1)
      .max(60),
  })
  .strict();
export type ProposalDraftInput = z.infer<typeof proposalDraftInputSchema>;

export const proposalDraftResultSchema = z
  .object({
    title: nonEmptyStringSchema.max(120),
    summary: nonEmptyStringSchema.max(1_500),
    revisionNote: z.string().trim().max(400),
    highlights: z.array(nonEmptyStringSchema.max(200)).max(8),
  })
  .strict();
export type ProposalDraftResult = z.infer<typeof proposalDraftResultSchema>;

export const proposalDraftResponseSchema = z
  .object({
    draft: proposalDraftResultSchema,
    requestId: nonEmptyStringSchema,
    modelVersion: nonEmptyStringSchema,
  })
  .strict();
export type ProposalDraftResponse = z.infer<typeof proposalDraftResponseSchema>;

export const conformeDraftReviewSchema = z.object({
  draftId: nonEmptyStringSchema,
  inquiryId: nonEmptyStringSchema,
  draft: commsDraftResultSchema,
  status: nonEmptyStringSchema,
  source: z.enum(["ai", "manual"]),
  requestedAt: nonEmptyStringSchema,
  reviewedBy: z.string().nullable(),
  reviewedAt: z.string().nullable(),
  lastConformeReminderAt: z.string().nullable(),
  reminderWindowBaseAt: nonEmptyStringSchema,
  requestId: nonEmptyStringSchema,
  modelVersion: nonEmptyStringSchema,
}).strict();
export type ConformeDraftReviewRecord = z.infer<typeof conformeDraftReviewSchema>;

export type AiUseCaseContractMap = {
  "pare.budget": { input: AiPareContext; output: AiPareBudgetAnalysis };
  "pare.risk": { input: AiPareContext; output: AiPareRisk };
  "pare.message-drafts": { input: AiPareContext; output: AiPareDrafts };
  "comms.draft": { input: CommsDraftRequest; output: CommsDraftResult };
  "inquiry.triage": { input: InquiryTriageInput; output: InquiryTriageResult };
  "proposal.draft": { input: ProposalDraftInput; output: ProposalDraftResult };
};

export type AiUseCaseInput<K extends AiUseCaseId> = AiUseCaseContractMap[K]["input"];
export type AiUseCaseOutput<K extends AiUseCaseId> = AiUseCaseContractMap[K]["output"];

export const aiTokenUsageSchema = z
  .object({
    inputTokens: z.number().int().nonnegative().optional(),
    outputTokens: z.number().int().nonnegative().optional(),
  })
  .strict();
export type AiTokenUsage = z.infer<typeof aiTokenUsageSchema>;

export const aiRunOutcomeSchema = z.enum([
  "completed",
  "blocked",
  "unavailable",
  "incomplete",
  "aborted",
  "failed",
]);
export type AiRunOutcome = z.infer<typeof aiRunOutcomeSchema>;

export const aiFailureCodeSchema = z.enum([
  "invalid_input",
  "use_case_disabled",
  "configuration_invalid",
  "synthetic_provenance_required",
  "zdr_required",
  "provider_unavailable",
  "provider_rejected",
  "invalid_tool_call",
  "invalid_output",
  "step_limit",
  "timeout",
  "aborted",
  "internal",
]);
export type AiFailureCode = z.infer<typeof aiFailureCodeSchema>;

export const aiGatewayErrorSchema = z
  .object({
    code: aiFailureCodeSchema,
    message: nonEmptyStringSchema,
    retryable: z.boolean(),
  })
  .strict();
export type AiGatewayError = z.infer<typeof aiGatewayErrorSchema>;

export const aiApprovalStateSchema = z.enum([
  "not_applicable",
  "pending",
  "approved",
  "rejected",
]);
export type AiApprovalState = z.infer<typeof aiApprovalStateSchema>;

export const aiPareProvenanceChainStageSchema = z.enum([
  "pare.budget",
  "pare.risk",
  "pare.message-drafts",
]);
export type AiPareProvenanceChainStage = z.infer<typeof aiPareProvenanceChainStageSchema>;

const aiDigestSchema = z.string().regex(/^[a-f0-9]{64}$/);
export const aiPareProvenanceChainEvidenceSchema = z
  .object({
    chainId: nonEmptyStringSchema,
    rootFixtureId: nonEmptyStringSchema,
    rootDigest: aiDigestSchema,
    stage: aiPareProvenanceChainStageSchema,
    stageIndex: z.number().int().min(0).max(2),
    auditId: nonEmptyStringSchema,
    inputDigest: aiDigestSchema,
    outputDigest: aiDigestSchema,
    toolResultDigests: z.array(aiDigestSchema).min(1).max(64),
    priorAuditIds: z.array(nonEmptyStringSchema).max(2),
    priorOutputDigests: z.array(aiDigestSchema).max(2),
  })
  .strict()
  .superRefine((evidence, ctx) => {
    const linearIndex = aiPareProvenanceChainStageSchema.options.indexOf(evidence.stage);
    const isLinearStage = evidence.stageIndex === linearIndex;
    const isIndependentRiskRoot = evidence.stage === "pare.risk" && evidence.stageIndex === 0;
    const expectedParentCount = evidence.stageIndex;
    if (!isLinearStage && !isIndependentRiskRoot) {
      ctx.addIssue({
        code: "custom",
        path: ["stageIndex"],
        message: "PARE provenance stage index does not match a supported chain version",
      });
    }
    if (evidence.priorAuditIds.length !== expectedParentCount ||
      evidence.priorOutputDigests.length !== expectedParentCount) {
      ctx.addIssue({
        code: "custom",
        path: ["priorAuditIds"],
        message: "PARE provenance must name every direct completed dependency",
      });
    }
  });
export type AiPareProvenanceChainEvidence = z.infer<typeof aiPareProvenanceChainEvidenceSchema>;

const aiAuditEvidenceBaseSchema = z
  .object({
    requestId: nonEmptyStringSchema,
    correlationId: nonEmptyStringSchema.optional(),
    useCaseId: aiUseCaseIdSchema,
    promptVersion: nonEmptyStringSchema,
    profileId: aiRouteProfileIdSchema,
    provider: aiProviderIdSchema,
    requestedModel: nonEmptyStringSchema,
    routeRevision: z.string().regex(/^[a-f0-9]{64}$/),
    routePolicyOutcome: aiRoutePolicyOutcomeSchema,
    responseModel: nonEmptyStringSchema.optional(),
    endpointTag: nonEmptyStringSchema.optional(),
    zdrBasis: aiZdrBasisSchema,
    dataClasses: z.array(aiDataClassSchema).min(1).max(5),
    usage: aiTokenUsageSchema.optional(),
    latencyMs: z.number().int().nonnegative(),
    outcome: aiRunOutcomeSchema,
    approvalState: aiApprovalStateSchema,
    syntheticProvenance: aiSyntheticProvenanceSchema.optional(),
    pareChain: aiPareProvenanceChainEvidenceSchema.optional(),
  })
  .strict();

export const aiAuditEvidenceSchema = aiAuditEvidenceBaseSchema.superRefine((evidence, ctx) => {
  if (evidence.routePolicyOutcome === "synthetic_verified" &&
    (!evidence.syntheticProvenance || evidence.dataClasses.length !== 1 || evidence.dataClasses[0] !== "synthetic")) {
    ctx.addIssue({
      code: "custom",
      path: ["routePolicyOutcome"],
      message: "Synthetic-verified route evidence requires verified synthetic provenance",
    });
  }
  if (evidence.routePolicyOutcome === "zdr_approved" && evidence.zdrBasis !== "provider-enforced") {
    ctx.addIssue({
      code: "custom",
      path: ["routePolicyOutcome"],
      message: "ZDR-approved route evidence must record a provider-enforced ZDR basis",
    });
  }
  if (evidence.routePolicyOutcome === "test_data_approved" && evidence.zdrBasis !== "test-data-only") {
    ctx.addIssue({
      code: "custom",
      path: ["routePolicyOutcome"],
      message: "Test-data route evidence must record a test-data-only basis",
    });
  }
  if (evidence.outcome === "completed" && evidence.routePolicyOutcome === "denied") {
    ctx.addIssue({
      code: "custom",
      path: ["routePolicyOutcome"],
      message: "A denied route policy cannot produce a completed result",
    });
  }
});
export type AiAuditEvidence = z.infer<typeof aiAuditEvidenceSchema>;

export const aiGatewayRunSuccessSchema = z
  .object({
    outcome: z.literal("completed"),
    output: z.unknown(),
    evidence: aiAuditEvidenceSchema,
  })
  .strict();
export type AiGatewayRunSuccess<TOutput> = Omit<
  z.infer<typeof aiGatewayRunSuccessSchema>,
  "output"
> & { output: TOutput };

export const aiGatewayRunFailureSchema = z
  .object({
    outcome: z.enum(["blocked", "unavailable", "incomplete", "aborted", "failed"]),
    error: aiGatewayErrorSchema,
    evidence: aiAuditEvidenceSchema,
  })
  .strict();
export type AiGatewayRunFailure = z.infer<typeof aiGatewayRunFailureSchema>;

export const aiGatewayRunResultSchema = z.union([
  aiGatewayRunSuccessSchema,
  aiGatewayRunFailureSchema,
]);
export type AiGatewayRunResult<TOutput> =
  | AiGatewayRunSuccess<TOutput>
  | AiGatewayRunFailure;

export const aiGatewayRequestSchema = z.discriminatedUnion("useCaseId", [
  z
    .object({
      useCaseId: z.literal("pare.budget"),
      input: pareContextSchema,
      correlationId: nonEmptyStringSchema.optional(),
    })
    .strict(),
  z
    .object({
      useCaseId: z.literal("pare.risk"),
      input: pareContextSchema,
      correlationId: nonEmptyStringSchema.optional(),
    })
    .strict(),
  z
    .object({
      useCaseId: z.literal("pare.message-drafts"),
      input: pareContextSchema,
      correlationId: nonEmptyStringSchema.optional(),
    })
    .strict(),
  z
    .object({
      useCaseId: z.literal("comms.draft"),
      input: commsDraftRequestSchema,
      correlationId: nonEmptyStringSchema.optional(),
    })
    .strict(),
  z
    .object({
      useCaseId: z.literal("inquiry.triage"),
      input: inquiryTriageInputSchema,
      correlationId: nonEmptyStringSchema.optional(),
    })
    .strict(),
  z
    .object({
      useCaseId: z.literal("proposal.draft"),
      input: proposalDraftInputSchema,
      correlationId: nonEmptyStringSchema.optional(),
    })
    .strict(),
]);
export type AiGatewayRequest = z.infer<typeof aiGatewayRequestSchema>;

export const aiGatewayStreamEventSchema = z.discriminatedUnion("type", [
  z
    .object({
      type: z.literal("meta"),
      requestId: nonEmptyStringSchema,
      useCaseId: aiUseCaseIdSchema,
    })
    .strict(),
  z
    .object({
      type: z.literal("delta"),
      requestId: nonEmptyStringSchema,
      sequence: z.number().int().nonnegative(),
      text: nonEmptyStringSchema,
    })
    .strict(),
  z
    .object({
      type: z.literal("complete"),
      requestId: nonEmptyStringSchema,
      result: aiGatewayRunSuccessSchema,
    })
    .strict(),
  z
    .object({
      type: z.literal("failure"),
      requestId: nonEmptyStringSchema,
      result: aiGatewayRunFailureSchema,
    })
    .strict(),
]);
export type AiGatewayStreamEvent<TOutput> =
  | { type: "meta"; requestId: string; useCaseId: AiUseCaseId }
  | { type: "delta"; requestId: string; sequence: number; text: string }
  | { type: "complete"; requestId: string; result: AiGatewayRunSuccess<TOutput> }
  | { type: "failure"; requestId: string; result: AiGatewayRunFailure };
