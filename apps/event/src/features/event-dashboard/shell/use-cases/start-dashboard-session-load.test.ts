/** @vitest-environment jsdom */
import { beforeEach, describe, expect, it, vi } from "vitest";

const readStoredEventSessionMock = vi.hoisted(() => vi.fn());
const loadCoordinatorWorkspaceMock = vi.hoisted(() => vi.fn(async () => ({ events: [], assignments: [] })));
const loadApprovalRequestsMock = vi.hoisted(() => vi.fn(async () => []));
const loadCommandInboxMock = vi.hoisted(() => vi.fn(async () => null));

vi.mock("@/app/lib/session", () => ({ readStoredEventSession: readStoredEventSessionMock }));
vi.mock("./load-dashboard-workspace", () => ({
  getCachedCoordinatorWorkspace: vi.fn(() => null),
  isDashboardCacheFresh: vi.fn(() => false),
  loadCoordinatorWorkspace: loadCoordinatorWorkspaceMock,
}));
vi.mock("@/features/event-workspace/shell/use-cases/load-event-workspace", () => ({
  getCachedApprovalRequests: vi.fn(() => null),
  loadApprovalRequests: loadApprovalRequestsMock,
}));
vi.mock("@/features/command-inbox/list/use-cases/load-command-inbox", () => ({
  getCachedCommandInbox: vi.fn(() => null),
  loadCommandInbox: loadCommandInboxMock,
}));

import { startDashboardSessionLoad, type DashboardSessionLoadSetters } from "./start-dashboard-session-load";

function setters() {
  const router = { replace: vi.fn() };
  const value: DashboardSessionLoadSetters = {
    router,
    setStatus: vi.fn(),
    setSession: vi.fn(),
    setError: vi.fn(),
    setReference: vi.fn(),
    setCoordinatorState: vi.fn(),
    setApprovalRequests: vi.fn(),
    setCommandInbox: vi.fn(),
    setCommandInboxLoadFailed: vi.fn(),
  };
  return { router, value };
}

describe("coordinator session load on a PMCM URL", () => {
  beforeEach(() => {
    readStoredEventSessionMock.mockReset().mockReturnValue({ role: "coordinator", name: "Marco Santos", email: "marco@pmcm.test" });
    loadCoordinatorWorkspaceMock.mockClear();
    loadApprovalRequestsMock.mockClear();
    loadCommandInboxMock.mockClear();
    window.history.replaceState(null, "", "/");
  });

  it("sends a coordinator from a PMCM path home before any data loads", () => {
    window.history.replaceState(null, "", "/dashboard/events/evt_1/billing");
    const { router, value } = setters();

    startDashboardSessionLoad(value);

    expect(router.replace).toHaveBeenCalledWith("/dashboard?view=shift&notice=outside-portal");
    expect(loadApprovalRequestsMock).not.toHaveBeenCalled();
    expect(loadCommandInboxMock).not.toHaveBeenCalled();
    expect(loadCoordinatorWorkspaceMock).toHaveBeenCalledTimes(1);
  });

  it("keeps a coordinator on the home route where it already is", () => {
    window.history.replaceState(null, "", "/dashboard?view=tasks&event=evt_1");
    const { router, value } = setters();

    startDashboardSessionLoad(value);

    expect(router.replace).not.toHaveBeenCalled();
  });
});
