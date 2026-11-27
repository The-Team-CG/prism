import type { PrismComplianceRule } from "@prism/types";

export const COMPLIANCE_RULE_PHASES = [
  ["planning", "Planning"],
  ["pre_event", "Pre-event"],
  ["event_day", "Onsite"],
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

/** An existing rule in the form's terms, so editing starts from what the rule says now. */
export function complianceRuleDraft(rule: PrismComplianceRule): ComplianceRuleDraft {
  const severity = COMPLIANCE_RULE_SEVERITIES.some(([value]) => value === rule.severity) ? rule.severity : "must_fix";
  return { title: rule.title, conditionKey: rule.conditionKey, phase: rule.phase || "planning", severity, note: rule.note ?? "" };
}

/** Workspace rules PMCM turned off: kept, so they can be turned back on, but no longer checked. */
export function inactiveWorkspaceRules(rules: PrismComplianceRule[]) {
  return rules.filter((rule) => !rule.active && !rule.eventId).sort((a, b) => a.title.localeCompare(b.title));
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

/** The checks PMCM ships with: the API lists them beside saved rules, dated at the epoch since nobody created them. */
export function builtInComplianceChecks(rules: PrismComplianceRule[]) {
  const phaseOrder = new Map<string, number>(COMPLIANCE_RULE_PHASES.map(([value], index) => [value, index]));
  return rules
    .filter((rule) => rule.active && !rule.eventId && rule.createdAt.startsWith("1970-01-01"))
    .sort((a, b) => (phaseOrder.get(a.phase.split(",")[0]) ?? 9) - (phaseOrder.get(b.phase.split(",")[0]) ?? 9) || a.title.localeCompare(b.title));
}

/** A rule's phases in words; built-in checks can run at several. */
export function compliancePhasesLabel(phase: string) {
  return phase.split(",").filter(Boolean).map((value) => complianceOptionLabel(COMPLIANCE_RULE_PHASES, value.trim())).join(", ");
}
