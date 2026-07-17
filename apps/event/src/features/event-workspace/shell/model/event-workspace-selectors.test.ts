import { describe, expect, it } from "vitest";
import type { PrismApprovalRequest, PrismEvent, PrismPmcmDashboardWorkspace, PrismPmcmEventWorkspace } from "@prism/types";
import {
  selectActiveEvents,
  selectEventWorkspaceResources,
  selectPendingApprovals,
  selectSelectedEvent,
  selectSelectedEventWorkspaceResources,
} from "./event-workspace-selectors";

function event(partial: Partial<PrismEvent> & Pick<PrismEvent, "id">): PrismEvent {
  return {
    eventName: partial.eventName ?? partial.id,
    clientName: partial.clientName ?? "Client",
    eventDate: partial.eventDate ?? "2026-08-01",
    status: partial.status ?? "planning",
    archived: partial.archived ?? false,
    ...partial,
  } as PrismEvent;
}

describe("event-workspace-selectors", () => {
  it("filters archived events out of active list", () => {
    const events = [
      event({ id: "e1", archived: false }),
      event({ id: "e2", archived: true }),
    ];
    expect(selectActiveEvents({ events }).map((entry) => entry.id)).toEqual(["e1"]);
  });

  it("selects explicit event or falls back to first", () => {
    const events = [event({ id: "e1" }), event({ id: "e2" })];
    expect(selectSelectedEvent(events, "e2")?.id).toBe("e2");
    expect(selectSelectedEvent(events, "missing")?.id).toBe("e1");
  });

  it("filters pending approvals", () => {
    const requests = [
      { id: "a1", status: "pending" },
      { id: "a2", status: "approved" },
    ] as PrismApprovalRequest[];
    expect(selectPendingApprovals(requests).map((entry) => entry.id)).toEqual(["a1"]);
  });

  it("prefers scoped event workspace resources over dashboard state", () => {
    const state = {
      floorPlanDrafts: [
        { id: "d-state", eventId: "e1", isActive: true },
        { id: "d-other", eventId: "e2", isActive: true },
      ],
      coordinatorAssignments: [{ id: "as-state", eventId: "e1" }],
      auditLogs: [],
      billingSources: [],
      billingStatements: [],
      briefings: [],
      complianceChecks: [],
      documents: [],
      eventInsights: [],
      notificationLogs: [],
      paymentMilestones: [],
      paymentRecords: [],
      postEventDocuments: [],
      supplierQuoteRequests: [],
      supplierQuotes: [],
    } as unknown as PrismPmcmDashboardWorkspace;

    const workspace = {
      event: event({ id: "e1" }),
      floorPlanDrafts: [{ id: "d-ws", eventId: "e1", isActive: true }],
      coordinatorAssignments: [{ id: "as-ws", eventId: "e1" }],
      auditLogs: [],
      billingSources: [],
      billingStatements: [],
      briefings: [],
      complianceChecks: [],
      documents: [],
      eventInsights: [],
      notificationLogs: [],
      paymentMilestones: [],
      paymentRecords: [],
      postEventDocuments: [],
      supplierQuoteRequests: [],
      supplierQuotes: [],
    } as unknown as PrismPmcmEventWorkspace;

    const scoped = selectEventWorkspaceResources(state, { id: "e1" }, workspace);
    expect(scoped.activeDraft?.id).toBe("d-ws");
    expect(scoped.assignments.map((entry) => entry.id)).toEqual(["as-ws"]);

    const selected = selectSelectedEventWorkspaceResources(
      state,
      [event({ id: "e1" }), event({ id: "e2" })],
      "e1",
      workspace,
    );
    expect(selected.selectedEvent?.id).toBe("e1");
    expect(selected.drafts.map((entry) => entry.id)).toEqual(["d-ws"]);
  });
});
