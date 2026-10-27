"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { PRISM_PRIVACY_NOTICE_VERSION, type CreatePrismInquiryInput, type PrismEvent, type PrismFloorPlanDraft, type SubmitBriefingInput } from "@prism/types";
import { PrismDashboardShell } from "@prism/ui";
import { cloneTemplateObjects, type FloorPlanTemplate, type Project } from "@/features/floorplan/editor";
import { ClientEventSwitcher } from "./sections/client-event-switcher";
import { ClientWrongPortalView } from "./sections/client-wrong-portal-view";
import { ClientDashboardLoadingShell } from "./sections/client-dashboard-loading-shell";
import { ClientFloorplanEditorScreen } from "./sections/client-floorplan-editor-screen";
import { ClientDashboardRouteBody } from "./sections/client-dashboard-route-body";
import { ClientWorkspaceBanners, clientShellMobileActions } from "./sections/client-event-header";
import { DashboardSessionSkeleton } from "./dashboard-tabs";
import {
  ClientWorkspaceProvider,
  type ClientRequestForm,
  type ClientWorkspaceValue,
  type PreferenceForm,
} from "../client-workspace-context";
import {
  FLOOR_PLAN_PREVIEW_CACHE_MS,
  draftIsOfficial,
  floorPlanPreviewCache,
  floorPlanPreviewCacheKey,
  isFresh,
  selectNextAction,
  type ClientDashboardAction,
} from "../model/client-dashboard-view-rules";
import {
  buildFloorPlanPreferencePayload,
  canEditClientFloorPlanPreference,
  preferenceFormFromDraft,
} from "../model/client-floorplan-preference-rules";
import {
  CLIENT_SIDEBAR_ITEMS,
  DETAIL_TAB_TO_ROUTE,
  EVENT_ROUTE_TO_NAV_ITEM,
  ROUTE_TO_DETAIL_TAB,
  dashboardHref,
  clientEventWorkspaceAvailable,
  clientEventSidebarItems,
  findClientEventNavItem,
  findClientSidebarLink,
  portalViewFromLink,
  sidebarActiveItemId,
} from "../model/client-dashboard-navigation";
import {
  clientShellDescription,
  clientShellEyebrow,
  clientShellTitle,
  isEventScopedClientRoute,
} from "../model/client-dashboard-shell-copy";
import {
  selectClientDashboardActions,
  selectClientEvents,
  selectEventDrafts,
  selectEventWorkspaceResources,
  selectOfficialDraft,
  selectPreferenceDrafts,
  selectSelectedClientEvent,
} from "../model/client-dashboard-selectors";
import {
  loadFloorPlanProject,
  loadOfficialFloorPlan,
  signOutClientSession,
  submitClientInquiry,
  submitClientOcularVisit,
  submitClientBriefing,
  submitFloorPlanPreference,
  submitFloorPlanRevisionComment,
} from "../use-cases/client-dashboard-actions";
import { buildFloorPlanRevisionPayload } from "../model/client-floorplan-review-rules";
import { useClientDashboardViewModel } from "../view-models/use-client-dashboard-view-model";
import type { ClientDashboardRoute, ClientPortalView, DetailTab } from "../model/client-dashboard-types";

export type { ClientDashboardRoute, ClientPortalView };

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
  privacyConsentAccepted: false,
};

const EVENT_PREFETCH_ROUTES = [
  "overview",
  "actions",
  "briefing",
  "proposal",
  "floorplan",
  "documents",
  "billing",
  "messages",
] as const satisfies ClientDashboardRoute[];

function disableEventNav(requiresEvent: boolean | undefined, hasEvent: boolean) {
  return Boolean(requiresEvent) && !hasEvent;
}

function clientWorkspaceShellNavigation({ route, portalView, isEventScopedView, selectedEvent }: {
  route: ClientDashboardRoute;
  portalView?: ClientPortalView;
  isEventScopedView: boolean;
  selectedEvent?: PrismEvent;
}) {
  const shellNavItems = CLIENT_SIDEBAR_ITEMS.map((item) => ({
    ...item,
    disabled: disableEventNav(item.requiresEvent, clientEventWorkspaceAvailable(selectedEvent)),
    subItems: item.subItems?.map((subItem) => ({
      ...subItem,
      disabled: disableEventNav(subItem.requiresEvent, clientEventWorkspaceAvailable(selectedEvent)),
    })),
  }));
  const inEventWorkspace = isEventScopedView && Boolean(selectedEvent);
  return {
    inEventWorkspace,
    activeShellItemId: inEventWorkspace
      ? EVENT_ROUTE_TO_NAV_ITEM[route] ?? "event-overview"
      : sidebarActiveItemId(route, isEventScopedView, portalView),
    sidebarNavItems: inEventWorkspace && selectedEvent ? clientEventSidebarItems(selectedEvent.eventName) : shellNavItems,
  };
}

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
  const { actionCenter, actionCenterLoadFailed, error, refresh, selectedEventId, session, setError, setSelectedEventId, state } = useClientDashboardViewModel({
    route,
    eventId,
    portalView,
  });
  const [screen, setScreen] = useState<Screen>({ name: "dashboard" });
  const [form, setForm] = useState<PreferenceForm>(initialPreference);
  const [revisionComment, setRevisionComment] = useState("");
  const [requestForm, setRequestForm] = useState<ClientRequestForm>(initialRequestForm);
  const [eventSearch, setEventSearch] = useState("");
  const [officialProject, setOfficialProject] = useState<Project | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const floorPlanTemplates: FloorPlanTemplate[] = [];

  const events = useMemo(
    () => selectClientEvents(state, session, route === "summary" ? eventId : undefined),
    [eventId, route, session, state],
  );
  const selectedEvent = selectSelectedClientEvent(events, eventId, selectedEventId);
  const ocularVisit = selectedEvent
    ? state?.ocularVisits?.find((visit) => visit.eventId === selectedEvent.id) ?? null
    : null;
  const eventDrafts = useMemo(() => selectEventDrafts(state, selectedEvent), [selectedEvent, state]);
  const officialDraft = useMemo(() => selectOfficialDraft(eventDrafts), [eventDrafts]);
  const preferenceDrafts = useMemo(() => selectPreferenceDrafts(eventDrafts), [eventDrafts]);
  const preferenceDraft = preferenceDrafts[0];
  const { audit, billing, briefing, disputes, documents, notifications, payments } = selectEventWorkspaceResources(state, selectedEvent);
  // This is a persisted read model. A failed load must not fall back to
  // browser-clock-derived urgency from workspace data.
  const resolvedActionCenter = actionCenter;
  const clientActions = selectClientDashboardActions(resolvedActionCenter, selectedEvent?.id);
  const nextAction = selectNextAction(clientActions);
  const isEventScopedView = isEventScopedClientRoute(route, eventId);

  useEffect(() => {
    if (!selectedEvent) return;
    if (preferenceDraft?.status === "revision_requested") {
      const savedPreference = preferenceFormFromDraft(preferenceDraft);
      if (savedPreference) setForm(savedPreference);
      return;
    }
    if (!preferenceDraft) setForm(initialPreference);
  }, [preferenceDraft, selectedEvent]);

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
    officialDraft,
    route,
    selectedEvent,
    session,
  ]);

  useEffect(() => {
    if (!selectedEvent) return;
    router.prefetch("/dashboard");
    router.prefetch("/dashboard/request");
    router.prefetch("/dashboard/events");
    EVENT_PREFETCH_ROUTES.forEach((nextRoute) => {
      router.prefetch(dashboardHref(nextRoute, selectedEvent.id));
    });
  }, [router, selectedEvent]);

  async function openFloorplanEditor(draft: PrismFloorPlanDraft, readOnly = false) {
    if (!selectedEvent) return;
    try {
      const locked = readOnly || draft.status === "approved";
      const project = locked && draftIsOfficial(draft)
        ? await loadOfficialFloorPlan(
            selectedEvent.id,
            draft.id,
            draft.status === "approved" ? "approved" : "submitted",
          )
        : await loadFloorPlanProject(draft.floorPlanId);
      setScreen({ name: "editor", event: selectedEvent, draft, project, readOnly: locked });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to open floorplan");
    }
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
        buildFloorPlanPreferencePayload(form, {
          name: `${template.name} preference draft`,
          venue: template.venue || selectedEvent.eventName,
          width: template.widthM,
          height: template.heightM,
          gridSize: 1,
          objects,
        }),
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
    if (!canEditClientFloorPlanPreference(preferenceDraft)) {
      setError("PMCM must reopen your layout preference before you can revise it.");
      return;
    }
    const isResubmission = Boolean(preferenceDraft);
    setBusy("layout-preference");
    setError(null);
    setNotice(null);
    try {
      await submitFloorPlanPreference(
        selectedEvent.id,
        buildFloorPlanPreferencePayload(form, { venue: selectedEvent.eventName }),
      );
      await refresh();
      setNotice(
        isResubmission
          ? "Your revised layout preference was returned to PMCM."
          : "Your layout preference was submitted to PMCM. You can revise it after PMCM reopens the request.",
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to submit layout preference");
    } finally {
      setBusy(null);
    }
  }

  async function submitOcularVisit(clientNote: string) {
    if (!selectedEvent) return;
    setBusy("ocular-visit");
    setError(null);
    setNotice(null);
    try {
      await submitClientOcularVisit(selectedEvent.id, {
        clientNote: clientNote.trim() || undefined,
      });
      await refresh();
      setNotice("Ocular visit requested. PMCM will coordinate scheduling.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to request an ocular visit");
    } finally {
      setBusy(null);
    }
  }

  async function submitBriefing(eventFor: string, input: SubmitBriefingInput) {
    if (!selectedEvent || selectedEvent.id !== eventFor) return;
    setBusy("briefing");
    setError(null);
    setNotice(null);
    try {
      await submitClientBriefing(eventFor, input);
      await refresh();
      setNotice("Your briefing was sent to PMCM and added to the event history.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to submit event briefing");
    } finally {
      setBusy(null);
    }
  }

  async function submitFloorPlanReview(ev: FormEvent<HTMLFormElement>) {
    ev.preventDefault();
    if (!selectedEvent || !officialDraft) return;
    const note = revisionComment.trim();
    if (!note) {
      setError("Write a revision comment before sending it to PMCM.");
      return;
    }
    setBusy("floorplan-revision");
    setError(null);
    setNotice(null);
    try {
      await submitFloorPlanRevisionComment(
        selectedEvent.id,
        officialDraft.id,
        buildFloorPlanRevisionPayload(note),
      );
      setRevisionComment("");
      await refresh();
      setNotice("Revision comment sent. PMCM will update the official floorplan.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to send floorplan revision comment");
    } finally {
      setBusy(null);
    }
  }

  function navigateToEventRoute(next: DetailTab | ClientDashboardRoute, nextEventId = selectedEvent?.id) {
    const nextRoute = ROUTE_TO_DETAIL_TAB[next as ClientDashboardRoute]
      ? (next as ClientDashboardRoute)
      : DETAIL_TAB_TO_ROUTE[next as DetailTab];
    if (selectedEvent?.archived && nextEventId === selectedEvent.id && nextRoute !== "summary") {
      router.push(dashboardHref("summary", selectedEvent.id));
      return;
    }
    router.push(dashboardHref(nextRoute, nextEventId));
  }

  function runClientAction(action: ClientDashboardAction) {
    if (action.href?.startsWith("/dashboard")) {
      router.push(action.href);
      return;
    }
    if (action.id === "layout-review" && officialDraft) {
      void openFloorplanEditor(officialDraft, officialDraft.status === "approved");
      return;
    }
    navigateToEventRoute(action.targetTab, action.eventId);
  }

  async function submitNewEventRequest(ev: FormEvent<HTMLFormElement>) {
    ev.preventDefault();
    if (!session) return;
    if (!requestForm.privacyConsentAccepted) {
      setError("Please accept the privacy notice before submitting your request.");
      return;
    }
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
        source: "Other",
        referralDetails: "Signed-in client request",
        message: [
          requestForm.message,
          requestForm.venueCity ? `Preferred venue/city: ${requestForm.venueCity}` : "",
          requestForm.budgetRange ? `Budget range: ${requestForm.budgetRange}` : "",
        ].filter(Boolean).join("\n\n"),
        privacyConsentAccepted: true,
        privacyNoticeVersion: PRISM_PRIVACY_NOTICE_VERSION,
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

  const signOut = async () => {
    await signOutClientSession();
    router.replace("/sign-in");
  };

  if (!session) return <DashboardSessionSkeleton />;
  if (session.role !== "client") {
    return <ClientWrongPortalView session={session} onUseClientSignIn={() => router.replace("/sign-in?next=/dashboard")} />;
  }
  if (!state) {
    return (
      <ClientDashboardLoadingShell
        route={route}
        eventId={eventId}
        portalView={portalView}
        session={session}
        error={error}
        onNavSelect={(href) => router.push(href)}
        onSignOut={signOut}
      />
    );
  }
  if (screen.name === "editor") {
    return (
      <ClientFloorplanEditorScreen
        event={screen.event}
        draft={screen.draft}
        project={screen.project}
        readOnly={screen.readOnly}
        onBack={() => setScreen({ name: "dashboard" })}
        onSubmitted={async () => {
          await refresh();
          setNotice(screen.draft.sourceType === "client_preference" && screen.draft.status === "revision_requested"
            ? "Your revised layout preference was returned to PMCM."
            : "Floor plan saved. PMCM approval will lock this plan for review.");
          setScreen({ name: "dashboard" });
        }}
      />
    );
  }

  const { inEventWorkspace, activeShellItemId, sidebarNavItems } = clientWorkspaceShellNavigation({
    route, portalView, isEventScopedView, selectedEvent,
  });

  function handleShellNavSelect(id: string) {
    const eventItem = findClientEventNavItem(id);
    if (eventItem) {
      navigateToEventRoute(eventItem.route);
      return;
    }
    const item = findClientSidebarLink(id);
    if (!item || disableEventNav(item.requiresEvent, clientEventWorkspaceAvailable(selectedEvent))) return;
    router.push(dashboardHref(item.route, item.eventScoped ? selectedEvent?.id : undefined, portalViewFromLink(item)));
  }

  const workspaceValue: ClientWorkspaceValue = {
    router,
    route,
    portalView,
    session,
    state,
    actionCenter: resolvedActionCenter,
    actionCenterLoadFailed,
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
    ocularVisit,
    submitOcularVisit,
    submitBriefing,
    eventDrafts,
    officialDraft,
    preferenceDrafts,
    audit,
    billing,
    briefing,
    disputes,
    documents,
    payments,
    clientActions,
    nextAction,
    form,
    setForm,
    revisionComment,
    setRevisionComment,
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
    submitRevisionComment: submitFloorPlanReview,
    submitNewEventRequest,
    signOut,
    eventHeader: null,
    isEventScopedView,
  };

  return (
    <ClientWorkspaceProvider value={workspaceValue}>
      <PrismDashboardShell
        portal="client"
        productLabel="P.R.I.S.M"
        roleLabel="Client Portal"
        eyebrow={clientShellEyebrow({ isEventScopedView, route })}
        title={clientShellTitle({ isEventScopedView, eventName: selectedEvent?.eventName, portalView, route })}
        description={clientShellDescription({ portalView, route, selectedEvent })}
        activeItemId={activeShellItemId}
        navItems={sidebarNavItems}
        onNavSelect={handleShellNavSelect}
        user={{
          name: session.name,
          detail: session.organization,
          initials: session.name.slice(0, 2).toUpperCase(),
        }}
        searchPlaceholder="Search events, documents, billing..."
        mobileActions={clientShellMobileActions(route, selectedEvent, () => router.push("/dashboard"), navigateToEventRoute)}
        sidebarContext={
          inEventWorkspace && selectedEvent ? (
            <ClientEventSwitcher
              events={events.filter((event) => !event.archived)}
              selected={selectedEvent}
              onSwitch={(eventId) => navigateToEventRoute(route, eventId)}
              onAllEvents={() => router.push("/dashboard/events")}
            />
          ) : null
        }
        onSignOut={signOut}
      >
        <div className="space-y-5">
          <ClientWorkspaceBanners error={error} notice={notice} />
          <ClientDashboardRouteBody route={route} isEventScopedView={isEventScopedView} />
        </div>
      </PrismDashboardShell>
    </ClientWorkspaceProvider>
  );
}
