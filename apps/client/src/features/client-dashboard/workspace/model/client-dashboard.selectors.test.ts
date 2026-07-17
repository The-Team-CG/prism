import { describe, expect, it } from "vitest";
import {
  selectClientEvents,
  selectEventDrafts,
  selectEventWorkspaceResources,
  selectSelectedClientEvent,
} from "./client-dashboard.selectors";
import type { PrismClientWorkspace, PrismEvent, PrismUser } from "@prism/types";

const session = { name: "Ana Reyes" } as Pick<PrismUser, "name">;

const events: PrismEvent[] = [
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
  {
    id: "evt_2",
    inquiryId: "inq_2",
    clientName: "Other Client",
    eventName: "Gala",
    eventDate: "2026-09-01",
    status: "briefing",
    clientPortalStatus: "unlocked",
    readiness: "open",
    archived: false,
    floorPlanStatus: "not_started",
    floorPlanId: null,
  },
  {
    id: "evt_3",
    inquiryId: "inq_3",
    clientName: "Ana Reyes",
    eventName: "Archived",
    eventDate: "2025-01-01",
    status: "archived",
    clientPortalStatus: "unlocked",
    readiness: "closed",
    archived: true,
    floorPlanStatus: "approved",
    floorPlanId: "plan_1",
  },
  {
    id: "evt_4",
    inquiryId: "inq_4",
    clientName: "Ana Reyes",
    eventName: "Locked",
    eventDate: "2026-10-01",
    status: "briefing",
    clientPortalStatus: "locked",
    readiness: "pending",
    archived: false,
    floorPlanStatus: "not_started",
    floorPlanId: null,
  },
];

const workspace = {
  events,
  floorPlanDrafts: [
    {
      id: "fpd_1",
      eventId: "evt_1",
      floorPlanId: "plan_a",
      name: "Draft A",
      status: "client_submitted",
      isActive: false,
      sourceType: "client_preference",
      createdByRole: "client",
      createdAt: "2026-01-01",
      updatedAt: "2026-01-01",
    },
    {
      id: "fpd_2",
      eventId: "evt_2",
      floorPlanId: "plan_b",
      name: "Draft B",
      status: "approved",
      isActive: true,
      sourceType: "blank",
      createdByRole: "pmcm-admin",
      createdAt: "2026-01-01",
      updatedAt: "2026-01-01",
    },
  ],
  auditLogs: [{ id: "a1", eventId: "evt_1" }, { id: "a2", eventId: "evt_2" }],
  billingStatements: [{ id: "b1", eventId: "evt_1" }],
  briefings: [{ eventId: "evt_1" }],
  documents: [{ id: "d1", eventId: "evt_1" }, { id: "d2", eventId: "evt_2" }],
  notificationLogs: [{ id: "n1", eventId: "evt_1" }],
  paymentMilestones: [{ id: "p1", eventId: "evt_1" }],
} as unknown as PrismClientWorkspace;

describe("client-dashboard selectors", () => {
  it("selects unlocked non-archived events for the session client", () => {
    expect(selectClientEvents(workspace, session).map((event) => event.id)).toEqual(["evt_1"]);
    expect(selectClientEvents(null, session)).toEqual([]);
    expect(selectClientEvents(workspace, null)).toEqual([]);
  });

  it("selects the preferred event by route id, then selection, then first", () => {
    const clientEvents = selectClientEvents(workspace, session);
    expect(selectSelectedClientEvent(clientEvents, "evt_1")?.id).toBe("evt_1");
    expect(selectSelectedClientEvent(clientEvents, undefined, "evt_1")?.id).toBe("evt_1");
    expect(selectSelectedClientEvent(clientEvents)?.id).toBe("evt_1");
  });

  it("filters drafts for the selected event", () => {
    expect(selectEventDrafts(workspace, { id: "evt_1" }).map((draft) => draft.id)).toEqual(["fpd_1"]);
    expect(selectEventDrafts(workspace, undefined)).toEqual([]);
  });

  it("scopes workspace resources to the selected event", () => {
    const resources = selectEventWorkspaceResources(workspace, { id: "evt_1" });
    expect(resources.briefing).toEqual({ eventId: "evt_1" });
    expect(resources.billing).toEqual({ id: "b1", eventId: "evt_1" });
    expect(resources.documents).toHaveLength(1);
    expect(resources.payments).toHaveLength(1);
    expect(selectEventWorkspaceResources(null, { id: "evt_1" }).documents).toEqual([]);
  });
});
