import type { PrismCommandInboxItem, PrismDefenseReadiness, PrismPmcmCommandInbox } from "@prism/types";

export type EventActionCenterItem = { id: string; label: string; detail: string; severity: "critical" | "warning" | "attention" | "info"; href?: string };
const rank = { critical: 0, warning: 1, attention: 2, info: 3 } as const;
function inboxItem(item: PrismCommandInboxItem): EventActionCenterItem { return { id: `inbox:${item.id}`, label: item.label, detail: item.description, severity: item.severity, href: item.href }; }
function readinessItem(item: PrismDefenseReadiness["nextActions"][number]): EventActionCenterItem { return { id: `readiness:${item.key}`, label: item.label, detail: item.detail, severity: item.status === "blocked" ? "critical" : item.status === "attention" ? "warning" : "info", href: item.targetTab }; }
export function selectEventActionCenter(inbox: PrismPmcmCommandInbox | null, readiness: Pick<PrismDefenseReadiness, "nextActions"> | null): EventActionCenterItem[] {
  const items = [...(inbox?.items ?? []).map(inboxItem), ...(readiness?.nextActions ?? []).map(readinessItem)];
  return items.sort((left, right) => rank[left.severity] - rank[right.severity] || left.id.localeCompare(right.id));
}
