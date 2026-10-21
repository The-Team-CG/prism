import { runDashboardActionWithSuccess } from "./dashboard-action-runner";
import { describe, expect, it, vi } from "vitest";

describe("runDashboardActionWithSuccess", () => {
  it("returns false and reports the action error without refreshing", async () => {
    const refresh = vi.fn().mockResolvedValue(undefined);
    const reportError = vi.fn();

    const result = await runDashboardActionWithSuccess(
      () => Promise.reject(new Error("review rejected")),
      { refresh, refreshSelectedEventWorkspace: refresh, refreshApprovals: refresh },
      reportError,
    );

    expect(result).toBe(false);
    expect(reportError).toHaveBeenCalledWith("review rejected");
    expect(refresh).not.toHaveBeenCalled();
  });

  it("returns true after the action and refresh sequence succeeds", async () => {
    const refresh = vi.fn().mockResolvedValue(undefined);
    const reportError = vi.fn();

    const result = await runDashboardActionWithSuccess(
      vi.fn().mockResolvedValue(undefined),
      { refresh, refreshSelectedEventWorkspace: refresh, refreshApprovals: refresh, loadLiveOps: refresh },
      reportError,
    );

    expect(result).toBe(true);
    expect(refresh).toHaveBeenCalledTimes(4);
    expect(reportError).not.toHaveBeenCalled();
  });
});
