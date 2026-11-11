import type { PlanItemStatus, PrismEventPlanItem, PrismPlanChange, PrismPlanKeptReason, PrismPlanPreview } from "@prism/types";
import { formatPortalDate } from "@prism/ui/format-date";

export const PLAN_STATUS_LABELS: Record<PlanItemStatus, string> = { open: "Open", done: "Done", skipped: "Skipped" };

export interface PlanProgress {
  total: number;
  open: number;
  done: number;
  skipped: number;
  overdue: number;
}

export function planProgress(items: readonly PrismEventPlanItem[]): PlanProgress {
  const count = (status: PlanItemStatus) => items.filter((item) => item.status === status).length;
  return { total: items.length, open: count("open"), done: count("done"), skipped: count("skipped"), overdue: items.filter((item) => item.overdue).length };
}

export interface PlanGroup {
  templateId: string;
  templateName: string;
  items: PrismEventPlanItem[];
}

/** One group per template the plan came from, in the order the API returns them (by date), so each group reads as a timeline. */
export function groupByTemplate(items: readonly PrismEventPlanItem[]): PlanGroup[] {
  const groups = new Map<string, PlanGroup>();
  for (const item of items) {
    const group = groups.get(item.templateId) ?? { templateId: item.templateId, templateName: item.templateName, items: [] };
    group.items.push(item);
    groups.set(item.templateId, group);
  }
  return [...groups.values()].sort((left, right) => left.templateName.localeCompare(right.templateName));
}

const FIELD_LABELS: Record<PrismPlanChange["field"], string> = {
  title: "Title",
  ownerRole: "Owner",
  dueDate: "Due",
  notes: "Notes",
  dependsOn: "Waits for",
};

/** One change in words: "Due: Nov 20, 2026 → Nov 5, 2026". Dates read as dates; an empty value reads as "nothing". */
export function changeLabel(change: PrismPlanChange): string {
  const show = (value: string) => (value === "" ? "nothing" : change.field === "dueDate" ? formatPortalDate(value) : value);
  return `${FIELD_LABELS[change.field]}: ${show(change.from)} → ${show(change.to)}`;
}

export const KEPT_REASON_LABELS: Record<PrismPlanKeptReason, string> = {
  done: "Already done, so it stays as it is",
  skipped: "Skipped, so it stays as it is",
  edited: "Edited by your team, so it stays as it is",
};

/** Nothing the apply would write: the template matches the plan already. */
export function previewIsEmpty(preview: PrismPlanPreview): boolean {
  return preview.add.length === 0 && preview.update.length === 0;
}

const plural = (count: number, one: string, other: string) => `${count} ${count === 1 ? one : other}`;

/** The headline counts of a preview, only for what is not zero. */
export function previewSummary(preview: PrismPlanPreview): string[] {
  return [
    preview.add.length > 0 ? `${plural(preview.add.length, "task", "tasks")} to add` : "",
    preview.update.length > 0 ? `${plural(preview.update.length, "task", "tasks")} to update` : "",
    preview.kept.length > 0 ? `${plural(preview.kept.length, "task", "tasks")} kept as they are` : "",
    preview.removedFromTemplate.length > 0 ? `${plural(preview.removedFromTemplate.length, "task", "tasks")} no longer in the template, left on the plan` : "",
    preview.unchanged > 0 ? `${plural(preview.unchanged, "task", "tasks")} already match` : "",
  ].filter(Boolean);
}

/** The status a checkbox moves a task to: finishing an open task, reopening a finished one. A skipped task is reopened too. */
export function toggledStatus(item: Pick<PrismEventPlanItem, "status">): PlanItemStatus {
  return item.status === "open" ? "done" : "open";
}

/** Who a task is with: the named person, else the owner role. */
export function ownerLabel(item: Pick<PrismEventPlanItem, "ownerName" | "ownerRole">): string {
  return item.ownerName ? `${item.ownerName} (${item.ownerRole})` : item.ownerRole;
}
