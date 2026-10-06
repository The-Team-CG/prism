/** @vitest-environment jsdom */
import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const loadEventCommandDataMock = vi.hoisted(() => vi.fn());
const routerMock = vi.hoisted(() => ({ replace: vi.fn() }));

vi.mock("next/navigation", () => ({ useRouter: () => routerMock }));
vi.mock("@/app/lib/role-guards", () => ({ isPmcmAdmin: (role: string) => role === "pmcm-admin" }));
vi.mock("@/features/floorplan/editor", () => ({ loadTemplates: vi.fn(async () => []) }));
vi.mock("@/features/event-workspace/shell", () => ({
  getCachedEventCommandData: vi.fn(() => null),
  loadApprovalRequests: vi.fn(async () => []),
  loadEventCommandData: loadEventCommandDataMock,
  eventWorkspaceRepository: { loadWorkspace: vi.fn(async () => null) },
  usePmcmSelectedEventWorkspace: () => ({ refresh: vi.fn(async () => {}), workspace: null }),
}));
vi.mock("@/features/command-inbox/list", () => ({ loadCommandInbox: vi.fn(async () => null) }));
vi.mock("../use-cases/load-dashboard-workspace", () => ({
  getCachedPmcmState: vi.fn(() => null),
  isDashboardCacheFresh: vi.fn(() => false),
  loadCoordinatorWorkspace: vi.fn(async () => null),
  loadPmcmState: vi.fn(async () => null),
}));
vi.mock("../use-cases/start-dashboard-session-load", () => ({
  startDashboardSessionLoad: ({ setSession }: { setSession: (session: unknown) => void }) => {
    setSession({ role: "pmcm-admin", name: "PMCM Admin", email: "admin@pmcm.test" });
    return () => {};
  },
}));

import { loadEventCommandData } from "@/features/event-workspace/shell";
import { useEventDashboardWorkspaceViewModel } from "./use-event-dashboard-workspace-view-model";

function eventData(eventId: string) {
  return {
    data: {
      liveOps: { event: { id: eventId }, tasks: [], urgentIssues: [], guestAttendanceCount: 0 },
      statusFeed: { event: { id: eventId }, items: [] },
      defenseReadiness: null,
      registrationPlatform: null,
      guestPrivacyClassification: { eventId, classification: "unclassified" },
    },
    errors: {},
  };
}

function renderWorkspace(eventId: string, tab: "live-ops" | "registration" = "live-ops") {
  return renderHook(
    ({ selectedEventId }: { selectedEventId: string | null }) =>
      useEventDashboardWorkspaceViewModel({
        selectedEventId,
        screenName: "portal",
        section: "events",
        tab,
      }),
    { initialProps: { selectedEventId: eventId } },
  );
}

describe("PMCM event-day live updates", () => {
  beforeEach(() => {
    vi.mocked(loadEventCommandData).mockReset();
    vi.mocked(loadEventCommandData).mockImplementation(async (eventId) => eventData(eventId) as never);
  });

  it("loads live-ops data once when opening the active desk", async () => {
    renderWorkspace("evt_1");

    await waitFor(() => expect(loadEventCommandData).toHaveBeenCalledWith("evt_1", true));
    expect(loadEventCommandData).toHaveBeenCalledTimes(1);
  });

  it("discards a previous event response after switching the active desk", async () => {
    let resolveFirst!: (value: never) => void;
    const firstEventRequest = new Promise<never>((resolve) => {
      resolveFirst = resolve;
    });
    vi.mocked(loadEventCommandData).mockImplementation(async (eventId) => {
      if (eventId === "evt_1") return firstEventRequest;
      return eventData(eventId) as never;
    });

    const { result, rerender, unmount } = renderWorkspace("evt_1");
    await waitFor(() => expect(loadEventCommandData).toHaveBeenCalledWith("evt_1", true));

    rerender({ selectedEventId: "evt_2" });
    await waitFor(() => expect(loadEventCommandData).toHaveBeenCalledWith("evt_2", true));
    await waitFor(() => expect(result.current.liveOps?.event.id).toBe("evt_2"));

    await act(async () => {
      resolveFirst(eventData("evt_1") as never);
    });
    expect(result.current.liveOps?.event.id).toBe("evt_2");
    unmount();
  });

  it("loads event guest privacy classification with registration command data", async () => {
    const { result } = renderWorkspace("evt_1", "registration");

    await waitFor(() => expect(loadEventCommandData).toHaveBeenCalledWith("evt_1", true));
    await waitFor(() => expect(result.current.guestPrivacyClassification).toEqual({
      eventId: "evt_1",
      classification: "unclassified",
    }));
  });
});
