import { z } from "zod";
import { nonEmptyStringSchema } from "./common.js";

export const aiUseCaseIdSchema = z.enum([
  "pare.budget",
  "pare.risk",
  "pare.message-drafts",
  "comms.draft",
]);
export type AiUseCaseId = z.infer<typeof aiUseCaseIdSchema>;

export const aiProviderIdSchema = z.enum(["mock", "anthropic", "openrouter"]);
export type AiProviderId = z.infer<typeof aiProviderIdSchema>;

export const aiRouteProfileIdSchema = z.enum(["mock", "test-anthropic"]);
export type AiRouteProfileId = z.infer<typeof aiRouteProfileIdSchema>;

export const aiModelTierSchema = z.enum(["fast", "strong"]);
export type AiModelTier = z.infer<typeof aiModelTierSchema>;

export const aiZdrBasisSchema = z.enum(["provider-enforced", "none"]);
export type AiZdrBasis = z.infer<typeof aiZdrBasisSchema>;

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
    zdrBasis: aiZdrBasisSchema,
    allowedDataClasses: z.array(aiDataClassSchema).min(1).max(5),
  })
  .strict();
export type AiRoute = z.infer<typeof aiRouteSchema>;

export const aiRouteProfileSchema = z
  .object({
    id: aiRouteProfileIdSchema,
    routesByTier: z.record(aiModelTierSchema, aiRouteSchema),
  })
  .strict()
  .superRefine((profile, ctx) => {
    for (const tier of ["fast", "strong"] as const) {
      const route = profile.routesByTier[tier];
      if (profile.id === "mock" && route.provider !== "mock") {
        ctx.addIssue({
          code: "custom",
          path: ["routesByTier", tier, "provider"],
          message: "The mock profile must use the mock provider for every tier",
        });
      }
      if (profile.id === "test-anthropic") {
        if (route.provider !== "anthropic") {
          ctx.addIssue({
            code: "custom",
            path: ["routesByTier", tier, "provider"],
            message: "The test-anthropic profile must use Anthropic for every tier",
          });
        }
        if (route.zdrBasis !== "none") {
          ctx.addIssue({
            code: "custom",
            path: ["routesByTier", tier, "zdrBasis"],
            message: "The Anthropic test route has no verified ZDR",
          });
        }
        if (route.allowedDataClasses.length !== 1 || route.allowedDataClasses[0] !== "synthetic") {
          ctx.addIssue({
            code: "custom",
            path: ["routesByTier", tier, "allowedDataClasses"],
            message: "The Anthropic test route only accepts synthetic data",
          });
        }
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

export const aiAuditEvidenceSchema = z
  .object({
    requestId: nonEmptyStringSchema,
    correlationId: nonEmptyStringSchema.optional(),
    useCaseId: aiUseCaseIdSchema,
    promptVersion: nonEmptyStringSchema,
    profileId: aiRouteProfileIdSchema,
    provider: aiProviderIdSchema,
    requestedModel: nonEmptyStringSchema,
    responseModel: nonEmptyStringSchema.optional(),
    endpointTag: nonEmptyStringSchema.optional(),
    zdrBasis: aiZdrBasisSchema,
    dataClasses: z.array(aiDataClassSchema).min(1).max(5),
    usage: aiTokenUsageSchema.optional(),
    latencyMs: z.number().int().nonnegative(),
    outcome: aiRunOutcomeSchema,
    approvalState: aiApprovalStateSchema,
    syntheticProvenance: aiSyntheticProvenanceSchema.optional(),
  })
  .strict()
  .superRefine((evidence, ctx) => {
    if (evidence.profileId === "mock" && evidence.provider !== "mock") {
      ctx.addIssue({
        code: "custom",
        path: ["provider"],
        message: "Mock profile audit evidence must identify the mock provider",
      });
    }
    if (evidence.profileId === "test-anthropic") {
      if (evidence.provider !== "anthropic") {
        ctx.addIssue({
          code: "custom",
          path: ["provider"],
          message: "Anthropic test profile audit evidence must identify Anthropic",
        });
      }
      if (evidence.zdrBasis !== "none") {
        ctx.addIssue({
          code: "custom",
          path: ["zdrBasis"],
          message: "Anthropic test profile cannot claim ZDR",
        });
      }
      const blockedBeforeProvider = evidence.outcome === "blocked";
      if (
        !blockedBeforeProvider &&
        (evidence.dataClasses.length !== 1 || evidence.dataClasses[0] !== "synthetic")
      ) {
        ctx.addIssue({
          code: "custom",
          path: ["dataClasses"],
          message: "Anthropic test profile audit evidence must be synthetic-only",
        });
      }
      if (!blockedBeforeProvider && !evidence.syntheticProvenance) {
        ctx.addIssue({
          code: "custom",
          path: ["syntheticProvenance"],
          message: "Anthropic test profile audit evidence requires verified provenance",
        });
      }
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
