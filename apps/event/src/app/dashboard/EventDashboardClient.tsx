"use client";

import dynamic from "next/dynamic";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  ClipboardCheck,
  Clock3,
  FileCheck2,
  Filter,
  LayoutGrid,
  ListFilter,
  LockKeyhole,
  MapPinned,
  MessageSquareText,
  Radio,
  Search,
  ShieldCheck,
  Star,
  Tags,
  Truck,
  UserCheck,
  UserRound,
  type LucideIcon,
} from "lucide-react";
import {
  mvpApi,
  type MvpAuditLog,
  type MvpApprovalRequest,
  type MvpCoordinator,
  type MvpCoordinatorAssignment,
  type MvpCoordinatorRoleRequirement,
  type MvpCoordinatorWorkspace,
  type MvpDemoState,
  type MvpDefenseReadiness,
  type MvpEvent,
  type MvpEventDayStatusFeed,
  type MvpFloorPlanDraft,
  type MvpInquiry,
  type MvpLiveOps,
  type MvpLoginHistory,
  type MvpSecurityAlert,
  type MvpSupplier,
  type MvpSupplierCategory,
} from "@/lib/mvp-api";
import {
  PrismDashboardShell,
  PrismSectionPanel,
} from "@prism/ui";
import { Alert, AlertDescription } from "@/app/components/ui/alert";
import { Badge } from "@/app/components/ui/badge";
import { Button } from "@/app/components/ui/button";
import { Input } from "@/app/components/ui/input";
import { StatusBadge, statusClass } from "@/app/components/ui/status-badge";
import { EmptyState } from "@/app/components/ui/empty-state";
import {
  AuditTrailPanel,
  ClientOnboardingTracker,
  CoordinatorAssignmentDesk,
  CoordinatorView,
  FinancialWorkspace,
  InquiryIntakeLog,
  LiveOperationsWorkspace,
  Phase4Workspace,
  SupplierDirectory,
  SupplierQuotePlanner,
} from "@/app/components/pmcm";
import {
  DefenseControlPanel,
  EventOverviewPanels,
  EventQueuePanel,
  EventWorkflowTabs,
  SelectedEventCockpit,
  SelectedEventStatusSummary,
  buildEventWorkflowTabs,
  type PmcmDetailTab,
} from "@/app/components/pmcm/event-command-cockpit";
import { PRESETS, type Preset } from "@/app/components/editor/presets";
import type { Project } from "@/app/components/editor/types";
import { clearEventSession, readStoredEventSession, type EventSession } from "@/app/lib/session";

const EditorShell = dynamic(
  () => import("@/app/components/editor/EditorShell").then((mod) => mod.EditorShell),
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
  | { name: "editor"; event: MvpEvent; draft: MvpFloorPlanDraft; project: Project };
type DetailTab = PmcmDetailTab;
type DashboardSection = "events" | "suppliers" | "audit";
type RouteState = { section: DashboardSection; tab: DetailTab; eventId?: string };

export type EventDashboardClientProps = Partial<RouteState>;

const EVENT_TAB_ROUTES: Record<DetailTab, string> = {
  overview: "overview",
  floorplans: "floorplans",
  briefing: "briefing",
  suppliers: "suppliers",
  coordinators: "coordinators",
  "live-ops": "live-ops",
  billing: "billing",
  closure: "closure",
  activity: "activity",
};

const EVENT_TAB_BY_ROUTE = Object.fromEntries(
  Object.entries(EVENT_TAB_ROUTES).map(([tabId, route]) => [route, tabId]),
) as Record<string, DetailTab>;

function routeStateFromPath(pathname: string): RouteState {
  const parts = pathname.split("/").filter(Boolean);
  if (parts[0] !== "dashboard") return { section: "events", tab: "overview" };
  if (parts[1] === "suppliers") return { section: "suppliers", tab: "overview" };
  if (parts[1] === "audit") return { section: "audit", tab: "overview" };
  if (parts[1] === "events" && parts[2]) {
    return {
      section: "events",
      eventId: decodeURIComponent(parts[2]),
      tab: EVENT_TAB_BY_ROUTE[parts[3] ?? "overview"] ?? "overview",
    };
  }
  return { section: "events", tab: "overview" };
}

function label(value: string) {
  return value.replaceAll("_", " ");
}

function statusTone(status: string) {
  return statusClass(status);
}

function tierLabel(tier: string) {
  if (tier === "tier_1") return "Tier 1";
  if (tier === "tier_2") return "Tier 2";
  if (tier === "pending_first_event") return "Pending First Event";
  return label(tier);
}

function tierTone(tier: string) {
  if (tier === "tier_1") return "border-(--prism-success)/25 bg-(--prism-success)/8 text-(--prism-success)";
  if (tier === "tier_2") return "border-[#40A0D0]/30 bg-secondary text-[#40A0D0]";
  return "border-(--prism-amber)/30 bg-(--prism-amber)/8 text-(--prism-amber)";
}

function cx(...classes: Array<string | false | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function RatingStars({ rating }: { rating: number | null }) {
  if (rating === null) return <span className="text-xs font-semibold text-muted-foreground">Unrated</span>;
  const rounded = Math.round(rating);
  return (
    <span className="inline-flex items-center gap-1" aria-label={`${rating.toFixed(1)} out of 5`}>
      {Array.from({ length: 5 }, (_, index) => (
        <Star
          key={index}
          className={cx("size-3.5", index < rounded ? "fill-(--prism-amber) text-(--prism-amber)" : "text-border")}
        />
      ))}
      <span className="ml-1 text-xs font-black text-foreground">{rating.toFixed(1)}</span>
    </span>
  );
}

function Panel({ title, icon: Icon, children, aside }: { title: string; icon: LucideIcon; children: React.ReactNode; aside?: React.ReactNode }) {
  return (
    <PrismSectionPanel title={title} icon={Icon} action={aside}>
      {children}
    </PrismSectionPanel>
  );
}

function buildProject(event: MvpEvent, draft: MvpFloorPlanDraft, preset?: Preset): Project {
  const widthM = 30;
  const heightM = 20;
  const pax = draft.clientPreference?.guestCount ?? 160;
  const now = Date.now();
  return {
    id: draft.floorPlanId,
    name: draft.name,
    venue: event.eventName,
    widthM,
    heightM,
    pax,
    objects: preset ? preset.build(widthM, heightM, pax) : [],
    guests: [],
    suppliers: [],
    createdAt: now,
    updatedAt: now,
  };
}

export default function EventDashboard({
  section: initialSection,
  tab: initialTab,
  eventId: initialEventId,
}: EventDashboardClientProps = {}) {
  const router = useRouter();
  const pathname = usePathname();
  const routeState = useMemo<RouteState>(() => {
    const pathState = routeStateFromPath(pathname);
    return {
      section: initialSection ?? pathState.section,
      tab: initialTab ?? pathState.tab,
      eventId: initialEventId ?? pathState.eventId,
    };
  }, [initialEventId, initialSection, initialTab, pathname]);
  const [session, setSession] = useState<EventSession | null>(null);
  const [state, setState] = useState<MvpDemoState | null>(null);
  const [coordinatorState, setCoordinatorState] = useState<MvpCoordinatorWorkspace | null>(null);
  const [screen, setScreen] = useState<Screen>({ name: "portal" });
  const [error, setError] = useState<string | null>(null);

  // PmcmPortal inner state (hoisted here since we're combining them)
  const [selectedEventId, setSelectedEventId] = useState<string | null>(routeState.eventId ?? null);
  const [section, setSection] = useState<DashboardSection>(routeState.section);
  const [tab, setTab] = useState<DetailTab>(routeState.tab);
  const [approvalRequests, setApprovalRequests] = useState<MvpApprovalRequest[]>([]);
  const [liveOps, setLiveOps] = useState<MvpLiveOps | null>(null);
  const [statusFeed, setStatusFeed] = useState<MvpEventDayStatusFeed | null>(null);
  const [defenseReadiness, setDefenseReadiness] = useState<MvpDefenseReadiness | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  async function refresh(current = session) {
    if (!current) return;
    if (current.role === "coordinator") {
      const next = await mvpApi.coordinatorWorkspace(current);
      setCoordinatorState(next);
      setState(null);
      return;
    }
    const next = await mvpApi.pmcmState();
    setState(next);
    setCoordinatorState(null);
  }

  useEffect(() => {
    const current = readStoredEventSession();
    if (!current) {
      router.replace("/sign-in?next=/dashboard");
      return;
    }
    setSession(current);
    refresh(current).catch((err) => setError(err instanceof Error ? err.message : "Unable to load event portal"));
  }, [router]);

  useEffect(() => {
    setSection(routeState.section);
    setTab(routeState.tab);
    if (routeState.eventId) setSelectedEventId(routeState.eventId);
  }, [routeState.eventId, routeState.section, routeState.tab]);

  useEffect(() => {
    if (!session || screen.name !== "portal") return;
    const intervalId = window.setInterval(() => {
      refresh(session).catch(() => undefined);
    }, 30_000);
    return () => window.clearInterval(intervalId);
  }, [session, screen.name]);

  useEffect(() => {
    if (!state) return;
    setSelectedEventId((prev) => routeState.eventId ?? prev ?? state.events[0]?.id ?? null);
    mvpApi.approvalRequests()
      .then(setApprovalRequests)
      .catch(() => undefined);
  }, [routeState.eventId, state]);

  // Derived from state
  const events = useMemo(() => (state?.events ?? []).filter((ev) => !ev.archived), [state]);
  const selectedEvent = events.find((ev) => ev.id === selectedEventId) ?? events[0];
  const supplierCategories = state?.supplierCategories ?? [];
  const suppliers = state?.suppliers ?? [];
  const coordinators = state?.coordinators ?? [];
  const coordinatorRoleRequirements = state?.coordinatorRoleRequirements ?? [];
  const unreviewedInquiries = (state?.inquiries ?? []).filter((inq) => inq.status === "new").length;
  const drafts = selectedEvent ? (state?.floorPlanDrafts ?? []).filter((d) => d.eventId === selectedEvent.id) : [];
  const quoteRequests = (state?.supplierQuoteRequests ?? []).filter((item) => item.eventId === selectedEvent?.id);
  const quotes = (state?.supplierQuotes ?? []).filter((item) => item.eventId === selectedEvent?.id);
  const complianceRules = state?.complianceRules ?? [];
  const checks = (state?.complianceChecks ?? []).filter((item) => item.eventId === selectedEvent?.id);
  const assignments = (state?.coordinatorAssignments ?? []).filter((item) => item.eventId === selectedEvent?.id);
  const payments = (state?.paymentMilestones ?? []).filter((item) => item.eventId === selectedEvent?.id);
  const billingSources = (state?.billingSources ?? []).filter((item) => item.eventId === selectedEvent?.id);
  const billingStatements = (state?.billingStatements ?? []).filter((item) => item.eventId === selectedEvent?.id);
  const eventInsights = (state?.eventInsights ?? []).filter((item) => item.eventId === selectedEvent?.id);
  const notificationLogs = (state?.notificationLogs ?? [])
    .filter((item) => !item.eventId || item.eventId === selectedEvent?.id)
    .slice(0, 8);
  const briefing = state?.briefings.find((item) => item.eventId === selectedEvent?.id);
  const selectedInquiry = state?.inquiries.find((item) => item.id === selectedEvent?.inquiryId);
  const audit = (state?.auditLogs ?? []).filter((item) => item.eventId === selectedEvent?.id || !item.eventId).slice(0, 14);
  const activeDraft = drafts.find((draft) => draft.isActive);
  const pendingApprovals = approvalRequests.filter((req) => req.status === "pending");

  async function refreshApprovals() {
    const reqs = await mvpApi.approvalRequests();
    setApprovalRequests(reqs);
  }

  async function loadLiveOps() {
    if (!selectedEvent) {
      setLiveOps(null);
      setStatusFeed(null);
      setDefenseReadiness(null);
      return;
    }
    const [nextLiveOps, nextStatusFeed, nextDefenseReadiness] = await Promise.all([
      mvpApi.liveOps(selectedEvent.id),
      mvpApi.eventDayStatusFeed(selectedEvent.id),
      mvpApi.defenseReadiness(selectedEvent.id),
    ]);
    setLiveOps(nextLiveOps);
    setStatusFeed(nextStatusFeed);
    setDefenseReadiness(nextDefenseReadiness);
  }

  useEffect(() => {
    if (!selectedEvent?.id) {
      setLiveOps(null);
      setStatusFeed(null);
      setDefenseReadiness(null);
      return;
    }
    Promise.all([
      mvpApi.liveOps(selectedEvent.id),
      mvpApi.eventDayStatusFeed(selectedEvent.id),
      mvpApi.defenseReadiness(selectedEvent.id),
    ])
      .then(([nl, ns, nd]) => { setLiveOps(nl); setStatusFeed(ns); setDefenseReadiness(nd); })
      .catch(() => undefined);
  }, [selectedEvent?.id]);

  async function run(actionLabel: string, action: () => Promise<unknown>) {
    setBusy(actionLabel);
    setError(null);
    try {
      await action();
      await refresh();
      await refreshApprovals();
      if (selectedEvent?.id) {
        void mvpApi.defenseReadiness(selectedEvent.id).then(setDefenseReadiness).catch(() => undefined);
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
      await loadLiveOps();
      await refreshApprovals();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Action failed");
    } finally {
      setBusy(null);
    }
  }

  async function createPreset(preset: Preset) {
    if (!selectedEvent) return;
    const draft = await mvpApi.createFloorPlanDraft(selectedEvent.id, {
      name: `${preset.name} PMCM draft`,
      sourceType: preset.id === "blank" ? "blank" : "preset",
      width: 30,
      height: 20,
      gridSize: 1,
    });
    await openEditor(selectedEvent, draft, preset);
  }

  async function openEditor(event: MvpEvent, draft: MvpFloorPlanDraft, preset?: Preset) {
    const fallback = buildProject(event, draft, preset);
    const project = preset ? fallback : await mvpApi.loadPlan(draft.floorPlanId, fallback);
    if (preset) await mvpApi.savePlan(project);
    setScreen({ name: "editor", event, draft, project });
  }

  function eventRoute(eventId: string, nextTab: DetailTab = "overview") {
    return `/dashboard/events/${encodeURIComponent(eventId)}/${EVENT_TAB_ROUTES[nextTab]}`;
  }

  function navigateEvent(eventId: string, nextTab: DetailTab = "overview") {
    setSection("events");
    setSelectedEventId(eventId);
    setTab(nextTab);
    router.push(eventRoute(eventId, nextTab));
  }

  function navigateEventTab(nextTab: DetailTab) {
    setSection("events");
    setTab(nextTab);
    const targetEventId = selectedEvent?.id ?? selectedEventId;
    if (targetEventId) {
      router.push(eventRoute(targetEventId, nextTab));
    } else {
      router.push("/dashboard/events");
    }
  }

  function navigateSection(nextSection: DashboardSection) {
    setSection(nextSection);
    if (nextSection === "suppliers") {
      router.push("/dashboard/suppliers");
      return;
    }
    if (nextSection === "audit") {
      router.push("/dashboard/audit");
      return;
    }
    const targetEventId = selectedEvent?.id ?? selectedEventId;
    router.push(targetEventId ? eventRoute(targetEventId, tab) : "/dashboard/events");
  }

  function openSupplierEvent(eventId: string) {
    navigateEvent(eventId, "overview");
  }

  /* Loading state */

  if (!session) {
    return (
      <main className="grid min-h-screen place-items-center bg-background">
        <div className="h-8 w-48 animate-pulse rounded-lg bg-secondary" />
      </main>
    );
  }

  /* Wrong role */

  if (session.role !== "pmcm-admin" && session.role !== "coordinator") {
    return (
      <main className="grid min-h-screen place-items-center bg-background px-6">
        <section className="w-full max-w-md rounded-lg border border-border bg-card p-7 shadow-md">
          <ShieldCheck className="size-11 rounded-lg bg-amber-50 p-2 text-amber-600" />
          <h1 className="mt-5 text-xl font-black text-foreground">Wrong portal for this account.</h1>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            {session.role === "client"
              ? "Client accounts belong in the client portal at http://localhost:3001."
              : "Supplier accounts belong in the supplier portal at http://localhost:3002."}
          </p>
          <Button
            className="mt-5 rounded-md font-bold"
            onClick={() => {
              clearEventSession();
              router.replace("/sign-in");
            }}
          >
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
          onSave={(project) => mvpApi.savePlan(project)}
          onSubmit={async (project) => {
            await mvpApi.savePlan(project);
            await mvpApi.submitFloorPlanDraft(screen.event.id, screen.draft.id);
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
            <Alert variant="destructive" className="max-w-md rounded-lg">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : (
            <div className="flex flex-col items-center gap-3">
              <div className="h-8 w-48 animate-pulse rounded-lg bg-secondary" />
            <p className="text-sm text-muted-foreground">Loading coordinator workspace...</p>
            </div>
          )}
        </main>
      );
    }
    return (
      <main className="min-h-screen bg-background">
        <CoordinatorView
          session={session}
          state={coordinatorState}
          onRefresh={() => refresh(session)}
        />
      </main>
    );
  }

  /* PMCM portal loading */

  if (!state) {
    return (
      <main className="grid min-h-screen place-items-center bg-background px-6">
        {error ? (
          <Alert variant="destructive" className="max-w-md rounded-lg">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : (
          <div className="flex flex-col items-center gap-3">
            <div className="h-8 w-48 animate-pulse rounded-lg bg-secondary" />
            <p className="text-sm text-muted-foreground">Loading event command...</p>
          </div>
        )}
      </main>
    );
  }

  /* Main PMCM portal */

  const openCheckCount = checks.filter((item) => item.status === "open").length;
  const eventTabItems = buildEventWorkflowTabs({
    draftsCount: drafts.length,
    quotesCount: quotes.length,
    assignmentsCount: assignments.length,
    paymentsCount: payments.length,
    openChecksCount: openCheckCount,
  });
  const openActionCount = defenseReadiness?.nextActions.length ?? pendingApprovals.length + unreviewedInquiries;

  const shellNavItems = [
    { id: "events", icon: Radio, label: "Events", badge: unreviewedInquiries },
    { id: "suppliers", icon: Tags, label: "Suppliers" },
    { id: "audit", icon: ShieldCheck, label: "Audit trail" },
  ];

  const commandActions = defenseReadiness?.nextActions.map((action) => ({
    id: action.key,
    label: action.label,
    description: action.detail,
    status: action.status,
    onSelect: () => navigateEventTab(action.targetTab as DetailTab),
  })) ?? [
    {
      id: "review-inquiries",
      label: "Review inquiries",
      description: "Accept a qualified inquiry and unlock the conforme path.",
      onSelect: () => navigateSection("events"),
    },
    {
      id: "supplier-desk",
      label: "Open supplier desk",
      description: "Review quote coverage and supplier readiness without leaving PMCM command.",
      onSelect: () => navigateSection("suppliers"),
    },
  ];

  const selectedEventActions = selectedEvent ? (
    <div className="flex flex-wrap gap-2">
      <Button size="sm" className="rounded-lg font-bold" onClick={() => run("briefing", () => mvpApi.submitBriefing(selectedEvent.id))}>
        Submit briefing
      </Button>
      <Button size="sm" variant="outline" className="rounded-lg font-bold" onClick={() => navigateEventTab("suppliers")}>
        Supplier desk
      </Button>
      <Button size="sm" variant="outline" className="rounded-lg font-bold" onClick={() => navigateEventTab("live-ops")}>
        Live ops
      </Button>
    </div>
  ) : null;

  const eventRail = (
    <EventQueuePanel
      events={events}
      selectedEventId={selectedEvent?.id}
      onReset={() => run("reset", mvpApi.reset)}
      onSelectEvent={(eventId) => {
        navigateEvent(eventId, "overview");
      }}
    />
  );

  const signOut = () => {
    clearEventSession();
    router.replace("/sign-in");
  };

  return (
    <PrismDashboardShell
      productLabel="P.R.I.S.M"
      roleLabel="PMCM Event Command"
      eyebrow="Operations cockpit"
      title={selectedEvent?.eventName ?? "Event Manager"}
      description="Conforme gates, floorplans, suppliers, billing, compliance, live operations, and closure in one command surface."
      activeItemId={section}
      navItems={shellNavItems}
      onNavSelect={(id) => navigateSection(id as DashboardSection)}
      commandActions={commandActions}
      rightRail={section === "events" ? eventRail : undefined}
    >
      <section className="min-w-0 space-y-4">
        {error && (
          <Alert variant="destructive" className="rounded-lg">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {section === "suppliers" ? (
          <SupplierDirectory
            categories={supplierCategories}
            suppliers={suppliers}
            onToggleBni={(supplier, value) => run("supplier BNI flag", () => mvpApi.updateSupplier(supplier.id, { bniMember: value }))}
            onCreateSupplier={(input) => run("create supplier", () => mvpApi.createSupplier(input))}
            onUpdateSupplier={(supplierId, input) => run("update supplier", () => mvpApi.updateSupplier(supplierId, input))}
            onChangeTier={(supplierId, tier, reason) => run("supplier tier change", () => mvpApi.changeSupplierTier(supplierId, { tier, reason }))}
            onAddReview={(supplierId, input) => run("supplier private review", () => mvpApi.addSupplierReview(supplierId, { ...input, eventId: selectedEvent?.id }))}
            onAddCertification={(supplierId, input) => run("supplier certification", () => mvpApi.addSupplierCertification(supplierId, input))}
            onOpenEvent={openSupplierEvent}
            busy={Boolean(busy)}
          />
        ) : section === "audit" ? (
          <AuditTrailPanel events={events} users={state.users} session={session} />
        ) : (
          <>
            <Panel title="Admin approvals" icon={ShieldCheck}>
              {pendingApprovals.length === 0 ? (
                <EmptyState icon={ShieldCheck} title="No pending approvals" description="New account requests will appear here for review." />
              ) : (
                <div className="divide-y divide-border">
                  {pendingApprovals.map((request) => (
                    <div key={request.id} className="py-4 first:pt-0 last:pb-0">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-bold text-foreground">{request.name}</p>
                          <p className="mt-0.5 text-xs text-muted-foreground">{request.email}</p>
                          <p className="mt-1.5 text-[10px] font-black uppercase tracking-[0.14em] text-(--prism-amber)">
                            {label(request.role)} - {request.organization}
                          </p>
                        </div>
                        <StatusBadge status={request.status} />
                      </div>
                      <div className="mt-4 flex flex-wrap gap-2">
                        <Button size="sm" disabled={!!busy} onClick={() => run("approve account", () => mvpApi.approveApprovalRequest(request.id))} className="rounded-lg font-bold">
                          Approve
                        </Button>
                        <Button size="sm" variant="outline" disabled={!!busy} onClick={() => run("decline account", () => mvpApi.declineApprovalRequest(request.id))} className="rounded-lg font-bold">
                          Decline
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Panel>

            <InquiryIntakeLog
              inquiries={state.inquiries}
              onAccept={(inq) => run("accept inquiry", () => mvpApi.acceptInquiry(inq.id))}
              onPend={(inq) => run("pend inquiry", () => mvpApi.pendInquiry(inq.id))}
              onDecline={(inq, reason) => run("decline inquiry", () => mvpApi.declineInquiry(inq.id, reason))}
              busy={Boolean(busy)}
            />

            <ClientOnboardingTracker
              inquiries={state.inquiries}
              onUploadConforme={(inq) => run("upload conforme", () => mvpApi.uploadConforme(inq.id))}
              onSendReminder={(inq) => run("conforme reminder", () => mvpApi.sendConformeReminder(inq.id))}
              busy={Boolean(busy)}
            />

            {selectedEvent ? (
              <>
                <SelectedEventCockpit
                  event={selectedEvent}
                  defenseReadiness={defenseReadiness}
                  openActionCount={openActionCount}
                  action={selectedEventActions}
                />

                {defenseReadiness && <DefenseControlPanel defenseReadiness={defenseReadiness} onSelectTab={navigateEventTab} />}

                <SelectedEventStatusSummary
                  drafts={drafts}
                  activeDraft={activeDraft}
                  quoteRequestCount={quoteRequests.length}
                  quoteCount={quotes.length}
                  openCheckCount={openCheckCount}
                />

                <EventWorkflowTabs items={eventTabItems} activeTab={tab} onSelectTab={navigateEventTab} />

                {tab === "overview" && (
                  <EventOverviewPanels
                    event={selectedEvent}
                    onSubmitBriefing={() => run("briefing", () => mvpApi.submitBriefing(selectedEvent.id))}
                    onOpenSupplierDesk={() => navigateEventTab("suppliers")}
                    onRunCompliance={() => run("compliance", () => mvpApi.runCompliance(selectedEvent.id, "planning"))}
                    onOpenCoordinatorDesk={() => navigateEventTab("coordinators")}
                    onOpenLiveOps={() => navigateEventTab("live-ops")}
                  />
                )}

                {tab === "floorplans" && (
                  <div className="space-y-4">
                    <Panel title="Start PMCM draft" icon={MapPinned}>
                      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                        {PRESETS.slice(0, 4).map((preset) => (
                          <button
                            key={preset.id}
                            onClick={() => run("create floorplan", () => createPreset(preset))}
                            className="border-l-2 border-l-border bg-secondary/40 px-3 py-3 text-left transition hover:border-l-(--prism-signal) hover:bg-secondary"
                          >
                            <p className="text-sm font-bold text-foreground">{preset.name}</p>
                            <p className="mt-1.5 text-xs leading-5 text-muted-foreground">{preset.description}</p>
                          </button>
                        ))}
                      </div>
                    </Panel>
                    <Panel title="Floorplan drafts and client preferences" icon={LayoutGrid}>
                      {drafts.length === 0 ? (
                        <EmptyState icon={LayoutGrid} title="No floorplan drafts yet" description="Pick a preset above to create the first PMCM draft for this event." />
                      ) : (
                        <div className="divide-y divide-border">
                          {drafts.map((draft) => (
                            <div key={draft.id} className="py-4 first:pt-0 last:pb-0">
                              <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                  <p className="truncate text-sm font-bold text-foreground">{draft.name}</p>
                                  <p className="mt-0.5 text-xs text-muted-foreground">{label(draft.sourceType)} - {draft.createdByRole ?? "pmcm-admin"}</p>
                                </div>
                                <StatusBadge status={draft.status} />
                              </div>
                              {draft.clientPreference && (
                                <div className="mt-3 border-l border-border bg-background/70 px-3 py-2 text-xs leading-5 text-muted-foreground">
                                  <p><span className="font-bold text-foreground">Seating:</span> {draft.clientPreference.seatingStyle}</p>
                                  <p><span className="font-bold text-foreground">Stage:</span> {draft.clientPreference.stagePreference}</p>
                                </div>
                              )}
                              <div className="mt-4 flex flex-wrap gap-2">
                                <Button size="sm" variant="outline" className="rounded-lg font-bold" onClick={() => run("open draft", () => openEditor(selectedEvent, draft))}>
                                  Open/Edit
                                </Button>
                                {draft.status !== "in_review" && draft.status !== "approved" && (
                                  <Button size="sm" className="rounded-lg font-bold" onClick={() => run("submit draft", () => mvpApi.submitFloorPlanDraft(selectedEvent.id, draft.id))}>
                                    Submit
                                  </Button>
                                )}
                                {draft.status !== "approved" && (
                                  <Button size="sm" variant="outline" className="rounded-lg border-(--prism-success)/25 bg-(--prism-success)/8 font-bold text-(--prism-success) hover:bg-(--prism-success)/12" onClick={() => run("approve draft", () => mvpApi.approveFloorPlanDraft(selectedEvent.id, draft.id))}>
                                    Approve
                                  </Button>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </Panel>
                  </div>
                )}

                {tab === "briefing" && (
                  <Panel title="Briefing" icon={FileCheck2}>
                    {briefing ? (
                      <div className="divide-y divide-border text-sm">
                        {[
                          { label: "Venue", value: briefing.venue },
                          { label: "Guest count", value: briefing.guestCount },
                          { label: "Budget range", value: briefing.budgetRange },
                          { label: "Services", value: briefing.serviceRequirements.join(", ") },
                        ].map(({ label: lbl, value }) => (
                          <div key={lbl} className="flex items-start justify-between gap-4 py-2.5 not-last:border-b not-last:border-border">
                            <span className="shrink-0 font-semibold text-muted-foreground">{lbl}</span>
                            <span className="text-right font-semibold text-foreground">{value}</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <EmptyState icon={FileCheck2} title="No briefing submitted yet" description="Use the quick action above to submit a demo briefing for this event." />
                    )}
                  </Panel>
                )}

                {tab === "suppliers" && (
                  <Panel title="Supplier desk" icon={Truck}>
                    <SupplierQuotePlanner
                      categories={supplierCategories}
                      suppliers={suppliers}
                      requests={quoteRequests}
                      quotes={quotes}
                      onRequestQuotes={(input) => run("request supplier quotes", () => mvpApi.requestSupplierQuotes(selectedEvent.id, input))}
                      onSelectQuote={(quoteId) => run("select supplier quote", () => mvpApi.selectSupplierQuote(selectedEvent.id, quoteId))}
                      busy={Boolean(busy)}
                    />
                  </Panel>
                )}

                {tab === "coordinators" && (
                  <CoordinatorAssignmentDesk
                    event={selectedEvent}
                    coordinators={coordinators}
                    assignments={state.coordinatorAssignments}
                    roleRequirements={coordinatorRoleRequirements}
                    busy={Boolean(busy)}
                    onAssign={(coordinator, role, override) => run("coordinator assignment", () =>
                      mvpApi.assignCoordinator(selectedEvent.id, { coordinatorId: coordinator.id, role, overrideConflict: override })
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
                    onCreateTask={(input) => runLiveOps("create event-day task", () => mvpApi.createEventDayTask(selectedEvent.id, input))}
                    onUpdateTask={(taskId, input) => runLiveOps("update event-day task", () => mvpApi.updateEventDayTask(selectedEvent.id, taskId, input))}
                    onEscalateTask={(taskId, input) => runLiveOps("escalate event-day task", () => mvpApi.escalateEventDayTask(selectedEvent.id, taskId, input))}
                    onCreateIssue={(input) => runLiveOps("create urgent issue", () => mvpApi.createUrgentIssue(selectedEvent.id, input))}
                    onUpdateIssue={(issueId, input) => runLiveOps("update urgent issue", () => mvpApi.updateUrgentIssue(selectedEvent.id, issueId, input))}
                    onEscalateIssue={(issueId, input) => runLiveOps("escalate urgent issue", () => mvpApi.escalateUrgentIssue(selectedEvent.id, issueId, input))}
                    onUpdateCoordinatorAttendance={(assignmentId, input) => runLiveOps("coordinator attendance", () =>
                      mvpApi.updateCoordinatorAttendance(selectedEvent.id, assignmentId, { ...input, markedBy: session.name })
                    )}
                    onReplaceCoordinator={(assignmentId, input) => runLiveOps("replace coordinator", () =>
                      mvpApi.replaceCoordinator(selectedEvent.id, assignmentId, input)
                    )}
                    onVerifySupplierStatus={(requestId, input) => runLiveOps("verify supplier setup", () =>
                      mvpApi.verifySupplierStatus(selectedEvent.id, requestId, { ...input, verifiedBy: session.name })
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
                    onRecordPayment={(milestoneId, input) => run("record payment", () => mvpApi.recordPayment(selectedEvent.id, milestoneId, input))}
                    onSendBilling={(billingId) => run("send billing statement", () => mvpApi.sendBillingStatement(selectedEvent.id, billingId))}
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
                    onCreateRule={(input) => run("create compliance rule", () => mvpApi.createComplianceRule(input))}
                    onRunCompliance={(phase) => run("run compliance", () => mvpApi.runCompliance(selectedEvent.id, phase))}
                    onResolveCompliance={(checkId) => run("resolve compliance", () =>
                      mvpApi.resolveCompliance(selectedEvent.id, checkId, { action: "resolve", note: "Resolved during PMCM review.", actorName: "Ms. Mys" })
                    )}
                    onOverrideCompliance={(checkId, reason) => run("override compliance", () =>
                      mvpApi.resolveCompliance(selectedEvent.id, checkId, { action: "override", overrideReason: reason, actorName: "Ms. Mys" })
                    )}
                    onCreateBillingSource={(input) => run("create billing source", () => mvpApi.createBillingSource(selectedEvent.id, input))}
                    onApproveBillingSource={(sourceId) => run("approve billing source", () => mvpApi.approveBillingSource(selectedEvent.id, sourceId, "Approved by PMCM for billing generation."))}
                    onGenerateBillingStatement={(sourceId) => run("generate billing statement", () => mvpApi.generateBillingStatement(selectedEvent.id, sourceId))}
                    onLoadCloseGates={() => mvpApi.closeGates(selectedEvent.id)}
                    onArchive={(reason) => run("archive event", () => mvpApi.archiveEvent(selectedEvent.id, reason))}
                    onLoadInsights={() => mvpApi.eventInsights(selectedEvent.id)}
                    onGenerateInsights={() => run("generate insights", () => mvpApi.generateEventInsights(selectedEvent.id))}
                  />
                )}

                {tab === "activity" && (
                  <Panel title="Activity and notifications" icon={MessageSquareText}>
                    <div className="space-y-3">
                      {notificationLogs.length > 0 && (
                        <div className="border-l border-border bg-background/70 px-3 py-2.5">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div>
                              <p className="text-sm font-black text-foreground">Queued client notifications</p>
                              <p className="mt-1 text-xs text-muted-foreground">Local defense queue only; production delivery adapters stay deferred.</p>
                            </div>
                            <StatusBadge status="pending" label={`${notificationLogs.length} queued`} />
                          </div>
                          <div className="mt-3 divide-y divide-border">
                            {notificationLogs.map((n) => (
                              <div key={n.id} className="flex flex-wrap items-start justify-between gap-3 border-l border-border px-3 py-2 text-sm">
                                <div className="min-w-0">
                                  <p className="font-black text-foreground">{label(n.channel)} to {n.recipient}</p>
                                  <p className="mt-1 line-clamp-2 text-xs leading-5 text-muted-foreground">{n.message}</p>
                                </div>
                                <StatusBadge status={n.status} />
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      {assignments.map((assignment: MvpCoordinatorAssignment) => (
                        <div key={assignment.id} className="border-l border-border px-3 py-2 text-sm">
                          <p className="font-black">{assignment.coordinatorName}</p>
                          <p className="mt-1 text-muted-foreground">{assignment.role} - {label(assignment.status)}</p>
                        </div>
                      ))}
                      {audit.map((item) => (
                        <div key={item.id} className="flex gap-3 border-l border-border px-3 py-2 text-sm">
                          <Clock3 className="mt-0.5 size-4 text-(--prism-amber)" />
                          <div><p className="font-black">{item.action}</p><p className="text-muted-foreground">{item.actor}</p></div>
                        </div>
                      ))}
                      {notificationLogs.length === 0 && assignments.length === 0 && audit.length === 0 && (
                        <EmptyState icon={MessageSquareText} title="No selected-event activity yet" description="Coordinator acknowledgments, queued notifications, and audit entries will appear here after actions run." />
                      )}
                    </div>
                  </Panel>
                )}
              </>
            ) : (
              <Panel title="No confirmed events" icon={AlertTriangle}>
                <p className="text-sm text-muted-foreground">
                  Accept an inquiry and upload signed conforme to create the first PMCM event workspace.
                </p>
              </Panel>
            )}
          </>
        )}
      </section>
    </PrismDashboardShell>
  );
}
