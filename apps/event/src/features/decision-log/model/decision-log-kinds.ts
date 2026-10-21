import { PRISM_DECISION_LOG_KINDS, type PrismDecisionLog, type PrismDecisionLogActor, type PrismDecisionLogKind } from "@prism/types";

export const DECISION_LOG_KIND_LABELS: Record<PrismDecisionLogKind, string> = {
  postponement: "Postponement",
  cancellation: "Cancellation",
  freeze_exception: "Freeze exception",
  addendum: "Addendum",
  archive_override: "Archive override",
  compliance_override: "Compliance override",
  risk_change: "Risk change",
  ocular_waiver: "Ocular visit waiver",
  billing_correction: "Billing correction",
  billing_waiver: "Billing waiver",
  payment_terms_override: "Payment terms override",
  reassignment: "Task reassignment",
  inquiry_merge: "Inquiry merge",
};

export type DecisionLogKindOption = { value: PrismDecisionLogKind | "all"; label: string; count: number };

/** Filter options with server counts; kinds with no recorded decisions are omitted. */
export function decisionLogKindOptions(log: PrismDecisionLog | null): DecisionLogKindOption[] {
  const counts = log?.kindCounts;
  const total = counts ? Object.values(counts).reduce((sum, count) => sum + count, 0) : 0;
  return [
    { value: "all", label: "All decisions", count: total },
    ...PRISM_DECISION_LOG_KINDS.filter((kind) => (counts?.[kind] ?? 0) > 0 || log?.kind === kind).map((kind) => ({
      value: kind,
      label: DECISION_LOG_KIND_LABELS[kind],
      count: counts?.[kind] ?? 0,
    })),
  ];
}

export function formatDecisionActor(actor: PrismDecisionLogActor) {
  if (!actor.name && !actor.role) return "Actor not recorded";
  if (!actor.role) return actor.name!;
  if (!actor.name) return actor.role;
  return `${actor.name} (${actor.role})`;
}

export function formatDecisionToken(value: string) {
  return value.replaceAll("_", " ");
}
