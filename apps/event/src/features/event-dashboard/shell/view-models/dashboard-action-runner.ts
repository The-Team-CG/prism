export type DashboardActionRefreshers = {
  refresh: () => Promise<unknown>;
  refreshSelectedEventWorkspace: () => Promise<unknown>;
  refreshApprovals: () => Promise<unknown>;
  loadLiveOps?: () => Promise<unknown>;
};

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Action failed";
}

export async function runDashboardActionWithSuccess(
  action: () => Promise<unknown>,
  refreshers: DashboardActionRefreshers,
  reportError: (message: string) => void,
): Promise<boolean> {
  try {
    await action();
    await refreshers.refresh();
    await refreshers.refreshSelectedEventWorkspace();
    await refreshers.refreshApprovals();
    if (refreshers.loadLiveOps) {
      await refreshers.loadLiveOps().catch(() => undefined);
    }
    return true;
  } catch (error) {
    reportError(errorMessage(error));
    return false;
  }
}
