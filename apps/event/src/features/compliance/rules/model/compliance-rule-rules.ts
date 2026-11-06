import type { PrismComplianceRule } from "@prism/types";

export const COMPLIANCE_RULE_PHASES = [
  ["planning", "Planning"],
  ["pre_event", "Pre-event"],
  ["event_day", "Event day"],
] as const;

export const COMPLIANCE_RULE_SEVERITIES = [
  ["must_fix", "Must fix"],
  ["watch_out", "Watch out"],
  ["advisory", "Advisory"],
] as const;

export type ComplianceRuleDraft = { title: string; conditionKey: string; phase: string; severity: string; note: string };

export const EMPTY_COMPLIANCE_RULE_DRAFT: ComplianceRuleDraft = { title: "", conditionKey: "", phase: "planning", severity: "must_fix", note: "" };

/** The rule layer the API stores for each severity choice. */
export function complianceRuleLayer(severity: string) {
  if (severity === "watch_out") return "Should-Fix";
  if (severity === "advisory") return "Advisory";
  return "Must-Fix";
}

export function toCreateComplianceRuleInput(draft: ComplianceRuleDraft) {
  return {
    title: draft.title.trim(),
    conditionKey: draft.conditionKey.trim(),
    phase: draft.phase,
    severity: draft.severity,
    layer: complianceRuleLayer(draft.severity),
    note: draft.note.trim(),
  };
}

/** Workspace-wide rules first, ordered by phase then title. */
export function activeWorkspaceRules(rules: PrismComplianceRule[]) {
  const phaseOrder = new Map<string, number>(COMPLIANCE_RULE_PHASES.map(([value], index) => [value, index]));
  return rules
    .filter((rule) => rule.active && !rule.eventId)
    .sort((a, b) => (phaseOrder.get(a.phase) ?? 9) - (phaseOrder.get(b.phase) ?? 9) || a.title.localeCompare(b.title));
}

export function complianceOptionLabel(options: ReadonlyArray<readonly [string, string]>, value: string) {
  return options.find(([key]) => key === value)?.[1] ?? value.replaceAll("_", " ");
}
