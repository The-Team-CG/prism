"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  BadgeCheck,
  CalendarDays,
  CheckCircle2,
  ClipboardCheck,
  FileCheck2,
  FileText,
  Home,
  LockKeyhole,
  MapPinned,
  MessageSquareText,
  Presentation,
  ReceiptText,
  Send,
  ShieldCheck,
  Sparkles,
  Timer,
  TrendingUp,
  WalletCards,
  type LucideIcon,
} from "lucide-react";
import { MOCK_AUTH_SESSION_KEY } from "@/mock/auth-users";
import {
  mvpApi,
  type CreateMvpInquiryInput,
  type MvpBillingStatement,
  type MvpBriefing,
  type MvpDemoState,
  type MvpDocument,
  type MvpEvent,
  type MvpFloorPlanDraft,
  type MvpPaymentMilestone,
  type MvpUser,
} from "@/lib/mvp-api";
import { Alert, AlertDescription } from "../ui/alert";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { StatusBadge } from "../ui/status-badge";
import { EmptyState } from "../ui/empty-state";
import {
  PrismDashboardShell,
  PrismNoticeBanner,
  RolePageHeader,
} from "@prism/ui";
import { PRESETS, type Preset } from "../editor/presets";
import type { CanvasObject as VenueObject, Project } from "../editor/types";
import {
  ClientBillingTab,
  ClientBriefingTab,
  ClientDocumentsTab,
  ClientOverviewTab,
  ClientProposalTab,
  DashboardRightRailSkeleton,
  DashboardSkeleton,
  DashboardSessionSkeleton,
  clientActivityActor,
  clientActivityTitle,
} from "./dashboard-tabs";

const EditorShell = dynamic(
  () => import("../editor/EditorShell").then((mod) => mod.EditorShell),
  {
    ssr: false,
    loading: () => (
      <div className="grid size-full place-items-center bg-background text-sm text-muted-foreground">
        Loading layout view...
      </div>
    ),
  },
);

type ClientSession = MvpUser & { signedInAt: string };
type DetailTab = "overview" | "briefing" | "proposal" | "floorplan" | "billing" | "documents" | "activity";
export type ClientDashboardRoute =
  | "home"
  | "request"
  | "events"
  | "overview"
  | "actions"
  | "briefing"
  | "proposal"
  | "floorplan"
  | "documents"
  | "billing"
  | "messages";

type ClientSidebarNavItem = {
  id: string;
  label: string;
  icon: LucideIcon;
  section: string;
  route: ClientDashboardRoute;
  requiresEvent?: boolean;
};

type Screen =
  | { name: "dashboard" }
  | { name: "editor"; event: MvpEvent; draft: MvpFloorPlanDraft; project: Project; readOnly: boolean };

type PreferenceForm = {
  name: string;
  seatingStyle: string;
  stagePreference: string;
  flowNotes: string;
  guestCount: number;
  constraints: string;
  notes: string;
};

const initialPreference: PreferenceForm = {
  name: "Client layout preference",
  seatingStyle: "Mixed banquet seating with VIP center aisle",
  stagePreference: "Main stage centered on the north wall",
  flowNotes: "Registration should stay near entry without blocking guest movement.",
  guestCount: 180,
  constraints: "Keep emergency exits visible\nLeave sponsor booth space near ingress",
  notes: "Client prefers a clean technology summit layout with clear photo wall access.",
};

const CLIENT_SIDEBAR_ITEMS: ClientSidebarNavItem[] = [
  { id: "client-home", label: "Home", icon: Home, section: "Client", route: "home" },
  { id: "new-event-request", label: "New Event Request", icon: Send, section: "Client", route: "request" },
  { id: "my-events", label: "My Events", icon: CalendarDays, section: "Client", route: "events" },
  { id: "event-overview", label: "Overview", icon: Home, section: "Event Workspace", route: "overview", requiresEvent: true },
  { id: "action-items", label: "Action Items", icon: ClipboardCheck, section: "Event Workspace", route: "actions", requiresEvent: true },
  { id: "briefing", label: "Briefing", icon: FileCheck2, section: "Event Workspace", route: "briefing", requiresEvent: true },
  { id: "proposal", label: "Proposal", icon: Presentation, section: "Event Workspace", route: "proposal", requiresEvent: true },
  { id: "floorplan", label: "Floor Plan", icon: MapPinned, section: "Event Workspace", route: "floorplan", requiresEvent: true },
  { id: "documents", label: "Documents", icon: FileText, section: "Event Workspace", route: "documents", requiresEvent: true },
  { id: "billing", label: "Billing", icon: WalletCards, section: "Event Workspace", route: "billing", requiresEvent: true },
  { id: "messages", label: "Messages", icon: MessageSquareText, section: "Event Workspace", route: "messages", requiresEvent: true },
];

const ROUTE_TO_NAV_ITEM: Record<ClientDashboardRoute, string> = {
  home: "client-home",
  request: "new-event-request",
  events: "my-events",
  overview: "event-overview",
  actions: "action-items",
  briefing: "briefing",
  proposal: "proposal",
  floorplan: "floorplan",
  documents: "documents",
  billing: "billing",
  messages: "messages",
};

const ROUTE_TO_DETAIL_TAB: Partial<Record<ClientDashboardRoute, DetailTab>> = {
  overview: "overview",
  actions: "overview",
  briefing: "briefing",
  proposal: "proposal",
  floorplan: "floorplan",
  documents: "documents",
  billing: "billing",
  messages: "activity",
};

const DETAIL_TAB_TO_ROUTE: Record<DetailTab, ClientDashboardRoute> = {
  overview: "overview",
  activity: "messages",
  briefing: "briefing",
  proposal: "proposal",
  floorplan: "floorplan",
  documents: "documents",
  billing: "billing",
};

function dashboardHref(route: ClientDashboardRoute, eventId?: string) {
  if (route === "home") return "/dashboard";
  if (route === "request") return "/dashboard/request";
  if (route === "events") return "/dashboard/events";
  if (!eventId) return "/dashboard/events";
  const section = route === "floorplan" ? "floor-plan" : route;
  return `/dashboard/events/${eventId}/${section}`;
}

function dashboardLoadingVariant(route: ClientDashboardRoute) {
  if (route === "request" || route === "events" || route === "floorplan" || route === "messages" || route === "home") {
    return route;
  }
  return "event";
}

function draftIsOfficial(draft: MvpFloorPlanDraft) {
  return draft.status === "in_review" || draft.status === "approved";
}

function objectBox(object: VenueObject, project: Project) {
  const loose = object as VenueObject & {
    position?: { x?: number; y?: number };
    size?: { width?: number; height?: number };
  };
  const x = typeof object.x === "number" ? object.x : loose.position?.x ?? 0;
  const y = typeof object.y === "number" ? object.y : loose.position?.y ?? 0;
  const w = typeof object.w === "number" ? object.w : loose.size?.width ?? 2;
  const h = typeof object.h === "number" ? object.h : loose.size?.height ?? 1;
  return {
    left: `${Math.max(0, Math.min(96, (x / Math.max(1, project.widthM)) * 100))}%`,
    top: `${Math.max(0, Math.min(94, (y / Math.max(1, project.heightM)) * 100))}%`,
    width: `${Math.max(4, Math.min(80, (w / Math.max(1, project.widthM)) * 100))}%`,
    height: `${Math.max(4, Math.min(70, (h / Math.max(1, project.heightM)) * 100))}%`,
  };
}

function LayoutPreview({ project }: { project: Project | null }) {
  if (!project) {
    return (
      <div className="rounded-xl border border-dashed border-border bg-muted/30 px-8 py-10 text-center text-sm text-muted-foreground">
        Official layout preview will appear here after your event team publishes it.
      </div>
    );
  }
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-[#FFF4EC]">
      <div className="relative aspect-16/10 min-h-60 bg-[linear-gradient(#EAD5CE_1px,transparent_1px),linear-gradient(90deg,#EAD5CE_1px,transparent_1px)] bg-size-[28px_28px]">
        {project.objects.length === 0 ? (
          <div className="absolute inset-0 grid place-items-center px-8 text-center text-sm text-muted-foreground">
            This official layout record is published; room details will appear after the next update.
          </div>
        ) : (
          project.objects.map((object) => (
            <div
              key={object.id}
              className="absolute rounded-md border border-primary/35 bg-(--prism-ink)/85 px-2 py-1 text-[10px] font-bold text-sidebar-foreground shadow-sm"
              style={objectBox(object, project)}
            >
              <span className="line-clamp-2">{object.label || object.name || object.kind}</span>
            </div>
          ))
        )}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border bg-card px-4 py-3 text-xs text-muted-foreground">
        <span>{project.name}</span>
        <span>{project.widthM}m x {project.heightM}m</span>
      </div>
    </div>
  );
}

function formatStatusLabel(status?: string) {
  return status ? status.replaceAll("_", " ") : "Pending";
}

function portalBadgeStatus(status?: MvpEvent["clientPortalStatus"]) {
  return status === "unlocked" ? "approved" : "locked";
}

function portalBadgeLabel(status?: MvpEvent["clientPortalStatus"]) {
  return status === "unlocked" ? "Conforme signed" : "Portal locked";
}

type ClientDashboardAction = {
  id: string;
  title: string;
  description: string;
  detail: string;
  ctaLabel: string;
  icon: LucideIcon;
  targetTab: DetailTab;
  status: string;
  tone: "primary" | "success" | "warning" | "neutral";
};

const money = new Intl.NumberFormat("en-PH", {
  style: "currency",
  currency: "PHP",
  maximumFractionDigits: 0,
});

function readSession(): ClientSession | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(MOCK_AUTH_SESSION_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as ClientSession;
  } catch {
    window.localStorage.removeItem(MOCK_AUTH_SESSION_KEY);
    return null;
  }
}

function getClientDashboardActions({
  selectedEvent,
  briefing,
  billing,
  payments,
  documents,
  officialDraft,
}: {
  selectedEvent: MvpEvent;
  briefing?: MvpBriefing;
  billing?: MvpBillingStatement;
  payments: MvpPaymentMilestone[];
  documents: MvpDocument[];
  officialDraft?: MvpFloorPlanDraft;
}): ClientDashboardAction[] {
  const nextPayment = payments.find((payment) => payment.status !== "paid");
  const documentNeedsAttention = documents.some((document) => /needs|pending|requested/i.test(document.status));
  const officialNeedsReview = officialDraft && officialDraft.status !== "approved";

  return [
    {
      id: "layout-review",
      title: officialNeedsReview ? "Review official layout" : officialDraft ? "Official layout is approved" : "Send layout preference",
      description: officialNeedsReview
        ? "PMCM has published the official layout. Open the floor plan before planning moves forward."
        : officialDraft
          ? "The official layout is approved for this event."
          : "Share seating, stage, guest-flow, and constraint notes before PMCM prepares the official plan.",
      detail: officialNeedsReview ? "Client review needed" : officialDraft ? formatStatusLabel(officialDraft.status) : "Preference draft",
      ctaLabel: officialDraft ? "Review layout" : "Open layout preferences",
      icon: MapPinned,
      targetTab: "floorplan",
      status: officialDraft?.status ?? "pending",
      tone: officialNeedsReview ? "primary" : officialDraft ? "success" : "warning",
    },
    {
      id: "proposal-package",
      title: billing && briefing ? "Review proposal package" : "Proposal package in preparation",
      description: billing && briefing
        ? "Briefing, package basis, billing statement, and review path are ready."
        : "The proposal view will populate after PMCM posts the client-safe planning package.",
      detail: billing ? billing.number : selectedEvent.status,
      ctaLabel: "Open proposal",
      icon: Presentation,
      targetTab: "proposal",
      status: billing && briefing ? "ready" : "pending",
      tone: billing && briefing ? "primary" : "neutral",
    },
    {
      id: "documents",
      title: documentNeedsAttention ? "Complete document checklist" : "Documents are organized",
      description: documentNeedsAttention
        ? "Some client files still need review or replacement before final planning checks."
        : "Signed conforme, client assets, and approval files are grouped with this event.",
      detail: `${documents.length} file${documents.length === 1 ? "" : "s"}`,
      ctaLabel: "Open documents",
      icon: FileText,
      targetTab: "documents",
      status: documentNeedsAttention ? "pending" : documents.length ? "ready" : "pending",
      tone: documentNeedsAttention ? "warning" : documents.length ? "success" : "neutral",
    },
    {
      id: "billing",
      title: nextPayment ? `Check ${nextPayment.label.toLowerCase()}` : "Billing is on track",
      description: nextPayment
        ? `${money.format(nextPayment.amount)} is scheduled for ${nextPayment.dueDate}. Payment recording remains PMCM-managed.`
        : "All visible billing milestones are marked complete.",
      detail: nextPayment ? nextPayment.dueDate : "No open milestone",
      ctaLabel: "Open billing",
      icon: ReceiptText,
      targetTab: "billing",
      status: nextPayment?.status ?? "approved",
      tone: nextPayment ? "warning" : "success",
    },
  ];
}

function selectNextAction(actions: ClientDashboardAction[]) {
  return actions.find((action) => action.tone === "primary")
    ?? actions.find((action) => action.tone === "warning")
    ?? actions[0];
}

function greetingByTime(name: string) {
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const firstName = name.split(" ")[0];
  return `${greeting}, ${firstName}.`;
}

function eventProgressDots(ev: MvpEvent, state: MvpDemoState) {
  const drafts = state.floorPlanDrafts.filter((d) => d.eventId === ev.id);
  const billing = state.billingStatements.find((b) => b.eventId === ev.id);
  const docs = state.documents.filter((d) => d.eventId === ev.id);
  const briefing = state.briefings.find((b) => b.eventId === ev.id);

  return [
    { label: "Briefing", done: Boolean(briefing) },
    { label: "Floor plan", done: drafts.some((d) => d.status === "approved") },
    { label: "Billing", done: billing?.status === "approved" || billing?.status === "paid" },
    { label: "Documents", done: docs.length > 0 && !docs.some((d) => /needs|pending|requested/i.test(d.status)) },
  ];
}

function statusAccentClass(status: string) {
  if (/approved|confirmed|complete|paid/i.test(status)) return "border-l-(--prism-success)";
  if (/planning|in_progress|active|draft/i.test(status)) return "border-l-(--prism-signal)";
  if (/pending|review/i.test(status)) return "border-l-(--prism-amber)";
  return "border-l-border";
}

function FieldGroup({ label: labelText, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label className="text-xs font-bold text-muted-foreground">
        {labelText}
      </Label>
      {children}
    </div>
  );
}

type ClientRequestForm = {
  eventName: string;
  eventDate: string;
  eventType: string;
  clientType: string;
  venueCity: string;
  budgetRange: string;
  message: string;
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

const CLIENT_STATE_CACHE_MS = 30_000;
const FLOOR_PLAN_PREVIEW_CACHE_MS = 60_000;
const clientStateCache = new Map<string, { state: MvpDemoState; loadedAt: number }>();
const clientStateRequests = new Map<string, Promise<MvpDemoState>>();
const floorPlanPreviewCache = new Map<string, { project: Project; loadedAt: number }>();

function clientStateCacheKey(session: Pick<MvpUser, "email">) {
  return session.email.trim().toLowerCase();
}

function getCachedClientState(session: Pick<MvpUser, "email">) {
  return clientStateCache.get(clientStateCacheKey(session));
}

function isFresh(loadedAt: number, ttl: number) {
  return Date.now() - loadedAt < ttl;
}

async function loadClientState(session: Pick<MvpUser, "email" | "name">, force = false) {
  const key = clientStateCacheKey(session);

  if (!force) {
    const cached = clientStateCache.get(key);
    if (cached && isFresh(cached.loadedAt, CLIENT_STATE_CACHE_MS)) return cached.state;

    const existing = clientStateRequests.get(key);
    if (existing) return existing;
  }

  const request = mvpApi
    .clientState(session)
    .then((next) => {
      clientStateCache.set(key, { state: next, loadedAt: Date.now() });
      return next;
    })
    .finally(() => clientStateRequests.delete(key));

  clientStateRequests.set(key, request);
  return request;
}

function floorPlanPreviewCacheKey(eventId: string, draft: MvpFloorPlanDraft) {
  return `${eventId}:${draft.id}:${draft.status}`;
}

export function Dashboard({
  route = "home",
  eventId,
}: {
  route?: ClientDashboardRoute;
  eventId?: string;
}) {
  const router = useRouter();
  const [session, setSession] = useState<ClientSession | null>(null);
  const [state, setState] = useState<MvpDemoState | null>(null);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [screen, setScreen] = useState<Screen>({ name: "dashboard" });
  const [form, setForm] = useState<PreferenceForm>(initialPreference);
  const [requestForm, setRequestForm] = useState<ClientRequestForm>(initialRequestForm);
  const [eventSearch, setEventSearch] = useState("");
  const [officialProject, setOfficialProject] = useState<Project | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const current = readSession();
    if (!current) {
      router.replace(`/sign-in?next=${encodeURIComponent(dashboardHref(route, eventId))}`);
      return;
    }
    setSession(current);
    if (current.role !== "client") return;

    const applyState = (next: MvpDemoState) => {
      if (cancelled) return;
      setState(next);
      setError(null);
      const firstClientEvent = next.events.find(
        (ev) => ev.clientName === current.name && ev.clientPortalStatus === "unlocked",
      );
      setSelectedEventId(eventId ?? firstClientEvent?.id ?? null);
    };

    const cached = getCachedClientState(current);
    if (cached) {
      applyState(cached.state);
      if (isFresh(cached.loadedAt, CLIENT_STATE_CACHE_MS)) {
        return () => {
          cancelled = true;
        };
      }
    }

    loadClientState(current, !cached)
      .then(applyState)
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Unable to load client portal");
      });

    return () => {
      cancelled = true;
    };
  }, [eventId, router]);

  const events = useMemo(() => {
    if (!state || !session) return [];
    return state.events.filter(
      (ev) => ev.clientName === session.name && !ev.archived && ev.clientPortalStatus === "unlocked",
    );
  }, [session, state]);

  const selectedEvent = eventId
    ? events.find((ev) => ev.id === eventId)
    : events.find((ev) => ev.id === selectedEventId) ?? events[0];
  const eventDrafts = selectedEvent
    ? state?.floorPlanDrafts.filter((d) => d.eventId === selectedEvent.id) ?? []
    : [];
  const officialDraft =
    eventDrafts.find((d) => d.isActive && draftIsOfficial(d)) ?? eventDrafts.find(draftIsOfficial);
  const preferenceDrafts = eventDrafts.filter(
    (d) => d.createdByRole === "client" || d.sourceType === "client_preference",
  );
  const briefing = state?.briefings.find((b) => b.eventId === selectedEvent?.id);
  const payments = state?.paymentMilestones.filter((p) => p.eventId === selectedEvent?.id) ?? [];
  const billing = state?.billingStatements.find((b) => b.eventId === selectedEvent?.id);
  const documents = state?.documents.filter((d) => d.eventId === selectedEvent?.id) ?? [];
  const audit = state?.auditLogs.filter((a) => a.eventId === selectedEvent?.id).slice(0, 10) ?? [];
  const notifications = state?.notificationLogs.filter((item) => item.eventId === selectedEvent?.id).slice(0, 4) ?? [];

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

    mvpApi
      .loadFloorPlanSnapshot(
        selectedEvent.id,
        officialDraft.id,
        officialDraft.status === "approved" ? "approved" : "submitted",
        { id: officialDraft.floorPlanId, name: officialDraft.name, venue: selectedEvent.eventName },
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

  async function refresh() {
    if (!session) return;
    const next = await loadClientState(session, true);
    setState(next);
  }

  async function openFloorplanEditor(draft: MvpFloorPlanDraft, readOnly = false, preset?: Preset) {
    if (!selectedEvent) return;
    const locked = readOnly || draft.status === "approved";
    const fallback = projectFromDraft(selectedEvent, draft, preset);
    const project = preset
      ? fallback
      : locked && draftIsOfficial(draft)
        ? await mvpApi.loadFloorPlanSnapshot(
            selectedEvent.id,
            draft.id,
            draft.status === "approved" ? "approved" : "submitted",
            fallback,
            session ?? undefined,
          )
        : await mvpApi.loadPlan(draft.floorPlanId, fallback, session ?? undefined);
    if (preset) await mvpApi.savePlan(project, session ?? undefined);
    setScreen({ name: "editor", event: selectedEvent, draft, project, readOnly: locked });
  }

  async function createEditorDraft(preset: Preset) {
    if (!selectedEvent) return;
    setBusy(`editor-${preset.id}`);
    setError(null);
    setNotice(null);
    try {
      const draft = await mvpApi.createFloorPlanPreference(
        selectedEvent.id,
        {
          name: `${preset.name} preference draft`,
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
      await openFloorplanEditor(draft, false, preset);
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
      await mvpApi.createFloorPlanPreference(
        selectedEvent.id,
        {
          name: form.name,
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

  const clientActions = selectedEvent
    ? getClientDashboardActions({
        selectedEvent,
        briefing,
        billing,
        payments,
        documents,
        officialDraft,
      })
    : [];
  const nextAction = selectNextAction(clientActions);

  function runClientAction(action: ClientDashboardAction) {
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
      const payload: CreateMvpInquiryInput = {
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
      await mvpApi.createInquiry(payload);
      setRequestForm(initialRequestForm);
      setNotice("New event request submitted. PMCM will review it before conforme and portal activation.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to submit event request");
    } finally {
      setBusy(null);
    }
  }

  const signOut = () => {
    window.localStorage.removeItem(MOCK_AUTH_SESSION_KEY);
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
                window.localStorage.removeItem(MOCK_AUTH_SESSION_KEY);
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
    const loadingTitle =
      route === "request"
        ? "New event request"
        : route === "events"
          ? "My events"
          : "Client portal";
    const loadingEyebrow =
      route === "home"
        ? "Client home"
        : route === "request"
          ? "Signed-in request"
          : route === "events"
            ? "Event portfolio"
            : "Event workspace";
    const loadingDescription =
      route === "request"
        ? "Loading your saved client details for the guided event request."
        : route === "events"
          ? "Loading your confirmed PMCM event workspaces."
          : "Loading your client event workspace, actions, files, billing, and PMCM updates.";

    return (
      <PrismDashboardShell
        productLabel="P.R.I.S.M"
        roleLabel="Client Portal"
        eyebrow={loadingEyebrow}
        title={loadingTitle}
        description={loadingDescription}
        activeItemId={ROUTE_TO_NAV_ITEM[route]}
        navItems={CLIENT_SIDEBAR_ITEMS.map((item) => ({
          ...item,
          disabled: item.requiresEvent,
        }))}
        onNavSelect={(id) => {
          const item = CLIENT_SIDEBAR_ITEMS.find((candidate) => candidate.id === id);
          if (item && !item.requiresEvent) router.push(dashboardHref(item.route));
        }}
        user={{
          name: session.name,
          detail: session.organization,
          initials: session.name.slice(0, 2).toUpperCase(),
        }}
        searchPlaceholder="Search proposal, billing, documents..."
        rightRail={<DashboardRightRailSkeleton />}
        mobileActions={[]}
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
          onSave={editable ? (project) => mvpApi.savePlan(project, session ?? undefined) : undefined}
          onSubmit={
            editable
              ? async (project) => {
                  await mvpApi.savePlan(project, session ?? undefined);
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
  }));
  const activeShellItemId = ROUTE_TO_NAV_ITEM[route];

  const handleShellNavSelect = (id: string) => {
    const item = CLIENT_SIDEBAR_ITEMS.find((candidate) => candidate.id === id);
    if (!item) return;
    router.push(dashboardHref(item.route, selectedEvent?.id));
  };

  const shellMobileActions = [
    { id: "home", label: "Home", icon: Home, active: route === "home", onSelect: () => router.push("/dashboard") },
    { id: "overview", label: "Overview", icon: Home, active: route === "overview", disabled: !selectedEvent, onSelect: () => navigateToEventRoute("overview") },
    { id: "floorplan", label: "Plan", icon: MapPinned, active: route === "floorplan", disabled: !selectedEvent, onSelect: () => navigateToEventRoute("floorplan") },
    { id: "billing", label: "Pay", icon: WalletCards, active: route === "billing", disabled: !selectedEvent, onSelect: () => navigateToEventRoute("billing") },
  ];

  const shellTitle =
    route === "request"
      ? "New event request"
      : route === "events"
        ? "My events"
        : selectedEvent?.eventName ?? "Client portal";

  const shellEyebrow =
    route === "home"
      ? "Client home"
      : route === "request"
        ? "Signed-in request"
        : route === "events"
          ? "Event portfolio"
          : "Event workspace";

  const shellDescription =
    route === "request"
      ? "Start another event request using your client account details."
      : route === "events"
        ? "Your confirmed PMCM events."
        : selectedEvent
          ? `${selectedEvent.clientName} — ${selectedEvent.eventDate}`
          : "Portal opens after inquiry is accepted and conforme is signed.";

  const eventHeader = selectedEvent ? (
    <RolePageHeader
      eyebrow="Event workspace"
      title={selectedEvent.eventName}
      description={`${selectedEvent.clientName} — ${selectedEvent.eventDate}`}
      meta={[
        <StatusBadge key="stage" status={selectedEvent.status} label={formatStatusLabel(selectedEvent.status)} />,
        <StatusBadge key="portal" status={portalBadgeStatus(selectedEvent.clientPortalStatus)} label={portalBadgeLabel(selectedEvent.clientPortalStatus)} />,
        selectedEvent.readiness ? `Readiness: ${formatStatusLabel(selectedEvent.readiness)}` : "Readiness pending",
      ]}
      action={
        <Button size="sm" variant="outline" className="rounded-lg" onClick={() => navigateToEventRoute("messages")}>
          Messages
        </Button>
      }
    />
  ) : null;

  /* ── Home page ────────────────────────────────────────────── */

  const renderHomePage = () => {
    const daysToEvent = (() => {
      if (!selectedEvent?.eventDate) return null;
      try {
        const diff = Math.ceil(
          (new Date(selectedEvent.eventDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24),
        );
        return diff > 0 ? diff : 0;
      } catch {
        return null;
      }
    })();

    return (
      <div className="space-y-6">
        {/* Greeting banner */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[var(--prism-signal)] to-[#8b0f48] px-6 py-7 text-white shadow-lg sm:px-8 sm:py-8">
          <div className="relative z-10">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-semibold text-white/70">P.R.I.S.M Client Portal</p>
                <h1 className="mt-1 text-2xl font-black leading-tight sm:text-3xl">
                  {greetingByTime(session.name)}
                </h1>
                <p className="mt-2 max-w-xl text-sm leading-6 text-white/80">
                  {events.length > 0
                    ? `You have ${events.length} active event${events.length === 1 ? "" : "s"} with PMCM. Select an event to review approvals, documents, billing, and planning updates.`
                    : "Your portal opens once PMCM accepts your inquiry and records the signed conforme."}
                </p>
                <div className="mt-5 flex flex-wrap gap-2">
                  <Button
                    className="rounded-lg bg-white font-bold text-[var(--prism-signal)] hover:bg-white/90"
                    onClick={() => router.push("/dashboard/request")}
                  >
                    <Send className="size-4" /> New event request
                  </Button>
                  {events.length > 0 && (
                    <Button
                      variant="ghost"
                      className="rounded-lg font-semibold text-white hover:bg-white/15 hover:text-white"
                      onClick={() => router.push("/dashboard/events")}
                    >
                      My events <ArrowRight className="size-4" />
                    </Button>
                  )}
                </div>
              </div>
              {daysToEvent !== null && (
                <div className="hidden shrink-0 flex-col items-center rounded-xl bg-white/15 px-5 py-4 text-center backdrop-blur-sm sm:flex">
                  <span className="text-4xl font-black leading-none">{daysToEvent}</span>
                  <span className="mt-1 text-xs font-semibold uppercase tracking-wider text-white/70">days to event</span>
                </div>
              )}
            </div>
          </div>
          {/* decorative circles */}
          <span className="pointer-events-none absolute -right-12 -top-12 size-48 rounded-full bg-white/6" />
          <span className="pointer-events-none absolute -bottom-16 -right-8 size-64 rounded-full bg-white/4" />
        </div>

        {/* Active event quick-stats */}
        {selectedEvent && (
          <div className="grid gap-3 sm:grid-cols-3">
            {[
              {
                label: "Event status",
                value: formatStatusLabel(selectedEvent.status),
                icon: TrendingUp,
                accent: "text-(--prism-signal)",
              },
              {
                label: "Floor plan",
                value: officialDraft ? formatStatusLabel(officialDraft.status) : "Not started",
                icon: MapPinned,
                accent: "text-(--prism-amber)",
              },
              {
                label: "Next payment",
                value: payments.find((p) => p.status !== "paid")?.dueDate ?? "No open milestone",
                icon: ReceiptText,
                accent: "text-(--prism-success)",
              },
            ].map((stat) => (
              <div
                key={stat.label}
                className="flex items-center gap-4 rounded-xl border border-border bg-card px-4 py-4 shadow-sm"
              >
                <span className={`grid size-10 shrink-0 place-items-center rounded-full bg-muted ${stat.accent}`}>
                  <stat.icon className="size-4" />
                </span>
                <div className="min-w-0">
                  <p className="text-base font-bold leading-tight text-foreground truncate">{stat.value}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">{stat.label}</p>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Event card grid */}
        {events.length > 0 ? (
          <div>
            <div className="mb-3 flex items-center justify-between gap-3">
              <h2 className="text-sm font-bold text-foreground">Your events</h2>
              <button
                type="button"
                onClick={() => router.push("/dashboard/events")}
                className="text-xs font-semibold text-(--prism-signal) hover:underline"
              >
                View all
              </button>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {events.slice(0, 4).map((ev) => {
                const dots = eventProgressDots(ev, state);
                const accentClass = statusAccentClass(ev.status);
                return (
                  <button
                    key={ev.id}
                    type="button"
                    onClick={() => {
                      setSelectedEventId(ev.id);
                      router.push(dashboardHref("overview", ev.id));
                    }}
                    className={`group rounded-xl border border-border border-l-4 ${accentClass} bg-card p-4 text-left shadow-sm transition hover:shadow-md hover:border-primary/25`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-bold text-foreground">{ev.eventName}</p>
                        <div className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                          <CalendarDays className="size-3 shrink-0" />
                          <span>{ev.eventDate ?? "Date pending"}</span>
                        </div>
                      </div>
                      <StatusBadge status={ev.status} label={formatStatusLabel(ev.status)} />
                    </div>
                    <div className="mt-3 flex items-center gap-3">
                      {dots.map((dot) => (
                        <div key={dot.label} className="flex flex-col items-center gap-1">
                          <span className={`size-2 rounded-full ${dot.done ? "bg-(--prism-success)" : "bg-muted-foreground/30"}`} />
                          <span className="text-[9px] font-semibold text-muted-foreground">{dot.label}</span>
                        </div>
                      ))}
                      <ArrowRight className="ml-auto size-3.5 text-muted-foreground/50 transition group-hover:text-(--prism-signal)" />
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        ) : (
          <EmptyState
            icon={LockKeyhole}
            title="No active event portal"
            description="The client portal opens after PMCM accepts your inquiry and records the signed conforme."
          />
        )}

        {/* Recent updates */}
        {notifications.length > 0 && (
          <div className="rounded-xl border border-border bg-card shadow-sm">
            <div className="flex items-center justify-between border-b border-border px-5 py-3.5">
              <div className="flex items-center gap-2">
                <Sparkles className="size-4 text-(--prism-signal)" />
                <p className="text-sm font-bold text-foreground">Recent updates from PMCM</p>
              </div>
            </div>
            <div className="divide-y divide-border">
              {notifications.map((n) => (
                <div key={n.id} className="flex items-start gap-3 px-5 py-3.5">
                  <span className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-full bg-primary/10 text-[10px] font-black text-primary">
                    PM
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-foreground">{n.channel.toUpperCase()} update</p>
                    <p className="mt-0.5 text-xs leading-5 text-muted-foreground line-clamp-2">{n.message}</p>
                  </div>
                  <StatusBadge status={n.status} />
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  /* ── Events list page ──────────────────────────────────────── */

  const renderEventsPage = () => {
    const visibleEvents = events.filter((ev) => {
      const query = eventSearch.trim().toLowerCase();
      if (!query) return true;
      return `${ev.eventName} ${ev.eventDate} ${ev.status}`.toLowerCase().includes(query);
    });

    return (
      <div className="space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-black text-foreground">My events</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {events.length} confirmed event{events.length === 1 ? "" : "s"} with PMCM
            </p>
          </div>
          <Button className="rounded-lg font-bold" onClick={() => router.push("/dashboard/request")}>
            <Send className="size-4" /> New request
          </Button>
        </div>

        <Input
          value={eventSearch}
          onChange={(ev) => setEventSearch(ev.target.value)}
          placeholder="Search by name, date, or status..."
          className="max-w-sm rounded-lg"
        />

        <div className="grid gap-3">
          {visibleEvents.length ? visibleEvents.map((ev) => {
            const dots = eventProgressDots(ev, state);
            const accentClass = statusAccentClass(ev.status);
            const statement = state.billingStatements.find((b) => b.eventId === ev.id);
            return (
              <div
                key={ev.id}
                className={`rounded-xl border border-border border-l-4 ${accentClass} bg-card shadow-sm`}
              >
                <div className="flex flex-wrap items-center justify-between gap-4 px-5 py-4">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-base font-bold text-foreground">{ev.eventName}</h3>
                      <StatusBadge status={ev.status} label={formatStatusLabel(ev.status)} />
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1"><CalendarDays className="size-3" />{ev.eventDate ?? "Date pending"}</span>
                      {statement && <span className="flex items-center gap-1"><WalletCards className="size-3" />{formatStatusLabel(statement.status)}</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="hidden items-center gap-4 sm:flex">
                      {dots.map((dot) => (
                        <div key={dot.label} className="flex flex-col items-center gap-1">
                          <span className={`size-2.5 rounded-full ${dot.done ? "bg-(--prism-success)" : "bg-muted-foreground/25"}`} />
                          <span className="text-[9px] font-semibold text-muted-foreground">{dot.label}</span>
                        </div>
                      ))}
                    </div>
                    <Button
                      size="sm"
                      className="rounded-lg font-bold"
                      onClick={() => {
                        setSelectedEventId(ev.id);
                        router.push(dashboardHref("overview", ev.id));
                      }}
                    >
                      Open <ArrowRight className="size-3.5" />
                    </Button>
                  </div>
                </div>
              </div>
            );
          }) : (
            <EmptyState icon={CalendarDays} title="No matching events" description="Try a different search, or start a new event request." />
          )}
        </div>
      </div>
    );
  };

  /* ── Request page ──────────────────────────────────────────── */

  const renderRequestPage = () => (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-black text-foreground">New event request</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Tell PMCM about your next event. Your account details are pre-filled. PMCM reviews all requests before activating the workspace.
        </p>
      </div>

      <div className="rounded-2xl border border-border bg-card shadow-sm">
        <form className="space-y-5 p-6" onSubmit={submitNewEventRequest}>
          <div className="grid gap-4 sm:grid-cols-2">
            <FieldGroup label="Client name">
              <Input value={session.name} readOnly className="rounded-lg bg-muted/40" />
            </FieldGroup>
            <FieldGroup label="Company">
              <Input value={session.organization} readOnly className="rounded-lg bg-muted/40" />
            </FieldGroup>
          </div>
          <FieldGroup label="Event name">
            <Input
              required
              value={requestForm.eventName}
              onChange={(ev) => setRequestForm({ ...requestForm, eventName: ev.target.value })}
              placeholder="e.g. Leadership Summit 2026"
              className="rounded-lg"
            />
          </FieldGroup>
          <div className="grid gap-4 sm:grid-cols-2">
            <FieldGroup label="Event date">
              <Input
                required
                type="date"
                value={requestForm.eventDate}
                onChange={(ev) => setRequestForm({ ...requestForm, eventDate: ev.target.value })}
                className="rounded-lg"
              />
            </FieldGroup>
            <FieldGroup label="Event type">
              <Input
                value={requestForm.eventType}
                onChange={(ev) => setRequestForm({ ...requestForm, eventType: ev.target.value })}
                className="rounded-lg"
              />
            </FieldGroup>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <FieldGroup label="Venue or city">
              <Input
                value={requestForm.venueCity}
                onChange={(ev) => setRequestForm({ ...requestForm, venueCity: ev.target.value })}
                placeholder="Venue, city, or TBD"
                className="rounded-lg"
              />
            </FieldGroup>
            <FieldGroup label="Budget range">
              <Input
                value={requestForm.budgetRange}
                onChange={(ev) => setRequestForm({ ...requestForm, budgetRange: ev.target.value })}
                className="rounded-lg"
              />
            </FieldGroup>
          </div>
          <FieldGroup label="Planning notes">
            <textarea
              required
              value={requestForm.message}
              onChange={(ev) => setRequestForm({ ...requestForm, message: ev.target.value })}
              rows={5}
              className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm outline-none transition placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30"
              placeholder="Share goals, estimated guests, event format, program notes, or early constraints."
            />
          </FieldGroup>

          <div className="rounded-xl border border-primary/15 bg-(--prism-signal-soft) p-4 text-sm">
            <p className="font-bold text-foreground">What happens next</p>
            <ol className="mt-2 space-y-1 text-muted-foreground">
              <li>1. PMCM reviews fit and scope.</li>
              <li>2. PMCM accepts, pends, or declines.</li>
              <li>3. Signed conforme unlocks the event workspace.</li>
            </ol>
          </div>

          <Button type="submit" disabled={busy === "event-request"} className="w-full rounded-lg font-bold">
            Submit request <Send className="size-4" />
          </Button>
        </form>
      </div>
    </div>
  );

  /* ── Floor plan page ───────────────────────────────────────── */

  const renderFloorPlanPage = () => {
    const activeDraft = officialDraft ?? preferenceDrafts[0];
    const approved = activeDraft?.status === "approved";
    return (
      <div className="space-y-5">
        <div className="rounded-2xl border border-border bg-card shadow-sm">
          <header className="flex flex-wrap items-start justify-between gap-3 border-b border-border px-6 py-5">
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-(--prism-signal)">Floor plan workspace</p>
              <h2 className="mt-1 text-xl font-black text-foreground">
                {approved ? "Approved floor plan" : "Editable floor plan"}
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {approved
                  ? "This plan is locked after PMCM approval. It's now the official event record."
                  : "Edit and submit your layout before PMCM approval locks it."}
              </p>
            </div>
            {activeDraft ? <StatusBadge status={activeDraft.status} label={formatStatusLabel(activeDraft.status)} /> : null}
          </header>

          <div className="p-6">
            {activeDraft ? (
              <div className="space-y-5">
                <div className="flex items-start justify-between gap-4 rounded-xl bg-muted/40 p-4">
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-foreground">{activeDraft.name}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {approved ? "Frozen for event reference." : "Open the editor to adjust seating, flow, stage placement, and notes."}
                    </p>
                  </div>
                  <Button className="shrink-0 rounded-lg font-bold" onClick={() => openFloorplanEditor(activeDraft, approved)}>
                    {approved ? "View floor plan" : "Edit floor plan"} <ArrowRight className="size-4" />
                  </Button>
                </div>
                <LayoutPreview project={approved ? officialProject : null} />
              </div>
            ) : (
              <EmptyState icon={MapPinned} title="No floor plan draft yet" description="Start with a layout preset below to open the editor." />
            )}

            {!approved && (
              <div className="mt-5">
                <p className="mb-3 text-xs font-bold uppercase tracking-widest text-muted-foreground">Quick-start presets</p>
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                  {PRESETS.slice(0, 4).map((preset) => (
                    <button
                      key={preset.id}
                      disabled={busy === `editor-${preset.id}`}
                      onClick={() => createEditorDraft(preset)}
                      className="rounded-xl border border-border bg-background p-3.5 text-left transition hover:border-(--prism-signal)/40 hover:bg-(--prism-signal-soft) disabled:opacity-60"
                    >
                      <p className="text-sm font-bold text-foreground">{preset.name}</p>
                      <p className="mt-0.5 text-xs leading-5 text-muted-foreground">{preset.description}</p>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {!approved && (
          <div className="rounded-2xl border border-border bg-card shadow-sm">
            <header className="border-b border-border px-6 py-4">
              <p className="text-sm font-bold text-foreground">Guided layout notes</p>
              <p className="mt-0.5 text-xs text-muted-foreground">Send PMCM structured layout context for the official plan.</p>
            </header>
            <form onSubmit={submitPreference} className="space-y-4 p-6">
              <div className="grid gap-4 sm:grid-cols-2">
                <FieldGroup label="Preference title">
                  <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="rounded-lg" />
                </FieldGroup>
                <FieldGroup label="Guest count">
                  <Input type="number" min={1} value={form.guestCount} onChange={(e) => setForm({ ...form, guestCount: Number(e.target.value) })} className="rounded-lg" />
                </FieldGroup>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <FieldGroup label="Seating style">
                  <Input value={form.seatingStyle} onChange={(e) => setForm({ ...form, seatingStyle: e.target.value })} className="rounded-lg" />
                </FieldGroup>
                <FieldGroup label="Stage preference">
                  <Input value={form.stagePreference} onChange={(e) => setForm({ ...form, stagePreference: e.target.value })} className="rounded-lg" />
                </FieldGroup>
              </div>
              <FieldGroup label="Guest flow notes">
                <textarea
                  value={form.flowNotes}
                  onChange={(e) => setForm({ ...form, flowNotes: e.target.value })}
                  rows={3}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm outline-none transition placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30"
                />
              </FieldGroup>
              <FieldGroup label="Constraints">
                <textarea
                  value={form.constraints}
                  onChange={(e) => setForm({ ...form, constraints: e.target.value })}
                  rows={3}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm outline-none transition placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30"
                />
              </FieldGroup>
              <Button disabled={busy === "layout-preference"} className="w-full rounded-lg font-bold" type="submit">
                <Send className="size-4" /> Save layout notes
              </Button>
            </form>
          </div>
        )}
      </div>
    );
  };

  /* ── Messages page ─────────────────────────────────────────── */

  const renderMessagesPage = () => {
    const messageItems = [
      ...notifications.map((item) => ({
        id: item.id,
        title: `${item.channel.toUpperCase()} update`,
        detail: item.message,
        meta: item.createdAt,
        status: item.status,
        initials: "PM",
      })),
      ...audit.map((item) => ({
        id: item.id,
        title: clientActivityTitle(item.action),
        detail: `Updated by ${clientActivityActor(item.actor)}`,
        meta: item.createdAt,
        status: "logged",
        initials: item.actor.slice(0, 2).toUpperCase(),
      })),
    ];

    return (
      <div className="rounded-2xl border border-border bg-card shadow-sm">
        <header className="border-b border-border px-6 py-5">
          <p className="text-xs font-bold uppercase tracking-widest text-(--prism-signal)">Messages</p>
          <h2 className="mt-1 text-xl font-black text-foreground">PMCM updates and activity</h2>
        </header>
        <div className="divide-y divide-border">
          {messageItems.length ? messageItems.map((item) => (
            <div key={item.id} className="flex items-start gap-4 px-6 py-4">
              <span className="grid size-9 shrink-0 place-items-center rounded-full bg-primary/10 text-xs font-black text-primary">
                {item.initials}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-bold text-foreground">{item.title}</p>
                  <StatusBadge status={item.status} />
                </div>
                <p className="mt-1 text-sm leading-6 text-muted-foreground">{item.detail}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">{item.meta}</p>
              </div>
            </div>
          )) : (
            <div className="px-6 py-8">
              <EmptyState icon={MessageSquareText} title="No messages yet" description="PMCM messages and client-visible updates will appear here." />
            </div>
          )}
        </div>
      </div>
    );
  };

  /* ── Actions page ──────────────────────────────────────────── */

  const renderActionGroup = (title: string, description: string, actions: ClientDashboardAction[]) => (
    <div className="rounded-2xl border border-border bg-card shadow-sm">
      <header className="border-b border-border px-5 py-4">
        <p className="text-sm font-bold text-foreground">{title}</p>
        <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
      </header>
      <div className="divide-y divide-border">
        {actions.length ? actions.map((action) => {
          const Icon = action.icon;
          const toneStyle =
            action.tone === "primary" ? "bg-(--prism-signal-soft) text-(--prism-signal)"
            : action.tone === "success" ? "bg-(--prism-success)/10 text-(--prism-success)"
            : action.tone === "warning" ? "bg-(--prism-amber-soft) text-(--prism-amber)"
            : "bg-muted text-muted-foreground";
          return (
            <button
              key={action.id}
              type="button"
              onClick={() => runClientAction(action)}
              className="flex w-full items-start gap-4 px-5 py-4 text-left transition hover:bg-muted/40"
            >
              <span className={`grid size-9 shrink-0 place-items-center rounded-xl ${toneStyle}`}>
                <Icon className="size-4" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center justify-between gap-2">
                  <span className="text-sm font-bold text-foreground">{action.title}</span>
                  <StatusBadge status={action.status} />
                </span>
                <span className="mt-0.5 block text-xs leading-5 text-muted-foreground line-clamp-2">{action.description}</span>
              </span>
            </button>
          );
        }) : (
          <p className="px-5 py-6 text-sm text-muted-foreground">Nothing here right now.</p>
        )}
      </div>
    </div>
  );

  /* ── Event pages router ────────────────────────────────────── */

  const renderEventPage = () => {
    if (!selectedEvent) {
      return (
        <EmptyState
          icon={LockKeyhole}
          title="No active event portal"
          description="The client portal opens after your inquiry is accepted and the signed conforme is uploaded."
          className="mt-8"
        />
      );
    }
    const needsAction = clientActions.filter((a) => a.tone === "primary" || a.tone === "warning");
    const waiting = clientActions.filter((a) => a.tone === "neutral");
    const completed = clientActions.filter((a) => a.tone === "success");

    return (
      <div className="space-y-5">
        {eventHeader}
        {route === "overview" && (
          <ClientOverviewTab
            selectedEvent={selectedEvent}
            briefing={briefing}
            payments={payments}
            billing={billing}
            documents={documents}
            audit={audit}
            officialDraft={officialDraft}
            preferenceDraftCount={preferenceDrafts.length}
            onOpenOfficialFloorplan={officialDraft ? () => openFloorplanEditor(officialDraft, officialDraft.status === "approved") : undefined}
            setTab={(next) => navigateToEventRoute(next)}
          />
        )}
        {route === "actions" && (
          <div className="grid gap-4 xl:grid-cols-3">
            {renderActionGroup("Needs your action", "Client decisions that can move planning forward.", needsAction)}
            {renderActionGroup("Waiting on PMCM", "Being prepared or reviewed by the event team.", waiting)}
            {renderActionGroup("Completed", "Finished client-visible workflow items.", completed)}
          </div>
        )}
        {route === "briefing" && <ClientBriefingTab briefing={briefing} />}
        {route === "proposal" && (
          <ClientProposalTab
            selectedEvent={selectedEvent}
            briefing={briefing}
            billing={billing}
            payments={payments}
            officialDraft={officialDraft}
            setTab={(next) => navigateToEventRoute(next)}
          />
        )}
        {route === "floorplan" && renderFloorPlanPage()}
        {route === "documents" && <ClientDocumentsTab documents={documents} />}
        {route === "billing" && <ClientBillingTab payments={payments} billing={billing} />}
        {route === "messages" && renderMessagesPage()}
      </div>
    );
  };

  const pageContent = (
    <div className="space-y-5">
      {error && <PrismNoticeBanner tone="danger">{error}</PrismNoticeBanner>}
      {notice && <PrismNoticeBanner tone="success">{notice}</PrismNoticeBanner>}
      {route === "home" && renderHomePage()}
      {route === "request" && renderRequestPage()}
      {route === "events" && renderEventsPage()}
      {route !== "home" && route !== "request" && route !== "events" && renderEventPage()}
    </div>
  );

  return (
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
      onSignOut={signOut}
    >
      {pageContent}
    </PrismDashboardShell>
  );
}

function projectFromDraft(event: MvpEvent, draft: MvpFloorPlanDraft, preset?: Preset): Project {
  const widthM = 30;
  const heightM = 20;
  const pax = draft.clientPreference?.guestCount ?? 120;
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
