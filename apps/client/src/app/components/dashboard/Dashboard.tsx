"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import {
  Activity,
  ArrowRight,
  BadgeCheck,
  Bell,
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
  Timer,
  UserRoundCheck,
  WalletCards,
  type LucideIcon,
} from "lucide-react";
import { MOCK_AUTH_SESSION_KEY } from "@/mock/auth-users";
import {
  mvpApi,
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
import { Skeleton } from "../ui/skeleton";
import { StatusBadge } from "../ui/status-badge";
import { EmptyState } from "../ui/empty-state";
import {
  PrismAppShell,
  PrismCompactRecordList,
  PrismNoticeBanner,
  PrismWorkflowTabs,
  RolePageHeader,
} from "@prism/ui";
import { PRESETS, type Preset } from "../editor/presets";
import type { CanvasObject as VenueObject, Project } from "../editor/types";
import {
  ClientActivityTab,
  ClientBillingTab,
  ClientBriefingTab,
  ClientDocumentsTab,
  ClientOverviewTab,
  ClientProposalTab,
  DashboardSkeleton,
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

const DETAIL_TABS: Array<{ id: DetailTab; label: string; icon: LucideIcon }> = [
  { id: "overview", label: "Overview", icon: Home },
  { id: "briefing", label: "Briefing", icon: FileCheck2 },
  { id: "proposal", label: "Proposal", icon: Presentation },
  { id: "floorplan", label: "Layout", icon: MapPinned },
  { id: "documents", label: "Documents", icon: FileText },
  { id: "billing", label: "Billing", icon: WalletCards },
  { id: "activity", label: "Activity", icon: Activity },
];

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
      <div className="rounded-lg border border-dashed border-border bg-card px-8 py-10 text-center text-sm text-muted-foreground">
        Official layout preview will appear here after your event team publishes it.
      </div>
    );
  }
  return (
    <div className="overflow-hidden rounded-lg border border-border bg-[#FFF4EC]">
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
          ? "The official layout is approved for this event. Use this space for the client copy and history."
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
        ? "Briefing, package basis, billing statement, and review path are ready without exposing PMCM internal costing."
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

function actionToneClass(tone: ClientDashboardAction["tone"]) {
  if (tone === "primary") return "border-primary/20 bg-(--prism-signal-soft) text-primary";
  if (tone === "success") return "border-(--prism-success)/20 bg-(--prism-success)/10 text-(--prism-success)";
  if (tone === "warning") return "border-(--prism-amber)/25 bg-(--prism-amber-soft) text-(--prism-amber)";
  return "border-border bg-secondary text-muted-foreground";
}

function LifecycleStrip({
  selectedEvent,
  briefing,
  billing,
  officialDraft,
}: {
  selectedEvent: MvpEvent;
  briefing?: MvpBriefing;
  billing?: MvpBillingStatement;
  officialDraft?: MvpFloorPlanDraft;
}) {
  const steps = [
    { label: "Inquiry accepted", state: "done", icon: BadgeCheck },
    { label: "Conforme signed", state: selectedEvent.clientPortalStatus === "unlocked" ? "done" : "pending", icon: ShieldCheck },
    { label: "Briefing / proposal", state: briefing && billing ? "done" : "current", icon: Presentation },
    { label: "Planning", state: officialDraft?.status === "approved" ? "done" : "current", icon: MapPinned },
    { label: "Event day", state: "pending", icon: CalendarDays },
    { label: "Closure", state: "pending", icon: CheckCircle2 },
  ];

  return (
    <section className="rounded-lg border border-border bg-card px-4 py-4 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.16em] text-primary">Lifecycle</p>
          <h2 className="mt-1 text-lg font-black text-foreground">Guided from inquiry to closure</h2>
        </div>
        <StatusBadge status={selectedEvent.status} label={formatStatusLabel(selectedEvent.status)} />
      </div>
      <ol className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-6">
        {steps.map((step, index) => {
          const Icon = step.icon;
          const isDone = step.state === "done";
          const isCurrent = step.state === "current";
          return (
            <li
              key={step.label}
              className={
                isDone
                  ? "border-l-2 border-l-(--prism-success) bg-(--prism-success)/8 px-3 py-2.5"
                  : isCurrent
                    ? "border-l-2 border-l-(--prism-signal) bg-(--prism-signal-soft) px-3 py-2.5"
                    : "border-l-2 border-l-border px-3 py-2.5"
              }
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-[10px] font-black uppercase tracking-[0.14em] text-muted-foreground">
                  Step {index + 1}
                </span>
                <Icon className={isDone ? "size-4 text-(--prism-success)" : isCurrent ? "size-4 text-primary" : "size-4 text-muted-foreground"} />
              </div>
              <p className="mt-2 text-sm font-black leading-tight text-foreground">{step.label}</p>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

function NextActionHero({
  event,
  action,
  onSelect,
}: {
  event: MvpEvent;
  action: ClientDashboardAction;
  onSelect: () => void;
}) {
  const Icon = action.icon;

  return (
    <section className="rounded-lg border border-border border-l-4 border-l-(--prism-signal) bg-card p-5 shadow-sm sm:p-6">
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_22rem] xl:items-end">
        <div className="min-w-0">
          <p className="text-sm font-bold text-primary">Next action</p>
          <h2 className="mt-2 max-w-3xl text-2xl font-black leading-tight text-foreground sm:text-3xl">
            {action.title}
          </h2>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground sm:text-base">
            {action.description}
          </p>
          <div className="mt-5 flex flex-wrap items-center gap-3">
            <Button onClick={onSelect} className="min-h-12 rounded-md px-5 font-black">
              {action.ctaLabel} <ArrowRight className="size-4" />
            </Button>
            <span className="inline-flex items-center gap-2 text-sm font-semibold text-muted-foreground">
              <Timer className="size-4 text-(--prism-amber)" />
              {action.detail} - {event.eventDate} - {formatStatusLabel(event.readiness)}
            </span>
          </div>
        </div>

        <div className="border-l border-border pl-4">
          <div className="flex items-start gap-3">
            <span className={`grid size-11 shrink-0 place-items-center rounded-md border ${actionToneClass(action.tone)}`}>
              <Icon className="size-5" />
            </span>
            <div className="min-w-0">
              <p className="text-sm font-black text-foreground">{event.eventName}</p>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">
                Confirmed client workspace. PMCM keeps internal planning details private while client-visible approvals stay here.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function ClientActionQueue({
  actions,
  onSelect,
}: {
  actions: ClientDashboardAction[];
  onSelect: (action: ClientDashboardAction) => void;
}) {
  return (
    <section className="rounded-lg border border-border bg-card p-4 shadow-sm sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.16em] text-primary">Action queue</p>
          <h3 className="mt-1 text-lg font-black text-foreground">Client-visible blockers</h3>
        </div>
        <Badge variant="outline" className="rounded-md border-primary/20 bg-secondary text-primary">
          {actions.length} workflows
        </Badge>
      </div>
      <div className="mt-4 divide-y divide-border">
        {actions.map((action) => {
          const Icon = action.icon;
          return (
            <button
              key={action.id}
              type="button"
              onClick={() => onSelect(action)}
              className="group flex min-h-20 w-full items-start gap-3 border-l-2 border-l-transparent px-3 py-3 text-left transition hover:border-l-(--prism-signal) hover:bg-muted/50"
            >
              <span className={`grid size-9 shrink-0 place-items-center rounded-md border ${actionToneClass(action.tone)}`}>
                <Icon className="size-4" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center justify-between gap-2">
                  <span className="text-sm font-black text-foreground">{action.title}</span>
                  <StatusBadge status={action.status} />
                </span>
                <span className="mt-1 line-clamp-2 block text-xs leading-5 text-muted-foreground">{action.description}</span>
              </span>
            </button>
          );
        })}
      </div>
    </section>
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

function FieldGroup({ label: labelText, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label className="text-xs font-bold uppercase tracking-wide text-(--prism-amber)">
        {labelText}
      </Label>
      {children}
    </div>
  );
}

export function Dashboard() {
  const router = useRouter();
  const [session, setSession] = useState<ClientSession | null>(null);
  const [state, setState] = useState<MvpDemoState | null>(null);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [tab, setTab] = useState<DetailTab>("overview");
  const [screen, setScreen] = useState<Screen>({ name: "dashboard" });
  const [form, setForm] = useState<PreferenceForm>(initialPreference);
  const [officialProject, setOfficialProject] = useState<Project | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    const current = readSession();
    if (!current) {
      router.replace("/sign-in?next=/dashboard");
      return;
    }
    setSession(current);
    if (current.role !== "client") return;
    mvpApi
      .clientState(current)
      .then((next) => {
        setState(next);
        const firstClientEvent = next.events.find(
          (ev) => ev.clientName === current.name && ev.clientPortalStatus === "unlocked",
        );
        setSelectedEventId(firstClientEvent?.id ?? null);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Unable to load client portal"));
  }, [router]);

  const events = useMemo(() => {
    if (!state || !session) return [];
    return state.events.filter(
      (ev) => ev.clientName === session.name && !ev.archived && ev.clientPortalStatus === "unlocked",
    );
  }, [session, state]);

  const selectedEvent = events.find((ev) => ev.id === selectedEventId) ?? events[0];
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
    if (!officialDraft || !selectedEvent) {
      setOfficialProject(null);
      return;
    }
    mvpApi
      .loadFloorPlanSnapshot(
        selectedEvent.id,
        officialDraft.id,
        officialDraft.status === "approved" ? "approved" : "submitted",
        { id: officialDraft.floorPlanId, name: officialDraft.name, venue: selectedEvent.eventName },
        session ?? undefined,
      )
      .then(setOfficialProject)
      .catch(() => setOfficialProject(null));
  }, [
    officialDraft?.id,
    officialDraft?.floorPlanId,
    officialDraft?.name,
    officialDraft?.status,
    selectedEvent,
    session,
  ]);

  async function refresh() {
    if (!session) return;
    const next = await mvpApi.clientState(session);
    setState(next);
  }

  async function openFloorplanEditor(draft: MvpFloorPlanDraft, readOnly = false, preset?: Preset) {
    if (!selectedEvent) return;
    const fallback = projectFromDraft(selectedEvent, draft, preset);
    const project = preset
      ? fallback
      : readOnly && draftIsOfficial(draft)
        ? await mvpApi.loadFloorPlanSnapshot(
            selectedEvent.id,
            draft.id,
            draft.status === "approved" ? "approved" : "submitted",
            fallback,
            session ?? undefined,
          )
        : await mvpApi.loadPlan(draft.floorPlanId, fallback, session ?? undefined);
    if (preset) await mvpApi.savePlan(project, session ?? undefined);
    setScreen({ name: "editor", event: selectedEvent, draft, project, readOnly });
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
      setNotice("Layout preference sent. Your event team will prepare the official floorplan for review.");
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
      void openFloorplanEditor(officialDraft, true);
      return;
    }
    setTab(action.targetTab);
  }

  /* Loading and auth redirects */

  if (!session) {
    return (
      <main className="grid min-h-screen place-items-center bg-background px-6">
        <Skeleton className="h-24 w-full max-w-sm rounded-lg" />
      </main>
    );
  }

  if (session.role !== "client") {
    return (
      <main className="grid min-h-screen place-items-center bg-background px-6">
        <section className="w-full max-w-md rounded-lg border border-border bg-card p-7 shadow-sm">
          <span className="grid size-11 place-items-center rounded-lg bg-amber-50 text-amber-600">
            <ShieldCheck className="size-5" />
          </span>
          <h1 className="mt-5 text-xl font-black text-foreground">Wrong portal for this account.</h1>
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
    return (
      <main className="grid min-h-screen grid-cols-[280px_minmax(0,1fr)] bg-background">
        <aside className="border-r border-primary/20 bg-sidebar p-5" />
        <div className="p-8">
          {error ? (
            <Alert variant="destructive" className="rounded-lg">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : (
            <DashboardSkeleton />
          )}
        </div>
      </main>
    );
  }

  if (screen.name === "editor") {
    const editable = !screen.readOnly;
    return (
      <main className="h-screen w-full overflow-hidden bg-background">
        <EditorShell
          project={screen.project}
          eventName={screen.event.eventName}
          draftName={screen.draft.name}
          draftStatus={screen.draft.status}
          readOnly={screen.readOnly}
          onBack={() => {
            setScreen({ name: "dashboard" });
            setTab("floorplan");
          }}
          onSave={editable ? (project) => mvpApi.savePlan(project, session ?? undefined) : undefined}
          onSubmit={
            editable
              ? async (project) => {
                  await mvpApi.savePlan(project, session ?? undefined);
                  await refresh();
                  setNotice("Preference draft saved. Your event team can use it when preparing the official layout.");
                  setScreen({ name: "dashboard" });
                  setTab("floorplan");
                }
              : undefined
          }
        />
      </main>
    );
  }

  /* Main dashboard */

  const shellNavItems = DETAIL_TABS.map((item) => ({
    ...item,
    disabled: !selectedEvent && item.id !== "overview",
  }));

  const shellCommandActions = selectedEvent
    ? clientActions.slice(0, 4).map((action) => ({
        id: action.id,
        label: action.title,
        description: action.description,
        icon: action.icon,
        status: action.status,
        onSelect: () => runClientAction(action),
      }))
    : [];

  const shellMobileActions = [
    { id: "overview", label: "Overview", icon: Home, active: tab === "overview", onSelect: () => setTab("overview") },
    { id: "floorplan", label: "Layout", icon: MapPinned, active: tab === "floorplan", disabled: !selectedEvent, onSelect: () => setTab("floorplan") },
    { id: "billing", label: "Pay", icon: WalletCards, active: tab === "billing", disabled: !selectedEvent, onSelect: () => setTab("billing") },
  ];

  const shellRightRail = (
    <div className="space-y-4">
      <section className="rounded-lg border border-border bg-card p-4 shadow-sm">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.16em] text-primary">Switch event</p>
            <p className="mt-1 text-xs text-muted-foreground">{events.length} confirmed event{events.length === 1 ? "" : "s"}</p>
          </div>
          <StatusBadge
            status={portalBadgeStatus(selectedEvent?.clientPortalStatus)}
            label={portalBadgeLabel(selectedEvent?.clientPortalStatus)}
          />
        </div>
        <PrismCompactRecordList
          className="mt-3"
          emptyText="No signed-conforme events are open yet."
          items={events.map((ev) => {
            const draftsForEvent = state.floorPlanDrafts.filter((draft) => draft.eventId === ev.id);
            const activeForEvent = draftsForEvent.find((draft) => draft.isActive) ?? draftsForEvent[0];
            return {
              id: ev.id,
              title: ev.eventName,
              description: ev.clientName,
              meta: ev.eventDate,
              status: activeForEvent?.status ?? ev.status,
              icon: CalendarDays,
              active: ev.id === selectedEvent?.id,
              onSelect: () => {
                setSelectedEventId(ev.id);
                setTab("overview");
              },
            };
          })}
        />
      </section>

      <section className="rounded-lg border border-border bg-card p-4 shadow-sm">
        <div className="flex items-start gap-3">
          <span className="grid size-9 shrink-0 place-items-center rounded-md bg-(--prism-signal-soft) text-primary">
            <UserRoundCheck className="size-4" />
          </span>
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.16em] text-primary">PMCM contact</p>
            <h3 className="mt-1 text-sm font-black text-foreground">Planning desk</h3>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              PMCM keeps supplier, coordinator, and internal cost decisions private. Client actions stay focused on approvals, files, billing visibility, and event preferences.
            </p>
          </div>
        </div>
      </section>

      <section className="rounded-lg border border-border bg-card p-4 shadow-sm">
        <p className="text-[10px] font-black uppercase tracking-[0.16em] text-primary">Key deadlines</p>
        <div className="mt-3 space-y-2">
          {[
            {
              label: "Event day",
              value: selectedEvent?.eventDate ?? "Pending",
              icon: CalendarDays,
            },
            {
              label: "Layout review",
              value: officialDraft ? formatStatusLabel(officialDraft.status) : "Not published",
              icon: MapPinned,
            },
            {
              label: "Next payment",
              value: payments.find((payment) => payment.status !== "paid")?.dueDate ?? "No open milestone",
              icon: ReceiptText,
            },
            {
              label: "Documents",
              value: documents.some((document) => /needs|pending|requested/i.test(document.status)) ? "Needs attention" : `${documents.length} received`,
              icon: ClipboardCheck,
            },
          ].map((item) => {
            const Icon = item.icon;
            return (
              <div key={item.label} className="flex items-center gap-3 border-t border-border px-1 py-2.5 first:border-t-0">
                <Icon className="size-4 shrink-0 text-(--prism-amber)" />
                <div className="min-w-0">
                  <p className="text-xs font-black text-foreground">{item.label}</p>
                  <p className="mt-0.5 truncate text-xs text-muted-foreground">{item.value}</p>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <section className="rounded-lg border border-border bg-card p-4 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <p className="text-[10px] font-black uppercase tracking-[0.16em] text-primary">Notifications</p>
          <Bell className="size-4 text-(--prism-amber)" />
        </div>
        {notifications.length ? (
          <div className="mt-3 space-y-2">
            {notifications.map((notification) => (
              <div key={notification.id} className="border-l border-border px-3 py-2.5">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs font-black text-foreground">{notification.channel.toUpperCase()}</p>
                  <StatusBadge status={notification.status} />
                </div>
                <p className="mt-1 line-clamp-2 text-xs leading-5 text-muted-foreground">{notification.message}</p>
              </div>
            ))}
          </div>
        ) : (
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            Email and Viber notifications will appear here when PMCM posts client-visible updates.
          </p>
        )}
      </section>
    </div>
  );

  return (
    <PrismAppShell
      productLabel="P.R.I.S.M"
      roleLabel="Client Portal"
      eyebrow="Confirmed client event"
      title={selectedEvent?.eventName ?? "Client portal"}
      description={
        selectedEvent
          ? `${selectedEvent.clientName} - ${selectedEvent.eventDate}. Next actions, proposal review, documents, billing, and official layout review stay in this signed-in portal.`
          : "The portal opens after your inquiry is accepted and the signed conforme is recorded."
      }
      activeItemId={tab}
      navItems={shellNavItems}
      onNavSelect={(id) => setTab(id as DetailTab)}
      user={{
        name: session.name,
        detail: session.organization,
        initials: session.name.slice(0, 2).toUpperCase(),
      }}
      searchPlaceholder="Search proposal, billing, documents..."
      commandActions={shellCommandActions}
      headerActions={
        <Button size="sm" variant="outline" className="rounded-md font-bold" onClick={() => void refresh()}>
          Refresh
        </Button>
      }
      rightRail={shellRightRail}
      mobileActions={shellMobileActions}
      onSignOut={() => {
        window.localStorage.removeItem(MOCK_AUTH_SESSION_KEY);
        router.replace("/sign-in");
      }}
    >
      <div className="space-y-5">

            {error && <PrismNoticeBanner tone="danger">{error}</PrismNoticeBanner>}
            {notice && <PrismNoticeBanner tone="success">{notice}</PrismNoticeBanner>}

            {selectedEvent ? (
              <>
                <RolePageHeader
                  eyebrow="Event context"
                  title={selectedEvent.eventName}
                  description={`${selectedEvent.clientName} - ${selectedEvent.eventDate}. This signed-in surface stays focused on client approvals, documents, billing visibility, and official layout review.`}
                  meta={[
                    <StatusBadge key="stage" status={selectedEvent.status} label={formatStatusLabel(selectedEvent.status)} />,
                    <StatusBadge key="portal" status={portalBadgeStatus(selectedEvent.clientPortalStatus)} label={portalBadgeLabel(selectedEvent.clientPortalStatus)} />,
                    selectedEvent.readiness ? `Readiness ${formatStatusLabel(selectedEvent.readiness)}` : "Readiness pending",
                  ]}
                  action={
                    <Button size="sm" variant="outline" className="rounded-md font-bold" onClick={() => setTab("activity")}>
                      Activity
                    </Button>
                  }
                />

                {nextAction ? (
                  <NextActionHero
                    event={selectedEvent}
                    action={nextAction}
                    onSelect={() => runClientAction(nextAction)}
                  />
                ) : null}

                <LifecycleStrip
                  selectedEvent={selectedEvent}
                  briefing={briefing}
                  billing={billing}
                  officialDraft={officialDraft}
                />

                <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_24rem]">
                  <ClientActionQueue actions={clientActions} onSelect={runClientAction} />

                  <section className="rounded-lg border border-border bg-card p-4 shadow-sm sm:p-5">
                    <div className="flex items-start gap-3">
                      <span className="grid size-10 shrink-0 place-items-center rounded-md bg-(--prism-ink) text-sidebar-foreground">
                        <MessageSquareText className="size-4" />
                      </span>
                      <div className="min-w-0">
                        <p className="text-[10px] font-black uppercase tracking-[0.16em] text-primary">Client workspace</p>
                        <h3 className="mt-1 text-lg font-black text-foreground">What this portal is for</h3>
                        <p className="mt-2 text-sm leading-6 text-muted-foreground">
                          Review PMCM-published planning details, respond to client-visible blockers, and keep event files in one record. Supplier choices, coordinator operations, internal CE, and audit controls stay outside this portal.
                        </p>
                      </div>
                    </div>
                    <div className="mt-4 grid gap-2">
                      {[
                        ["Conforme gate", portalBadgeLabel(selectedEvent.clientPortalStatus)],
                        ["Official layout", officialDraft ? formatStatusLabel(officialDraft.status) : "Not published"],
                        ["Billing", billing ? formatStatusLabel(billing.status) : "Pending"],
                      ].map(([label, value]) => (
                        <div key={label} className="flex items-center justify-between gap-3 border-t border-border px-1 py-2.5 first:border-t-0">
                          <span className="text-xs font-bold text-muted-foreground">{label}</span>
                          <span className="text-xs font-black text-foreground">{value}</span>
                        </div>
                      ))}
                    </div>
                  </section>
                </div>

                <PrismWorkflowTabs items={DETAIL_TABS} activeId={tab} onSelect={(id) => setTab(id as DetailTab)} />

                {/* Tab content */}
                {tab === "overview" && (
                  <ClientOverviewTab
                    selectedEvent={selectedEvent}
                    briefing={briefing}
                    payments={payments}
                    billing={billing}
                    documents={documents}
                    audit={audit}
                    officialDraft={officialDraft}
                    preferenceDraftCount={preferenceDrafts.length}
                    onOpenOfficialFloorplan={
                      officialDraft ? () => openFloorplanEditor(officialDraft, true) : undefined
                    }
                    setTab={setTab}
                  />
                )}

                {tab === "floorplan" && (
                  <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_400px]">
                    {/* Draft panel */}
                    <section className="rounded-lg border border-border bg-card shadow-sm">
                      <header className="flex items-center gap-2.5 border-b border-border px-5 py-3.5">
                        <span className="grid size-7 place-items-center rounded-md bg-secondary text-(--prism-amber)">
                          <MapPinned className="size-3.5" />
                        </span>
                        <h3 className="text-sm font-bold text-foreground">Layout preference draft</h3>
                      </header>
                      <div className="p-5 space-y-5">
                        <div className="border-l border-(--prism-sage) bg-secondary/45 px-3 py-2.5">
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div>
                              <p className="text-sm font-bold text-foreground">Preference canvas</p>
                              <p className="mt-0.5 text-xs leading-5 text-muted-foreground">
                                Sketch seating, stage, and guest-flow ideas here. The official floor plan remains separate for client review.
                              </p>
                            </div>
                            {preferenceDrafts[0] && (
                              <Button
                                size="sm"
                                onClick={() => openFloorplanEditor(preferenceDrafts[0])}
                                className="rounded-lg font-bold"
                              >
                                Open latest preference
                              </Button>
                            )}
                          </div>
                          <div className="mt-4 grid gap-2 sm:grid-cols-2">
                            {PRESETS.slice(0, 4).map((preset) => (
                              <button
                                key={preset.id}
                                disabled={busy === `editor-${preset.id}`}
                                onClick={() => createEditorDraft(preset)}
                                className="rounded-lg border border-border bg-card p-3 text-left transition hover:border-primary/35 disabled:opacity-60"
                              >
                                <p className="text-sm font-bold text-foreground">{preset.name}</p>
                                <p className="mt-0.5 text-xs leading-5 text-muted-foreground">{preset.description}</p>
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* Preference form */}
                        <form onSubmit={submitPreference} className="space-y-4">
                          <FieldGroup label="Preference title">
                            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
                          </FieldGroup>
                          <div className="grid gap-4 sm:grid-cols-2">
                            <FieldGroup label="Seating style">
                              <Input value={form.seatingStyle} onChange={(e) => setForm({ ...form, seatingStyle: e.target.value })} />
                            </FieldGroup>
                            <FieldGroup label="Stage preference">
                              <Input value={form.stagePreference} onChange={(e) => setForm({ ...form, stagePreference: e.target.value })} />
                            </FieldGroup>
                          </div>
                          <FieldGroup label="Guest flow notes">
                            <textarea
                              value={form.flowNotes}
                              onChange={(e) => setForm({ ...form, flowNotes: e.target.value })}
                              rows={3}
                              className="w-full rounded-lg border border-border bg-input-background px-3 py-2 text-sm outline-none transition focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]"
                            />
                          </FieldGroup>
                          <div className="grid gap-4 sm:grid-cols-[120px_1fr]">
                            <FieldGroup label="Guests">
                              <Input
                                type="number"
                                min={1}
                                value={form.guestCount}
                                onChange={(e) => setForm({ ...form, guestCount: Number(e.target.value) })}
                              />
                            </FieldGroup>
                            <FieldGroup label="Constraints">
                              <textarea
                                value={form.constraints}
                                onChange={(e) => setForm({ ...form, constraints: e.target.value })}
                                rows={3}
                                className="w-full rounded-lg border border-border bg-input-background px-3 py-2 text-sm outline-none transition focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]"
                              />
                            </FieldGroup>
                          </div>
                          <FieldGroup label="Optional notes">
                            <textarea
                              value={form.notes}
                              onChange={(e) => setForm({ ...form, notes: e.target.value })}
                              rows={2}
                              className="w-full rounded-lg border border-border bg-input-background px-3 py-2 text-sm outline-none transition focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]"
                            />
                          </FieldGroup>
                          <Button disabled={busy === "layout-preference"} className="min-h-11 gap-2 rounded-lg font-bold" type="submit">
                            <Send className="size-4" /> Submit preference draft
                          </Button>
                        </form>

                        {/* Existing drafts */}
                        {preferenceDrafts.length > 0 && (
                          <div className="border-t border-border pt-4">
                            <p className="text-xs font-bold text-muted-foreground uppercase tracking-wide">Your preference drafts</p>
                            {preferenceDrafts.slice(0, 4).map((draft) => (
                              <div key={draft.id} className="flex items-center justify-between gap-3 border-t border-border px-1 py-3 text-sm first:mt-2 first:border-t-0">
                                <div className="min-w-0">
                                  <p className="truncate font-semibold text-foreground">{draft.name}</p>
                                  <StatusBadge status={draft.status} className="mt-1.5" />
                                </div>
                                <Button variant="outline" size="sm" className="min-h-10 shrink-0 rounded-lg" onClick={() => openFloorplanEditor(draft)}>
                                  Edit preference
                                </Button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </section>

                    {/* Official review panel */}
                    <section className="rounded-lg border border-border bg-card shadow-sm">
                      <header className="flex items-center gap-2.5 border-b border-border px-5 py-3.5">
                        <span className="grid size-7 place-items-center rounded-md bg-secondary text-(--prism-amber)">
                          <CheckCircle2 className="size-3.5" />
                        </span>
                        <h3 className="text-sm font-bold text-foreground">Official floorplan review</h3>
                      </header>
                      <div className="p-5">
                        {officialDraft ? (
                          <div className="space-y-4">
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <p className="font-bold text-foreground">{officialDraft.name}</p>
                                <p className="mt-0.5 text-xs text-muted-foreground">Official floor plan for approval or revision comments.</p>
                              </div>
                              <StatusBadge status={officialDraft.status} />
                            </div>
                            <Button
                              variant="outline"
                              className="w-full rounded-lg font-bold"
                              onClick={() => openFloorplanEditor(officialDraft, true)}
                            >
                              Open floor plan
                            </Button>
                            <LayoutPreview project={officialProject} />
                          </div>
                        ) : (
                          <EmptyState
                            icon={LockKeyhole}
                            title="No official layout yet"
                            description="Your event team will publish the official layout here after reviewing your preference."
                          />
                        )}
                      </div>
                    </section>
                  </div>
                )}

                {tab === "briefing" && <ClientBriefingTab briefing={briefing} />}
                {tab === "proposal" && (
                  <ClientProposalTab
                    selectedEvent={selectedEvent}
                    briefing={briefing}
                    billing={billing}
                    payments={payments}
                    officialDraft={officialDraft}
                    setTab={setTab}
                  />
                )}
                {tab === "billing" && <ClientBillingTab payments={payments} billing={billing} />}
                {tab === "documents" && <ClientDocumentsTab documents={documents} />}
                {tab === "activity" && <ClientActivityTab audit={audit} />}
              </>
            ) : (
              <EmptyState
                icon={LockKeyhole}
                title="No active event portal"
                description="The client portal opens after your inquiry is accepted and the signed conforme is uploaded."
                className="mt-8"
              />
            )}
      </div>
    </PrismAppShell>
  );
}
