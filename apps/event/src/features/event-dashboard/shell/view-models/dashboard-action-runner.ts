export type DashboardActionRefreshers = {
  /** The portal-wide reads (reference, approvals, command inbox, or the coordinator workspace). */
  refresh: () => Promise<unknown>;
  refreshSelectedEventWorkspace: () => Promise<unknown>;
  /** Best-effort: a live-ops refresh failure never fails the command that already succeeded. */
  loadLiveOps?: () => Promise<unknown>;
};

/** What the PMCM sees when a command went through: the action's own name, so a save is never silent. */
export function dashboardActionSuccessToast(actionLabel: string): { title: string; description: string } {
  const label = actionLabel.trim();
  return { title: label.charAt(0).toUpperCase() + label.slice(1), description: "Done." };
}

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

/**
 * Runs one PMCM command: says it went through as soon as it has, then refreshes what the screen shows. A failed
 * command is reported and announces nothing; a refresh failure is reported but does not undo the announcement.
 */
export async function runDashboardAction(
  actionLabel: string,
  action: () => Promise<unknown>,
  refreshers: DashboardActionRefreshers,
  { reportError, announce }: { reportError: (message: string) => void; announce: (toast: { title: string; description: string }) => void },
): Promise<void> {
  try {
    await action();
  } catch (error) {
    reportError(errorMessage(error));
    return;
  }
  announce(dashboardActionSuccessToast(actionLabel));
  try {
    await refreshAfterDashboardCommand(refreshers);
  } catch (error) {
    reportError(errorMessage(error));
  }
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
