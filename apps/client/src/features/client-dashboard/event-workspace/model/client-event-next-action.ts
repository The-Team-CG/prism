import type { PrismClientActionItem } from "@prism/types";

const SEVERITY_RANK: Record<PrismClientActionItem["priority"], number> = { critical: 0, warning: 1, attention: 2, info: 3 };

/**
 * The single action an event overview leads with: the most severe open item for this event,
 * soonest due first. Informational updates never become the "next step".
 */
export function selectEventNextAction(items: PrismClientActionItem[], eventId: string): PrismClientActionItem | undefined {
  const due = (item: PrismClientActionItem) => {
    const time = item.dueAt ? Date.parse(item.dueAt) : Number.NaN;
    return Number.isFinite(time) ? time : Number.POSITIVE_INFINITY;
  };
  return items
    .filter((item) => item.eventId === eventId && item.priority !== "info")
    .sort((left, right) => SEVERITY_RANK[left.priority] - SEVERITY_RANK[right.priority] || due(left) - due(right))[0];
}
