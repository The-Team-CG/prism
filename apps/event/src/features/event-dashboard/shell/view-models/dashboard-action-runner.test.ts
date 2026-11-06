import { runDashboardActionWithSuccess } from "./dashboard-action-runner";
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
