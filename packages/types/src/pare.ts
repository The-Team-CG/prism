import { z } from "zod";

/**
 * PARE (Proactive Automated Replacement Engine) contract.
 *
 * One supplier withdrawal produces one PARE result: context, ranked replacement
 * candidates, a budget verdict, a risk verdict and two draft messages. The result
 * is stored sanitized on `OpsAiAuditLog` and gated behind an
 * `OpsAiApprovalRecord` — no PARE output acts on its own.
 *
 * Shared by `apps/api` (ai-governance writes the audit + approval records) and
 * the `apps/agent-*` eve apps (their tools read and return these shapes).
 * Schemas are the source of truth; every type is a `z.infer`.
 */

/* ── Suppliers and candidates ─────────────────────────────────── */

/** The supplier that pulled out, as recorded on the quote request. */
export const pareWithdrawnSupplierSchema = z.object({
  id: z.string(),
  name: z.string(),
  category: z.string(),
  tier: z.string(),
  quotedAmount: z.number(),
});
export type PAREWithdrawnSupplier = z.infer<typeof pareWithdrawnSupplierSchema>;

/** A ranked replacement option. `reason` is the shortlist rationale shown to PMCM. */
export const pareCandidateSchema = z.object({
  supplierId: z.string(),
  supplierName: z.string(),
  tier: z.string(),
  quotedAmount: z.number(),
  reliabilityScore: z.number(),
  halal: z.boolean(),
  priorPmcmEvents: z.number(),
  reason: z.string(),
});
export type PARECandidate = z.infer<typeof pareCandidateSchema>;

/**
 * A supplier row the ranking step scores, with the relations it needs.
 * Relations are optional so a caller can pass a thinner row.
 */
export const pareSupplierRecordSchema = z.object({
  id: z.string(),
  name: z.string(),
  tier: z.string(),
  categoryName: z.string().nullish(),
  serviceInclusions: z.string().nullish(),
  performanceNotes: z.string().nullish(),
  reviews: z.array(z.object({ rating: z.number() })).optional(),
  /** Quote requests for the event being repaired. */
  quoteRequests: z.array(z.object({ assignmentStatus: z.string().nullish() })).optional(),
  /** Quotes for the event being repaired. */
  quotes: z.array(z.object({ amount: z.number().nullish() })).optional(),
});
export type PARESupplierRecord = z.infer<typeof pareSupplierRecordSchema>;

/* ── Analyses ─────────────────────────────────────────────────── */

export const pareBudgetAnalysisSchema = z.object({
  feasible: z.boolean(),
  selectedCandidate: pareCandidateSchema,
  costDelta: z.number(),
  costDeltaLabel: z.string(),
  summary: z.string(),
});
export type PAREBudgetAnalysis = z.infer<typeof pareBudgetAnalysisSchema>;

export const pareRiskLevelSchema = z.enum(["LOW", "MEDIUM", "HIGH"]);
export type PARERiskLevel = z.infer<typeof pareRiskLevelSchema>;

export const pareRiskSchema = z.object({
  level: pareRiskLevelSchema,
  factors: z.array(z.string()),
  recommendation: z.string(),
});
export type PARERisk = z.infer<typeof pareRiskSchema>;

/** Advisory copy only. PMCM reviews, edits and sends these; PARE never sends. */
export const pareDraftsSchema = z.object({
  supplierNotification: z.string(),
  clientReassurance: z.string(),
});
export type PAREDrafts = z.infer<typeof pareDraftsSchema>;

/* ── Context ──────────────────────────────────────────────────── */

/** Shared state every PARE step reads, built once from the withdrawal. */
export const pareContextSchema = z.object({
  triggerId: z.string(),
  eventId: z.string(),
  eventName: z.string(),
  eventDate: z.string(),
  daysUntilEvent: z.number(),
  clientName: z.string(),
  totalBudget: z.number(),
  spentBudget: z.number(),
  remainingBudget: z.number(),
  withdrawnSupplier: pareWithdrawnSupplierSchema,
  clientPreferences: z.array(z.string()),
  candidates: z.array(pareCandidateSchema).optional(),
  budgetAnalysis: pareBudgetAnalysisSchema.optional(),
  riskAssessment: pareRiskSchema.optional(),
  drafts: pareDraftsSchema.optional(),
});
export type PAREContext = z.infer<typeof pareContextSchema>;

/**
 * Raw withdrawal facts the context is built from.
 *
 * The API reads these off Prisma. Agent apps take them as tool input, which is
 * what lets an agent run without database access.
 */
export const pareTriggerInputSchema = z.object({
  triggerId: z.string(),
  event: z.object({
    id: z.string(),
    eventName: z.string(),
    eventDate: z.string(),
    clientName: z.string(),
  }),
  /** The quote request whose supplier withdrew. */
  withdrawnRequest: z.object({
    supplierId: z.string().nullish(),
    supplierName: z.string(),
    category: z.string(),
    supplierTier: z.string().nullish(),
  }),
  /** `OpsSupplierQuote` rows for this event with status `selected`. */
  selectedQuotes: z
    .array(z.object({ requestId: z.string().nullish(), amount: z.number().nullish() }))
    .optional(),
  /** `serviceRequirements` from the most recent `OpsBriefing` for this event. */
  briefingServiceRequirements: z.unknown().optional(),
  totalBudget: z.number().optional(),
  remainingBudget: z.number().optional(),
  /** Reference point for `daysUntilEvent`. Defaults to now. */
  now: z.string().optional(),
});
export type PARETriggerInput = z.infer<typeof pareTriggerInputSchema>;

/* ── Result and approval ──────────────────────────────────────── */

/** `mock` is the deterministic path; `live` means a model produced the analyses. */
export const pareModeSchema = z.enum(["mock", "live"]);
export type PAREMode = z.infer<typeof pareModeSchema>;

export const pareResultSchema = z.object({
  requestId: z.string(),
  eventId: z.string(),
  eventName: z.string(),
  withdrawnSupplier: pareWithdrawnSupplierSchema,
  candidates: z.array(pareCandidateSchema),
  budgetAnalysis: pareBudgetAnalysisSchema,
  riskAssessment: pareRiskSchema,
  drafts: pareDraftsSchema,
  mode: pareModeSchema,
  triggeredAt: z.string(),
});
export type PAREResult = z.infer<typeof pareResultSchema>;

export const pareApprovalStatusSchema = z.enum(["pending", "approved", "rejected"]);
export type PAREApprovalStatus = z.infer<typeof pareApprovalStatusSchema>;

export const pareApprovalRecordSchema = z.object({
  id: z.string(),
  eventId: z.string(),
  requestId: z.string(),
  status: pareApprovalStatusSchema,
  pareResult: pareResultSchema,
  reviewedBy: z.string().nullable(),
  reviewedAt: z.string().nullable(),
  createdAt: z.string(),
});
export type PAREApprovalRecord = z.infer<typeof pareApprovalRecordSchema>;

/* ── Agent submission contracts ───────────────────────────────── */

/**
 * What each reasoning agent hands back. These are the `submit_*` tool inputs in
 * the `apps/agent-*` eve apps, and the shape their callers can rely on.
 *
 * `selectedCandidate` is absent here on purpose: the agent judges the shortlist
 * it was given, it does not re-pick the candidate.
 */
export const submitPareBudgetAnalysisSchema = z.object({
  feasible: z.boolean(),
  costDelta: z.number(),
  costDeltaLabel: z.string(),
  summary: z.string(),
});
export type SubmitPAREBudgetAnalysisInput = z.infer<typeof submitPareBudgetAnalysisSchema>;

export const submitPareRiskAssessmentSchema = pareRiskSchema;
export type SubmitPARERiskAssessmentInput = z.infer<typeof submitPareRiskAssessmentSchema>;

export const submitPareMessageDraftsSchema = pareDraftsSchema;
export type SubmitPAREMessageDraftsInput = z.infer<typeof submitPareMessageDraftsSchema>;
