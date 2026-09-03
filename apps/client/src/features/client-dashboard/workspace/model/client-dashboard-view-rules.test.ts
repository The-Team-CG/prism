import { describe, expect, it } from "vitest";
import { deriveClientActionCenterFromWorkspace, selectNextAction } from "./client-dashboard-view-rules";
import type { PrismClientWorkspace } from "@prism/types";

function workspace(overrides: Partial<PrismClientWorkspace> = {}): PrismClientWorkspace {
  return {
    users: [],
    inquiries: [],
    events: [
      {
        id: "evt_1",
        inquiryId: "inq_1",
        clientName: "Ana Reyes",
        eventName: "Summit",
        eventDate: "2026-08-01",
        status: "briefing",
        clientPortalStatus: "unlocked",
        readiness: "open",
        archived: false,
        floorPlanStatus: "not_started",
        floorPlanId: null,
      },
    ],
    documents: [],
    briefings: [],
    supplierQuotes: [],
    coordinatorAssignments: [],
    complianceChecks: [],
    billingStatements: [],
    paymentMilestones: [
      {
        id: "pay_1",
        eventId: "evt_1",
        label: "Deposit",
        percentage: 50,
        amount: 10000,
        amountPaid: 0,
        remainingBalance: 10000,
        dueDate: "2020-01-01",
        status: "pending",
        history: [],
      },
    ],
    postEventDocuments: [],
    floorPlanDrafts: [],
    auditLogs: [],
    notificationLogs: [],
    ...overrides,
  };
}

describe("client action center derivation", () => {
  it("builds a labeled workspace fallback ordered by severity", () => {
    const center = deriveClientActionCenterFromWorkspace(workspace(), { name: "Ana Reyes" }, Date.parse("2026-09-03T00:00:00.000Z"));
    expect(center.items[0]?.kind).toBe("billing");
    expect(center.items[0]?.priority).toBe("critical");
    expect(center.items.some((item) => item.kind === "briefing")).toBe(true);
    expect(center.counts.critical).toBe(1);
  });

  it("selects overdue warning actions before routine next actions", () => {
    const next = selectNextAction([
      { id: "a", title: "Briefing", description: "", detail: "", ctaLabel: "Open", icon: {} as never, targetTab: "briefing", status: "missing", tone: "primary" },
      { id: "b", title: "Pay", description: "", detail: "", ctaLabel: "Open", icon: {} as never, targetTab: "billing", status: "pending", tone: "warning" },
    ]);
    expect(next?.id).toBe("b");
  });
});
