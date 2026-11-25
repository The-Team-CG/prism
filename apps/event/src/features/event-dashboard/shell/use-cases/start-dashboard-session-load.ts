import type {
  PrismPmcmCommandInbox,
  PrismApprovalRequest,
} from "@prism/types";
import { portalAppPath } from "@prism/ui/portal-path";
import type { EventSession } from "@/app/lib/session";
import { readStoredEventSession } from "@/app/lib/session";
import { getCachedApprovalRequests, loadApprovalRequests } from "@/features/event-workspace/shell/use-cases/load-event-workspace";
import { getCachedCommandInbox, loadCommandInbox } from "@/features/command-inbox/list/use-cases/load-command-inbox";
import { isDashboardCacheFresh } from "./load-dashboard-workspace";
import {
  COORDINATOR_HOME_PATH,
  coordinatorLocationRedirect,
  isCoordinatorHomePath,
} from "@/features/coordinators/desk/model/coordinator-portal-routes";

type WorkspaceStatus = "idle" | "loading" | "ready" | "error";

type TimedCache<T> = { value: T; loadedAt: number };

export type DashboardSessionLoadSetters = {
  router: { replace: (href: string) => void };
  setStatus: (status: WorkspaceStatus) => void;
  setSession: (session: EventSession) => void;
  setError: (error: string | null) => void;
  setReference: (reference: null) => void;
  setApprovalRequests: (requests: PrismApprovalRequest[]) => void;
  setCommandInbox: (inbox: PrismPmcmCommandInbox) => void;
  setCommandInboxLoadFailed: (failed: boolean) => void;
};

function isCachedFresh<T>(cached: TimedCache<T> | null | undefined) {
  return Boolean(cached && isDashboardCacheFresh(cached.loadedAt));
}

function portalLoadError(err: unknown) {
  return err instanceof Error ? err.message : "Unable to load event portal";
}

function resolveCachedOrLoad<T>(
  fresh: boolean,
  cached: TimedCache<T> | null | undefined,
  load: (force: boolean) => Promise<T>,
) {
  if (fresh && cached) return Promise.resolve(cached.value);
  return load(!cached);
}

function resolveInbox(
  fresh: boolean,
  cached: TimedCache<PrismPmcmCommandInbox> | null | undefined,
) {
  if (fresh && cached) return Promise.resolve(cached.value);
  return Promise.resolve().then(() => loadCommandInbox(!cached));
}

function loadPmcmDashboard(isCancelled: () => boolean, setters: DashboardSessionLoadSetters) {
  const cachedApprovals = getCachedApprovalRequests();
  const cachedInbox = getCachedCommandInbox();

  setters.setReference(null);
  if (cachedApprovals) setters.setApprovalRequests(cachedApprovals.value);
  if (cachedInbox) setters.setCommandInbox(cachedInbox.value);

  const approvalsAreFresh = isCachedFresh(cachedApprovals);
  const inboxIsFresh = isCachedFresh(cachedInbox);
  if (approvalsAreFresh && inboxIsFresh) {
    setters.setStatus("ready");
    return;
  }

  Promise.all([
    resolveCachedOrLoad(approvalsAreFresh, cachedApprovals, loadApprovalRequests),
    resolveInbox(inboxIsFresh, cachedInbox),
  ])
    .then(([requests, inboxResult]) => {
      if (isCancelled()) return;
      setters.setApprovalRequests(requests);
      setters.setCommandInbox(inboxResult);
      setters.setCommandInboxLoadFailed(false);
      setters.setStatus("ready");
      setters.setError(null);
    })
    .catch((err) => {
      if (isCancelled()) return;
      setters.setStatus("error");
      setters.setCommandInboxLoadFailed(true);
      setters.setError(portalLoadError(err));
    });
}

/**
 * A coordinator on a PMCM URL is sent to the coordinator portal before any data loads. The decision uses only the URL
 * and the stored session, so no PMCM read is started for a page the coordinator cannot see.
 */
function redirectCoordinatorOffPmcmPath(router: DashboardSessionLoadSetters["router"]) {
  // The browser path carries the hosting prefix (/event in service mode); the coordinator routes are app paths.
  const pathname = portalAppPath(window.location.pathname);
  const { search } = window.location;
  if (isCoordinatorHomePath(pathname)) return;
  const redirect = coordinatorLocationRedirect({ pathname, search });
  if (redirect) router.replace(`${COORDINATOR_HOME_PATH}${redirect.search}`);
}

export function startDashboardSessionLoad(setters: DashboardSessionLoadSetters) {
  let cancelled = false;
  const isCancelled = () => cancelled;
  const current = readStoredEventSession();
  if (!current) {
    setters.setStatus("loading");
    setters.router.replace("/sign-in?next=/dashboard");
    return () => {
      cancelled = true;
    };
  }

  setters.setStatus("loading");
  setters.setSession(current);
  setters.setError(null);

  if (current.role === "coordinator") {
    // Coordinators have their own portal; none of the PMCM dashboard's data is read for them.
    redirectCoordinatorOffPmcmPath(setters.router);
    return () => {
      cancelled = true;
    };
  }

  if (current.role !== "pmcm-admin") {
    setters.setStatus("ready");
    return () => {
      cancelled = true;
    };
  }

  loadPmcmDashboard(isCancelled, setters);
  return () => {
    cancelled = true;
  };
}
