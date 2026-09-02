"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type {
  PrismApprovalRequest,
  PrismCoordinatorWorkspace,
  PrismDefenseReadiness,
  PrismEventDayStatusFeed,
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
  isDashboardCacheFresh,
  loadCoordinatorWorkspace,
  loadPmcmState,
} from "../use-cases/load-dashboard-workspace";
import { startDashboardSessionLoad } from "../use-cases/start-dashboard-session-load";
import { usePmcmSelectedEventWorkspace } from "@/features/event-workspace/shell";

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
}: {
  selectedEventId: string | null;
  screenName: ScreenName;
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
  const [floorPlanTemplates, setFloorPlanTemplates] = useState<FloorPlanTemplate[]>([]);
  const [commandInbox, setCommandInbox] = useState<PrismPmcmCommandInbox | null>(null);
  const [conformeUploadTarget, setConformeUploadTarget] = useState<PrismPmcmDashboardWorkspace["inquiries"][number] | null>(null);
  const [commandInboxLoadFailed, setCommandInboxLoadFailed] = useState(false);
  const [commandDataErrors, setCommandDataErrors] = useState<EventCommandDataErrors>({});

  const reportSelectedEventWorkspaceError = useCallback((err: unknown) => {
    setError(err instanceof Error ? err.message : "Unable to load selected event workspace");
  }, []);
  const {
    refresh: refreshSelectedEventWorkspace,
    workspace: selectedEventWorkspace,
  } = usePmcmSelectedEventWorkspace({
    eventId: session && isPmcmAdmin(session.role) ? selectedEventId : null,
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
      const [next, requests, inboxResult] = await Promise.all([
        loadPmcmState(true),
        loadApprovalRequests(true),
        loadCommandInbox(true),
      ]);
      setState(next);
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
  }, []);

  useEffect(() => {
    if (!session || screenName !== "portal") return;
    const id = window.setInterval(() => {
      refresh(session).catch(() => undefined);
    }, 30_000);
    return () => window.clearInterval(id);
  }, [session, screenName]);

  async function refreshApprovals() {
    const reqs = await loadApprovalRequests(true);
    setApprovalRequests(reqs);
  }

  async function refreshCommandInbox() {
    const data = await loadCommandInbox(true);
    setCommandInbox(data);
    setCommandInboxLoadFailed(false);
    return data;
  }

  function applyEventCommandData(result: Awaited<ReturnType<typeof loadEventCommandData>>) {
    setLiveOps(result.data.liveOps);
    setStatusFeed(result.data.statusFeed);
    setDefenseReadiness(result.data.defenseReadiness);
    setRegistrationPlatform(result.data.registrationPlatform);
    setCommandDataErrors(result.errors);
  }

  async function loadLiveOps(force = true) {
    if (!selectedEventId) {
      setLiveOps(null);
      setStatusFeed(null);
      setDefenseReadiness(null);
      setRegistrationPlatform(null);
      setCommandDataErrors({});
      return;
    }
    const result = await loadEventCommandData(selectedEventId, force);
    applyEventCommandData(result);
  }

  useEffect(() => {
    let cancelled = false;
    if (!selectedEventId) {
      setLiveOps(null);
      setStatusFeed(null);
      setDefenseReadiness(null);
      setRegistrationPlatform(null);
      setCommandDataErrors({});
      return;
    }

    const cached = getCachedEventCommandData(selectedEventId);
    if (cached) {
      applyEventCommandData({ data: cached.value, errors: {} });
      if (isFresh(cached.loadedAt, EVENT_WORKSPACE_CACHE_MS)) {
        return () => {
          cancelled = true;
        };
      }
    }

    loadEventCommandData(selectedEventId, !cached)
      .then((result) => {
        if (!cancelled) applyEventCommandData(result);
      })
      .catch((err) => {
        if (!cancelled) {
          setCommandDataErrors({ liveOps: err instanceof Error ? err.message : String(err) });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [selectedEventId]);

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
