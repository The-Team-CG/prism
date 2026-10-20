import type { PrismFileRequirementItem } from "@prism/types";

/** Client-facing due line: required state, due date, and overdue flag. PMCM notes are never shown here. */
export function fileRequirementDueSummary(item: Pick<PrismFileRequirementItem, "required" | "dueDate" | "overdue">) {
  const parts = [item.required ? "Required" : "Optional"];
  if (item.dueDate) {
    const due = new Date(item.dueDate).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
    parts.push(`Due ${due}`);
  }
  if (item.overdue) parts.push("Overdue");
  return parts.join(" · ");
}

