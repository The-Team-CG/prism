import type { PrismFileRequirementItem, PrismFileRequirementsMatrix } from "@prism/types";

export const FILE_HUB_HELP_COPY =
  "Upload deliverables in Stored event files. Confirmed files are shared with the client and available to download from the event file hub.";

export function sortFileRequirementItems(items: PrismFileRequirementItem[]) {
  const order: Record<string, number> = {
    missing: 0,
    pending: 1,
    submitted: 2,
    generated: 3,
    approved: 4,
    complete: 5,
  };
  return [...items].sort((left, right) => (order[left.status] ?? 9) - (order[right.status] ?? 9) || left.label.localeCompare(right.label));
}

export function fileRequirementCounts(matrix: PrismFileRequirementsMatrix | null) {
  const items = matrix?.items ?? [];
  return {
    total: items.length,
    open: items.filter((item) => item.status === "missing" || item.status === "pending").length,
  };
}
