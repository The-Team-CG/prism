import { z } from "zod";
import { nonEmptyStringSchema } from "./common.js";

export const aiUseCaseIdSchema = z.enum([
  "pare.budget",
  "pare.risk",
  "pare.message-drafts",
  "comms.draft",
  "inquiry.triage",
  "proposal.draft",
  "client-message.draft",
  "compliance.advisory",
  "theme.suggestions",
  "event.intelligence",
  "event-day.copilot",
  "operations.assistant",
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

/** FR-AI-09 workflow trigger points beyond the unsigned conforme: each drafts a message PMCM reviews and sends. */
export const CLIENT_MESSAGE_TRIGGERS = ["proposal_unanswered", "balance_due", "floorplan_pending"] as const;
export const clientMessageTriggerSchema = z.enum(CLIENT_MESSAGE_TRIGGERS);
export type ClientMessageTrigger = z.infer<typeof clientMessageTriggerSchema>;

export const clientMessageDraftRequestSchema = z.object({ eventId: nonEmptyStringSchema, trigger: clientMessageTriggerSchema }).strict();
export type ClientMessageDraftRequest = z.infer<typeof clientMessageDraftRequestSchema>;

/** The minimized, server-built facts the model sees for one trigger. No client identity. */
export const clientMessageDraftInputSchema = z
  .object({
    trigger: clientMessageTriggerSchema,
    eventType: z.string().trim(),
    daysUntilEvent: z.number().int(),
    proposalVersion: z.number().int().positive().optional(),
    daysSinceProposalIssued: z.number().int().nonnegative().optional(),
    milestoneLabel: z.string().trim().optional(),
    amountDue: z.number().int().nonnegative().optional(),
    dueDate: z.string().trim().optional(),
    daysSinceFloorPlanSubmitted: z.number().int().nonnegative().optional(),
  })
  .strict();
export type ClientMessageDraftInput = z.infer<typeof clientMessageDraftInputSchema>;

export const sendClientMessageSchema = z
  .object({
    eventId: nonEmptyStringSchema,
    trigger: clientMessageTriggerSchema,
    subject: nonEmptyStringSchema.max(150),
    body: nonEmptyStringSchema.max(2_000),
    idempotencyKey: nonEmptyStringSchema,
  })
  .strict();
export type SendClientMessageInput = z.infer<typeof sendClientMessageSchema>;

/** Request body for the event-scoped AI advisories below; the server builds the model input from the event record. */
export const aiEventRequestSchema = z.object({ eventId: nonEmptyStringSchema }).strict();
export type AiEventRequest = z.infer<typeof aiEventRequestSchema>;

/* FR-10+ Compliance AI advisory: plain-language explanation and a prioritized action list over the rule results. */
export const complianceAdvisoryInputSchema = z
  .object({
    eventType: z.string().trim(),
    phase: z.string().trim(),
    daysUntilEvent: z.number().int(),
    openChecks: z
      .array(z.object({
        title: z.string().trim().max(200),
        severity: z.string().trim().max(40),
        evidence: z.array(z.string().trim().max(300)).max(3),
        remediation: z.string().trim().max(400),
      }).strict())
      .min(1)
      .max(30),
  })
  .strict();
export type ComplianceAdvisoryInput = z.infer<typeof complianceAdvisoryInputSchema>;
export const complianceAdvisoryResultSchema = z
  .object({
    explanation: nonEmptyStringSchema.max(1_500),
    actions: z.array(z.object({ priority: z.number().int().min(1).max(30), checkTitle: nonEmptyStringSchema.max(200), action: nonEmptyStringSchema.max(400) }).strict()).min(1).max(10),
  })
  .strict();
export type ComplianceAdvisoryResult = z.infer<typeof complianceAdvisoryResultSchema>;

/* FR-11 Theme and moodboard suggestions: concepts in words and colors, never generated images. */
export const themeSuggestionInputSchema = z
  .object({
    eventType: z.string().trim(),
    guestCount: z.number().int().nonnegative().optional(),
    venueType: z.string().trim().max(120).optional(),
    moodAndStyling: z.string().trim().max(1_000),
    budgetRange: z.string().trim().max(120).optional(),
    stylingBudget: z.number().int().nonnegative().optional(),
  })
  .strict();
export type ThemeSuggestionInput = z.infer<typeof themeSuggestionInputSchema>;
export const themeSuggestionResultSchema = z
  .object({
    concepts: z
      .array(z.object({
        name: nonEmptyStringSchema.max(80),
        palette: z.array(z.string().trim().regex(/^#[\da-f]{6}$/i)).min(3).max(5),
        moodboardDescription: nonEmptyStringSchema.max(600),
        referenceSearchTerms: z.array(nonEmptyStringSchema.max(60)).min(2).max(6),
      }).strict())
      .min(2)
      .max(3),
  })
  .strict();
export type ThemeSuggestionResult = z.infer<typeof themeSuggestionResultSchema>;

/* FR-AI-07 Event-day copilot: prioritized alerts from live facts. No names: supplier categories, roles and counts only. */
export const eventDayCopilotInputSchema = z
  .object({
    eventType: z.string().trim(),
    suppliers: z.array(z.object({ category: z.string().trim().max(80), status: z.string().trim().max(30), minutesPastIngress: z.number().int() }).strict()).max(40),
    overdueTasks: z.array(z.object({ title: z.string().trim().max(200), priority: z.string().trim().max(20), role: z.string().trim().max(80), minutesOverdue: z.number().int().nonnegative() }).strict()).max(30),
    coordinators: z.object({ assigned: z.number().int().nonnegative(), present: z.number().int().nonnegative(), late: z.number().int().nonnegative(), absent: z.number().int().nonnegative(), notMarked: z.number().int().nonnegative() }).strict(),
    checkIns: z.object({ checkedIn: z.number().int().nonnegative(), lastHour: z.number().int().nonnegative(), expected: z.number().int().nonnegative().optional() }).strict(),
    openIssues: z.array(z.object({ title: z.string().trim().max(200), severity: z.string().trim().max(20), minutesOpen: z.number().int().nonnegative(), slaBreached: z.boolean() }).strict()).max(30),
  })
  .strict();
export type EventDayCopilotInput = z.infer<typeof eventDayCopilotInputSchema>;
export const EVENT_DAY_COPILOT_AREAS = ["suppliers", "tasks", "staffing", "check_in", "issues"] as const;
export const eventDayCopilotResultSchema = z
  .object({
    summary: nonEmptyStringSchema.max(600),
    alerts: z.array(z.object({
      priority: z.enum(["critical", "high", "medium"]),
      area: z.enum(EVENT_DAY_COPILOT_AREAS),
      alert: nonEmptyStringSchema.max(300),
      recommendation: nonEmptyStringSchema.max(300),
    }).strict()).max(8),
  })
  .strict();
export type EventDayCopilotResult = z.infer<typeof eventDayCopilotResultSchema>;
/** The copilot as the operator sees it: the advice plus when it was produced, so a cached answer is visible as such. */
export interface PrismEventDayCopilot extends EventDayCopilotResult {
  generatedAt: string;
}

/* FR-AI-05 P.R.I.S.M Operations Assistant: PMCM asks about one event; the answer uses only the facts sent and takes no action. */
export const OPERATIONS_ASSISTANT_FACT_KEYS = [
  "phase", "daysUntilEvent", "guestCount", "suppliers", "tasks", "issues", "compliance", "billing", "checkIns", "proposal", "floorPlan",
] as const;
const assistantTurnSchema = z.object({ question: z.string().trim().min(1).max(500), answer: z.string().trim().min(1).max(1_500) }).strict();
export const askOperationsAssistantSchema = z
  .object({
    question: z.string().trim().min(3).max(500),
    history: z.array(assistantTurnSchema).max(3).default([]),
  })
  .strict();
export type AskOperationsAssistantInput = z.input<typeof askOperationsAssistantSchema>;
export const operationsAssistantInputSchema = z
  .object({
    question: z.string().trim().min(3).max(500),
    history: z.array(assistantTurnSchema).max(3),
    event: z.object({ eventType: z.string().trim(), phase: z.string().trim().max(40), daysUntilEvent: z.number().int(), guestCount: z.number().int().nonnegative().optional() }).strict(),
    facts: z.object({
      suppliersRequested: z.number().int().nonnegative(),
      suppliersConfirmed: z.number().int().nonnegative(),
      openTasks: z.number().int().nonnegative(),
      overdueTasks: z.number().int().nonnegative(),
      openIssues: z.number().int().nonnegative(),
      openComplianceItems: z.number().int().nonnegative(),
      outstandingBalance: z.number().int().nonnegative(),
      checkedInGuests: z.number().int().nonnegative(),
      proposalStatus: z.string().trim().max(40),
      floorPlanStatus: z.string().trim().max(40),
    }).strict(),
  })
  .strict();
export type OperationsAssistantInput = z.infer<typeof operationsAssistantInputSchema>;
export const operationsAssistantResultSchema = z
  .object({
    answer: nonEmptyStringSchema.max(1_500),
    basedOn: z.array(z.enum(OPERATIONS_ASSISTANT_FACT_KEYS)).max(11),
    suggestedNextSteps: z.array(nonEmptyStringSchema.max(200)).max(3),
  })
  .strict();
export type OperationsAssistantResult = z.infer<typeof operationsAssistantResultSchema>;

/* FR-AI-08 PEIL: the three-section post-event intelligence report. */
export const eventIntelligenceInputSchema = z
  .object({
    eventType: z.string().trim(),
    guestCount: z.number().int().nonnegative().optional(),
    checkedInGuests: z.number().int().nonnegative().optional(),
    dimensions: z.array(z.object({ dimension: z.string().trim().max(80), status: z.string().trim().max(20), summary: z.string().trim().max(400) }).strict()).max(12),
    risks: z.array(z.object({ title: z.string().trim().max(200), severity: z.string().trim().max(20), status: z.string().trim().max(20) }).strict()).max(20),
    supplierRatings: z.array(z.number().min(0).max(5)).max(50),
    totalBilled: z.number().int().nonnegative().optional(),
    outstandingAmount: z.number().int().nonnegative().optional(),
    clientRating: z.number().int().min(1).max(5).optional(),
  })
  .strict();
export type EventIntelligenceInput = z.infer<typeof eventIntelligenceInputSchema>;
export const eventIntelligenceResultSchema = z
  .object({
    whatWorked: z.array(nonEmptyStringSchema.max(300)).min(1).max(6),
    whatFailed: z.array(z.object({ issue: nonEmptyStringSchema.max(200), why: nonEmptyStringSchema.max(400) }).strict()).max(6),
    recommendedActions: z.array(nonEmptyStringSchema.max(300)).min(1).max(6),
  })
  .strict();
export type EventIntelligenceResult = z.infer<typeof eventIntelligenceResultSchema>;

export interface PrismClientMessageTriggerState {
  trigger: ClientMessageTrigger;
  /** When the condition started, for example when the proposal was issued. */
  since: string;
  detail: string;
}

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
    /** Milestones for the Payment Schedule section. The standard policy is a 50% downpayment and the balance before the event. */
    paymentSchedule: z
      .array(z.object({ label: nonEmptyStringSchema.max(80), percentage: z.number().positive().max(100) }).strict())
      .min(1)
      .max(4)
      .default([
        { label: "Downpayment", percentage: 50 },
        { label: "Balance before the event", percentage: 50 },
      ])
      .refine((schedule) => Math.round(schedule.reduce((sum, item) => sum + item.percentage, 0) * 100) === 10_000, "Payment milestones must total 100%"),
  })
  .strict();
export type ProposalDraftRequest = z.input<typeof proposalDraftRequestSchema>;

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
    /** Amounts are computed on the server from the estimate total; the model only words them. */
    paymentSchedule: z
      .array(z.object({ label: nonEmptyStringSchema, percentage: z.number().positive(), amount: z.number().int().nonnegative() }).strict())
      .min(1)
      .max(4),
  })
  .strict();
export type ProposalDraftInput = z.infer<typeof proposalDraftInputSchema>;

export const proposalDraftResultSchema = z
  .object({
    title: nonEmptyStringSchema.max(120),
    summary: nonEmptyStringSchema.max(1_500),
    revisionNote: z.string().trim().max(400),
    highlights: z.array(nonEmptyStringSchema.max(200)).max(8),
    /** The five catalog sections of a first-draft proposal (FR-AI-03). */
    sections: z
      .object({
        executiveSummary: nonEmptyStringSchema.max(1_200),
        eventConcept: nonEmptyStringSchema.max(1_200),
        servicePackageSummary: nonEmptyStringSchema.max(1_200),
        investmentSummary: nonEmptyStringSchema.max(800),
        paymentSchedule: nonEmptyStringSchema.max(800),
      })
      .strict(),
  })
  .strict();
export type ProposalDraftResult = z.infer<typeof proposalDraftResultSchema>;

export const PROPOSAL_DRAFT_SECTION_TITLES = {
  executiveSummary: "Executive Summary",
  eventConcept: "Event Concept",
  servicePackageSummary: "Service Package Summary",
  investmentSummary: "Investment Summary",
  paymentSchedule: "Payment Schedule",
} as const satisfies Record<keyof ProposalDraftResult["sections"], string>;

/** The proposal summary text PMCM edits: each section under its heading, in catalog order. */
export function composeProposalDraftSections(sections: ProposalDraftResult["sections"]): string {
  return (Object.keys(PROPOSAL_DRAFT_SECTION_TITLES) as Array<keyof typeof PROPOSAL_DRAFT_SECTION_TITLES>)
    .map((key) => `${PROPOSAL_DRAFT_SECTION_TITLES[key]}\n${sections[key].trim()}`)
    .join("\n\n");
}

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
  "client-message.draft": { input: ClientMessageDraftInput; output: CommsDraftResult };
  "compliance.advisory": { input: ComplianceAdvisoryInput; output: ComplianceAdvisoryResult };
  "theme.suggestions": { input: ThemeSuggestionInput; output: ThemeSuggestionResult };
  "event.intelligence": { input: EventIntelligenceInput; output: EventIntelligenceResult };
  "event-day.copilot": { input: EventDayCopilotInput; output: EventDayCopilotResult };
  "operations.assistant": { input: OperationsAssistantInput; output: OperationsAssistantResult };
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

type AiAuditEvidenceFields = z.infer<typeof aiAuditEvidenceBaseSchema>;

/** Route evidence that contradicts its own policy outcome; each is reported on `routePolicyOutcome`. */
const AI_AUDIT_EVIDENCE_RULES: ReadonlyArray<{ violated: (evidence: AiAuditEvidenceFields) => boolean; message: string }> = [
  {
    violated: (evidence) => evidence.routePolicyOutcome === "synthetic_verified" &&
      (!evidence.syntheticProvenance || evidence.dataClasses.length !== 1 || evidence.dataClasses[0] !== "synthetic"),
    message: "Synthetic-verified route evidence requires verified synthetic provenance",
  },
  {
    violated: (evidence) => evidence.routePolicyOutcome === "zdr_approved" && evidence.zdrBasis !== "provider-enforced",
    message: "ZDR-approved route evidence must record a provider-enforced ZDR basis",
  },
  {
    violated: (evidence) => evidence.routePolicyOutcome === "test_data_approved" && evidence.zdrBasis !== "test-data-only",
    message: "Test-data route evidence must record a test-data-only basis",
  },
  {
    violated: (evidence) => evidence.outcome === "completed" && evidence.routePolicyOutcome === "denied",
    message: "A denied route policy cannot produce a completed result",
  },
];

export const aiAuditEvidenceSchema = aiAuditEvidenceBaseSchema.superRefine((evidence, ctx) => {
  for (const rule of AI_AUDIT_EVIDENCE_RULES) {
    if (rule.violated(evidence)) ctx.addIssue({ code: "custom", path: ["routePolicyOutcome"], message: rule.message });
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
