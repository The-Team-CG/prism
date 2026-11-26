/** @vitest-environment jsdom */
import { beforeEach, describe, expect, it, vi } from "vitest";

const readStoredEventSessionMock = vi.hoisted(() => vi.fn());
const loadApprovalRequestsMock = vi.hoisted(() => vi.fn(async () => []));
const loadCommandInboxMock = vi.hoisted(() => vi.fn(async () => null));

vi.mock("@/app/lib/session", () => ({ readStoredEventSession: readStoredEventSessionMock }));
vi.mock("./load-dashboard-workspace", () => ({
  isDashboardCacheFresh: vi.fn(() => false),
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
    setApprovalRequests: vi.fn(),
    setCommandInbox: vi.fn(),
    setCommandInboxLoadFailed: vi.fn(),
  };
  return { router, value };
}

describe("coordinator session load on a PMCM URL", () => {
  beforeEach(() => {
    readStoredEventSessionMock.mockReset().mockReturnValue({ role: "coordinator", name: "Marco Santos", email: "marco@pmcm.test" });
    loadApprovalRequestsMock.mockClear();
    loadCommandInboxMock.mockClear();
    window.history.replaceState(null, "", "/");
  });

  it("sends a coordinator from a PMCM page to the coordinator portal without reading any dashboard data", () => {
    window.history.replaceState(null, "", "/dashboard/events/evt_1/billing");
    const { router, value } = setters();

    startDashboardSessionLoad(value);

    expect(router.replace).toHaveBeenCalledWith("/coordinator?view=shift&notice=outside-portal");
    expect(loadApprovalRequestsMock).not.toHaveBeenCalled();
    expect(loadCommandInboxMock).not.toHaveBeenCalled();
  });

  it("keeps the view and event of a link to the coordinator's old home", () => {
    window.history.replaceState(null, "", "/dashboard?view=tasks&event=evt_1");
    const { router, value } = setters();

    startDashboardSessionLoad(value);

    expect(router.replace).toHaveBeenCalledWith("/coordinator?view=tasks&event=evt_1");
  });

  it("reads the old home under the portal's /event prefix the same way", () => {
    vi.stubEnv("NEXT_PUBLIC_PORTAL_BASE_PATH", "/event");
    try {
      window.history.replaceState(null, "", "/event/dashboard/messages?event=evt_1");
      const { router, value } = setters();

      startDashboardSessionLoad(value);

      expect(router.replace).toHaveBeenCalledWith("/coordinator?event=evt_1&view=messages");
    } finally {
      vi.unstubAllEnvs();
    }
  });
});
