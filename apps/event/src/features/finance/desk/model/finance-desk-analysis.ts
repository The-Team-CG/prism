import type { PrismFinanceDeskEvent, PrismFinanceDeskItem, PrismFinanceDeskItemKind, PrismFinanceDeskPayout } from "@prism/types";
import { daysUntil } from "@prism/ui/format-date";

const owed = (milestone: { remaining: number; disputed: number }) => Math.max(0, milestone.remaining - milestone.disputed);

export type AgingBucket = { id: "not-due" | "1-30" | "31-60" | "61+"; label: string; amount: number; count: number };

/** What clients owe, by how late it is: not due yet, then 1–30, 31–60 and more than 60 days late. Disputed amounts are left out. */
export function agingBuckets(events: PrismFinanceDeskEvent[], todayKey: string): AgingBucket[] {
  const buckets: AgingBucket[] = [
    { id: "not-due", label: "Not due yet", amount: 0, count: 0 },
    { id: "1-30", label: "1–30 days late", amount: 0, count: 0 },
    { id: "31-60", label: "31–60 days late", amount: 0, count: 0 },
    { id: "61+", label: "Over 60 days late", amount: 0, count: 0 },
  ];
  for (const milestone of events.flatMap((event) => event.milestones)) {
    const amount = owed(milestone);
    if (amount <= 0) continue;
    const late = -(daysUntil(milestone.dueDate, todayKey) ?? 0);
    const bucket = late <= 0 ? buckets[0] : late <= 30 ? buckets[1] : late <= 60 ? buckets[2] : buckets[3];
    bucket.amount += amount;
    bucket.count += 1;
  }
  return buckets;
}

export type OutlookWeek = { id: string; label: string; start: string | null; moneyIn: number; moneyOut: number };

function addDays(key: string, days: number): string {
  const date = new Date(`${key}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

const shortDay = (key: string) => new Intl.DateTimeFormat("en-PH", { month: "short", day: "numeric", timeZone: "UTC" }).format(new Date(`${key}T00:00:00Z`));

/**
 * Money expected over the coming weeks: what clients owe coming in, and what PMCM owes suppliers going out, by the week
 * it falls due. Anything already late sits in a first "Late" column, since it is owed now.
 */
export function cashOutlook(events: PrismFinanceDeskEvent[], payouts: PrismFinanceDeskPayout[], todayKey: string, weeks = 8): OutlookWeek[] {
  const columns: OutlookWeek[] = [
    { id: "late", label: "Late", start: null, moneyIn: 0, moneyOut: 0 },
    ...Array.from({ length: weeks }, (_, index) => {
      const start = addDays(todayKey, index * 7);
      return { id: start, label: index === 0 ? "This week" : shortDay(start), start, moneyIn: 0, moneyOut: 0 };
    }),
  ];
  const columnFor = (dueKey: string | null) => {
    if (!dueKey) return null;
    const days = daysUntil(dueKey, todayKey) ?? 0;
    if (days < 0) return columns[0];
    const week = Math.floor(days / 7);
    return week < weeks ? columns[week + 1] : null;
  };
  for (const milestone of events.flatMap((event) => event.milestones)) {
    const column = columnFor(milestone.dueDate);
    if (column) column.moneyIn += owed(milestone);
  }
  for (const payout of payouts) {
    const column = columnFor(payout.dueDate);
    if (column) column.moneyOut += Math.max(0, payout.amount - payout.released);
  }
  return columns;
}

export type QueueGroup = "all" | "money-in" | "disputes" | "suppliers" | "setup";

const GROUP_OF: Record<PrismFinanceDeskItemKind, Exclude<QueueGroup, "all">> = {
  client_overdue: "money-in",
  verify_payment: "money-in",
  apply_money: "money-in",
  dispute: "disputes",
  correction: "disputes",
  supplier_overdue: "suppliers",
  supplier_due_soon: "suppliers",
  approve_source: "setup",
  send_statement: "setup",
};

export const QUEUE_GROUPS: Array<{ id: QueueGroup; label: string }> = [
  { id: "all", label: "All" },
  { id: "money-in", label: "Client money" },
  { id: "disputes", label: "Disputes" },
  { id: "suppliers", label: "Suppliers" },
  { id: "setup", label: "Setup" },
];

/** The queue narrowed to one kind of work and a search over its title, detail and event. */
export function filterQueue(items: PrismFinanceDeskItem[], group: QueueGroup, query: string): PrismFinanceDeskItem[] {
  const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  return items.filter((item) => {
    if (group !== "all" && GROUP_OF[item.kind] !== group) return false;
    const text = `${item.title} ${item.detail} ${item.eventName ?? ""}`.toLowerCase();
    return words.every((word) => text.includes(word));
  });
}

export function queueGroupCounts(items: PrismFinanceDeskItem[]): Record<QueueGroup, number> {
  const counts: Record<QueueGroup, number> = { all: items.length, "money-in": 0, disputes: 0, suppliers: 0, setup: 0 };
  for (const item of items) counts[GROUP_OF[item.kind]] += 1;
  return counts;
}

/** Work that reached PMCM after their last visit to the desk. With no visit on record, nothing is marked new. */
export function isNewSince(item: Pick<PrismFinanceDeskItem, "arrivedAt">, lastSeen: string | null): boolean {
  if (!lastSeen || !item.arrivedAt) return false;
  return item.arrivedAt > lastSeen;
}

const csvCell = (value: string | number) => {
  const text = String(value);
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
};

/** What every client owes, one row per payment, for a spreadsheet: amounts in whole pesos, dates as YYYY-MM-DD. */
export function receivablesCsv(events: PrismFinanceDeskEvent[], todayKey: string): string {
  const header = ["Event", "Client", "Statement", "Payment", "Due date", "Amount", "Paid", "Being checked", "Disputed", "Outstanding", "Days late"];
  const rows = events.flatMap((event) => event.milestones.map((milestone) => {
    const late = Math.max(0, -(daysUntil(milestone.dueDate, todayKey) ?? 0));
    return [event.eventName, event.clientName, event.statementNumber ?? "", milestone.label, milestone.dueDate, milestone.amount, milestone.paid, milestone.checking, milestone.disputed, milestone.remaining, milestone.remaining > 0 ? late : 0];
  }));
  return [header, ...rows].map((row) => row.map(csvCell).join(",")).join("\r\n");
}
