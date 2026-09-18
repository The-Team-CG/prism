import { describe, expect, it } from "vitest";
import {
  clientFloorplanDashboardActionLabel,
  deriveClientActionCenterFromWorkspace,
  selectNextAction,
} from "./client-dashboard-view-rules";
import { selectClientDashboardActions } from "./client-dashboard-selectors";
import type { PrismClientActionItem, PrismClientWorkspace } from "@prism/types";

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
    expect(center.items.find((item) => item.kind === "floorplan")?.href).toBe("/dashboard/events/evt_1/floor-plan");
  });

  it("labels direct event-card floorplan actions by state", () => {
    expect(clientFloorplanDashboardActionLabel("not_started")).toBe("Set layout preferences");
    expect(clientFloorplanDashboardActionLabel("in_review")).toBe("View official floorplan");
    expect(clientFloorplanDashboardActionLabel("approved")).toBe("View official floorplan");
    expect(clientFloorplanDashboardActionLabel(undefined)).toBe("Open floor plan");
  });

  it("selects overdue warning actions before routine next actions", () => {
    const next = selectNextAction([
      { id: "a", title: "Briefing", description: "", detail: "", ctaLabel: "Open", icon: {} as never, targetTab: "briefing", status: "missing", tone: "primary" },
      { id: "b", title: "Pay", description: "", detail: "", ctaLabel: "Open", icon: {} as never, targetTab: "billing", status: "pending", tone: "warning" },
    ]);
    expect(next?.id).toBe("b");
  });

  it("keeps action presentation deterministic when source order changes", () => {
    const items: PrismClientActionItem[] = [
      { id: "z", eventId: "evt_1", eventName: "Summit", kind: "briefing", priority: "attention", label: "Z", description: "", status: "missing" },
      { id: "a", eventId: "evt_1", eventName: "Summit", kind: "briefing", priority: "attention", label: "A", description: "", status: "missing" },
    ];
    const toIds = (source: typeof items) => selectClientDashboardActions({ items }, "evt_1").map((item) => item.id);
    expect(toIds(items)).toEqual(toIds([...items].reverse()));
    expect(toIds(items)).toEqual(["a", "z"]);
  });
});
