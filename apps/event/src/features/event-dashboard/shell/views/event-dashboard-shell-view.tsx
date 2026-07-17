"use client";



import { Card, CardBody, CardHeader, SectionAccent } from "./sections/shell-ui";
import { EventFileHub } from "./sections/event-file-hub";
import { EventCalendarWorkspace } from "./sections/event-calendar-workspace";
import { EventTasksWorkspace } from "./sections/event-tasks-workspace";
import { EventSettingsWorkspace } from "./sections/event-settings-workspace";
import { CommandHomePage } from "./sections/command-home-page";
import { EventQueueCard } from "./sections/event-queue-card";

import { formatShortDate, humanizeToken, useEventOpsCommands } from "@/features/event-ops";
import dynamic from "next/dynamic";
import {
  useEffect,
  useMemo,
  useState } from "react";
import { usePathname,
  useRouter } from "next/navigation";
import {
  AlertTriangle,
  Archive,
  CalendarClock,
  CalendarDays,
  CheckCircle2,
  ClipboardCheck,
  CircleUserRound,
  Download,
  Eye,
  FileCheck2,
  FileSignature,
  FileText,
  Grid2X2,
  Home,
  Inbox,
  LayoutGrid,
  List,
  MapPinned,
  MessageSquareText,
  MoreHorizontal,
  Pencil,
  Radio,
  ReceiptText,
  RotateCcw,
  Search,
  Settings,
  ShieldCheck,
  Share2,
  Tags,
  Truck,
  Upload,
  UsersRound,
  type LucideIcon,
  } from "lucide-react";
import {
  type PrismApprovalRequest,
  type PrismBillingStatement,
  type PrismBriefing,
  type PrismComplianceCheck,
  type PrismCoordinatorWorkspace,
  type PrismDefenseReadiness,
  type PrismDocument,
  type PrismEvent,
  type PrismEventDayStatusFeed,
  type PrismFloorPlanDraft,
  type PrismInquiry,
  type PrismLiveOps,
  type PrismPostEventDocument,
  type PrismPmcmCommandInbox,
  type PrismPmcmDashboardWorkspace,
  type PrismSupplierQuoteRequest,
} from "@/lib/prism-api";
import { PrismDashboardShell, type PrismNavItem } from "@prism/ui";
import { Alert, AlertDescription } from "@/app/components/ui/alert";
import { Button } from "@/app/components/ui/button";
import { StatusBadge } from "@/app/components/ui/status-badge";
import { EmptyState } from "@/app/components/ui/empty-state";
import { Badge } from "@/app/components/ui/badge";
import { AuditTrailPanel } from "@/features/audit/trail";
import { ClientOnboardingTracker } from "@/features/clients/onboarding";
import { ConformeUploadModal } from "@/features/conforme/upload";
import { InquiryIntakeLog } from "@/features/inquiries/intake";
import { PAREPanel } from "@/features/pare/panel";
import { Phase4Workspace } from "@/features/closure/phase4";
import { CoordinatorAssignmentDesk, CoordinatorView } from "@/features/coordinators/desk";
import { EventCommandInbox, EventOverviewPanels } from "@/features/command-inbox/list";
import { FinancialWorkspace } from "@/features/finance/workspace";
import { LiveOperationsWorkspace } from "@/features/live-ops/workspace";
import { SupplierDirectory, SupplierQuotePlanner } from "@/features/suppliers/directory";
import {
  EventDashboardSessionSkeleton,
  EventDashboardSkeleton,
  SkeletonCard,
  SkeletonLine,
  eventDashboardSkeletonVariant,
} from "@/app/dashboard/components/event-dashboard-skeleton";
import { cloneTemplateObjects, loadTemplates, type FloorPlanTemplate } from "@/features/floorplan/editor/templates";
import type { Project } from "@/features/floorplan/editor/types";
import { clearEventSession, readStoredEventSession, type EventSession } from "@/app/lib/session";
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
import {
  getCachedCommandInbox,
  loadCommandInbox,
} from "@/features/command-inbox/list";
import { EventMessagesWorkspace } from "@/app/dashboard/components/event-messages-workspace";

export type { EventDashboardClientProps };

const EditorShell = dynamic(
  () => import("@/features/floorplan/editor/EditorShell").then((mod) => mod.EditorShell),
  {
    ssr: false,
    loading: () => (
      <div className="grid size-full place-items-center bg-background text-sm text-muted-foreground">
        Loading PMCM editor...
      </div>
    ),
  },
);

type Screen =
  | { name: "portal" }
  | { name: "editor"; event: PrismEvent; draft: PrismFloorPlanDraft; project: Project };

const phpMoney = new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP", maximumFractionDigits: 0 });

const EVENT_WORKSPACE_CACHE_MS = 20_000;

function isFresh(loadedAt: number, ttl?: number) {
  if (ttl == null) return isDashboardCacheFresh(loadedAt);
  return Date.now() - loadedAt < ttl;
}

/* ── Shared card primitive ─────────────────────────────────── */





function loadingShellNavItems(hasEvent: boolean): PrismNavItem[] {
  return eventPortalNavItems({ hasEvent });
}

function eventPortalNavItems({
  hasEvent,
  eventName,
  inquiryCount,
  taskCount,
  commandInboxCount,
  assignmentCount,
  quoteCount,
  draftCount,
  paymentCount,
  closeoutCount,
}: {
  hasEvent: boolean;
  eventName?: string;
  inquiryCount?: number;
  taskCount?: number;
  commandInboxCount?: number | string;
  assignmentCount?: number;
  quoteCount?: number;
  draftCount?: number;
  paymentCount?: number;
  closeoutCount?: number;
}): PrismNavItem[] {
  const eventSection = eventName ? "Current event" : "Event workspace";
  return [
    { id: "dashboard", icon: Home, label: "Dashboard", section: "PMCM" },
    { id: "inquiries", icon: FileSignature, label: "Inquiries", section: "PMCM", badge: inquiryCount || undefined },
    { id: "clients", icon: CircleUserRound, label: "Clients", section: "PMCM" },
    { id: "events-list", icon: CalendarDays, label: "Events", section: "PMCM" },
    { id: "calendar", icon: CalendarClock, label: "Calendar", section: "PMCM" },
    { id: "tasks", icon: ClipboardCheck, label: "Tasks", section: "PMCM", badge: taskCount || undefined },
    { id: "command-inbox", icon: Inbox, label: "Command Inbox", section: "PMCM", badge: commandInboxCount || undefined },
    ...(hasEvent
      ? [
          { id: "event-overview", icon: LayoutGrid, label: "Overview", section: eventSection },
          { id: "event-planning", icon: FileCheck2, label: "Briefing", section: eventSection },
          { id: "event-files", icon: MapPinned, label: "Floorplans", section: eventSection, badge: draftCount || undefined },
          { id: "event-suppliers", icon: Truck, label: "Suppliers", section: eventSection, badge: quoteCount || undefined },
          { id: "event-staff", icon: UsersRound, label: "Coordinators", section: eventSection, badge: assignmentCount || undefined },
          { id: "event-timeline", icon: Radio, label: "Live Ops", section: eventSection },
          { id: "event-budget", icon: ReceiptText, label: "Billing", section: eventSection, badge: paymentCount || undefined },
          { id: "event-report", icon: Archive, label: "Closure", section: eventSection, badge: closeoutCount || undefined },
          { id: "event-messages", icon: MessageSquareText, label: "Activity", section: eventSection },
        ]
      : []),
    { id: "suppliers", icon: Tags, label: "Supplier Directory", section: "Management" },
    { id: "audit", icon: ShieldCheck, label: "Audit Trail", section: "System" },
    { id: "settings", icon: Settings, label: "Settings", section: "System" },
  ];
}

/* ── Home page stat card ───────────────────────────────────── */

/* ── Event queue card (inline, no right rail) ──────────────── */

/* ── Home / command page ───────────────────────────────────── */

/* ── Main dashboard export ─────────────────────────────────── */

export function EventDashboardShellView({
  section: initialSection,
  tab: initialTab,
  eventId: initialEventId,
  clientId: initialClientId,
  view: initialView,
}: EventDashboardClientProps = {}) {
  const ops = useEventOpsCommands();
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
  } = selectEventWorkspaceResources(state, selectedEvent);
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

  /* Loading */
  if (!session) {
    return <EventDashboardSessionSkeleton />;
  }

  /* Wrong role */
  if (session.role !== "pmcm-admin" && session.role !== "coordinator") {
    return (
      <main className="grid min-h-screen place-items-center bg-background px-6">
        <section className="w-full max-w-md rounded-2xl border border-border bg-card p-8 shadow-sm">
          <ShieldCheck className="size-12 rounded-xl bg-amber-50 p-2.5 text-amber-600" />
          <h1 className="mt-5 text-xl font-bold text-foreground">Wrong portal for this account.</h1>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            {session.role === "client"
              ? "Client accounts belong in the client portal at http://localhost:3001."
              : "Supplier accounts belong in the supplier portal at http://localhost:3002."}
          </p>
          <Button className="mt-5 rounded-lg font-bold" onClick={() => { clearEventSession(); router.replace("/sign-in"); }}>
            Use event team sign-in
          </Button>
        </section>
      </main>
    );
  }

  /* Editor fullscreen */
  if (screen.name === "editor") {
    return (
      <div className="h-screen w-full overflow-hidden">
        <EditorShell
          project={screen.project}
          eventName={screen.event.eventName}
          draftName={screen.draft.name}
          draftStatus={screen.draft.status}
          onSave={(project) => ops.savePlan(project)}
          onSubmit={async (project) => {
            await ops.savePlan(project);
            await ops.submitFloorPlanDraft(screen.event.id, screen.draft.id);
            await refresh(session);
            setScreen({ name: "portal" });
          }}
          onBack={() => setScreen({ name: "portal" })}
        />
      </div>
    );
  }

  /* Coordinator view */
  if (session.role === "coordinator") {
    if (!coordinatorState) {
      return (
        <main className="grid min-h-screen place-items-center bg-background px-6">
          {error ? (
            <Alert variant="destructive" className="max-w-md rounded-xl"><AlertDescription>{error}</AlertDescription></Alert>
          ) : (
            <div className="w-full max-w-5xl">
              <SkeletonCard>
                <div className="flex items-center gap-3">
                  <SkeletonLine className="size-10 rounded-md" />
                  <div>
                    <SkeletonLine className="h-4 w-44 rounded-md" />
                    <SkeletonLine className="mt-2 h-3 w-64 rounded-md" />
                  </div>
                </div>
              </SkeletonCard>
              <div className="mt-5">
                <EventDashboardSkeleton variant="coordinator" />
              </div>
            </div>
          )}
        </main>
      );
    }
    return (
      <CoordinatorView session={session} state={coordinatorState} onRefresh={() => refresh(session)} onSignOut={signOut} />
    );
  }

  /* PMCM loading */
  if (!state) {
    const loadingVariant = eventDashboardSkeletonVariant(routeState);
    const loadingShellCopy = routeLoadingShellCopy(routeState);
    return (
      <PrismDashboardShell
        productLabel="P.R.I.S.M"
        roleLabel="PMCM Event Command"
        eyebrow={loadingShellCopy.eyebrow}
        title={loadingShellCopy.title}
        description="Loading the PMCM event command data, route context, and workspace queue."
        activeItemId={activeSidebarItemFromRoute(routeState)}
        navItems={loadingShellNavItems(Boolean(routeState.eventId))}
        sidebarMode="single"
        onNavSelect={handleSidebarNav}
        user={{ name: session.name, detail: humanizeToken(session.role), initials: session.name.slice(0, 2).toUpperCase() }}
        searchPlaceholder="Search events, suppliers, inquiries..."
        showTopBarSearch={false}
        onSignOut={signOut}
      >
        {error ? (
          <Alert variant="destructive" className="max-w-md rounded-xl"><AlertDescription>{error}</AlertDescription></Alert>
        ) : (
          <EventDashboardSkeleton variant={loadingVariant} />
        )}
      </PrismDashboardShell>
    );
  }

  /* Main PMCM portal */
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

  /* Section routing flags */
  const isHome = section === "dashboard";
  const isCommandInbox = section === "command-inbox";
  const isEventsList = section === "events-list";
  const isInquiries = section === "inquiries";
  const isClients = section === "clients";
  const isCalendar = section === "calendar";
  const isTasks = section === "tasks";
  const isTeam = section === "team";
  const isFiles = section === "files";
  const isMessages = section === "messages";
  const isFinance = section === "finance";
  const isSettings = section === "settings";

  return (
    <PrismDashboardShell
      productLabel="P.R.I.S.M"
      roleLabel="PMCM Event Command"
      eyebrow={
        section === "suppliers" ? "Supplier directory"
        : section === "audit" ? "Audit log"
        : isClients ? "Clients"
        : isCalendar ? "Calendar"
        : isTasks ? "Tasks"
        : isCommandInbox ? "Command inbox"
        : isTeam ? "Team"
        : isFiles ? "Files"
        : isMessages ? "Messages"
        : isFinance ? "Finance"
        : isSettings ? "Settings"
        : isInquiries ? "Inquiries"
        : isEventsList ? "Events"
        : isHome ? "Command home"
        : "Event workspace"
      }
      title={
        section === "suppliers" ? "Supplier Directory"
        : section === "audit" ? "Audit Trail"
        : isClients ? activeNavItem?.label ?? "Client Desk"
        : isCalendar ? activeNavItem?.label ?? "Calendar"
        : isTasks ? activeNavItem?.label ?? "Task Queue"
        : isCommandInbox ? "Command Inbox"
        : isTeam ? "Team & Coordinators"
        : isFiles ? activeNavItem?.label ?? "Event File Hub"
        : isMessages ? activeNavItem?.label ?? "Event Messages"
        : isFinance ? activeNavItem?.label ?? "Finance Desk"
        : isSettings ? activeNavItem?.label ?? "Settings"
        : isInquiries ? "Inquiry Intake"
        : isEventsList ? activeNavItem?.label ?? "All Events"
        : isHome ? activeNavItem?.label ?? "Event Manager"
        : selectedEvent?.eventName ?? "Event Manager"
      }
      description={
        section === "suppliers" ? "Master supplier directory with category tagging, tiering, and performance reviews."
        : section === "audit" ? "Complete audit trail of all actions, approvals, and system events."
        : isClients ? "Client intake, conforme status, approval requests, and portal readiness."
        : isCalendar ? "Event dates, planning windows, supplier deadlines, and onsite schedule checkpoints."
        : isTasks ? "PMCM actions across inquiries, approvals, planning, finance, live operations, and closure."
        : isCommandInbox ? "Prioritized action queue across inquiries, suppliers, billing, coordinators, and closure."
        : isTeam ? "Coordinator roster, assignment coverage, availability, and event-day staffing."
        : isFiles ? "Operational documents, official floorplans, billing statements, contracts, and closeout records."
        : isMessages ? "Client, supplier, coordinator, and internal PMCM communication threads."
        : isFinance ? "Billing statements, payment milestones, balances, and statement delivery."
        : isSettings ? "Workspace preferences, account context, notification defaults, and role-safe system controls."
        : isInquiries ? "Review, accept, pend, or decline incoming event inquiries."
        : isEventsList ? "Confirmed event workspaces ready for planning and operations."
        : isHome ? "Active event workspaces, inquiry intake, and client onboarding."
        : selectedEvent ? `${selectedEvent.clientName} — ${selectedEvent.eventDate}`
        : "Select an event or accept an inquiry to begin."
      }
      activeItemId={sidebarActiveOverride ?? activeSidebarItemId}
      navItems={shellNavItems}
      sidebarMode="single"
      onNavSelect={handleSidebarNav}
      user={{ name: session.name, detail: humanizeToken(session.role), initials: session.name.slice(0, 2).toUpperCase() }}
      searchPlaceholder="Search events, suppliers, inquiries..."
      showTopBarSearch={false}
      onSignOut={signOut}
    >
      <div className="space-y-5">
        {error && (
          <Alert variant="destructive" className="rounded-xl">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {isCalendar ? (
          <EventCalendarWorkspace
            events={events}
            selectedEventId={selectedEvent?.id}
            onOpenEvent={(eventId) => navigateEvent(eventId, "overview")}
          />
        ) : isTasks ? (
          <EventTasksWorkspace
            unreviewedInquiries={unreviewedInquiries}
            pendingApprovals={pendingApprovals}
            selectedEvent={selectedEvent}
            defenseReadiness={defenseReadiness}
            draftsCount={drafts.length}
            quoteCount={quotes.length}
            paymentCount={payments.length}
            openCheckCount={openCheckCount}
            onNavigateSection={navigateSection}
            onNavigateEventTab={(nextTab) => navigateEventTab(nextTab)}
          />
        ) : isCommandInbox ? (
          <EventCommandInbox
            inbox={commandInbox}
            onRefresh={() => loadCommandInbox(true).then((data) => { setCommandInbox(data); setCommandInboxLoadFailed(false); }).catch(() => setCommandInboxLoadFailed(true))}
            loadFailed={commandInboxLoadFailed}
          />
        ) : isSettings ? (
          <EventSettingsWorkspace session={session} selectedEvent={selectedEvent} />
        ) : isClients ? (
          <>
            {selectedClient ? (
              <Card>
                <CardHeader>
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <SectionAccent>Client overview</SectionAccent>
                      <h2 className="mt-1 text-base font-black text-foreground">{selectedClient.name}</h2>
                      <p className="mt-1 text-sm text-muted-foreground">{selectedClient.contact ?? "Primary contact pending"}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button variant="outline" className="h-8 rounded-md px-3 text-xs font-bold" onClick={() => navigateSection("clients")}>
                        All Clients
                      </Button>
                      <StatusBadge status={selectedClient.events.length ? "active" : "prospect"} />
                    </div>
                  </div>
                </CardHeader>
                <CardBody className="grid gap-3 md:grid-cols-4">
                  {[
                    { label: "Active Events", value: selectedClient.events.length },
                    { label: "Open Inquiries", value: selectedClient.inquiries.length },
                    { label: "Balance", value: phpMoney.format(payments.reduce((sum, item) => sum + item.remainingBalance, 0)) },
                    { label: "Last Activity", value: selectedClient.events[0]?.eventDate ?? "Pending" },
                  ].map((item) => (
                    <div key={item.label} className="rounded-md border border-border bg-muted/20 px-4 py-3">
                      <p className="text-lg font-black text-foreground">{item.value}</p>
                      <p className="mt-1 text-xs font-bold text-muted-foreground">{item.label}</p>
                    </div>
                  ))}
                </CardBody>
              </Card>
            ) : (
              <Card>
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <CircleUserRound className="size-4 text-(--prism-signal)" />
                    <h2 className="text-sm font-bold text-foreground">{activeNavItem?.label ?? "All clients"}</h2>
                  </div>
                </CardHeader>
                <div className="divide-y divide-border">
                  {clientRecordsForView.map((client) => (
                    <button key={client.id} type="button" onClick={() => navigateClient(client.id)} className="flex w-full items-center justify-between gap-4 px-6 py-4 text-left transition hover:bg-muted/30">
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-black text-foreground">{client.name}</span>
                        <span className="mt-1 block truncate text-xs text-muted-foreground">{client.contact ?? "Contact pending"} - {client.events.length} event(s)</span>
                      </span>
                      <StatusBadge status={client.events.length ? "active" : "prospect"} />
                    </button>
                  ))}
                  {clientRecordsForView.length === 0 ? (
                    <div className="px-6 py-8">
                      <EmptyState icon={CircleUserRound} title="No clients in this view" description="Client records will appear here once their inquiry and event state matches this filter." />
                    </div>
                  ) : null}
                </div>
              </Card>
            )}
            {selectedClient && (routeState.view ?? "overview") !== "overview" ? (
              <Card>
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <FileText className="size-4 text-(--prism-signal)" />
                    <h2 className="text-sm font-bold text-foreground">{activeNavItem?.label ?? "Client detail"}</h2>
                  </div>
                </CardHeader>
                <CardBody>
                  {routeState.view === "events" ? (
                    <div className="divide-y divide-border overflow-hidden rounded-md border border-border">
                      {selectedClient.events.map((event) => (
                        <button key={event.id} type="button" onClick={() => navigateEvent(event.id, "overview")} className="flex w-full items-center justify-between gap-4 px-4 py-3 text-left transition hover:bg-muted/30">
                          <span className="min-w-0">
                            <span className="block truncate text-sm font-black text-foreground">{event.eventName}</span>
                            <span className="mt-1 block text-xs text-muted-foreground">{event.eventDate}</span>
                          </span>
                          <StatusBadge status={event.status} />
                        </button>
                      ))}
                      {selectedClient.events.length === 0 ? (
                        <div className="px-4 py-6">
                          <EmptyState icon={CalendarDays} title="No events yet" description="Accepted inquiries with signed conforme will create client event workspaces here." />
                        </div>
                      ) : null}
                    </div>
                  ) : (
                    <div className="grid gap-3 md:grid-cols-3">
                      {[
                        { label: "Contact Person", value: selectedClient.contact ?? "Pending" },
                        { label: "Company", value: selectedClient.company ?? selectedClient.name },
                        { label: "Record Scope", value: `${selectedClient.events.length} events / ${selectedClient.inquiries.length} inquiries` },
                      ].map((item) => (
                        <div key={item.label} className="rounded-md border border-border bg-muted/20 px-4 py-3">
                          <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{item.label}</p>
                          <p className="mt-1 text-sm font-black text-foreground">{item.value}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </CardBody>
              </Card>
            ) : null}
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <CircleUserRound className="size-4 text-(--prism-signal)" />
                  <h2 className="text-sm font-bold text-foreground">Client pipeline</h2>
                </div>
              </CardHeader>
              <CardBody className="grid gap-3 sm:grid-cols-3">
                {[
                  { label: "Total inquiries", value: state.inquiries.length, tone: "text-(--prism-signal)" },
                  { label: "Need review", value: unreviewedInquiries, tone: "text-(--prism-amber)" },
                  { label: "Pending accounts", value: pendingApprovals.length, tone: "text-(--prism-success)" },
                ].map((item) => (
                  <div key={item.label} className="rounded-xl border border-border bg-muted/20 px-4 py-3">
                    <p className={`text-2xl font-black ${item.tone}`}>{item.value}</p>
                    <p className="mt-1 text-xs font-bold text-muted-foreground">{item.label}</p>
                  </div>
                ))}
              </CardBody>
            </Card>
            <InquiryIntakeLog
              inquiries={state.inquiries}
              onAccept={(inq) => run("accept inquiry", () => ops.acceptInquiry(inq.id))}
              onPend={(inq) => run("pend inquiry", () => ops.pendInquiry(inq.id))}
              onDecline={(inq, reason) => run("decline inquiry", () => ops.declineInquiry(inq.id, reason))}
              busy={Boolean(busy)}
            />
            <ClientOnboardingTracker
              inquiries={state.inquiries}
              onUploadConforme={(inq) => { setConformeUploadTarget(inq); return Promise.resolve(); }}
              onSendReminder={(inq) => run("conforme reminder", () => ops.sendConformeReminder(inq.id))}
              busy={Boolean(busy)}
            />
          </>
        ) : isTeam ? (
          selectedEvent ? (
            <CoordinatorAssignmentDesk
              event={selectedEvent}
              coordinators={coordinators}
              assignments={state.coordinatorAssignments}
              roleRequirements={coordinatorRoleRequirements}
              busy={Boolean(busy)}
              onAssign={(coordinator, role, override) => run("coordinator assignment", () =>
                ops.assignCoordinator(selectedEvent.id, { coordinatorId: coordinator.id, role, overrideConflict: override })
              )}
            />
          ) : (
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <UsersRound className="size-4 text-(--prism-signal)" />
                  <h2 className="text-sm font-bold text-foreground">Coordinator roster</h2>
                </div>
              </CardHeader>
              <div className="divide-y divide-border">
                {coordinators.map((coordinator) => (
                  <div key={coordinator.id} className="flex items-start justify-between gap-4 px-6 py-4">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-bold text-foreground">{coordinator.name}</p>
                      <p className="mt-1 text-xs text-muted-foreground">{coordinator.roleTags.join(", ") || "General coordinator"}</p>
                      {coordinator.skillsTags.length > 0 && (
                        <p className="mt-0.5 text-xs text-muted-foreground/70">{coordinator.skillsTags.join(", ")}</p>
                      )}
                    </div>
                    <StatusBadge status={coordinator.active ? "active" : "inactive"} />
                  </div>
                ))}
              </div>
            </Card>
          )
        ) : isFiles ? (
          selectedEvent ? (
            <EventFileHub
              event={selectedEvent}
              documents={documents}
              drafts={drafts}
              billingStatements={billingStatements}
              quoteRequests={quoteRequests}
              briefing={briefing}
              checks={checks}
              postEventDocuments={postEventDocuments}
              onOpenFloorplans={() => navigateEventTab("floorplans")}
              onOpenBriefing={() => navigateEventTab("briefing")}
              onOpenSuppliers={() => navigateEventTab("suppliers")}
              onOpenBilling={() => navigateEventTab("billing")}
              onOpenClosure={() => navigateEventTab("closure")}
            />
          ) : (
            <EmptyState icon={FileText} title="Select an event" description="Files are organized by event workspace after conforme activation." />
          )
        ) : isMessages ? (
          selectedEvent ? (
            <EventMessagesWorkspace
              event={selectedEvent}
              session={session}
              audit={audit}
              notificationLogs={notificationLogs}
            />
          ) : (
            <EmptyState icon={MessageSquareText} title="Select an event" description="Client, supplier, coordinator, and internal threads are event-scoped." />
          )
        ) : isFinance ? (
          selectedEvent ? (
            <FinancialWorkspace
              event={selectedEvent}
              inquiry={selectedInquiry}
              billingStatements={billingStatements}
              payments={payments}
              notificationLogs={notificationLogs}
              busy={Boolean(busy)}
              onRecordPayment={(milestoneId, input) => run("record payment", () => ops.recordPayment(selectedEvent.id, milestoneId, input))}
              onSendBilling={(billingId) => run("send billing", () => ops.sendBillingStatement(selectedEvent.id, billingId))}
            />
          ) : (
            <EmptyState icon={ReceiptText} title="Select an event" description="Finance opens inside a confirmed event so billing can stay tied to proposal and conforme records." />
          )
        ) : section === "suppliers" ? (
          <SupplierDirectory
            categories={supplierCategories}
            suppliers={suppliers}
            onToggleBni={(supplier, value) => run("supplier BNI flag", () => ops.updateSupplier(supplier.id, { bniMember: value }))}
            onCreateSupplier={(input) => run("create supplier", () => ops.createSupplier(input))}
            onUpdateSupplier={(supplierId, input) => run("update supplier", () => ops.updateSupplier(supplierId, input))}
            onChangeTier={(supplierId, tier, reason) => run("supplier tier change", () => ops.changeSupplierTier(supplierId, { tier, reason }))}
            onAddReview={(supplierId, input) => run("supplier private review", () => ops.addSupplierReview(supplierId, { ...input, eventId: selectedEvent?.id }))}
            onAddCertification={(supplierId, input) => run("supplier certification", () => ops.addSupplierCertification(supplierId, input))}
            onOpenEvent={(eventId) => navigateEvent(eventId, "overview")}
            busy={Boolean(busy)}
          />
        ) : section === "audit" ? (
          <AuditTrailPanel events={events} users={state.users} session={session} />
        ) : isInquiries ? (
          <>
            <InquiryIntakeLog
              inquiries={state.inquiries}
              onAccept={(inq) => run("accept inquiry", () => ops.acceptInquiry(inq.id))}
              onPend={(inq) => run("pend inquiry", () => ops.pendInquiry(inq.id))}
              onDecline={(inq, reason) => run("decline inquiry", () => ops.declineInquiry(inq.id, reason))}
              busy={Boolean(busy)}
            />
            <ClientOnboardingTracker
              inquiries={state.inquiries}
              onUploadConforme={(inq) => { setConformeUploadTarget(inq); return Promise.resolve(); }}
              onSendReminder={(inq) => run("conforme reminder", () => ops.sendConformeReminder(inq.id))}
              busy={Boolean(busy)}
            />
          </>
        ) : isEventsList ? (
          <EventQueueCard
            events={eventsForView}
            selectedEventId={selectedEvent?.id}
            onSelectEvent={(id) => navigateEvent(id)}
            onReset={() => run("reset", ops.reset)}
            onNavigateEvent={(id) => navigateEvent(id, "overview")}
          />
        ) : isHome ? (
          <>
            <CommandHomePage
              session={session}
              state={state}
              events={events}
              selectedEvent={selectedEvent}
              unreviewedInquiries={unreviewedInquiries}
              pendingApprovals={pendingApprovals}
              defenseReadiness={defenseReadiness}
              onNavigateSection={navigateSection}
              onNavigateEvent={navigateEvent}
              onReset={() => run("reset", ops.reset)}
            />

            {/* Inquiry + onboarding below the command grid */}
            <InquiryIntakeLog
              inquiries={state.inquiries}
              onAccept={(inq) => run("accept inquiry", () => ops.acceptInquiry(inq.id))}
              onPend={(inq) => run("pend inquiry", () => ops.pendInquiry(inq.id))}
              onDecline={(inq, reason) => run("decline inquiry", () => ops.declineInquiry(inq.id, reason))}
              busy={Boolean(busy)}
            />

            <ClientOnboardingTracker
              inquiries={state.inquiries}
              onUploadConforme={(inq) => { setConformeUploadTarget(inq); return Promise.resolve(); }}
              onSendReminder={(inq) => run("conforme reminder", () => ops.sendConformeReminder(inq.id))}
              busy={Boolean(busy)}
            />

            {/* Pending account approvals */}
            {pendingApprovals.length > 0 && (
              <Card>
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="size-4 text-(--prism-signal)" />
                    <h2 className="text-sm font-bold text-foreground">Account approvals</h2>
                  </div>
                </CardHeader>
                <div className="divide-y divide-border">
                  {pendingApprovals.map((request) => (
                    <div key={request.id} className="flex items-start justify-between gap-4 px-6 py-4">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-bold text-foreground">{request.name}</p>
                        <p className="mt-0.5 text-xs text-muted-foreground">{request.email}</p>
                        <p className="mt-1 text-[10px] font-bold uppercase tracking-wider text-(--prism-amber)">
                          {humanizeToken(request.role)} — {request.organization}
                        </p>
                      </div>
                      <div className="flex shrink-0 flex-wrap gap-2">
                        <Button size="sm" disabled={!!busy} onClick={() => run("approve account", () => ops.approveApprovalRequest(request.id))} className="rounded-lg font-bold">
                          Approve
                        </Button>
                        <Button size="sm" variant="outline" disabled={!!busy} onClick={() => run("decline account", () => ops.declineApprovalRequest(request.id))} className="rounded-lg font-bold">
                          Decline
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            )}
          </>
        ) : (
          /* Event workspace */
          selectedEvent ? (
            <div className="space-y-5">
              {/* Event header */}
              <div className="flex flex-wrap items-start justify-between gap-4 rounded-2xl border border-border bg-card px-6 py-5 shadow-sm">
                <div className="min-w-0">
                  <p className="text-xs font-bold uppercase tracking-widest text-(--prism-signal)">Event workspace</p>
                  <h1 className="mt-1 text-xl font-bold text-foreground">{selectedEvent.eventName}</h1>
                  <p className="mt-1 text-sm text-muted-foreground">{selectedEvent.clientName} — {selectedEvent.eventDate}</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <StatusBadge status={selectedEvent.status} />
                    <StatusBadge status={selectedEvent.floorPlanStatus} label={`Floorplan ${humanizeToken(selectedEvent.floorPlanStatus)}`} />
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" className="rounded-lg font-bold" onClick={() => run("briefing", () => ops.submitBriefing(selectedEvent.id))}>
                    Submit briefing
                  </Button>
                  <Button size="sm" variant="outline" className="rounded-lg font-bold" onClick={() => navigateEventTab("suppliers")}>
                    Supplier desk
                  </Button>
                  <Button size="sm" variant="outline" className="rounded-lg font-bold" onClick={() => navigateEventTab("live-ops")}>
                    Live ops
                  </Button>
                </div>
              </div>

              {tab === "overview" && (
                <EventOverviewPanels
                  event={selectedEvent}
                  defenseReadiness={defenseReadiness}
                  drafts={drafts}
                  activeDraft={activeDraft}
                  quoteRequestCount={quoteRequests.length}
                  quoteCount={quotes.length}
                  openCheckCount={openCheckCount}
                  onSubmitBriefing={() => run("briefing", () => ops.submitBriefing(selectedEvent.id))}
                  onOpenSupplierDesk={() => navigateEventTab("suppliers")}
                  onRunCompliance={() => run("compliance", () => ops.runCompliance(selectedEvent.id, "planning"))}
                  onOpenCoordinatorDesk={() => navigateEventTab("coordinators")}
                  onOpenLiveOps={() => navigateEventTab("live-ops")}
                  onOpenFloorplans={() => navigateEventTab("floorplans")}
                  onOpenBilling={() => navigateEventTab("billing")}
                  onOpenClosure={() => navigateEventTab("closure")}
                />
              )}

              {tab === "floorplans" && (
                <div className="space-y-4">
                  <Card>
                    <CardHeader>
                      <div className="flex items-center gap-2">
                        <MapPinned className="size-4 text-(--prism-signal)" />
                        <h2 className="text-sm font-bold text-foreground">Start PMCM draft</h2>
                      </div>
                    </CardHeader>
                    <CardBody>
                      {floorPlanTemplates.length ? (
                        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                          {floorPlanTemplates.slice(0, 4).map((template) => (
                            <button
                              key={template.id}
                              onClick={() => run("create floorplan", () => createTemplateDraft(template))}
                              className="rounded-xl border border-border bg-muted/30 p-4 text-left transition hover:border-(--prism-signal)/40 hover:bg-(--prism-signal-soft)"
                            >
                              <p className="text-sm font-bold text-foreground">{template.name}</p>
                              <p className="mt-1 text-xs leading-5 text-muted-foreground">{template.description || template.venue || "Saved PMCM template"}</p>
                            </button>
                          ))}
                        </div>
                      ) : (
                        <p className="rounded-xl border border-dashed border-border bg-muted/20 p-4 text-xs text-muted-foreground">
                          No saved templates yet. Save reusable layouts from the editor before starting a template-based draft.
                        </p>
                      )}
                    </CardBody>
                  </Card>
                  <Card>
                    <CardHeader>
                      <div className="flex items-center gap-2">
                        <LayoutGrid className="size-4 text-(--prism-signal)" />
                        <h2 className="text-sm font-bold text-foreground">Floorplan drafts and client preferences</h2>
                      </div>
                    </CardHeader>
                    <CardBody>
                      {drafts.length === 0 ? (
                        <EmptyState icon={LayoutGrid} title="No floorplan drafts yet" description="Pick a saved template above to create the first PMCM draft for this event." />
                      ) : (
                        <div className="space-y-4">
                          {drafts.map((draft) => (
                            <div key={draft.id} className="rounded-xl border border-border bg-muted/20 p-4">
                              <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                  <p className="truncate text-sm font-bold text-foreground">{draft.name}</p>
                                  <p className="mt-0.5 text-xs text-muted-foreground">{humanizeToken(draft.sourceType)} — {draft.createdByRole ?? "pmcm-admin"}</p>
                                </div>
                                <StatusBadge status={draft.status} />
                              </div>
                              {draft.clientPreference && (
                                <div className="mt-3 rounded-lg border border-border bg-card px-3 py-2 text-xs leading-5 text-muted-foreground">
                                  <p><span className="font-bold text-foreground">Seating:</span> {draft.clientPreference.seatingStyle}</p>
                                  <p><span className="font-bold text-foreground">Stage:</span> {draft.clientPreference.stagePreference}</p>
                                </div>
                              )}
                              <div className="mt-3 flex flex-wrap gap-2">
                                <Button size="sm" variant="outline" className="rounded-lg font-bold" onClick={() => run("open draft", () => openEditor(selectedEvent, draft))}>
                                  Open / Edit
                                </Button>
                                {draft.status !== "in_review" && draft.status !== "approved" && (
                                  <Button size="sm" className="rounded-lg font-bold" onClick={() => run("submit draft", () => ops.submitFloorPlanDraft(selectedEvent.id, draft.id))}>
                                    Submit
                                  </Button>
                                )}
                                {draft.status !== "approved" && (
                                  <Button size="sm" variant="outline" className="rounded-lg border-(--prism-success)/25 bg-(--prism-success)/8 font-bold text-(--prism-success) hover:bg-(--prism-success)/15" onClick={() => run("approve draft", () => ops.approveFloorPlanDraft(selectedEvent.id, draft.id))}>
                                    Approve
                                  </Button>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </CardBody>
                  </Card>
                </div>
              )}

              {tab === "briefing" && (
                <Card>
                  <CardHeader>
                    <div className="flex items-center gap-2">
                      <FileCheck2 className="size-4 text-(--prism-signal)" />
                      <h2 className="text-sm font-bold text-foreground">Event briefing</h2>
                    </div>
                  </CardHeader>
                  <CardBody>
                    {briefing ? (
                      <div className="grid gap-3 sm:grid-cols-2">
                        {[
                          { label: "Venue", value: briefing.venue },
                          { label: "Guest count", value: String(briefing.guestCount) },
                          { label: "Budget range", value: briefing.budgetRange },
                          { label: "Services", value: briefing.serviceRequirements.join(", ") },
                        ].map(({ label: lbText, value }) => (
                          <div key={lbText} className="rounded-xl bg-muted/40 p-4">
                            <p className="text-xs font-semibold text-muted-foreground">{lbText}</p>
                            <p className="mt-1.5 text-sm font-bold text-foreground">{value}</p>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <EmptyState icon={FileCheck2} title="No briefing submitted yet" description="Use the quick action to submit a sample briefing for this event." />
                    )}
                  </CardBody>
                </Card>
              )}

              {tab === "suppliers" && (
                <div className="space-y-5">
                  <Card>
                    <CardHeader>
                      <div className="flex items-center gap-2">
                        <Truck className="size-4 text-(--prism-signal)" />
                        <h2 className="text-sm font-bold text-foreground">Supplier desk</h2>
                      </div>
                    </CardHeader>
                    <CardBody>
                      <SupplierQuotePlanner
                        categories={supplierCategories}
                        suppliers={suppliers}
                        requests={quoteRequests}
                        quotes={quotes}
                        onRequestQuotes={(input) => run("request supplier quotes", () => ops.requestSupplierQuotes(selectedEvent.id, input))}
                        onSelectQuote={(quoteId) => run("select supplier quote", () => ops.selectSupplierQuote(selectedEvent.id, quoteId))}
                        busy={Boolean(busy)}
                      />
                    </CardBody>
                  </Card>

                  <Card>
                    <CardHeader>
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="grid size-5 place-items-center rounded bg-[var(--prism-signal)] text-white">
                            <svg viewBox="0 0 16 16" fill="none" className="size-3" aria-hidden="true">
                              <path d="M8 2l1.5 3 3.5.5-2.5 2.5.5 3.5L8 10l-3 1.5.5-3.5L3 5.5l3.5-.5L8 2z" fill="currentColor"/>
                            </svg>
                          </span>
                          <h2 className="text-sm font-bold text-foreground">PARE · Emergency Response Engine</h2>
                        </div>
                        <span className="rounded-full border border-border bg-muted px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-muted-foreground">
                          FR-AI-04
                        </span>
                      </div>
                    </CardHeader>
                    <CardBody>
                      <PAREPanel
                        eventId={selectedEvent.id}
                        assignedRequests={quoteRequests.filter((r) => r.assignmentStatus === "confirmed")}
                        suppliers={suppliers}
                        onWithdraw={(requestId) => run("withdraw supplier", () => ops.withdrawSupplier(selectedEvent.id, requestId))}
                        busy={Boolean(busy)}
                      />
                    </CardBody>
                  </Card>
                </div>
              )}

              {tab === "coordinators" && (
                <CoordinatorAssignmentDesk
                  event={selectedEvent}
                  coordinators={coordinators}
                  assignments={state.coordinatorAssignments}
                  roleRequirements={coordinatorRoleRequirements}
                  busy={Boolean(busy)}
                  onAssign={(coordinator, role, override) => run("coordinator assignment", () =>
                    ops.assignCoordinator(selectedEvent.id, { coordinatorId: coordinator.id, role, overrideConflict: override })
                  )}
                />
              )}

              {tab === "live-ops" && (
                <LiveOperationsWorkspace
                  event={selectedEvent}
                  liveOps={liveOps}
                  statusFeed={statusFeed}
                  coordinators={coordinators}
                  busy={Boolean(busy)}
                  onReload={loadLiveOps}
                  onCreateTask={(input) => runLiveOps("create task", () => ops.createEventDayTask(selectedEvent.id, input))}
                  onUpdateTask={(taskId, input) => runLiveOps("update task", () => ops.updateEventDayTask(selectedEvent.id, taskId, input))}
                  onEscalateTask={(taskId, input) => runLiveOps("escalate task", () => ops.escalateEventDayTask(selectedEvent.id, taskId, input))}
                  onCreateIssue={(input) => runLiveOps("create issue", () => ops.createUrgentIssue(selectedEvent.id, input))}
                  onUpdateIssue={(issueId, input) => runLiveOps("update issue", () => ops.updateUrgentIssue(selectedEvent.id, issueId, input))}
                  onEscalateIssue={(issueId, input) => runLiveOps("escalate issue", () => ops.escalateUrgentIssue(selectedEvent.id, issueId, input))}
                  onUpdateCoordinatorAttendance={(assignmentId, input) => runLiveOps("attendance", () =>
                    ops.updateCoordinatorAttendance(selectedEvent.id, assignmentId, { ...input, markedBy: session.name })
                  )}
                  onReplaceCoordinator={(assignmentId, input) => runLiveOps("replace coordinator", () =>
                    ops.replaceCoordinator(selectedEvent.id, assignmentId, input)
                  )}
                  onVerifySupplierStatus={(requestId, input) => runLiveOps("verify supplier", () =>
                    ops.verifySupplierStatus(selectedEvent.id, requestId, { ...input, verifiedBy: session.name })
                  )}
                />
              )}

              {tab === "billing" && (
                <FinancialWorkspace
                  event={selectedEvent}
                  inquiry={selectedInquiry}
                  billingStatements={billingStatements}
                  payments={payments}
                  notificationLogs={notificationLogs}
                  busy={Boolean(busy)}
                  onRecordPayment={(milestoneId, input) => run("record payment", () => ops.recordPayment(selectedEvent.id, milestoneId, input))}
                  onSendBilling={(billingId) => run("send billing", () => ops.sendBillingStatement(selectedEvent.id, billingId))}
                />
              )}

              {tab === "closure" && (
                <Phase4Workspace
                  event={selectedEvent}
                  rules={complianceRules}
                  checks={checks}
                  billingSources={billingSources}
                  billingStatements={billingStatements}
                  insights={eventInsights}
                  busy={Boolean(busy)}
                  onCreateRule={(input) => run("create compliance rule", () => ops.createComplianceRule(input))}
                  onRunCompliance={(phase) => run("run compliance", () => ops.runCompliance(selectedEvent.id, phase))}
                  onResolveCompliance={(checkId) => run("resolve compliance", () =>
                    ops.resolveCompliance(selectedEvent.id, checkId, { action: "resolve", note: "Resolved during PMCM review.", actorName: "Ms. Mys" })
                  )}
                  onOverrideCompliance={(checkId, reason) => run("override compliance", () =>
                    ops.resolveCompliance(selectedEvent.id, checkId, { action: "override", overrideReason: reason, actorName: "Ms. Mys" })
                  )}
                  onCreateBillingSource={(input) => run("create billing source", () => ops.createBillingSource(selectedEvent.id, input))}
                  onApproveBillingSource={(sourceId) => run("approve billing source", () => ops.approveBillingSource(selectedEvent.id, sourceId, "Approved by PMCM."))}
                  onGenerateBillingStatement={(sourceId) => run("generate billing statement", () => ops.generateBillingStatement(selectedEvent.id, sourceId))}
                  onLoadCloseGates={() => ops.closeGates(selectedEvent.id)}
                  onArchive={(reason) => run("archive event", () => ops.archiveEvent(selectedEvent.id, reason))}
                  onLoadInsights={() => ops.eventInsights(selectedEvent.id)}
                  onGenerateInsights={() => run("generate insights", () => ops.generateEventInsights(selectedEvent.id))}
                />
              )}

              {tab === "activity" && (
                <EventMessagesWorkspace
                  event={selectedEvent}
                  session={session}
                  audit={audit}
                  notificationLogs={notificationLogs}
                />
              )}
            </div>
          ) : (
            <Card>
              <CardBody>
                <EmptyState
                  icon={AlertTriangle}
                  title="No confirmed events"
                  description="Accept an inquiry and upload signed conforme to create the first PMCM event workspace."
                />
              </CardBody>
            </Card>
          )
        )}
      </div>
      {conformeUploadTarget && (
        <ConformeUploadModal
          inquiry={conformeUploadTarget}
          onUpload={async (file) => {
            await ops.uploadConforme(conformeUploadTarget.id, {
              fileName: file.name,
              mimeType: file.type,
              sizeBytes: file.size,
            });
            await refresh();
          }}
          onClose={() => setConformeUploadTarget(null)}
        />
      )}
    </PrismDashboardShell>
  );
}
