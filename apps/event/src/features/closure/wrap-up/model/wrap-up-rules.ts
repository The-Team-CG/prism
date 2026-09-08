import type { PrismEventWrapUp } from "@prism/types";

export function wrapUpProgress(record: PrismEventWrapUp | null) {
  if (!record) return { completed: 0, total: 0, status: "not-started" as const };
  const items = Object.values(record.requiredItems);
  const sections = Object.values(record.sections);
  const completed = items.filter(Boolean).length + sections.filter((section) => section.status === "complete").length;
  const total = items.length + sections.length + 1;
  return { completed: completed + (record.clientAcknowledgedAt ? 1 : 0), total, status: record.status };
}

export function wrapUpReminderState(record: PrismEventWrapUp | null, now = new Date()) {
  if (!record || record.status === "complete") return "complete" as const;
  if (now.getTime() >= new Date(record.deadlineAt).getTime()) return "due" as const;
  if (now.getTime() >= new Date(record.activatedAt).getTime() + 12 * 60 * 60 * 1000) return "reminder" as const;
  return "open" as const;
}
