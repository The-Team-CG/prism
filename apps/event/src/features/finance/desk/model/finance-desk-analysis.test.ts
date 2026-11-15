import { describe, expect, it } from "vitest";
import type { PrismFinanceDeskEvent, PrismFinanceDeskItem, PrismStatementMilestone } from "@prism/types";
import { agingBuckets, cashOutlook, filterQueue, isNewSince, queueGroupCounts, receivablesCsv } from "./finance-desk-analysis";

const TODAY = "2026-11-14";

function milestone(overrides: Partial<PrismStatementMilestone>): PrismStatementMilestone {
  return { id: "m", label: "Balance", dueDate: "2026-12-30", amount: 100000, paid: 0, remaining: 100000, status: "pending", checking: 0, disputed: 0, settledOn: null, ...overrides };
}

const event = (milestones: PrismStatementMilestone[], overrides: Partial<PrismFinanceDeskEvent> = {}): PrismFinanceDeskEvent => ({
  eventId: "e", eventName: "Gala", eventDate: null, clientName: "Ana Reyes", statementNumber: "BS-1", statementSent: true, billed: 0, paid: 0, checking: 0, balance: 0, overdue: 0, milestones, ...overrides,
});

const item = (overrides: Partial<PrismFinanceDeskItem>): PrismFinanceDeskItem => ({
  id: "i", kind: "verify_payment", severity: "warning", eventId: "e", eventName: "Gala", title: "Check ₱60,000 GCash payment", detail: "Reported by the client", amount: 60000, date: null, href: "/", arrivedAt: null, ...overrides,
});

describe("finance desk analysis", () => {
  it("ages what clients owe by how late it is, leaving out amounts under dispute and paid payments", () => {
    const buckets = agingBuckets([event([
      milestone({ id: "a", dueDate: "2026-12-01", remaining: 50000 }),
      milestone({ id: "b", dueDate: "2026-10-19", remaining: 66000 }),
      milestone({ id: "c", dueDate: "2026-09-01", remaining: 125000, disputed: 30000 }),
      milestone({ id: "d", dueDate: "2026-08-01", remaining: 10000 }),
      milestone({ id: "e", dueDate: "2026-08-01", remaining: 0 }),
    ])], TODAY);

    expect(buckets.map((bucket) => [bucket.id, bucket.amount, bucket.count])).toEqual([["not-due", 50000, 1], ["1-30", 66000, 1], ["31-60", 0, 0], ["61+", 105000, 2]]);
  });

  it("puts money due in and out into the week it falls due, with anything late in its own first column", () => {
    const weeks = cashOutlook(
      [event([milestone({ dueDate: "2026-10-19", remaining: 66000 }), milestone({ dueDate: "2026-11-18", remaining: 432500 }), milestone({ dueDate: "2026-11-21", remaining: 84000 }), milestone({ dueDate: "2027-03-01" })])],
      [
        { id: "p1", eventId: "e", eventName: "Gala", supplierName: "Bloom", label: "Deposit", amount: 90000, released: 0, dueDate: "2026-11-09", status: "scheduled" },
        { id: "p2", eventId: "e", eventName: "Gala", supplierName: "XPERTO", label: "Second", amount: 145500, released: 50000, dueDate: "2026-11-16", status: "partially_released" },
      ],
      TODAY,
      3,
    );

    expect(weeks.map((week) => [week.label, week.moneyIn, week.moneyOut])).toEqual([["Late", 66000, 90000], ["This week", 432500, 95500], ["Nov 21", 84000, 0], ["Nov 28", 0, 0]]);
  });

  it("narrows the queue by kind of work and by words in its title, detail or event, and counts each kind", () => {
    const items = [item({ id: "v" }), item({ id: "d", kind: "dispute", title: "Answer a dispute", eventName: "Summit" }), item({ id: "s", kind: "supplier_overdue", title: "Pay Bloom Florals" })];

    expect(filterQueue(items, "disputes", "").map((entry) => entry.id)).toEqual(["d"]);
    expect(filterQueue(items, "all", "bloom").map((entry) => entry.id)).toEqual(["s"]);
    expect(filterQueue(items, "all", "summit answer").map((entry) => entry.id)).toEqual(["d"]);
    expect(queueGroupCounts(items)).toEqual({ all: 3, "money-in": 1, disputes: 1, suppliers: 1, setup: 0 });
  });

  it("marks work new only when it arrived after the last visit", () => {
    expect(isNewSince(item({ arrivedAt: "2026-11-14T03:00:00.000Z" }), "2026-11-13T00:00:00.000Z")).toBe(true);
    expect(isNewSince(item({ arrivedAt: "2026-11-12T03:00:00.000Z" }), "2026-11-13T00:00:00.000Z")).toBe(false);
    expect(isNewSince(item({ arrivedAt: "2026-11-14T03:00:00.000Z" }), null)).toBe(false);
  });

  it("exports one row per payment, quoting cells a spreadsheet would split", () => {
    const csv = receivablesCsv([event([milestone({ label: "Balance, final", dueDate: "2026-10-19", amount: 126000, paid: 60000, remaining: 66000, checking: 60000 })], { eventName: 'The "Gala"' })], TODAY);

    expect(csv.split("\r\n")).toEqual([
      "Event,Client,Statement,Payment,Due date,Amount,Paid,Being checked,Disputed,Outstanding,Days late",
      '"The ""Gala""",Ana Reyes,BS-1,"Balance, final",2026-10-19,126000,60000,60000,0,66000,26',
    ]);
  });
});
