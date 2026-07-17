/** Pure display helpers shared by PMCM event feature views. */

export function humanizeToken(value: string): string {
  return value.replaceAll("_", " ");
}

export function formatShortDate(value?: string | null): string {
  if (!value) return "No date";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function isPaymentOverdue(status: string, dueDate: string, now = new Date()): boolean {
  if (status === "paid" || status === "waived") return false;
  const due = new Date(dueDate);
  if (Number.isNaN(due.getTime())) return false;
  return due.getTime() < now.getTime();
}

export function toIsoDateTimeLocal(value: string): string {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toISOString();
}

export function liveOpsStatusTone(value: string): "danger" | "warning" | "success" | "neutral" {
  const v = value.toLowerCase();
  if (v.includes("critical") || v.includes("overdue") || v.includes("blocked")) return "danger";
  if (v.includes("warn") || v.includes("pending") || v.includes("risk")) return "warning";
  if (v.includes("done") || v.includes("complete") || v.includes("verified") || v.includes("ok"))
    return "success";
  return "neutral";
}
