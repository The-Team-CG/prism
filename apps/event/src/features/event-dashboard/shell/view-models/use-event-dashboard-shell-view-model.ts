"use client";

import { useEventOpsCommands } from "@/features/event-ops";
import { useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import type {
  PrismApprovalRequest,
  PrismCoordinatorWorkspace,
  PrismDefenseReadiness,
  PrismEvent,
  PrismEventDayStatusFeed,
  PrismFloorPlanDraft,
  PrismInquiry,
  PrismLiveOps,
  PrismPmcmCommandInbox,
  PrismPmcmDashboardWorkspace,
  PrismSupplier,
} from "@prism/types";
import { loadTemplates, type FloorPlanTemplate, type Project, cloneTemplateObjects } from "@/features/floorplan/editor";
import { clearEventSession, readStoredEventSession, type EventSession } from "@/app/lib/session";
import { isPmcmAdmin } from "@/app/lib/role-guards";
import { eventPortalNavItems, loadingShellNavItems } from "./use-event-dashboard-nav";
import {
  selectActiveEvents,
  selectClientRecords,
  selectClientRecordsForView,
  selectEventWorkspaceResources,
  selectEventsForView,
  selectPendingApprovals,
  selectSelectedEvent,
  selectUnreviewedInquiryCount,
} from "../model/event-dashboard-selectors";
import {
  CLIENT_DETAIL_ROUTES,
  EVENT_DETAIL_ROUTES,
  EVENT_TAB_ROUTES,
  EVENT_WORKSPACE_ROUTE_TABS,
  SIDEBAR_STATIC_ROUTES,
  activeSidebarItemFromRoute,
  routeLoadingShellCopy,
  routeStateFromPath,
  type DashboardSection,
  type DetailTab,
  type EventDashboardClientProps,
  type RouteState,
} from "../model/event-dashboard-routing";
import {
  getCachedCoordinatorWorkspace,
  getCachedPmcmState,
  isDashboardCacheFresh,
  loadCoordinatorWorkspace,
  loadPmcmState,
} from "../use-cases/load-dashboard-workspace";
import {
  getCachedApprovalRequests,
  getCachedEventCommandData,
  loadApprovalRequests,
  loadEventCommandData,
  type EventCommandData,
} from "@/features/event-workspace/shell";
import { getCachedCommandInbox, loadCommandInbox } from "@/features/command-inbox/list";
import {
  usePmcmActionRunner,
  usePmcmApprovalRequests,
  usePmcmEventReadiness,
  usePmcmSelectedEventWorkspace,
} from "@/features/event-workspace/shell";

export type { EventDashboardClientProps };

type Screen =
  | { name: "portal" }
  | { name: "editor"; event: PrismEvent; draft: PrismFloorPlanDraft; project: Project };

const EVENT_WORKSPACE_CACHE_MS = 20_000;

function isFresh(loadedAt: number, ttl?: number) {
  if (ttl == null) return isDashboardCacheFresh(loadedAt);
  return Date.now() - loadedAt < ttl;
}

export function useEventDashboardShellViewModel({
  section: initialSection,
  tab: initialTab,
  eventId: initialEventId,
  clientId: initialClientId,
  view: initialView,
}: EventDashboardClientProps = {}) {  const ops = useEventOpsCommands();
  const router = useRouter();
  const pathname = usePathname();
  const routeState = useMemo<RouteState>(() => {
    const pathState = routeStateFromPath(pathname);
    return {
      section: initialSection ?? pathState.section,
      tab: initialTab ?? pathState.tab,
      eventId: initialEventId ?? pathState.eventId,
      clientId: initialClientId ?? pathState.clientId,
      view: initialView ?? pathState.view,
    };
  }, [initialClientId, initialEventId, initialSection, initialTab, initialView, pathname]);

  const [session, setSession] = useState<EventSession | null>(null);
  const [state, setState] = useState<PrismPmcmDashboardWorkspace | null>(null);
  const [coordinatorState, setCoordinatorState] = useState<PrismCoordinatorWorkspace | null>(null);
  const [screen, setScreen] = useState<Screen>({ name: "portal" });
  const [error, setError] = useState<string | null>(null);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(routeState.eventId ?? null);
  const [selectedClientId, setSelectedClientId] = useState<string | null>(routeState.clientId ?? null);
  const [section, setSection] = useState<DashboardSection>(routeState.section);
  const [tab, setTab] = useState<DetailTab>(routeState.tab);
  const [sidebarActiveOverride, setSidebarActiveOverride] = useState<string | null>(null);
  const [approvalRequests, setApprovalRequests] = useState<PrismApprovalRequest[]>([]);
  const [liveOps, setLiveOps] = useState<PrismLiveOps | null>(null);
  const [statusFeed, setStatusFeed] = useState<PrismEventDayStatusFeed | null>(null);
  const [defenseReadiness, setDefenseReadiness] = useState<PrismDefenseReadiness | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [floorPlanTemplates, setFloorPlanTemplates] = useState<FloorPlanTemplate[]>([]);
  const [commandInbox, setCommandInbox] = useState<PrismPmcmCommandInbox | null>(null);

  const [conformeUploadTarget, setConformeUploadTarget] = useState<PrismInquiry | null>(null);
  const [commandInboxLoadFailed, setCommandInboxLoadFailed] = useState(false);

  const reportSelectedEventWorkspaceError = useCallback((err: unknown) => {
    setError(err instanceof Error ? err.message : "Unable to load selected event workspace");
  }, []);
  const {
    refresh: refreshSelectedEventWorkspace,
    workspace: selectedEventWorkspace,
  } = usePmcmSelectedEventWorkspace({
    eventId: session && isPmcmAdmin(session.role) ? selectedEventId : null,
    loadWorkspace: ops.pmcmEventWorkspace,
    onError: reportSelectedEventWorkspaceError,
  });

  async function refresh(current = session) {
    if (!current) return;
    if (current.role === "coordinator") {
      const next = await loadCoordinatorWorkspace(current, true);
      setCoordinatorState(next);
      setState(null);
      return;
    }
    if (current.role !== "pmcm-admin") return;
    const [next, requests, inboxResult] = await Promise.all([
      loadPmcmState(true),
      loadApprovalRequests(true),
      loadCommandInbox(true),
    ]);
    setState(next);
    setApprovalRequests(requests);
    setCommandInbox(inboxResult);
    setCoordinatorState(null);
  }

  useEffect(() => {
    let cancelled = false;
    const current = readStoredEventSession();
    if (!current) {
      router.replace("/sign-in?next=/dashboard");
      return;
    }

    setSession(current);
    setError(null);

    if (current.role === "coordinator") {
      const cached = getCachedCoordinatorWorkspace(current);
      if (cached) {
        setCoordinatorState(cached.value);
        setState(null);
        if (isFresh(cached.loadedAt)) {
          return () => {
            cancelled = true;
          };
        }
      }

      loadCoordinatorWorkspace(current, !cached)
        .then((next) => {
          if (cancelled) return;
          setCoordinatorState(next);
          setState(null);
          setError(null);
        })
        .catch((err) => {
          if (!cancelled) setError(err instanceof Error ? err.message : "Unable to load event portal");
        });

      return () => {
        cancelled = true;
      };
    }

    if (current.role !== "pmcm-admin") {
      return () => {
        cancelled = true;
      };
    }

    const cachedState = getCachedPmcmState();
    const cachedApprovals = getCachedApprovalRequests();
    const cachedInbox = getCachedCommandInbox();

    if (cachedState) {
      setState(cachedState.value);
      setCoordinatorState(null);
    }
    if (cachedApprovals) {
      setApprovalRequests(cachedApprovals.value);
    }
    if (cachedInbox) {
      setCommandInbox(cachedInbox.value);
    }

    const stateIsFresh = cachedState && isFresh(cachedState.loadedAt);
    const approvalsAreFresh = cachedApprovals && isFresh(cachedApprovals.loadedAt);
    const inboxIsFresh = cachedInbox && isFresh(cachedInbox.loadedAt);
    if (stateIsFresh && approvalsAreFresh && inboxIsFresh) {
      return () => {
        cancelled = true;
      };
    }

    Promise.all([
      stateIsFresh ? Promise.resolve(cachedState.value) : loadPmcmState(!cachedState),
      approvalsAreFresh ? Promise.resolve(cachedApprovals.value) : loadApprovalRequests(!cachedApprovals),
      inboxIsFresh ? Promise.resolve(cachedInbox.value) : Promise.resolve().then(() => loadCommandInbox(!cachedInbox)),
    ])
      .then(([next, requests, inboxResult]) => {
        if (cancelled) return;
        setState(next);
        setApprovalRequests(requests);
        setCommandInbox(inboxResult);
        setCommandInboxLoadFailed(false);
        setCoordinatorState(null);
        setError(null);
      })
      .catch((err) => {
        if (!cancelled) {
          setCommandInboxLoadFailed(true);
          setError(err instanceof Error ? err.message : "Unable to load event portal");
        }
      });

    return () => {
      cancelled = true;
    };
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
    setSection(routeState.section);
    setTab(routeState.tab);
    if (routeState.eventId) setSelectedEventId(routeState.eventId);
    if (routeState.section === "clients") setSelectedClientId(routeState.clientId ?? null);
  }, [routeState.clientId, routeState.eventId, routeState.section, routeState.tab, routeState.view]);

  useEffect(() => {
    if (!session || screen.name !== "portal") return;
    const id = window.setInterval(() => {
      refresh(session).catch(() => undefined);
    }, 30_000);
    return () => window.clearInterval(id);
  }, [session, screen.name]);

  useEffect(() => {
    if (!state) return;
    setSelectedEventId((prev) => routeState.eventId ?? prev ?? state.events[0]?.id ?? null);
  }, [routeState.eventId, state]);

  const events = useMemo(() => selectActiveEvents(state), [state]);
  const selectedEvent = selectSelectedEvent(events, selectedEventId);
  const supplierCategories = state?.supplierCategories ?? [];
  const suppliers = state?.suppliers ?? [];
  const coordinators = state?.coordinators ?? [];
  const coordinatorRoleRequirements = state?.coordinatorRoleRequirements ?? [];
  const inquiries = state?.inquiries ?? [];
  const unreviewedInquiries = selectUnreviewedInquiryCount(inquiries);
  const complianceRules = state?.complianceRules ?? [];
  const {
    activeDraft,
    assignments,
    audit,
    billingSources,
    billingStatements,
    briefing,
    checks,
    documents,
    drafts,
    eventInsights,
    notificationLogs,
    payments,
    postEventDocuments,
    quoteRequests,
    quotes,
  } = selectEventWorkspaceResources(state, selectedEvent, selectedEventWorkspace);
  const selectedInquiry = inquiries.find((item) => item.id === selectedEvent?.inquiryId);
  const pendingApprovals = selectPendingApprovals(approvalRequests);
  const clientRecords = useMemo(() => selectClientRecords(events, inquiries), [events, inquiries]);
  const selectedClient = clientRecords.find((client) => client.id === selectedClientId) ?? null;
  const clientListView = !selectedClient ? routeState.view ?? "all" : "all";
  const clientRecordsForView = useMemo(() => selectClientRecordsForView(clientRecords, clientListView), [clientListView, clientRecords]);
  const eventListView = routeState.view ?? "all";
  const eventsForView = useMemo(() => selectEventsForView(events, eventListView), [eventListView, events]);

  useEffect(() => {
    if (!session || screen.name !== "portal") return;

    router.prefetch("/dashboard");
    router.prefetch("/dashboard/inquiries");
    router.prefetch("/dashboard/events");
    router.prefetch("/dashboard/clients");
    router.prefetch("/dashboard/calendar");
    router.prefetch("/dashboard/tasks");
    router.prefetch("/dashboard/command-inbox");
    router.prefetch("/dashboard/team");
    router.prefetch("/dashboard/suppliers");
    router.prefetch("/dashboard/files");
    router.prefetch("/dashboard/messages");
    router.prefetch("/dashboard/finance");
    router.prefetch("/dashboard/audit");
    router.prefetch("/dashboard/settings");

    const eventId = routeState.eventId ?? selectedEvent?.id ?? selectedEventId;
    if (!eventId) return;

    Object.values(EVENT_TAB_ROUTES).forEach((route) => {
      router.prefetch(`/dashboard/events/${encodeURIComponent(eventId)}/${route}`);
    });
  }, [router, routeState.eventId, screen.name, selectedEvent?.id, selectedEventId, session]);

  async function refreshApprovals() {
    const reqs = await loadApprovalRequests(true);
    setApprovalRequests(reqs);
  }

  function applyEventCommandData(next: EventCommandData) {
    setLiveOps(next.liveOps);
    setStatusFeed(next.statusFeed);
    setDefenseReadiness(next.defenseReadiness);
  }

  async function loadLiveOps(force = true) {
    if (!selectedEvent) {
      setLiveOps(null);
      setStatusFeed(null);
      setDefenseReadiness(null);
      return;
    }
    const next = await loadEventCommandData(selectedEvent.id, force);
    applyEventCommandData(next);
  }

  useEffect(() => {
    let cancelled = false;
    if (!selectedEvent?.id) {
      setLiveOps(null);
      setStatusFeed(null);
      setDefenseReadiness(null);
      return;
    }

    const cached = getCachedEventCommandData(selectedEvent.id);
    if (cached) {
      applyEventCommandData(cached.value);
      if (isFresh(cached.loadedAt, EVENT_WORKSPACE_CACHE_MS)) {
        return () => {
          cancelled = true;
        };
      }
    }

    loadEventCommandData(selectedEvent.id, !cached)
      .then((next) => {
        if (!cancelled) applyEventCommandData(next);
      })
      .catch(() => undefined);

    return () => {
      cancelled = true;
    };
  }, [selectedEvent?.id]);

  async function run(actionLabel: string, action: () => Promise<unknown>) {
    setBusy(actionLabel);
    setError(null);
    try {
      await action();
      await refresh();
      await refreshSelectedEventWorkspace();
      await refreshApprovals();
      if (selectedEvent?.id) {
        await loadEventCommandData(selectedEvent.id, true).then(applyEventCommandData).catch(() => undefined);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Action failed");
    } finally {
      setBusy(null);
    }
  }

  async function runLiveOps(actionLabel: string, action: () => Promise<unknown>) {
    setBusy(actionLabel);
    setError(null);
    try {
      await action();
      await refresh();
      await loadLiveOps(true);
      await refreshApprovals();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Action failed");
    } finally {
      setBusy(null);
    }
  }

  async function createTemplateDraft(template: FloorPlanTemplate) {
    if (!selectedEvent) return;
    const draft = await ops.createFloorPlanDraft(selectedEvent.id, {
      name: `${template.name} PMCM draft`,
      sourceType: "template",
      venue: template.venue || selectedEvent.eventName,
      width: template.widthM,
      height: template.heightM,
      gridSize: 1,
      pax: template.pax,
      objects: cloneTemplateObjects(template),
      guests: template.includeGuests ? template.guests : [],
      suppliers: template.includeSuppliers ? template.suppliers : [],
    });
    await openEditor(selectedEvent, draft);
  }

  async function openEditor(event: PrismEvent, draft: PrismFloorPlanDraft) {
    if (!session || !isPmcmAdmin(session.role)) return;
    const project = await ops.loadPlan(draft.floorPlanId);
    setScreen({ name: "editor", event, draft, project });
  }

  function eventRoute(eventId: string, nextTab: DetailTab = "overview") {
    return `/dashboard/events/${encodeURIComponent(eventId)}/${EVENT_TAB_ROUTES[nextTab]}`;
  }

  function navigateEvent(eventId: string, nextTab: DetailTab = "overview") {
    setSidebarActiveOverride(null);
    setSection("events");
    setSelectedEventId(eventId);
    setTab(nextTab);
    router.push(eventRoute(eventId, nextTab));
  }

  function navigateClient(clientId: string) {
    setSidebarActiveOverride(null);
    setSection("clients");
    setSelectedClientId(clientId);
    router.push(`/dashboard/clients/${encodeURIComponent(clientId)}`);
  }

  function navigateEventTab(nextTab: DetailTab, options: { preserveSidebarActive?: boolean } = {}) {
    if (!options.preserveSidebarActive) setSidebarActiveOverride(null);
    setSection("events");
    setTab(nextTab);
    const targetId = selectedEvent?.id ?? selectedEventId;
    router.push(targetId ? eventRoute(targetId, nextTab) : "/dashboard/events");
  }

  function navigateSection(nextSection: DashboardSection, options: { preserveSidebarActive?: boolean } = {}) {
    if (!options.preserveSidebarActive) setSidebarActiveOverride(null);
    setSection(nextSection);
    if (nextSection === "dashboard") { router.push("/dashboard"); return; }
    if (nextSection === "clients") { setSelectedClientId(null); router.push("/dashboard/clients"); return; }
    if (nextSection === "calendar") { router.push("/dashboard/calendar"); return; }
    if (nextSection === "tasks") { router.push("/dashboard/tasks"); return; }
    if (nextSection === "command-inbox") { router.push("/dashboard/command-inbox"); return; }
    if (nextSection === "team") { router.push("/dashboard/team"); return; }
    if (nextSection === "suppliers") { router.push("/dashboard/suppliers"); return; }
    if (nextSection === "files") { router.push("/dashboard/files"); return; }
    if (nextSection === "messages") { router.push("/dashboard/messages"); return; }
    if (nextSection === "finance") { router.push("/dashboard/finance"); return; }
    if (nextSection === "audit") { router.push("/dashboard/audit"); return; }
    if (nextSection === "settings") { router.push("/dashboard/settings"); return; }
    if (nextSection === "inquiries") { router.push("/dashboard/inquiries"); return; }
    if (nextSection === "events-list") { router.push("/dashboard/events"); return; }
    router.push("/dashboard");
  }

  function handleSidebarNav(id: string) {
    setSidebarActiveOverride(id);
    const staticRoute = SIDEBAR_STATIC_ROUTES[id];
    if (staticRoute) {
      const nextRouteState = routeStateFromPath(staticRoute);
      setSection(nextRouteState.section);
      setTab(nextRouteState.tab);
      if (nextRouteState.section === "clients") setSelectedClientId(null);
      router.push(staticRoute);
      return;
    }

    const clientRoute = CLIENT_DETAIL_ROUTES[id];
    if (clientRoute && selectedClient) {
      setSection("clients");
      setSelectedClientId(selectedClient.id);
      router.push(`/dashboard/clients/${encodeURIComponent(selectedClient.id)}${clientRoute === "overview" ? "" : `/${clientRoute}`}`);
      return;
    }

    const eventRouteSegment = EVENT_DETAIL_ROUTES[id];
    if (eventRouteSegment) {
      const targetId = selectedEvent?.id ?? selectedEventId;
      if (!targetId) {
        navigateSection("events-list", { preserveSidebarActive: true });
        return;
      }
      setSection("events");
      setTab(EVENT_WORKSPACE_ROUTE_TABS[eventRouteSegment] ?? "overview");
      router.push(`/dashboard/events/${encodeURIComponent(targetId)}${eventRouteSegment === "overview" ? "/overview" : `/${eventRouteSegment}`}`);
      return;
    }

    switch (id) {
      case "dashboard-overview": router.push("/dashboard"); setSection("dashboard"); return;
      case "dashboard-upcoming": navigateSection("events-list", { preserveSidebarActive: true }); return;
      case "dashboard-pending": navigateSection("tasks", { preserveSidebarActive: true }); return;
      case "dashboard-messages": navigateSection("messages", { preserveSidebarActive: true }); return;
      case "dashboard-finance": navigateSection("finance", { preserveSidebarActive: true }); return;
      case "command-inbox": navigateSection("command-inbox", { preserveSidebarActive: true }); return;
      case "clients-all":
      case "clients-active":
      case "clients-past":
      case "clients-archived":
        navigateSection("clients", { preserveSidebarActive: true }); return;
      case "clients-prospects": navigateSection("inquiries", { preserveSidebarActive: true }); return;
      case "client-overview":
      case "client-contacts":
      case "client-notes":
      case "client-activity":
        if (selectedClient) router.push(`/dashboard/clients/${encodeURIComponent(selectedClient.id)}`);
        return;
      case "client-events":
        if (selectedClient?.events[0]) navigateEvent(selectedClient.events[0].id, "overview");
        return;
      case "client-files": navigateSection("files", { preserveSidebarActive: true }); return;
      case "client-messages": navigateSection("messages", { preserveSidebarActive: true }); return;
      case "client-contracts": navigateSection("files", { preserveSidebarActive: true }); return;
      case "client-invoices": navigateSection("finance", { preserveSidebarActive: true }); return;
      case "events-all":
      case "events-upcoming":
      case "events-ongoing":
      case "events-completed":
      case "events-cancelled":
      case "events-draft":
      case "events-by-client":
      case "events-by-type":
        navigateSection("events-list", { preserveSidebarActive: true }); return;
      case "calendar-all":
      case "calendar-events":
      case "calendar-tasks":
      case "calendar-clients":
      case "calendar-team":
      case "calendar-suppliers":
      case "calendar-payments":
        navigateSection("calendar", { preserveSidebarActive: true }); return;
      case "tasks-my":
      case "tasks-all":
      case "tasks-overdue":
      case "tasks-today":
      case "tasks-week":
      case "tasks-assigned":
      case "tasks-by-client":
      case "tasks-by-event":
      case "tasks-templates":
        navigateSection("tasks", { preserveSidebarActive: true }); return;
      case "messages-inbox":
      case "messages-client":
      case "messages-event":
      case "messages-team":
      case "messages-approvals":
      case "messages-announcements":
      case "messages-archived":
        navigateSection("messages", { preserveSidebarActive: true }); return;
      case "files-all":
      case "files-client":
      case "files-event":
      case "files-contracts":
      case "files-quotations":
      case "files-invoices":
      case "files-floorplans":
      case "files-permits":
      case "files-media":
      case "files-archived":
        navigateSection("files", { preserveSidebarActive: true }); return;
      case "team-all":
      case "team-roles":
      case "team-availability":
      case "team-assignments":
      case "team-workload":
      case "team-departments":
      case "team-archived":
        navigateSection("team", { preserveSidebarActive: true }); return;
      case "suppliers-all":
      case "suppliers-preferred":
      case "suppliers-venues":
      case "suppliers-catering":
      case "suppliers-media":
      case "suppliers-lights":
      case "suppliers-decor":
      case "suppliers-transport":
      case "suppliers-contracts":
      case "suppliers-payments":
        navigateSection("suppliers", { preserveSidebarActive: true }); return;
      case "finance-overview":
      case "finance-quotations":
      case "finance-invoices":
      case "finance-payments":
      case "finance-expenses":
      case "finance-balances":
      case "finance-profit":
      case "finance-reports":
        navigateSection("finance", { preserveSidebarActive: true }); return;
      case "settings-organization":
      case "settings-users":
      case "settings-roles":
      case "settings-event-types":
      case "settings-task-templates":
      case "settings-message-templates":
      case "settings-file-categories":
      case "settings-notifications":
        navigateSection("settings", { preserveSidebarActive: true }); return;
      case "settings-system-logs": navigateSection("audit", { preserveSidebarActive: true }); return;
      case "event-overview": navigateEventTab("overview", { preserveSidebarActive: true }); return;
      case "event-planning": navigateEventTab("briefing", { preserveSidebarActive: true }); return;
      case "event-schedule": navigateEventTab("live-ops", { preserveSidebarActive: true }); return;
      case "event-attendees": navigateEventTab("live-ops", { preserveSidebarActive: true }); return;
      case "event-staff": navigateEventTab("coordinators", { preserveSidebarActive: true }); return;
      case "event-suppliers": navigateEventTab("suppliers", { preserveSidebarActive: true }); return;
      case "event-budget": navigateEventTab("billing", { preserveSidebarActive: true }); return;
      case "event-files": navigateEventTab("floorplans", { preserveSidebarActive: true }); return;
      case "event-messages": navigateEventTab("activity", { preserveSidebarActive: true }); return;
      case "event-timeline": navigateEventTab("live-ops", { preserveSidebarActive: true }); return;
      case "event-report": navigateEventTab("closure", { preserveSidebarActive: true }); return;
    }
  }

  const signOut = () => {
    clearEventSession();
    router.replace("/sign-in");
  };

  const openCheckCount = checks.filter((item) => item.status === "open").length;
  const openActionCount = defenseReadiness?.nextActions.length ?? pendingApprovals.length + unreviewedInquiries;
  const eventWorkspaceDisabled = !selectedEvent;
  const activeSidebarItemId = activeSidebarItemFromRoute(routeState);
  const shellNavItems = eventPortalNavItems({
    hasEvent: !eventWorkspaceDisabled,
    eventName: selectedEvent?.eventName,
    inquiryCount: unreviewedInquiries + pendingApprovals.length,
    taskCount: openActionCount,
    commandInboxCount: commandInboxLoadFailed
      ? "!"
      : commandInbox
        ? commandInbox.counts.critical + commandInbox.counts.warning + commandInbox.counts.attention
        : undefined,
    assignmentCount: assignments.length,
    quoteCount: quotes.length,
    draftCount: drafts.length,
    paymentCount: payments.length,
    closeoutCount: openCheckCount,
  });
  const activeNavItem = shellNavItems.find((item) => item.id === activeSidebarItemId);

  return {
    routeState,
    session,
    state,
    coordinatorState,
    screen,
    error,
    selectedEventId,
    selectedClientId,
    section,
    tab,
    sidebarActiveOverride,
    approvalRequests,
    liveOps,
    statusFeed,
    defenseReadiness,
    busy,
    floorPlanTemplates,
    commandInbox,
    conformeUploadTarget,
    commandInboxLoadFailed,
    events,
    selectedEvent,
    supplierCategories,
    suppliers,
    coordinators,
    coordinatorRoleRequirements,
    inquiries,
    unreviewedInquiries,
    complianceRules,
    activeDraft,
    assignments,
    audit,
    billingSources,
    billingStatements,
    briefing,
    checks,
    documents,
    drafts,
    eventInsights,
    notificationLogs,
    payments,
    postEventDocuments,
    quoteRequests,
    quotes,
    selectedInquiry,
    pendingApprovals,
    clientRecords,
    selectedClient,
    clientListView,
    clientRecordsForView,
    eventListView,
    eventsForView,
    openCheckCount,
    openActionCount,
    eventWorkspaceDisabled,
    activeSidebarItemId,
    shellNavItems,
    activeNavItem,
    isHome: section === "dashboard",
    isCommandInbox: section === "command-inbox",
    isEventsList: section === "events-list",
    isInquiries: section === "inquiries",
    isClients: section === "clients",
    isCalendar: section === "calendar",
    isTasks: section === "tasks",
    isTeam: section === "team",
    isFiles: section === "files",
    isMessages: section === "messages",
    isFinance: section === "finance",
    isSettings: section === "settings",
    refresh,
    refreshApprovals,
    loadLiveOps,
    run,
    runLiveOps,
    createTemplateDraft,
    openEditor,
    navigateEvent,
    navigateClient,
    navigateEventTab,
    navigateSection,
    handleSidebarNav,
    signOut,
    setTab,
    setScreen,
    setConformeUploadTarget,
    setCommandInbox,
    setCommandInboxLoadFailed,
    setSelectedEventId,
    setSection,
    setSelectedClientId,
    setError,
    setState,
    setCoordinatorState,
    setLiveOps,
    setStatusFeed,
    setDefenseReadiness,
    setBusy,
    setFloorPlanTemplates,
    acceptInquiry: (inquiry: PrismInquiry) => run("accept inquiry", () => ops.acceptInquiry(inquiry.id)),
    pendInquiry: (inquiry: PrismInquiry) => run("pend inquiry", () => ops.pendInquiry(inquiry.id)),
    declineInquiry: (inquiry: PrismInquiry, reason: string) => run("decline inquiry", () => ops.declineInquiry(inquiry.id, reason)),
    logInquiryOnBehalf: (input: Parameters<typeof ops.logInquiryOnBehalf>[0]) => session ? run("log inquiry on behalf", () => ops.logInquiryOnBehalf(input, session)) : Promise.resolve(),
    sendConformeReminder: (inquiry: PrismInquiry) => run("conforme reminder", () => ops.sendConformeReminder(inquiry.id)),
    toggleSupplierBni: (supplier: PrismSupplier, nextValue: boolean) => run("supplier BNI flag", () => ops.updateSupplier(supplier.id, { bniMember: nextValue })),
    createSupplier: (input: Parameters<typeof ops.createSupplier>[0]) => run("create supplier", () => ops.createSupplier(input)),
    updateSupplierProfile: (supplierId: string, input: Parameters<typeof ops.updateSupplier>[1]) => run("update supplier", () => ops.updateSupplier(supplierId, input)),
    changeSupplierTier: (supplierId: string, tier: Parameters<typeof ops.changeSupplierTier>[1]["tier"], reason: string) => run("supplier tier change", () => ops.changeSupplierTier(supplierId, { tier, reason })),
    addSupplierReview: (supplierId: string, input: Parameters<typeof ops.addSupplierReview>[1]) => session ? run("supplier private review", () => ops.addSupplierReview(supplierId, { ...input, eventId: selectedEvent?.id }, session)) : Promise.resolve(),
    addSupplierCertification: (supplierId: string, input: Parameters<typeof ops.addSupplierCertification>[1]) => run("supplier certification", () => ops.addSupplierCertification(supplierId, input)),
    requestSupplierQuotes: (input: Parameters<typeof ops.requestSupplierQuotes>[1]) => selectedEvent ? run("request supplier quotes", () => ops.requestSupplierQuotes(selectedEvent.id, input)) : Promise.resolve(),
    selectSupplierQuote: (quoteId: string) => selectedEvent ? run("select supplier quote", () => ops.selectSupplierQuote(selectedEvent.id, quoteId)) : Promise.resolve(),
    recordPayment: (milestoneId: string, input: Parameters<typeof ops.recordPayment>[2]) => selectedEvent ? run("record payment", () => ops.recordPayment(selectedEvent.id, milestoneId, input)) : Promise.resolve(),
    sendBillingStatement: (billingId: string) => selectedEvent ? run("send billing statement", () => ops.sendBillingStatement(selectedEvent.id, billingId)) : Promise.resolve(),
    createComplianceRule: (input: Parameters<typeof ops.createComplianceRule>[0]) => run("create compliance rule", () => ops.createComplianceRule(input)),
    runComplianceChecks: (phase: string) => selectedEvent ? run("run compliance", () => ops.runCompliance(selectedEvent.id, phase)) : Promise.resolve(),
    resolveComplianceCheck: (checkId: string) => selectedEvent ? run("resolve compliance", () => ops.resolveCompliance(selectedEvent.id, checkId, { action: "resolve", note: "Resolved during PMCM review.", actorName: "Ms. Mys" })) : Promise.resolve(),
    overrideComplianceCheck: (checkId: string, reason: string) => selectedEvent ? run("override compliance", () => ops.resolveCompliance(selectedEvent.id, checkId, { action: "override", overrideReason: reason, actorName: "Ms. Mys" })) : Promise.resolve(),
    createBillingSource: (input: Parameters<typeof ops.createBillingSource>[1]) => selectedEvent ? run("create billing source", () => ops.createBillingSource(selectedEvent.id, input)) : Promise.resolve(),
    approveBillingSource: (sourceId: string) => selectedEvent ? run("approve billing source", () => ops.approveBillingSource(selectedEvent.id, sourceId, "Approved by PMCM.")) : Promise.resolve(),
    generateBillingStatement: (sourceId: string) => selectedEvent ? run("generate billing statement", () => ops.generateBillingStatement(selectedEvent.id, sourceId)) : Promise.resolve(),
    loadCloseGates: () => selectedEvent ? ops.closeGates(selectedEvent.id) : Promise.reject(new Error("No event selected")),
    archiveSelectedEvent: (reason?: string) => selectedEvent ? run("archive event", () => ops.archiveEvent(selectedEvent.id, reason)) : Promise.resolve(),
    loadEventInsights: () => selectedEvent ? ops.eventInsights(selectedEvent.id) : Promise.reject(new Error("No event selected")),
    generateEventInsights: () => selectedEvent ? run("generate insights", () => ops.generateEventInsights(selectedEvent.id)) : Promise.resolve(),
    assignCoordinator: (coordinator: { id: string }, role: string, overrideConflict = false) => selectedEvent ? run("coordinator assignment", () => ops.assignCoordinator(selectedEvent.id, { coordinatorId: coordinator.id, role, overrideConflict })) : Promise.resolve(),
    createEventDayTask: (input: Parameters<typeof ops.createEventDayTask>[1]) => selectedEvent ? runLiveOps("create task", () => ops.createEventDayTask(selectedEvent.id, input)) : Promise.resolve(),
    updateEventDayTask: (taskId: string, input: Parameters<typeof ops.updateEventDayTask>[2]) => selectedEvent ? runLiveOps("update task", () => ops.updateEventDayTask(selectedEvent.id, taskId, input)) : Promise.resolve(),
    escalateEventDayTask: (taskId: string, input: Parameters<typeof ops.escalateEventDayTask>[2]) => selectedEvent ? runLiveOps("escalate task", () => ops.escalateEventDayTask(selectedEvent.id, taskId, input)) : Promise.resolve(),
    createUrgentIssue: (input: Parameters<typeof ops.createUrgentIssue>[1]) => selectedEvent ? runLiveOps("create issue", () => ops.createUrgentIssue(selectedEvent.id, input)) : Promise.resolve(),
    updateUrgentIssue: (issueId: string, input: Parameters<typeof ops.updateUrgentIssue>[2]) => selectedEvent ? runLiveOps("update issue", () => ops.updateUrgentIssue(selectedEvent.id, issueId, input)) : Promise.resolve(),
    escalateUrgentIssue: (issueId: string, input: Parameters<typeof ops.escalateUrgentIssue>[2]) => selectedEvent ? runLiveOps("escalate issue", () => ops.escalateUrgentIssue(selectedEvent.id, issueId, input)) : Promise.resolve(),
    updateCoordinatorAttendance: (assignmentId: string, input: Parameters<typeof ops.updateCoordinatorAttendance>[2]) => selectedEvent ? runLiveOps("attendance", () => ops.updateCoordinatorAttendance(selectedEvent.id, assignmentId, input)) : Promise.resolve(),
    replaceCoordinator: (assignmentId: string, input: Parameters<typeof ops.replaceCoordinator>[2]) => selectedEvent ? runLiveOps("replace coordinator", () => ops.replaceCoordinator(selectedEvent.id, assignmentId, input)) : Promise.resolve(),
    verifySupplierStatus: (requestId: string, input: Parameters<typeof ops.verifySupplierStatus>[2]) => selectedEvent ? runLiveOps("verify supplier", () => ops.verifySupplierStatus(selectedEvent.id, requestId, input)) : Promise.resolve(),
    createTemplateDraftAction: (template: FloorPlanTemplate) => run("create floorplan", () => createTemplateDraft(template)),
    openDraft: (event: PrismEvent, draft: PrismFloorPlanDraft) => run("open draft", () => openEditor(event, draft)),
    uploadConforme: async (file: { name: string; type: string; size: number }) => {
      if (!conformeUploadTarget) return;
      await ops.uploadConforme(conformeUploadTarget.id, {
        fileName: file.name,
        mimeType: file.type,
        sizeBytes: file.size,
      });
      await refresh();
    },
    saveEditorPlan: (project: Project) => ops.savePlan(project),
    submitEditorPlan: async (project: Project) => {
      if (screen.name !== "editor") return;
      await ops.savePlan(project);
      await ops.submitFloorPlanDraft(screen.event.id, screen.draft.id);
      await refresh(session);
      setScreen({ name: "portal" });
    },
    closeEditor: () => setScreen({ name: "portal" }),
    refreshCommandInbox: async () => {
      const data = await loadCommandInbox(true);
      setCommandInbox(data);
      setCommandInboxLoadFailed(false);
      return data;
    },
    resetDashboard: () => run("reset", ops.reset),
    approveApprovalRequest: (requestId: string) => run("approve account", () => ops.approveApprovalRequest(requestId)),
    declineApprovalRequest: (requestId: string) => run("decline account", () => ops.declineApprovalRequest(requestId)),
    submitBriefing: () => selectedEvent ? run("briefing", () => ops.submitBriefing(selectedEvent.id)) : Promise.resolve(),
    runPlanningCompliance: () => selectedEvent ? run("compliance", () => ops.runCompliance(selectedEvent.id, "planning")) : Promise.resolve(),
    submitFloorPlanDraft: (draft: PrismFloorPlanDraft) => selectedEvent ? run("submit draft", () => ops.submitFloorPlanDraft(selectedEvent.id, draft.id)) : Promise.resolve(),
    approveFloorPlanDraft: (draft: PrismFloorPlanDraft) => selectedEvent ? run("approve draft", () => ops.approveFloorPlanDraft(selectedEvent.id, draft.id)) : Promise.resolve(),
    withdrawSupplier: (requestId: string) => selectedEvent ? run("withdraw supplier", () => ops.withdrawSupplier(selectedEvent.id, requestId)) : Promise.resolve(),
    uploadConformeTarget: (inquiry: PrismInquiry) => setConformeUploadTarget(inquiry),
    openConformeUpload: (inquiry: PrismInquiry) => {
      setConformeUploadTarget(inquiry);
      return Promise.resolve();
    },
    closeConformeUpload: () => setConformeUploadTarget(null),
    loadingShellCopy: routeLoadingShellCopy(routeState),
    loadingShellNavItems: loadingShellNavItems(Boolean(routeState.eventId)),
  };
}
