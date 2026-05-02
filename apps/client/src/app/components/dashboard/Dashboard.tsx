"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import {
  Activity,
  ArrowRight,
  BadgeCheck,
  CalendarDays,
  CheckCircle2,
  FileCheck2,
  FileText,
  Home,
  LockKeyhole,
  MapPinned,
  ReceiptText,
  Send,
  ShieldCheck,
  WalletCards,
  type LucideIcon,
} from "lucide-react";
import { MOCK_AUTH_SESSION_KEY } from "@/mock/auth-users";
import {
  mvpApi,
  type MvpDemoState,
  type MvpEvent,
  type MvpFloorPlanDraft,
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
  PrismStatusSummary,
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
  DashboardSkeleton,
} from "./dashboard-tabs";

const EditorShell = dynamic(
  () => import("../editor/EditorShell").then((mod) => mod.EditorShell),
  {
    ssr: false,
    loading: () => (
      <div className="grid size-full place-items-center bg-background text-sm text-muted-foreground">
        Loading layout view…
      </div>
    ),
  },
);

type ClientSession = MvpUser & { signedInAt: string };
type DetailTab = "overview" | "floorplan" | "briefing" | "billing" | "documents" | "activity";
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
  { id: "floorplan", label: "Floorplan", icon: MapPinned },
  { id: "billing", label: "Billing", icon: WalletCards },
  { id: "documents", label: "Documents", icon: FileText },
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
        <span>{project.widthM}m × {project.heightM}m</span>
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
  const firstName = session?.name.split(" ")[0] || "there";

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

  /* ── Loading / auth redirects ─────────────────────────────── */

  if (!session) {
    return (
      <main className="grid min-h-screen place-items-center bg-background px-6">
        <Skeleton className="h-24 w-full max-w-sm rounded-xl" />
      </main>
    );
  }

  if (session.role !== "client") {
    return (
      <main className="grid min-h-screen place-items-center bg-background px-6">
        <section className="w-full max-w-md rounded-xl border border-border bg-card p-7 shadow-[0_18px_70px_rgba(23,18,22,0.08)]">
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
            <Alert variant="destructive" className="rounded-xl">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : (
            <DashboardSkeleton />
          )}
        </div>
      </main>
    );
  }

  /* ── Editor fullscreen ────────────────────────────────────── */

  if (screen.name === "editor") {
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
          onSave={(project) => mvpApi.savePlan(project, session ?? undefined)}
          onSubmit={async (project) => {
            await mvpApi.savePlan(project, session ?? undefined);
            await refresh();
            setNotice("Preference draft saved. Your event team can use it when preparing the official layout.");
            setScreen({ name: "dashboard" });
            setTab("floorplan");
          }}
        />
      </main>
    );
  }

  /* ── Main dashboard ───────────────────────────────────────── */

  const shellNavItems = DETAIL_TABS.map((item) => ({
    ...item,
    disabled: !selectedEvent && item.id !== "overview",
  }));

  const shellCommandActions = selectedEvent
    ? [
        {
          id: "briefing",
          label: "Review briefing",
          description: briefing ? "Venue, scope, guest count, and service notes are ready." : "Briefing appears after your event team publishes it.",
          icon: FileCheck2,
          status: briefing ? "ready" : "pending",
          onSelect: () => setTab("briefing"),
        },
        {
          id: "floorplan",
          label: officialDraft ? "View official layout" : "Send layout preference",
          description: officialDraft
            ? "Read-only official copy is available."
            : "Share seating, stage, and flow notes.",
          icon: MapPinned,
          status: officialDraft?.status ?? "pending",
          onSelect: () => setTab("floorplan"),
        },
        {
          id: "billing",
          label: "Check billing",
          description: billing ? "Statement and milestones are visible." : "Milestones appear after billing is posted.",
          icon: ReceiptText,
          status: billing?.status ?? "pending",
          onSelect: () => setTab("billing"),
        },
        {
          id: "documents",
          label: "Open documents",
          description: `${documents.length} document${documents.length === 1 ? "" : "s"} in this event.`,
          icon: FileText,
          status: documents.length ? "ready" : "pending",
          onSelect: () => setTab("documents"),
        },
      ]
    : [];

  const shellMobileActions = [
    { id: "overview", label: "Overview", icon: Home, active: tab === "overview", onSelect: () => setTab("overview") },
    { id: "floorplan", label: "Plan", icon: MapPinned, active: tab === "floorplan", disabled: !selectedEvent, onSelect: () => setTab("floorplan") },
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
        <p className="text-[10px] font-black uppercase tracking-[0.16em] text-primary">Layout boundary</p>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          Official floorplans are view-only in this portal. Use preference drafts to share layout ideas before the official version is published for review.
        </p>
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
          ? `${selectedEvent.clientName} - ${selectedEvent.eventDate}. Briefing, billing, documents, and official layout review stay in this signed-in portal.`
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
      searchPlaceholder="Search briefing, billing, documents..."
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
                {/* Hero greeting */}
                <section className="rounded-xl border border-border bg-secondary/60 px-6 py-5">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <h2 className="text-2xl font-black leading-none text-foreground">
                        Hello, {firstName}.
                      </h2>
                      <p className="mt-2 text-sm text-muted-foreground">
                        Quick access to briefing, billing, documents, preference drafts, and official layout review.
                      </p>
                    </div>
                    <StatusBadge
                      status={portalBadgeStatus(selectedEvent.clientPortalStatus)}
                      label={portalBadgeLabel(selectedEvent.clientPortalStatus)}
                    />
                  </div>

                  {/* Quick action cards */}
                  <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-5">
                    {[
                      { label: "Briefing", detail: "Review venue and service notes", icon: FileCheck2, nextTab: "briefing" as DetailTab, color: "bg-secondary text-foreground" },
                      { label: "Layout", detail: "Preferences and official review", icon: MapPinned, nextTab: "floorplan" as DetailTab, color: "bg-(--prism-amber-soft) text-(--prism-amber)" },
                      { label: "Documents", detail: "Conforme files and approvals", icon: FileText, nextTab: "documents" as DetailTab, color: "bg-secondary text-primary" },
                      { label: "Billing", detail: "Milestones and statement status", icon: ReceiptText, nextTab: "billing" as DetailTab, color: "bg-(--prism-signal-soft) text-(--prism-danger)" },
                      { label: "Activity", detail: "Client-visible event updates", icon: Activity, nextTab: "activity" as DetailTab, color: "bg-muted text-muted-foreground" },
                    ].map((action) => (
                      <button
                        key={action.label}
                        onClick={() => setTab(action.nextTab)}
                        className="group min-h-[7.5rem] rounded-lg border border-border bg-card p-3.5 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-md"
                      >
                        <span className={`grid size-8 place-items-center rounded-md ${action.color}`}>
                          <action.icon className="size-4" />
                        </span>
                        <p className="mt-3 text-sm font-black text-foreground">{action.label}</p>
                        <p className="mt-0.5 line-clamp-2 text-xs leading-5 text-muted-foreground">{action.detail}</p>
                      </button>
                    ))}
                  </div>
                </section>

                <RolePageHeader
                  eyebrow="Confirmed client portal"
                  title="Your event is open because the signed conforme is on file."
                  description="Use this portal for briefing details, document submissions, billing milestones, preference drafts, and read-only review of the official floorplan."
                  meta={[
                    <StatusBadge
                      key="portal-status"
                      status={portalBadgeStatus(selectedEvent.clientPortalStatus)}
                      label={portalBadgeLabel(selectedEvent.clientPortalStatus)}
                    />,
                  ]}
                />

                {/* Event cards */}
                <section>
                  <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
                    <div>
                      <h3 className="text-sm font-black text-foreground">Switch event</h3>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Only accepted inquiries with signed conformes appear here.
                      </p>
                    </div>
                    <Badge variant="outline" className="rounded-full border-(--prism-amber)/35 bg-accent text-(--prism-amber) text-xs">
                      {events.length} active
                    </Badge>
                  </div>
                  <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-4">
                    {events.slice(0, 4).map((ev) => {
                      const draftsForEvent = state.floorPlanDrafts.filter((d) => d.eventId === ev.id);
                      const activeForEvent = draftsForEvent.find((d) => d.isActive) ?? draftsForEvent[0];
                      const isActive = ev.id === selectedEvent.id;
                      return (
                        <button
                          key={ev.id}
                          onClick={() => { setSelectedEventId(ev.id); setTab("overview"); }}
                          aria-pressed={isActive}
                          className={`flex min-h-24 items-start gap-3 rounded-lg border bg-card p-3.5 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${
                            isActive ? "border-primary/40 ring-2 ring-primary/10" : "border-border hover:border-primary/25"
                          }`}
                        >
                          <span className="mt-0.5 grid size-10 shrink-0 place-items-center rounded-md bg-secondary text-primary">
                            <CalendarDays className="size-4" />
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="text-[10px] font-black uppercase tracking-[0.15em] text-(--prism-amber)">
                              {isActive ? "Selected event" : "Confirmed event"}
                            </p>
                            <p className="mt-1 line-clamp-2 text-sm font-black text-foreground">{ev.eventName}</p>
                            <div className="mt-2 flex flex-wrap items-center gap-2">
                              <span className="text-xs text-muted-foreground">{ev.eventDate}</span>
                              <StatusBadge status={activeForEvent?.status ?? ev.status} />
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </section>

                <PrismStatusSummary
                  columns="four"
                  items={[
                    {
                      id: "portal",
                      label: "Conforme gate",
                      value: portalBadgeLabel(selectedEvent.clientPortalStatus),
                      icon: BadgeCheck,
                      status: portalBadgeStatus(selectedEvent.clientPortalStatus),
                    },
                    {
                      id: "floorplan",
                      label: "Official layout",
                      value: officialDraft ? formatStatusLabel(officialDraft.status) : preferenceDrafts.length ? "Preference sent" : "Pending",
                      icon: MapPinned,
                      status: officialDraft?.status ?? (preferenceDrafts.length ? "submitted" : "pending"),
                    },
                    {
                      id: "billing",
                      label: "Payment milestones",
                      value: billing ? formatStatusLabel(billing.status) : "Pending",
                      icon: ReceiptText,
                      status: billing?.status ?? "pending",
                    },
                    {
                      id: "activity",
                      label: "Event updates",
                      value: audit.length,
                      icon: Activity,
                      detail: "Client-visible updates for this event.",
                    },
                  ]}
                />

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
                    <section className="rounded-xl border border-border bg-card shadow-sm">
                      <header className="flex items-center gap-2.5 border-b border-border px-5 py-3.5">
                        <span className="grid size-7 place-items-center rounded-md bg-secondary text-(--prism-amber)">
                          <MapPinned className="size-3.5" />
                        </span>
                        <h3 className="text-sm font-bold text-foreground">Layout preference draft</h3>
                      </header>
                      <div className="p-5 space-y-5">
                        {/* Canvas presets */}
                        <div className="rounded-xl border border-border bg-secondary/50 p-4">
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div>
                              <p className="text-sm font-bold text-foreground">Preference canvas</p>
                              <p className="mt-0.5 text-xs leading-5 text-muted-foreground">
                                Sketch seating, stage, and guest-flow ideas here. The official floorplan remains a separate read-only review.
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
                          <div className="space-y-2 border-t border-border pt-4">
                            <p className="text-xs font-bold text-muted-foreground uppercase tracking-wide">Your preference drafts</p>
                            {preferenceDrafts.slice(0, 4).map((draft) => (
                              <div key={draft.id} className="flex items-center justify-between gap-3 rounded-lg border border-border bg-background p-3 text-sm">
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
                    <section className="rounded-xl border border-border bg-card shadow-sm">
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
                                <p className="mt-0.5 text-xs text-muted-foreground">Read-only official version for approval or revision comments.</p>
                              </div>
                              <StatusBadge status={officialDraft.status} />
                            </div>
                            <Button
                              variant="outline"
                              className="w-full rounded-lg font-bold"
                              onClick={() => openFloorplanEditor(officialDraft, true)}
                            >
                              View read-only plan
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
