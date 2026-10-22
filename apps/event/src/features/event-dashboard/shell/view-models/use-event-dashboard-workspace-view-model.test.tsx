/** @vitest-environment jsdom */
import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const loadEventCommandDataMock = vi.hoisted(() => vi.fn());
const loadTemplatesMock = vi.hoisted(() => vi.fn());
const loadPmcmStateMock = vi.hoisted(() => vi.fn());
const loadApprovalRequestsMock = vi.hoisted(() => vi.fn());
const loadCommandInboxMock = vi.hoisted(() => vi.fn());
const eventWorkspaceLoadMock = vi.hoisted(() => vi.fn());
const selectedEventWorkspaceHookMock = vi.hoisted(() => vi.fn());
const routerMock = vi.hoisted(() => ({ replace: vi.fn() }));

vi.mock("next/navigation", () => ({ useRouter: () => routerMock }));
vi.mock("@/app/lib/role-guards", () => ({ isPmcmAdmin: (role: string) => role === "pmcm-admin" }));
vi.mock("@/features/floorplan/editor", () => ({ loadTemplates: loadTemplatesMock }));
vi.mock("@/features/event-workspace/shell", () => ({
  getCachedEventCommandData: vi.fn(() => null),
  loadApprovalRequests: loadApprovalRequestsMock,
  loadEventCommandData: loadEventCommandDataMock,
  eventWorkspaceRepository: { loadWorkspace: eventWorkspaceLoadMock },
  usePmcmSelectedEventWorkspace: selectedEventWorkspaceHookMock,
}));
vi.mock("@/features/command-inbox/list", () => ({ loadCommandInbox: loadCommandInboxMock }));
vi.mock("../use-cases/load-dashboard-workspace", () => ({
  getCachedPmcmState: vi.fn(() => null),
  isDashboardCacheFresh: vi.fn(() => false),
  loadCoordinatorWorkspace: vi.fn(async () => null),
  loadPmcmState: loadPmcmStateMock,
}));
vi.mock("../use-cases/start-dashboard-session-load", () => ({
  startDashboardSessionLoad: ({ setSession }: { setSession: (session: unknown) => void }) => {
    setSession({ role: "pmcm-admin", name: "PMCM Admin", email: "admin@pmcm.test" });
    return () => {};
  },
}));

import { eventWorkspaceRepository, loadApprovalRequests, loadEventCommandData, usePmcmSelectedEventWorkspace } from "@/features/event-workspace/shell";
import { loadTemplates } from "@/features/floorplan/editor";
import { loadCommandInbox } from "@/features/command-inbox/list";
import { loadPmcmState } from "../use-cases/load-dashboard-workspace";
import type { DashboardSection, DetailTab } from "../model/event-dashboard-routing";
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

function renderWorkspace(eventId: string | null, section: DashboardSection = "events", tab: DetailTab = "live-ops") {
  return renderHook(
    ({ selectedEventId, routeSection, routeTab }: { selectedEventId: string | null; routeSection: DashboardSection; routeTab: DetailTab }) =>
      useEventDashboardWorkspaceViewModel({
        selectedEventId,
        screenName: "portal",
        section: routeSection,
        tab: routeTab,
      }),
    { initialProps: { selectedEventId: eventId, routeSection: section, routeTab: tab } },
  );
}

describe("PMCM event-day live updates", () => {
  beforeEach(() => {
    vi.useRealTimers();
    vi.mocked(loadEventCommandData).mockReset();
    vi.mocked(loadEventCommandData).mockImplementation(async (eventId) => eventData(eventId) as never);
    vi.mocked(loadTemplates).mockReset().mockResolvedValue([]);
    vi.mocked(loadPmcmState).mockReset().mockResolvedValue(null as never);
    vi.mocked(loadApprovalRequests).mockReset().mockResolvedValue([]);
    vi.mocked(loadCommandInbox).mockReset().mockResolvedValue(null as never);
    vi.mocked(eventWorkspaceRepository.loadWorkspace).mockReset().mockImplementation(async () => null as never);
    vi.mocked(usePmcmSelectedEventWorkspace).mockReset().mockImplementation(({ eventId, loadWorkspace }: any) => {
      if (eventId) void loadWorkspace(eventId);
      return { refresh: vi.fn(async () => {}), workspace: null } as never;
    });
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

    rerender({ selectedEventId: "evt_2", routeSection: "events", routeTab: "live-ops" });
    await waitFor(() => expect(loadEventCommandData).toHaveBeenCalledWith("evt_2", true));
    await waitFor(() => expect(result.current.liveOps?.event.id).toBe("evt_2"));

    await act(async () => {
      resolveFirst(eventData("evt_1") as never);
    });
    expect(result.current.liveOps?.event.id).toBe("evt_2");
    unmount();
  });

  it("loads event guest privacy classification with registration command data", async () => {
    const { result } = renderWorkspace("evt_1", "events", "registration");

    await waitFor(() => expect(loadEventCommandData).toHaveBeenCalledWith("evt_1", true));
    await waitFor(() => expect(result.current.guestPrivacyClassification).toEqual({
      eventId: "evt_1",
      classification: "unclassified",
    }));
  });
  it("keeps the global supplier route independent from retained event and dashboard loaders", async () => {
    vi.useFakeTimers();
    const { rerender, unmount } = renderWorkspace("evt_retained", "suppliers", "overview");

    await act(async () => { await Promise.resolve(); });
    expect(loadPmcmState).not.toHaveBeenCalled();
    expect(loadTemplates).not.toHaveBeenCalled();
    expect(loadEventCommandData).not.toHaveBeenCalled();
    expect(eventWorkspaceRepository.loadWorkspace).not.toHaveBeenCalled();
    expect(vi.mocked(usePmcmSelectedEventWorkspace).mock.calls[0]?.[0].eventId).toBeNull();

    rerender({ selectedEventId: "evt_retained", routeSection: "dashboard", routeTab: "overview" });
    await act(async () => { await Promise.resolve(); });
    const templateLoadsBeforeSupplierReturn = vi.mocked(loadTemplates).mock.calls.length;
    const eventCommandLoadsBeforeSupplierReturn = vi.mocked(loadEventCommandData).mock.calls.length;
    const eventWorkspaceLoadsBeforeSupplierReturn = vi.mocked(eventWorkspaceRepository.loadWorkspace).mock.calls.length;

    rerender({ selectedEventId: "evt_retained", routeSection: "suppliers", routeTab: "overview" });
    await act(async () => { await Promise.resolve(); });
    await act(async () => { await vi.advanceTimersByTimeAsync(30_000); });

    expect(loadPmcmState).not.toHaveBeenCalled();
    expect(loadTemplates).toHaveBeenCalledTimes(templateLoadsBeforeSupplierReturn);
    expect(loadEventCommandData).toHaveBeenCalledTimes(eventCommandLoadsBeforeSupplierReturn);
    expect(eventWorkspaceRepository.loadWorkspace).toHaveBeenCalledTimes(eventWorkspaceLoadsBeforeSupplierReturn);
    expect(loadApprovalRequests).toHaveBeenCalled();
    expect(loadCommandInbox).toHaveBeenCalled();
    unmount();
  });

  it("keeps selected event routes loading their event workspace and commands", async () => {
    renderWorkspace("evt_1", "events", "overview");

    await waitFor(() => expect(loadEventCommandData).toHaveBeenCalledWith("evt_1", true));
    expect(eventWorkspaceRepository.loadWorkspace).toHaveBeenCalledWith("evt_1");
    expect(loadPmcmState).toHaveBeenCalled();
    expect(loadTemplates).toHaveBeenCalled();
  });
});
