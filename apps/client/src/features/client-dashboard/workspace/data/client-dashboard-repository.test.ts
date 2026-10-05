import { describe, expect, it, vi } from "vitest";
import type { PrismClientWorkspace, PrismEvent } from "@prism/types";

const { detailMock } = vi.hoisted(() => ({ detailMock: vi.fn() }));

vi.mock("@/lib/prism-api", () => ({
  clientApi: {
    clientWorkspace: { detail: detailMock },
    inquiries: { create: vi.fn() },
  },
  clientApiRequest: vi.fn(),
}));

import { clientDashboardRepository } from "./client-dashboard-repository";

function event(id: string): PrismEvent {
  return {
    id,
    inquiryId: `inq_${id}`,
    clientName: "Ana Reyes",
    eventName: `Event ${id}`,
    eventDate: "2026-11-01T00:00:00.000Z",
    status: "planning",
    clientPortalStatus: "unlocked",
    readiness: "ready",
    archived: false,
    floorPlanStatus: "not_started",
  };
}

function workspacePage(
  events: PrismEvent[],
  nextCursor: string | null,
  hasMore: boolean,
): PrismClientWorkspace {
  return {
    users: [],
    inquiries: [],
    events,
    documents: [],
    briefings: [],
    supplierQuotes: [],
    coordinatorAssignments: [],
    complianceChecks: [],
    billingStatements: [],
    paymentMilestones: [],
    postEventDocuments: [],
    floorPlanDrafts: [],
    auditLogs: [],
    notificationLogs: [],
    clientEventTimelines: [],
    ocularVisits: [],
    pagination: { nextCursor, hasMore, totalCount: 2 },
  };
}

describe("clientDashboardRepository.loadWorkspace", () => {
  it("follows every server cursor and merges the client event pages", async () => {
    detailMock
      .mockResolvedValueOnce(workspacePage([event("evt_a")], "cursor-2", true))
      .mockResolvedValueOnce(workspacePage([event("evt_b")], null, false));

    const workspace = await clientDashboardRepository.loadWorkspace();

    expect(detailMock).toHaveBeenNthCalledWith(1, {}, undefined);
    expect(detailMock).toHaveBeenNthCalledWith(2, {}, "cursor-2");
    expect(workspace.events.map((item) => item.id)).toEqual(["evt_a", "evt_b"]);
    expect(workspace.pagination).toEqual({
      nextCursor: null,
      hasMore: false,
      totalCount: 2,
    });
  });
});
