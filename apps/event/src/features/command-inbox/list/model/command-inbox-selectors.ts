import type {
  PrismCommandInboxItem,
  PrismCommandInboxSeverity,
} from "@prism/types";

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
