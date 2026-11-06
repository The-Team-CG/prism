export type DashboardActionRefreshers = {
  /** The portal-wide reads (reference, approvals, command inbox, or the coordinator workspace). */
  refresh: () => Promise<unknown>;
  refreshSelectedEventWorkspace: () => Promise<unknown>;
  /** Best-effort: a live-ops refresh failure never fails the command that already succeeded. */
  loadLiveOps?: () => Promise<unknown>;
};

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Action failed";
}

/** After a command, every read the screen shows refreshes at once: one round of waiting instead of one per read. */
export async function refreshAfterDashboardCommand(refreshers: DashboardActionRefreshers): Promise<void> {
  await Promise.all([
    refreshers.refresh(),
    refreshers.refreshSelectedEventWorkspace(),
    refreshers.loadLiveOps?.().catch(() => undefined),
  ]);
}

export async function runDashboardActionWithSuccess(
  action: () => Promise<unknown>,
  refreshers: DashboardActionRefreshers,
  reportError: (message: string) => void,
): Promise<boolean> {
  try {
    await action();
    await refreshAfterDashboardCommand(refreshers);
    return true;
  } catch (error) {
    reportError(errorMessage(error));
    return false;
  }
}
