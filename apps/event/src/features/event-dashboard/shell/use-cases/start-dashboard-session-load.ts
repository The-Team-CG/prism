import type {
  PrismCoordinatorWorkspace,
  PrismPmcmCommandInbox,
  PrismPmcmDashboardWorkspace,
  PrismApprovalRequest,
} from "@prism/types";
import type { EventSession } from "@/app/lib/session";
import { readStoredEventSession } from "@/app/lib/session";
import { getCachedApprovalRequests, loadApprovalRequests } from "@/features/event-workspace/shell";
import { getCachedCommandInbox, loadCommandInbox } from "@/features/command-inbox/list";
import {
  getCachedCoordinatorWorkspace,
  getCachedPmcmState,
  isDashboardCacheFresh,
  loadCoordinatorWorkspace,
  loadPmcmState,
} from "./load-dashboard-workspace";

type WorkspaceStatus = "idle" | "loading" | "ready" | "error";

type TimedCache<T> = { value: T; loadedAt: number };

export type DashboardSessionLoadSetters = {
  router: { replace: (href: string) => void };
  setStatus: (status: WorkspaceStatus) => void;
  setSession: (session: EventSession) => void;
  setError: (error: string | null) => void;
  setState: (state: PrismPmcmDashboardWorkspace | null) => void;
  setCoordinatorState: (state: PrismCoordinatorWorkspace | null) => void;
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

function loadCoordinatorDashboard(
  current: EventSession,
  isCancelled: () => boolean,
  setters: DashboardSessionLoadSetters,
) {
  const cached = getCachedCoordinatorWorkspace(current);
  if (cached) {
    setters.setCoordinatorState(cached.value);
    setters.setState(null);
    if (isDashboardCacheFresh(cached.loadedAt)) {
      setters.setStatus("ready");
      return;
    }
  }

  loadCoordinatorWorkspace(current, !cached)
    .then((next) => {
      if (isCancelled()) return;
      setters.setCoordinatorState(next);
      setters.setState(null);
      setters.setStatus("ready");
      setters.setError(null);
    })
    .catch((err) => {
      if (isCancelled()) return;
      setters.setStatus("error");
      setters.setError(portalLoadError(err));
    });
}

function loadPmcmDashboard(isCancelled: () => boolean, setters: DashboardSessionLoadSetters) {
  const cachedState = getCachedPmcmState();
  const cachedApprovals = getCachedApprovalRequests();
  const cachedInbox = getCachedCommandInbox();

  if (cachedState) {
    setters.setState(cachedState.value);
    setters.setCoordinatorState(null);
  }
  if (cachedApprovals) setters.setApprovalRequests(cachedApprovals.value);
  if (cachedInbox) setters.setCommandInbox(cachedInbox.value);

  const stateIsFresh = isCachedFresh(cachedState);
  const approvalsAreFresh = isCachedFresh(cachedApprovals);
  const inboxIsFresh = isCachedFresh(cachedInbox);
  if (stateIsFresh && approvalsAreFresh && inboxIsFresh) {
    setters.setStatus("ready");
    return;
  }

  Promise.all([
    resolveCachedOrLoad(stateIsFresh, cachedState, loadPmcmState),
    resolveCachedOrLoad(approvalsAreFresh, cachedApprovals, loadApprovalRequests),
    resolveInbox(inboxIsFresh, cachedInbox),
  ])
    .then(([next, requests, inboxResult]) => {
      if (isCancelled()) return;
      setters.setState(next);
      setters.setApprovalRequests(requests);
      setters.setCommandInbox(inboxResult);
      setters.setCommandInboxLoadFailed(false);
      setters.setCoordinatorState(null);
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
    loadCoordinatorDashboard(current, isCancelled, setters);
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
