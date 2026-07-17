"use client";


import { ClientPortalSidebar } from "./sections/client-portal-sidebar";
import {
  EventWorkspaceNav,
  NoticeBanner,
} from "./sections/shell-presentational";

import {
  FLOOR_PLAN_PREVIEW_CACHE_MS,
  actionCenterItemToDashboardAction,
  draftIsOfficial,
  floorPlanPreviewCache,
  floorPlanPreviewCacheKey,
  formatStatusLabel,
  isFresh,
  objectBox,
  selectNextAction,
  type ClientDashboardAction,
} from "../model/client-dashboard-view-rules";
import {
  ClientWorkspaceProvider,
  type ClientRequestForm,
  type ClientWorkspaceValue,
  type PreferenceForm,
} from "../client-workspace-context";

import { FormEvent, useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  Home,
  MapPinned,
  ShieldCheck,
  WalletCards,
} from "lucide-react";
import {
  type CreatePrismInquiryInput,
  type PrismClientActionItem,
  type PrismEvent,
  type PrismFloorPlanDraft,
} from "@/lib/prism-api";
import {
  loadFloorPlanProject,
  loadOfficialFloorPlan,
  saveFloorPlanProject,
  signOutClientSession,
  submitClientInquiry,
  submitFloorPlanPreference,
} from "../use-cases/client-dashboard-actions";
import { Alert, AlertDescription } from "@/app/components/ui/alert";
import { Button } from "@/app/components/ui/button";
import { StatusBadge } from "@/app/components/ui/status-badge";
import {
  PrismDashboardShell,
} from "@prism/ui";
import { cloneTemplateObjects, loadTemplates, type FloorPlanTemplate } from "@/features/floorplan/editor/templates";
import type { Project } from "@/features/floorplan/editor/types";
import {
  DashboardSkeleton,
  DashboardSessionSkeleton,
} from "./dashboard-tabs";
import { ClientHomePage } from "../../home";
import { ClientEventsPage } from "../../events";
import { ClientRequestPage } from "../../request";
import { ClientCalendarPage } from "../../calendar";
import { ClientApprovalsPage } from "../../approvals";
import { ClientFilesPage } from "../../files";
import { ClientMessagesPage } from "../../messages";
import { ClientPortalBillingPage } from "../../billing";
import { ClientEventWorkspacePage } from "../../event-workspace";
import {
  CLIENT_PORTAL_VIEW_META,
  CLIENT_SIDEBAR_ITEMS,
  DETAIL_TAB_TO_ROUTE,
  EVENT_ROUTE_TO_NAV_ITEM,
  EVENT_WORKSPACE_NAV_ITEMS,
  PORTAL_ROUTE_TO_NAV_ITEM,
  ROUTE_TO_DETAIL_TAB,
  dashboardHref,
  dashboardLoadingVariant,
  findClientSidebarLink,
  portalViewFromLink,
  sidebarActiveItemId,
} from "../model/client-dashboard.navigation";
import {
  selectClientEvents,
  selectEventDrafts,
  selectEventWorkspaceResources,
  selectSelectedClientEvent,
} from "../model/client-dashboard.selectors";
import { useClientDashboardState } from "../view-models/use-client-dashboard-state";
import type {
  ClientDashboardRoute,
  ClientPortalView,
  DetailTab,
} from "../model/client-dashboard.types";

export type { ClientDashboardRoute, ClientPortalView };

const EditorShell = dynamic(
  () => import("@/features/floorplan/editor/EditorShell").then((mod) => mod.EditorShell),
  {
    ssr: false,
    loading: () => (
      <div className="grid size-full place-items-center bg-background text-sm text-muted-foreground">
        Loading layout view...
      </div>
    ),
  },
);

type Screen =
  | { name: "dashboard" }
  | { name: "editor"; event: PrismEvent; draft: PrismFloorPlanDraft; project: Project; readOnly: boolean };

const initialPreference: PreferenceForm = {
  name: "Client layout preference",
  seatingStyle: "Mixed banquet seating with VIP center aisle",
  stagePreference: "Main stage centered on the north wall",
  flowNotes: "Registration should stay near entry without blocking guest movement.",
  guestCount: 180,
  constraints: "Keep emergency exits visible\nLeave sponsor booth space near ingress",
  notes: "Client prefers a clean technology summit layout with clear photo wall access.",
};


const initialRequestForm: ClientRequestForm = {
  eventName: "",
  eventDate: "",
  eventType: "Corporate event",
  clientType: "Corporate",
  venueCity: "",
  budgetRange: "TBD / Flexible",
  message: "",
};


export function ClientDashboardWorkspaceView({
  route = "home",
  eventId,
  portalView,
}: {
  route?: ClientDashboardRoute;
  eventId?: string;
  portalView?: ClientPortalView;
}) {
  const router = useRouter();
  const { actionCenter, error, refresh, selectedEventId, session, setError, setSelectedEventId, state } = useClientDashboardState({
    route,
    eventId,
    portalView,
  });
  const [screen, setScreen] = useState<Screen>({ name: "dashboard" });
  const [form, setForm] = useState<PreferenceForm>(initialPreference);
  const [requestForm, setRequestForm] = useState<ClientRequestForm>(initialRequestForm);
  const [eventSearch, setEventSearch] = useState("");
  const [officialProject, setOfficialProject] = useState<Project | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [floorPlanTemplates, setFloorPlanTemplates] = useState<FloorPlanTemplate[]>([]);

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

  const events = useMemo(() => selectClientEvents(state, session), [session, state]);
  const selectedEvent = selectSelectedClientEvent(events, eventId, selectedEventId);
  const eventDrafts = selectEventDrafts(state, selectedEvent);
  const officialDraft =
    eventDrafts.find((d) => d.isActive && draftIsOfficial(d)) ?? eventDrafts.find(draftIsOfficial);
  const preferenceDrafts = eventDrafts.filter(
    (d) => d.createdByRole === "client" || d.sourceType === "client_preference",
  );
  const { audit, billing, briefing, documents, notifications, payments } = selectEventWorkspaceResources(state, selectedEvent);

  useEffect(() => {
    if (route !== "floorplan" || !officialDraft || !selectedEvent) {
      setOfficialProject(null);
      return;
    }

    let cancelled = false;
    const cacheKey = floorPlanPreviewCacheKey(selectedEvent.id, officialDraft);
    const cached = floorPlanPreviewCache.get(cacheKey);
    if (cached) {
      setOfficialProject(cached.project);
      if (isFresh(cached.loadedAt, FLOOR_PLAN_PREVIEW_CACHE_MS)) {
        return () => {
          cancelled = true;
        };
      }
    }

    loadOfficialFloorPlan(
      selectedEvent.id,
      officialDraft.id,
      officialDraft.status === "approved" ? "approved" : "submitted",
      session ?? undefined,
    )
      .then((project) => {
        floorPlanPreviewCache.set(cacheKey, { project, loadedAt: Date.now() });
        if (!cancelled) setOfficialProject(project);
      })
      .catch(() => {
        if (!cancelled) setOfficialProject(null);
      });

    return () => {
      cancelled = true;
    };
  }, [
    officialDraft?.id,
    officialDraft?.floorPlanId,
    officialDraft?.name,
    officialDraft?.status,
    route,
    selectedEvent?.id,
    selectedEvent?.eventName,
    session?.email,
    session?.name,
  ]);

  useEffect(() => {
    if (!selectedEvent) return;

    router.prefetch("/dashboard");
    router.prefetch("/dashboard/request");
    router.prefetch("/dashboard/events");
    ([
      "overview",
      "actions",
      "briefing",
      "proposal",
      "floorplan",
      "documents",
      "billing",
      "messages",
    ] satisfies ClientDashboardRoute[]).forEach((nextRoute) => {
      router.prefetch(dashboardHref(nextRoute, selectedEvent.id));
    });
  }, [router, selectedEvent?.id]);

  async function openFloorplanEditor(draft: PrismFloorPlanDraft, readOnly = false) {
    if (!selectedEvent) return;
    const locked = readOnly || draft.status === "approved";
    const project = locked && draftIsOfficial(draft)
        ? await loadOfficialFloorPlan(
            selectedEvent.id,
            draft.id,
            draft.status === "approved" ? "approved" : "submitted",
            session ?? undefined,
          )
        : await loadFloorPlanProject(draft.floorPlanId, session ?? undefined);
    setScreen({ name: "editor", event: selectedEvent, draft, project, readOnly: locked });
  }

  async function createEditorDraft(template: FloorPlanTemplate) {
    if (!selectedEvent) return;
    setBusy(`editor-${template.id}`);
    setError(null);
    setNotice(null);
    try {
      const objects = cloneTemplateObjects(template);
      const draft = await submitFloorPlanPreference(
        selectedEvent.id,
        {
          name: `${template.name} preference draft`,
          venue: template.venue || selectedEvent.eventName,
          seatingStyle: form.seatingStyle,
          stagePreference: form.stagePreference,
          flowNotes: form.flowNotes,
          guestCount: form.guestCount,
          constraints: form.constraints.split(/\r?\n/).map((s) => s.trim()).filter(Boolean),
          notes: form.notes,
          width: template.widthM,
          height: template.heightM,
          gridSize: 1,
          objects,
        },
        session ?? undefined,
      );
      await refresh();
      await openFloorplanEditor(draft);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to open layout view");
    } finally {
      setBusy(null);
    }
  }

  async function submitPreference(ev: FormEvent<HTMLFormElement>) {
    ev.preventDefault();
    if (!selectedEvent) return;
    setBusy("layout-preference");
    setError(null);
    setNotice(null);
    try {
      await submitFloorPlanPreference(
        selectedEvent.id,
        {
          name: form.name,
          venue: selectedEvent.eventName,
          seatingStyle: form.seatingStyle,
          stagePreference: form.stagePreference,
          flowNotes: form.flowNotes,
          guestCount: form.guestCount,
          constraints: form.constraints.split(/\r?\n/).map((s) => s.trim()).filter(Boolean),
          notes: form.notes,
        },
        session ?? undefined,
      );
      await refresh();
      setNotice("Floor plan draft saved. PMCM can review it, and approval will lock the plan.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to submit layout preference");
    } finally {
      setBusy(null);
    }
  }

  const clientActions = selectedEvent && actionCenter
    ? actionCenter.items
        .filter((item) => item.eventId === selectedEvent.id)
        .map(actionCenterItemToDashboardAction)
    : [];
  const nextAction = selectNextAction(clientActions);

  function runClientAction(action: ClientDashboardAction) {
    if (action.href?.startsWith("/dashboard")) {
      router.push(action.href);
      return;
    }
    if (action.id === "layout-review" && officialDraft) {
      void openFloorplanEditor(officialDraft, officialDraft.status === "approved");
      return;
    }
    navigateToEventRoute(action.targetTab);
  }

  function navigateToEventRoute(next: DetailTab | ClientDashboardRoute, nextEventId = selectedEvent?.id) {
    const nextRoute = ROUTE_TO_DETAIL_TAB[next as ClientDashboardRoute]
      ? (next as ClientDashboardRoute)
      : DETAIL_TAB_TO_ROUTE[next as DetailTab];
    router.push(dashboardHref(nextRoute, nextEventId));
  }

  async function submitNewEventRequest(ev: FormEvent<HTMLFormElement>) {
    ev.preventDefault();
    if (!session) return;
    setBusy("event-request");
    setError(null);
    setNotice(null);
    try {
      const payload: CreatePrismInquiryInput = {
        clientName: session.name,
        companyName: session.organization,
        email: session.email,
        clientType: requestForm.clientType,
        eventType: requestForm.eventType,
        eventName: requestForm.eventName,
        eventDate: requestForm.eventDate,
        source: "Client Portal",
        referralDetails: "Signed-in client request",
        message: [
          requestForm.message,
          requestForm.venueCity ? `Preferred venue/city: ${requestForm.venueCity}` : "",
          requestForm.budgetRange ? `Budget range: ${requestForm.budgetRange}` : "",
        ].filter(Boolean).join("\n\n"),
        privacyConsentAccepted: true,
        privacyNoticeVersion: "2026-05-01",
        marketingConsentAccepted: false,
      };
      await submitClientInquiry(payload);
      setRequestForm(initialRequestForm);
      setNotice("New event request submitted. PMCM will review it before conforme and portal activation.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to submit event request");
    } finally {
      setBusy(null);
    }
  }

  const signOut = () => {
    signOutClientSession();
    router.replace("/sign-in");
  };

  /* Loading and auth redirects */

  if (!session) {
    return <DashboardSessionSkeleton />;
  }

  if (session.role !== "client") {
    return (
      <main className="grid min-h-screen place-items-center bg-background px-6">
        <section className="w-full max-w-md rounded-2xl border border-border bg-card p-8 shadow-sm">
          <span className="grid size-12 place-items-center rounded-xl bg-amber-50 text-amber-600">
            <ShieldCheck className="size-5" />
          </span>
          <h1 className="mt-5 text-xl font-bold text-foreground">Wrong portal for this account.</h1>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            {session.role === "pmcm-admin" || session.role === "coordinator"
              ? "Event team and coordinator accounts belong in the event operations portal."
              : "Supplier accounts belong in the supplier portal."}
          </p>
          <div className="mt-5 flex flex-wrap gap-2">
            {(session.role === "pmcm-admin" || session.role === "coordinator") && (
              <Button asChild className="rounded-lg font-bold">
                <a href="http://localhost:3004">
                  Open event portal <ArrowRight className="size-4" />
                </a>
              </Button>
            )}
            {session.role === "supplier" && (
              <Button asChild className="rounded-lg font-bold">
                <a href="http://localhost:3002">
                  Open supplier portal <ArrowRight className="size-4" />
                </a>
              </Button>
            )}
            <Button
              variant="outline"
              className="rounded-lg"
              onClick={() => {
                signOutClientSession();
                router.replace("/sign-in?next=/dashboard");
              }}
            >
              Use client sign-in
            </Button>
          </div>
        </section>
      </main>
    );
  }

  if (!state) {
    const loadingNavItems = CLIENT_SIDEBAR_ITEMS.map((item) => ({
      ...item,
      disabled: item.requiresEvent,
      subItems: item.subItems?.map((subItem) => ({
        ...subItem,
        disabled: subItem.requiresEvent,
      })),
    }));
    const loadingPortalViewMeta = portalView ? CLIENT_PORTAL_VIEW_META[portalView] : undefined;
    const loadingIsEventScopedView = Boolean(eventId) || !PORTAL_ROUTE_TO_NAV_ITEM[route];
    const loadingActiveItemId = sidebarActiveItemId(route, loadingIsEventScopedView, portalView);
    const handleLoadingNavSelect = (id: string) => {
      const item = findClientSidebarLink(id);
      if (item && !item.requiresEvent) router.push(dashboardHref(item.route, undefined, portalViewFromLink(item)));
    };
    const loadingTitle =
      loadingPortalViewMeta?.title
      ?? (route === "request"
        ? "New event request"
        : route === "events"
          ? "My events"
          : "Client portal");
    const loadingEyebrow =
      route === "home"
        ? "Client home"
        : route === "request"
          ? "Signed-in request"
          : route === "events"
            ? "Event portfolio"
            : "Event workspace";
    const loadingDescription =
      loadingPortalViewMeta?.description
      ?? (route === "request"
            ? "Loading event request details…"
            : route === "events"
              ? "Loading events…"
              : "Loading event workspace…");

    return (
      <PrismDashboardShell
        productLabel="P.R.I.S.M"
        roleLabel="Client Portal"
        eyebrow={loadingEyebrow}
        title={loadingTitle}
        description={loadingDescription}
        activeItemId={loadingActiveItemId}
        navItems={loadingNavItems}
        onNavSelect={handleLoadingNavSelect}
        user={{
          name: session.name,
          detail: session.organization,
          initials: session.name.slice(0, 2).toUpperCase(),
        }}
        searchPlaceholder="Search proposal, billing, documents..."
        mobileActions={[]}
        sidebarMode="single"
        sidebarContent={({ collapsed }) => (
          <ClientPortalSidebar
            navItems={loadingNavItems}
            activeItemId={loadingActiveItemId}
            onSelect={handleLoadingNavSelect}
            collapsed={collapsed}
          />
        )}
        onSignOut={signOut}
      >
        {error ? (
          <Alert variant="destructive" className="rounded-lg">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : (
          <DashboardSkeleton variant={dashboardLoadingVariant(route)} />
        )}
      </PrismDashboardShell>
    );
  }

  if (screen.name === "editor") {
    const editable = !screen.readOnly && screen.draft.status !== "approved";
    return (
      <main className="h-screen w-full overflow-hidden bg-background">
        <EditorShell
          project={screen.project}
          eventName={screen.event.eventName}
          draftName={screen.draft.name}
          draftStatus={screen.draft.status}
          readOnly={screen.readOnly}
          onBack={() => setScreen({ name: "dashboard" })}
          onSave={editable ? (project) => saveFloorPlanProject(project, session ?? undefined) : undefined}
          onSubmit={
            editable
              ? async (project) => {
                  await saveFloorPlanProject(project, session ?? undefined);
                  await refresh();
                  setNotice("Floor plan saved. PMCM approval will lock this plan for review.");
                  setScreen({ name: "dashboard" });
                }
              : undefined
          }
        />
      </main>
    );
  }

  /* Main dashboard */

  const shellNavItems = CLIENT_SIDEBAR_ITEMS.map((item) => ({
    ...item,
    disabled: item.requiresEvent && !selectedEvent,
    subItems: item.subItems?.map((subItem) => ({
      ...subItem,
      disabled: subItem.requiresEvent && !selectedEvent,
    })),
  }));
  const isEventScopedView = Boolean(eventId) || !PORTAL_ROUTE_TO_NAV_ITEM[route];
  const portalViewMeta = portalView ? CLIENT_PORTAL_VIEW_META[portalView] : undefined;
  const activeShellItemId = sidebarActiveItemId(route, isEventScopedView, portalView);
  const activeEventNavItemId = EVENT_ROUTE_TO_NAV_ITEM[route] ?? "event-overview";

  const handleShellNavSelect = (id: string) => {
    const item = findClientSidebarLink(id);
    if (!item) return;
    if (item.requiresEvent && !selectedEvent) return;
    router.push(dashboardHref(item.route, item.eventScoped ? selectedEvent?.id : undefined, portalViewFromLink(item)));
  };

  const shellMobileActions = [
    { id: "home", label: "Home", icon: Home, active: route === "home", onSelect: () => router.push("/dashboard") },
    { id: "overview", label: "Overview", icon: Home, active: route === "overview", disabled: !selectedEvent, onSelect: () => navigateToEventRoute("overview") },
    { id: "floorplan", label: "Plan", icon: MapPinned, active: route === "floorplan", disabled: !selectedEvent, onSelect: () => navigateToEventRoute("floorplan") },
    { id: "billing", label: "Pay", icon: WalletCards, active: route === "billing", disabled: !selectedEvent, onSelect: () => navigateToEventRoute("billing") },
  ];

  const shellTitle =
    isEventScopedView
      ? selectedEvent?.eventName ?? "Client portal"
      : portalViewMeta?.title
        ?? (route === "request"
        ? "New event request"
        : route === "events"
          ? "My events"
          : route === "calendar"
            ? "Calendar"
            : route === "approvals"
              ? "Approvals"
              : route === "messages"
                ? "Messages"
                : route === "files"
                  ? "Files"
                  : route === "billing"
                    ? "Billing & Payments"
                    : "Dashboard");

  const shellEyebrow =
    isEventScopedView
      ? "Event workspace"
      : route === "home"
        ? "Client home"
        : route === "request"
          ? "Signed-in request"
          : route === "events"
            ? "Event portfolio"
            : "Client portal";

  const shellDescription =
    portalViewMeta?.description
    ?? (route === "request"
      ? "Start another event request using your client account details."
      : route === "events"
        ? "Your confirmed PMCM events."
        : route === "calendar"
          ? "Event dates, meetings, deadlines, payments, and approval timing."
          : route === "approvals"
            ? "Client approvals grouped by status and document type."
            : route === "messages"
              ? "PMCM updates, event conversations, announcements, and archived notes."
              : route === "files"
                ? "Contracts, quotations, receipts, layouts, and shared event files."
                : route === "billing"
                  ? "Quotations, invoices, payment schedule, receipts, and current balance."
                  : selectedEvent
          ? `${selectedEvent.clientName} - ${selectedEvent.eventDate}`
          : "Portal opens after inquiry is accepted and conforme is signed.");

  const eventHeader = selectedEvent ? (
    <section className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 bg-gradient-to-r from-muted/60 to-transparent px-5 py-4">
        <div className="min-w-0 flex items-center gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-[var(--prism-signal)] text-white font-black text-base select-none">
            {selectedEvent.eventName.slice(0, 1).toUpperCase()}
          </span>
          <div className="min-w-0">
            <h2 className="text-base font-black leading-tight text-foreground truncate">{selectedEvent.eventName}</h2>
            <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
              <span>{selectedEvent.eventDate ?? "Date TBD"}</span>
              <span aria-hidden>·</span>
              <StatusBadge status={selectedEvent.status} label={formatStatusLabel(selectedEvent.status)} />
            </div>
          </div>
        </div>
        <Button size="sm" variant="ghost" className="rounded-lg text-xs font-semibold text-muted-foreground shrink-0" onClick={() => router.push("/dashboard/events")}>
          Switch event
        </Button>
      </div>
      <EventWorkspaceNav
        items={EVENT_WORKSPACE_NAV_ITEMS}
        activeItemId={activeEventNavItemId}
        onSelect={(item) => navigateToEventRoute(item.route)}
      />
    </section>
  ) : null;


  const workspaceValue: ClientWorkspaceValue = {
    router,
    route,
    portalView,
    session,
    state,
    actionCenter,
    error,
    notice,
    busy,
    setError,
    setNotice,
    setBusy,
    refresh,
    events,
    selectedEvent,
    selectedEventId,
    setSelectedEventId,
    eventDrafts,
    officialDraft,
    preferenceDrafts,
    audit,
    billing,
    briefing,
    documents,
    payments,
    clientActions,
    nextAction,
    form,
    setForm,
    requestForm,
    setRequestForm,
    eventSearch,
    setEventSearch,
    officialProject,
    floorPlanTemplates,
    notifications,
    navigateToEventRoute,
    runClientAction,
    openFloorplanEditor,
    createEditorDraft,
    submitPreference,
    submitNewEventRequest,
    signOut,
    eventHeader,
    isEventScopedView,
  };

  return (
    <ClientWorkspaceProvider value={workspaceValue}>
      <PrismDashboardShell
        productLabel="P.R.I.S.M"
        roleLabel="Client Portal"
        eyebrow={shellEyebrow}
        title={shellTitle}
        description={shellDescription}
        activeItemId={activeShellItemId}
        navItems={shellNavItems}
        onNavSelect={handleShellNavSelect}
        user={{
          name: session.name,
          detail: session.organization,
          initials: session.name.slice(0, 2).toUpperCase(),
        }}
        searchPlaceholder="Search events, documents, billing..."
        mobileActions={shellMobileActions}
        sidebarMode="single"
        sidebarContent={({ collapsed }) => (
          <ClientPortalSidebar
            navItems={shellNavItems}
            activeItemId={activeShellItemId}
            onSelect={handleShellNavSelect}
            collapsed={collapsed}
          />
        )}
        onSignOut={signOut}
      >
        <div className="space-y-5">
          {error && <NoticeBanner tone="danger">{error}</NoticeBanner>}
          {notice && <NoticeBanner tone="success">{notice}</NoticeBanner>}
          {route === "home" && <ClientHomePage />}
          {route === "request" && <ClientRequestPage />}
          {route === "events" && <ClientEventsPage />}
          {route === "calendar" && <ClientCalendarPage />}
          {route === "approvals" && !isEventScopedView && <ClientApprovalsPage />}
          {route === "messages" && !isEventScopedView && <ClientMessagesPage />}
          {route === "files" && <ClientFilesPage />}
          {route === "billing" && !isEventScopedView && <ClientPortalBillingPage />}
          {isEventScopedView && <ClientEventWorkspacePage />}
        </div>
      </PrismDashboardShell>
    </ClientWorkspaceProvider>
  );
}
