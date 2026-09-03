import type { PrismFileRequirementItem, PrismFileRequirementsMatrix } from "@prism/types";

export const STORAGE_GATE_COPY =
  "File requirements are metadata-only. Binary object storage, signed uploads, Share, and Download stay gated until a storage adapter is approved.";

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
