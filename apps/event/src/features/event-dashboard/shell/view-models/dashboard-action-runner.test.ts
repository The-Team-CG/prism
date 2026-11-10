import { dashboardActionSuccessToast, runDashboardAction, runDashboardActionWithSuccess } from "./dashboard-action-runner";
import { describe, expect, it, vi } from "vitest";

describe("runDashboardActionWithSuccess", () => {
  it("returns false and reports the action error without refreshing", async () => {
    const refresh = vi.fn().mockResolvedValue(undefined);
    const reportError = vi.fn();

    const result = await runDashboardActionWithSuccess(
      () => Promise.reject(new Error("review rejected")),
      { refresh, refreshSelectedEventWorkspace: refresh },
      reportError,
    );

    expect(result).toBe(false);
    expect(reportError).toHaveBeenCalledWith("review rejected");
    expect(refresh).not.toHaveBeenCalled();
  });

  it("refreshes every read at once after the action, and a live-ops failure does not fail the command", async () => {
    let releaseReads: () => void = () => undefined;
    const reads = new Promise<void>((resolve) => {
      releaseReads = resolve;
    });
    const refresh = vi.fn(() => reads);
    const refreshSelectedEventWorkspace = vi.fn(() => reads);
    const loadLiveOps = vi.fn(() => Promise.reject(new Error("live ops offline")));
    const reportError = vi.fn();

    const pending = runDashboardActionWithSuccess(
      vi.fn().mockResolvedValue(undefined),
      { refresh, refreshSelectedEventWorkspace, loadLiveOps },
      reportError,
    );
    await vi.waitFor(() => expect(loadLiveOps).toHaveBeenCalled());
    // All three started while the first is still in flight: no read waits for another.
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(refreshSelectedEventWorkspace).toHaveBeenCalledTimes(1);

    releaseReads();
    await expect(pending).resolves.toBe(true);
    expect(reportError).not.toHaveBeenCalled();
  });
});

describe("runDashboardAction", () => {
  const refreshers = () => ({ refresh: vi.fn().mockResolvedValue(undefined), refreshSelectedEventWorkspace: vi.fn().mockResolvedValue(undefined) });

  it("says the command went through, by name, and then refreshes", async () => {
    const r = refreshers();
    const announce = vi.fn();
    const reportError = vi.fn();
    await runDashboardAction("supplier tier change", () => Promise.resolve(), r, { announce, reportError });

    expect(announce).toHaveBeenCalledWith({ title: "Supplier tier change", description: "Done." });
    expect(r.refresh).toHaveBeenCalledTimes(1);
    expect(reportError).not.toHaveBeenCalled();
  });

  it("announces nothing for a failed command and reports why, without refreshing", async () => {
    const r = refreshers();
    const announce = vi.fn();
    const reportError = vi.fn();
    await runDashboardAction("record payment", () => Promise.reject(new Error("Amount exceeds balance")), r, { announce, reportError });

    expect(announce).not.toHaveBeenCalled();
    expect(reportError).toHaveBeenCalledWith("Amount exceeds balance");
    expect(r.refresh).not.toHaveBeenCalled();
  });

  it("keeps the success when only the refresh afterwards fails, and reports the refresh problem", async () => {
    const r = { refresh: vi.fn().mockRejectedValue(new Error("Can't reach P.R.I.S.M right now. Try again in a moment.")), refreshSelectedEventWorkspace: vi.fn().mockResolvedValue(undefined) };
    const announce = vi.fn();
    const reportError = vi.fn();
    await runDashboardAction("send billing statement", () => Promise.resolve(), r, { announce, reportError });

    expect(announce).toHaveBeenCalledTimes(1);
    expect(reportError).toHaveBeenCalledWith("Can't reach P.R.I.S.M right now. Try again in a moment.");
  });

  it("titles the toast with the action's name", () => {
    expect(dashboardActionSuccessToast(" accept inquiry ")).toEqual({ title: "Accept inquiry", description: "Done." });
  });
});
