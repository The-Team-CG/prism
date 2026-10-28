import { formatPortalDate } from "@prism/ui/format-date";
import type { PrismFileRequirementItem } from "@prism/types";

/** Client-facing due line: required state, due date, and overdue flag. PMCM notes are never shown here. */
export function fileRequirementDueSummary(item: Pick<PrismFileRequirementItem, "required" | "dueDate" | "overdue">) {
  const parts = [item.required ? "Required" : "Optional"];
  if (item.dueDate) {
    parts.push(`Due ${formatPortalDate(item.dueDate)}`);
  }
  if (item.overdue) parts.push("Overdue");
  return parts.join(" · ");
}

