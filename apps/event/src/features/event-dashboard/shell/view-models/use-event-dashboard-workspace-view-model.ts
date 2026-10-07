"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type {
  PrismApprovalRequest,
  PrismCoordinatorWorkspace,
  PrismDefenseReadiness,
  PrismEventDayStatusFeed,
  PrismGuestPrivacyClassification,
  PrismLiveOps,
  PrismPmcmCommandInbox,
  PrismPmcmDashboardWorkspace,
  PrismRegistrationPlatform,
} from "@prism/types";
import { isPmcmAdmin } from "@/app/lib/role-guards";
import { type EventSession } from "@/app/lib/session";
import { loadTemplates, type FloorPlanTemplate } from "@/features/floorplan/editor";
import {
  getCachedEventCommandData,
  loadApprovalRequests,
  loadEventCommandData,
  type EventCommandDataErrors,
} from "@/features/event-workspace/shell";
import { loadCommandInbox } from "@/features/command-inbox/list";
import { eventWorkspaceRepository } from "@/features/event-workspace/shell";
import {
  getCachedPmcmState,
  isDashboardCacheFresh,
  loadCoordinatorWorkspace,
  loadPmcmState,
} from "../use-cases/load-dashboard-workspace";
import { startDashboardSessionLoad } from "../use-cases/start-dashboard-session-load";
import { usePmcmSelectedEventWorkspace } from "@/features/event-workspace/shell";
import { useEventDayLiveUpdates } from "@/features/live-ops/workspace";
import type { DashboardSection, DetailTab } from "../model/event-dashboard-routing";

type ScreenName = "portal" | "editor";
type WorkspaceStatus = "idle" | "loading" | "ready" | "error";

const EVENT_WORKSPACE_CACHE_MS = 20_000;

function isFresh(loadedAt: number, ttl?: number) {
  if (ttl == null) return isDashboardCacheFresh(loadedAt);
  return Date.now() - loadedAt < ttl;
}

export function useEventDashboardWorkspaceViewModel({
  selectedEventId,
  screenName,
  section,
  tab,
}: {
  selectedEventId: string | null;
  screenName: ScreenName;
  section: DashboardSection;
  tab: DetailTab;
}) {
  const router = useRouter();
  const [session, setSession] = useState<EventSession | null>(null);
  const [status, setStatus] = useState<WorkspaceStatus>("idle");
  const [state, setState] = useState<PrismPmcmDashboardWorkspace | null>(null);
  const [coordinatorState, setCoordinatorState] = useState<PrismCoordinatorWorkspace | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [approvalRequests, setApprovalRequests] = useState<PrismApprovalRequest[]>([]);
  const [liveOps, setLiveOps] = useState<PrismLiveOps | null>(null);
  const [statusFeed, setStatusFeed] = useState<PrismEventDayStatusFeed | null>(null);
  const [defenseReadiness, setDefenseReadiness] = useState<PrismDefenseReadiness | null>(null);
  const [registrationPlatform, setRegistrationPlatform] = useState<PrismRegistrationPlatform | null>(null);
  const [guestPrivacyClassification, setGuestPrivacyClassification] = useState<PrismGuestPrivacyClassification | null>(null);
  const [floorPlanTemplates, setFloorPlanTemplates] = useState<FloorPlanTemplate[]>([]);
  const [commandInbox, setCommandInbox] = useState<PrismPmcmCommandInbox | null>(null);
  const [conformeUploadTarget, setConformeUploadTarget] = useState<PrismPmcmDashboardWorkspace["inquiries"][number] | null>(null);
  const [commandInboxLoadFailed, setCommandInboxLoadFailed] = useState(false);
  const [commandDataErrors, setCommandDataErrors] = useState<EventCommandDataErrors>({});
  const activeEventCommandDataIdRef = useRef<string | null>(selectedEventId);
  const eventCommandDataRequestIdRef = useRef(0);
  if (activeEventCommandDataIdRef.current !== selectedEventId) {
    activeEventCommandDataIdRef.current = selectedEventId;
    eventCommandDataRequestIdRef.current += 1;
  }

  const reportSelectedEventWorkspaceError = useCallback((err: unknown) => {
    setError(err instanceof Error ? err.message : "Unable to load selected event workspace");
  }, []);
  const {
    refresh: refreshSelectedEventWorkspace,
    workspace: selectedEventWorkspace,
  } = usePmcmSelectedEventWorkspace({
    eventId: session && isPmcmAdmin(session.role) && section !== "suppliers" ? selectedEventId : null,
    loadWorkspace: eventWorkspaceRepository.loadWorkspace,
    onError: reportSelectedEventWorkspaceError,
  });

  async function refresh(current = session) {
    if (!current) return;
    setStatus("loading");
    try {
      if (current.role === "coordinator") {
        const next = await loadCoordinatorWorkspace(current, true);
        setCoordinatorState(next);
        setState(null);
        setStatus("ready");
        return;
      }
      if (current.role !== "pmcm-admin") {
        setStatus("ready");
        return;
      }
      if (section === "suppliers") {
        const [requests, inboxResult] = await Promise.all([
          loadApprovalRequests(true),
          loadCommandInbox(true, commandInbox?.page.index ?? 0),
        ]);
        setState(null);
        setApprovalRequests(requests);
        setCommandInbox(inboxResult);
        setCommandInboxLoadFailed(false);
        setCoordinatorState(null);
        setStatus("ready");
        return;
      }
      const shouldLoadBroadState = section !== "dashboard" && section !== "command-inbox";
      const [next, requests, inboxResult] = await Promise.all([
        shouldLoadBroadState ? loadPmcmState(true) : Promise.resolve(state),
        loadApprovalRequests(true),
        loadCommandInbox(true, commandInbox?.page.index ?? 0),
      ]);
      if (shouldLoadBroadState) setState(next);
      setApprovalRequests(requests);
      setCommandInbox(inboxResult);
      setCoordinatorState(null);
      setStatus("ready");
    } catch (err) {
      setStatus("error");
      throw err;
    }
  }

  useEffect(() => {
    return startDashboardSessionLoad({
      router,
      setStatus,
      setSession,
      setError,
      setState,
      setCoordinatorState,
      setApprovalRequests,
      setCommandInbox,
      setCommandInboxLoadFailed,
    });
  }, [router]);

  useEffect(() => {
    if (!session || session.role !== "pmcm-admin") return;
    if (section === "dashboard" || section === "command-inbox" || section === "suppliers") {
      setState(null);
      return;
    }
    const cached = getCachedPmcmState();
    if (cached) setState(cached.value);
    if (cached && isDashboardCacheFresh(cached.loadedAt)) return;
    let cancelled = false;
    loadPmcmState(Boolean(cached))
      .then((next) => {
        if (!cancelled) setState(next);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Unable to load PMCM workspace");
      });
    return () => {
      cancelled = true;
    };
  }, [session, section]);

  useEffect(() => {
    if (section === "suppliers") return;
    let cancelled = false;
    loadTemplates()
      .then((templates) => {
        if (!cancelled) setFloorPlanTemplates(templates);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Unable to load floor plan templates");
      });

    return () => {
      cancelled = true;
    };
  }, [section]);

  const isEventDayLiveOpsView = isLiveOpsWorkspaceVisible(screenName, section, tab, selectedEventId);
  const isActivePmcmLiveOpsView = Boolean(session && isPmcmAdmin(session.role) && isEventDayLiveOpsView);

  useEffect(() => {
    if (!session || screenName !== "portal" || isActivePmcmLiveOpsView) return;
    const id = window.setInterval(() => {
      refresh(session).catch(() => undefined);
    }, 30_000);
    return () => window.clearInterval(id);
  }, [session, screenName, section, tab, commandInbox?.page.index, isActivePmcmLiveOpsView]);

  async function refreshApprovals() {
    const reqs = await loadApprovalRequests(true);
    setApprovalRequests(reqs);
  }

  async function refreshCommandInbox() {
    const data = await loadCommandInbox(true, commandInbox?.page.index ?? 0);
    setCommandInbox(data);
    setCommandInboxLoadFailed(false);
    return data;
  }

  async function changeCommandInboxPage(page: number) {
    try {
      const data = await loadCommandInbox(false, page);
      setCommandInbox(data);
      setCommandInboxLoadFailed(false);
      return data;
    } catch (err) {
      setCommandInboxLoadFailed(true);
      throw err;
    }
  }

  const applyEventCommandData = useCallback((result: Awaited<ReturnType<typeof loadEventCommandData>>) => {
    setLiveOps(result.data.liveOps);
    setStatusFeed(result.data.statusFeed);
    setDefenseReadiness(result.data.defenseReadiness);
    setRegistrationPlatform(result.data.registrationPlatform);
    setGuestPrivacyClassification(result.data.guestPrivacyClassification);
    setCommandDataErrors(result.errors);
  }, []);

  const loadLiveOps = useCallback(async (force = true) => {
    if (!selectedEventId) {
      setLiveOps(null);
      setStatusFeed(null);
      setDefenseReadiness(null);
      setRegistrationPlatform(null);
      setGuestPrivacyClassification(null);
      setCommandDataErrors({});
      return;
    }
    const eventId = selectedEventId;
    const requestId = ++eventCommandDataRequestIdRef.current;
    const result = await loadEventCommandData(eventId, force);
    if (
      activeEventCommandDataIdRef.current !== eventId ||
      eventCommandDataRequestIdRef.current !== requestId
    ) return;
    applyEventCommandData(result);
  }, [applyEventCommandData, selectedEventId]);

  const refreshLiveOps = useCallback(() => loadLiveOps(true), [loadLiveOps]);
  useEventDayLiveUpdates({
    enabled: isActivePmcmLiveOpsView,
    refresh: refreshLiveOps,
  });

  useEffect(() => {
    let cancelled = false;
    if (section === "suppliers") {
      eventCommandDataRequestIdRef.current += 1;
      setLiveOps(null);
      setStatusFeed(null);
      setDefenseReadiness(null);
      setRegistrationPlatform(null);
      setCommandDataErrors({});
      return () => {
        cancelled = true;
      };
    }
    if (!selectedEventId) {
      eventCommandDataRequestIdRef.current += 1;
      setLiveOps(null);
      setStatusFeed(null);
      setDefenseReadiness(null);
      setRegistrationPlatform(null);
      setGuestPrivacyClassification(null);
      setCommandDataErrors({});
      return;
    }

    const cached = getCachedEventCommandData(selectedEventId);
    if (cached) {
      applyEventCommandData({ data: cached.value, errors: {} });
      if (isFresh(cached.loadedAt, EVENT_WORKSPACE_CACHE_MS)) {
        if (!isEventDayLiveOpsView) eventCommandDataRequestIdRef.current += 1;
        return () => {
          cancelled = true;
        };
      }
    }

    if (isEventDayLiveOpsView) {
      return () => {
        cancelled = true;
      };
    }

    const requestId = ++eventCommandDataRequestIdRef.current;
    const isCurrentRequest = () =>
      !cancelled &&
      activeEventCommandDataIdRef.current === selectedEventId &&
      eventCommandDataRequestIdRef.current === requestId;
    loadEventCommandData(selectedEventId, !cached)
      .then((result) => {
        if (isCurrentRequest()) applyEventCommandData(result);
      })
      .catch((err) => {
        if (isCurrentRequest()) {
          setCommandDataErrors({ liveOps: err instanceof Error ? err.message : String(err) });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [applyEventCommandData, isEventDayLiveOpsView, section, selectedEventId]);

  return {
    status,
    session,
    state,
    coordinatorState,
    error,
    setError,
    approvalRequests,
    liveOps,
    statusFeed,
    defenseReadiness,
    registrationPlatform,
    guestPrivacyClassification,
    commandDataErrors,
    floorPlanTemplates,
    commandInbox,
    setCommandInbox,
    conformeUploadTarget,
    setConformeUploadTarget,
    commandInboxLoadFailed,
    setCommandInboxLoadFailed,
    refresh,
    refreshApprovals,
    refreshCommandInbox,
    changeCommandInboxPage,
    loadLiveOps,
    refreshSelectedEventWorkspace,
    selectedEventWorkspace,
    setState,
    setCoordinatorState,
    setLiveOps,
    setStatusFeed,
    setDefenseReadiness,
    setFloorPlanTemplates,
  };
}

export type EventDashboardWorkspaceViewModel = ReturnType<typeof useEventDashboardWorkspaceViewModel>;

function isLiveOpsWorkspaceVisible(screenName: ScreenName, section: DashboardSection, tab: DetailTab, eventId: string | null) {
  return Boolean(screenName === "portal" && section === "events" && tab === "live-ops" && eventId);
}
