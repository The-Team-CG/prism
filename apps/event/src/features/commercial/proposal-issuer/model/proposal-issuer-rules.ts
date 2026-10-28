import { createCostEstimateSchema, issueProposalVersionSchema, parseContract } from "@prism/types";

export type EstimateLineDraft = { key: string; category: string; description: string; quantity: string; unitAmount: string };

export const ESTIMATE_CATEGORY_SUGGESTIONS = ["Venue", "Catering", "Styling", "Production", "Staffing", "Logistics", "Management fee"] as const;

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
      budgetAmount: Number(draft.budgetAmount),
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

export function buildIssueProposalInput(draft: ProposalDraft, costEstimateId: string, idempotencyKey: string) {
  return parseContract(
    issueProposalVersionSchema,
    { title: draft.title, summary: draft.summary, revisionNote: draft.revisionNote, costEstimateId, idempotencyKey },
    "Proposal",
  );
}
