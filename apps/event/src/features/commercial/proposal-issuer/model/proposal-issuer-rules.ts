import { createCostEstimateSchema, issueProposalVersionSchema, parseContract, proposalDraftRequestSchema } from "@prism/types";

export type EstimateLineDraft = { key: string; category: string; description: string; quantity: string; unitAmount: string };

export const ESTIMATE_CATEGORY_SUGGESTIONS = ["Venue", "Catering", "Styling", "Production", "Staffing", "Logistics", "Management fee"] as const;

/** FR-19: adds source lines to the estimate, dropping a still-empty starter line. */
export function appendEstimateLines(current: EstimateLineDraft[], incoming: Array<{ category: string; description: string; quantity: number; unitAmount: number }>, nextKey: () => string): EstimateLineDraft[] {
  const kept = current.filter((line) => line.category.trim() || line.description.trim() || line.unitAmount.trim());
  return [...kept, ...incoming.map((line) => ({ key: nextKey(), category: line.category, description: line.description, quantity: String(line.quantity), unitAmount: String(line.unitAmount) }))];
}

export function emptyEstimateLine(key: string): EstimateLineDraft {
  return { key, category: "", description: "", quantity: "1", unitAmount: "" };
}

function lineTotal(line: EstimateLineDraft) {
  const quantity = Number(line.quantity);
  const unitAmount = Number(line.unitAmount);
  return Number.isFinite(quantity) && Number.isFinite(unitAmount) ? Math.round(quantity * unitAmount) : 0;
}

export function estimateTotal(lines: readonly EstimateLineDraft[]) {
  return lines.reduce((sum, line) => sum + lineTotal(line), 0);
}

export function estimateLineTotal(line: EstimateLineDraft) {
  return lineTotal(line);
}

export function formatPeso(amount: number) {
  return new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP", maximumFractionDigits: 0 }).format(amount);
}

/** Reads a peso amount typed with or without the ₱ sign and thousands separators. Empty or non-numeric input is NaN. */
export function parsePesoAmount(value: string): number {
  const digits = value.replace(/[₱,s]/g, "");
  return digits === "" ? Number.NaN : Number(digits);
}

type ProposalDraft = {
  budgetAmount: string;
  notes: string;
  lines: readonly EstimateLineDraft[];
  title: string;
  summary: string;
  revisionNote: string;
};

export function buildCostEstimateInput(draft: ProposalDraft) {
  return parseContract(
    createCostEstimateSchema,
    {
      budgetAmount: parsePesoAmount(draft.budgetAmount),
      notes: draft.notes,
      lines: draft.lines.map((line) => ({
        category: line.category,
        description: line.description,
        quantity: Number(line.quantity),
        unitAmount: Number(line.unitAmount),
      })),
    },
    "Cost estimate",
  );
}

/** FR-62: Option B, saved as its own estimate, and PMCM's reason when the briefing names one fixed budget. */
export type ProposalPackages = { alternativeCostEstimateId?: string; packageOverrideReason?: string };

export function buildIssueProposalInput(draft: ProposalDraft, costEstimateId: string, idempotencyKey: string, packages: ProposalPackages = {}) {
  return parseContract(
    issueProposalVersionSchema,
    {
      title: draft.title, summary: draft.summary, revisionNote: draft.revisionNote, costEstimateId, idempotencyKey,
      ...(packages.alternativeCostEstimateId ? { alternativeCostEstimateId: packages.alternativeCostEstimateId } : {}),
      ...(packages.packageOverrideReason?.trim() ? { packageOverrideReason: packages.packageOverrideReason.trim() } : {}),
    },
    "Proposal",
  );
}

/** The estimate being built, shaped for the AI drafting request. Invalid input throws a readable message. */
export function buildProposalDraftRequest(eventId: string, draft: ProposalDraft) {
  return parseContract(
    proposalDraftRequestSchema,
    {
      eventId,
      budgetAmount: parsePesoAmount(draft.budgetAmount),
      notes: draft.notes,
      lines: draft.lines.map((line) => ({
        category: line.category,
        description: line.description,
        quantity: Number(line.quantity),
        unitAmount: Number(line.unitAmount),
      })),
    },
    "Proposal draft",
  );
}
