import { describe, expect, it } from "vitest";
import type { PrismApprovalRequest, PrismEvent, PrismPmcmEventWorkspace } from "@prism/types";
import {
  selectActiveEvents,
  selectEventWorkspaceResources,
  selectPendingApprovals,
  selectSelectedEvent,
  selectSelectedEventWorkspaceResources,
} from "./pmcm-dashboard-selectors";

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

  it("only resolves a selected event when an id is present and authorized in the loaded list", () => {
    const events = [event({ id: "e1" }), event({ id: "e2" })];
    expect(selectSelectedEvent(events, "e2")?.id).toBe("e2");
    expect(selectSelectedEvent(events, "missing")).toBeUndefined();
    expect(selectSelectedEvent(events)).toBeUndefined();
  });

  it("filters pending approvals", () => {
    const requests = [
      { id: "a1", status: "pending" },
      { id: "a2", status: "approved" },
    ] as PrismApprovalRequest[];
    expect(selectPendingApprovals(requests).map((entry) => entry.id)).toEqual(["a1"]);
  });

  it("reads event resources only from that event's own workspace", () => {
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

    const scoped = selectEventWorkspaceResources({ id: "e1" }, workspace);
    expect(scoped.activeDraft?.id).toBe("d-ws");
    expect(scoped.assignments.map((entry) => entry.id)).toEqual(["as-ws"]);
    // Another event's workspace never leaks in; until the right one loads, every list is empty.
    const other = selectEventWorkspaceResources({ id: "e2" }, workspace);
    expect(other.drafts).toEqual([]);
    expect(other.assignments).toEqual([]);

    const selected = selectSelectedEventWorkspaceResources(
      [event({ id: "e1" }), event({ id: "e2" })],
      "e1",
      workspace,
    );
    expect(selected.selectedEvent?.id).toBe("e1");
    expect(selected.drafts.map((entry) => entry.id)).toEqual(["d-ws"]);
  });
});
