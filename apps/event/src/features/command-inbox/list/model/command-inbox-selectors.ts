import type { PrismCommandInboxItem, PrismCommandInboxSeverity } from "@prism/types";

const SEVERITY_RANK: Record<PrismCommandInboxSeverity, number> = {
  critical: 0,
  warning: 1,
  attention: 2,
  info: 3,
};

export function selectCommandInboxItemsBySeverity(
  items: PrismCommandInboxItem[],
  severity?: PrismCommandInboxSeverity | null,
): PrismCommandInboxItem[] {
  const filtered = severity ? items.filter((item) => item.severity === severity) : items;
  return [...filtered].sort((a, b) => {
    const sevDiff = SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity];
    if (sevDiff !== 0) return sevDiff;
    const aTime = a.dueAt ?? a.createdAt ?? "";
    const bTime = b.dueAt ?? b.createdAt ?? "";
    return bTime.localeCompare(aTime);
  });
}

export function selectCommandInboxGroupedBySeverity(
  items: PrismCommandInboxItem[],
): { severity: PrismCommandInboxSeverity; items: PrismCommandInboxItem[] }[] {
  const groups: { severity: PrismCommandInboxSeverity; items: PrismCommandInboxItem[] }[] = [];
  for (const severity of ["critical", "warning", "attention", "info"] as PrismCommandInboxSeverity[]) {
    const matching = selectCommandInboxItemsBySeverity(items, severity);
    if (matching.length > 0) groups.push({ severity, items: matching });
  }
  return groups;
}

export function selectCommandInboxCount(items: PrismCommandInboxItem[]): number {
  return items.length;
}

export function selectCriticalCommandInboxCount(items: PrismCommandInboxItem[]): number {
  return items.filter((item) => item.severity === "critical").length;
}

export interface CommandInboxTriage {
  /** Critical blockers: the only rows that get strong warning treatment. */
  urgent: PrismCommandInboxItem[];
  /** Warning and attention rows that still need a decision. */
  needsAction: PrismCommandInboxItem[];
  /** Informational updates, collapsed by default. */
  reference: PrismCommandInboxItem[];
  counts: { urgent: number; needsAction: number; reference: number; total: number };
}

/** Splits loaded rows into triage bands. Counts cover the loaded page only; the inbox does not report totals across pages. */
export function selectCommandInboxTriage(items: PrismCommandInboxItem[]): CommandInboxTriage {
  const sorted = selectCommandInboxItemsBySeverity(items);
  const urgent = sorted.filter((entry) => entry.severity === "critical");
  const needsAction = sorted.filter((entry) => entry.severity === "warning" || entry.severity === "attention");
  const reference = sorted.filter((entry) => entry.severity === "info");
  return {
    urgent,
    needsAction,
    reference,
    counts: { urgent: urgent.length, needsAction: needsAction.length, reference: reference.length, total: sorted.length },
  };
}
