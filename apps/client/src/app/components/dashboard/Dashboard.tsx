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
  ClipboardList,
  FileCheck2,
  FileText,
  Heart,
  Home,
  LayoutTemplate,
  LockKeyhole,
  MapPinned,
  ReceiptText,
  Send,
  ShieldCheck,
  Trash2,
  WalletCards,
  type LucideIcon,
} from "lucide-react";
import { MOCK_AUTH_SESSION_KEY } from "@/mock/auth-users";
import {
  mvpApi,
  type MvpAuditLog,
  type MvpDemoState,
  type MvpEvent,
  type MvpFloorPlanDraft,
  type MvpUser,
} from "@/lib/mvp-api";
import { Alert, AlertDescription } from "../ui/alert";
import { Avatar, AvatarFallback } from "../ui/avatar";
import { Badge } from "../ui/badge";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "../ui/breadcrumb";
import { Button } from "../ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Separator } from "../ui/separator";
import { Skeleton } from "../ui/skeleton";
import { StatusBadge, statusClass } from "../ui/status-badge";
import { EmptyState } from "../ui/empty-state";
import { PrismMetricTile, PrismNoticeBanner, RolePageHeader } from "@prism/ui";
import { ClientDefenseWorkspace } from "@prism/ui/client-blocks";
import { PRESETS, type Preset } from "../editor/presets";
import type { CanvasObject as VenueObject, Project } from "../editor/types";
import {
  ClientActivityTab,
  ClientBillingTab,
  ClientBriefingTab,
  ClientDocumentsTab,
  DashboardSkeleton,
} from "./dashboard-tabs";

const EditorShell = dynamic(
  () => import("../editor/EditorShell").then((mod) => mod.EditorShell),
  {
    ssr: false,
    loading: () => (
      <div className="grid size-full place-items-center bg-background text-sm text-muted-foreground">
        Loading floorplan editor…
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

const money = new Intl.NumberFormat("en-PH", {
  style: "currency",
  currency: "PHP",
  maximumFractionDigits: 0,
});

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
        Official layout preview will appear here after PMCM submits.
      </div>
    );
  }
  return (
    <div className="overflow-hidden rounded-lg border border-border bg-[#FFF4EC]">
      <div className="relative aspect-16/10 min-h-60 bg-[linear-gradient(#EAD5CE_1px,transparent_1px),linear-gradient(90deg,#EAD5CE_1px,transparent_1px)] bg-size-[28px_28px]">
        {project.objects.length === 0 ? (
          <div className="absolute inset-0 grid place-items-center px-8 text-center text-sm text-muted-foreground">
            PMCM has submitted this layout record; objects will appear after the next save.
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
  const clientConforme =
    selectedEvent?.clientPortalStatus === "unlocked"
      ? {
          status: "signed" as const,
          title: "Signed conforme is on file",
          description:
            "Your client portal is unlocked. PMCM can now coordinate briefing, billing, supplier work, and official floorplan review from this confirmed event record.",
          primaryAction: (
            <Button type="button" variant="outline" size="sm" className="rounded-lg font-bold" onClick={() => setTab("documents")}>
              View documents
            </Button>
          ),
        }
      : {
          status: "locked" as const,
          title: "Portal unlock is still pending",
          description:
            "PMCM reviews the inquiry first, then opens the client portal after the conforme is signed and accepted.",
        };
  const officialFloorplanStatus = !officialDraft
    ? "not-started"
    : officialDraft.status === "approved"
      ? "approved"
      : officialDraft.status === "in_review"
        ? "submitted"
        : "draft";
  const billingMilestones = payments.map((payment) => ({
    id: payment.id,
    label: payment.label,
    amount: money.format(payment.amount),
    due: payment.dueDate,
    status: payment.status,
  }));
  const clientDocuments = documents.map((document) => ({
    id: document.id,
    title: document.fileName,
    description: document.type.replaceAll("_", " "),
    status: document.status,
    meta: `Uploaded ${document.uploadedAt}`,
  }));
  const clientActivityItems = audit.map((item) => ({
    id: item.id,
    title: item.action,
    description: item.actor,
    status: "completed",
    meta: item.createdAt,
  }));

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
          name: `${preset.name} client draft`,
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
      setError(err instanceof Error ? err.message : "Unable to open floorplan editor");
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
      setNotice("Layout preference submitted to PMCM for official editing.");
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
              ? "PMCM and coordinator accounts belong in the event command portal."
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
            setNotice("Floorplan draft saved for PMCM review inside this event.");
            setScreen({ name: "dashboard" });
            setTab("floorplan");
          }}
        />
      </main>
    );
  }

  /* ── Main dashboard ───────────────────────────────────────── */

  return (
    <main className="min-h-screen bg-background text-foreground lg:h-screen lg:overflow-hidden">
      <div className="grid min-h-screen lg:h-screen lg:grid-cols-[280px_minmax(0,1fr)]">

        {/* Sidebar */}
        <aside className="flex flex-col border-r border-primary/20 bg-sidebar p-5 text-sidebar-foreground lg:h-screen lg:overflow-y-auto">
          <a href="/" className="flex items-center gap-3">
            <span className="flex h-11 w-32 items-center justify-center rounded-lg border border-white/10 bg-white px-2.5 shadow-sm">
              <img src="/pmcm-logo.png" alt="PMCM logo" className="h-8 w-full object-contain" />
            </span>
            <span>
              <span className="block text-xs font-black uppercase tracking-[0.22em] text-(--prism-amber)">P.R.I.S.M</span>
              <span className="block text-sm text-sidebar-foreground/70">Client portal</span>
            </span>
          </a>

          {/* User card */}
          <div className="mt-6 flex items-center gap-3 rounded-xl border border-white/10 bg-white/7 p-3">
            <Avatar className="size-10 border border-(--prism-amber)/30">
              <AvatarFallback className="bg-card text-xs font-black text-foreground">
                {session.name.slice(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <p className="truncate text-sm font-black">{session.name}</p>
              <p className="truncate text-xs text-sidebar-foreground/60">{session.organization}</p>
            </div>
          </div>

          {/* Primary nav */}
          <nav className="mt-7 flex flex-col gap-1">
            <p className="px-3 pb-2 text-[10px] font-black uppercase tracking-[0.18em] text-(--prism-amber)">
              Navigation
            </p>
            <SidebarNavButton
              icon={Home}
              label="Dashboard"
              active={tab === "overview" && !selectedEvent}
              onClick={() => setTab("overview")}
            />
            <SidebarNavButton
              icon={ClipboardList}
              label="My events"
              badge={events.length}
              active={!!selectedEvent}
              onClick={() => setTab("overview")}
            />
          </nav>

          {/* Event workspace sub-nav — only shown when an event is selected */}
          {selectedEvent && (
            <nav className="mt-5 flex flex-col gap-1 border-l border-white/10 pl-3 ml-3">
              <p className="px-3 pb-1 text-[10px] font-black uppercase tracking-[0.16em] text-sidebar-foreground/50">
                {selectedEvent.eventName}
              </p>
              {DETAIL_TABS.map(({ id, label, icon }) => (
                <SidebarNavButton
                  key={id}
                  icon={icon}
                  label={label}
                  active={tab === id}
                  onClick={() => setTab(id)}
                  small
                />
              ))}
            </nav>
          )}

          {/* Resources */}
          <nav className="mt-6 flex flex-col gap-1">
            <p className="px-3 pb-2 text-[10px] font-black uppercase tracking-[0.18em] text-(--prism-amber)">
              Resources
            </p>
            {[
              { label: "Templates", Icon: LayoutTemplate },
              { label: "Favorites", Icon: Heart },
              { label: "Archive", Icon: Trash2 },
            ].map(({ label, Icon }) => (
              <button
                key={label}
                className="flex h-9 items-center gap-3 rounded-lg px-3 text-sm font-semibold text-sidebar-foreground/60 transition hover:bg-white/8 hover:text-white"
              >
                <Icon className="size-4" />
                {label}
              </button>
            ))}
          </nav>

          <Separator className="my-5 bg-white/10" />

          {/* Event switcher */}
          <div className="min-h-0 flex-1">
            <p className="px-1 pb-2 text-xs font-black uppercase tracking-[0.16em] text-(--prism-amber)">
              Event spaces
            </p>
            {events.length === 0 ? (
              <p className="rounded-xl bg-white/8 p-3 text-sm leading-6 text-sidebar-foreground/60">
                No conforme-approved events are open yet.
              </p>
            ) : (
              <div className="flex flex-col gap-2 pr-1">
                {events.map((ev) => (
                  <button
                    key={ev.id}
                    onClick={() => { setSelectedEventId(ev.id); setTab("overview"); }}
                    className={`w-full rounded-xl border p-3 text-left transition ${
                      ev.id === selectedEvent?.id
                        ? "border-(--prism-amber)/40 bg-card text-foreground"
                        : "border-white/10 bg-white/5 text-sidebar-foreground/70 hover:border-(--prism-amber)/25 hover:bg-white/8"
                    }`}
                  >
                    <p className="truncate text-sm font-black">{ev.eventName}</p>
                    <p className="mt-0.5 text-xs">{ev.eventDate}</p>
                  </button>
                ))}
              </div>
            )}
          </div>

          <Button
            variant="outline"
            className="mt-5 h-10 border-white/15 bg-transparent text-sidebar-foreground hover:bg-white/10"
            onClick={() => {
              window.localStorage.removeItem(MOCK_AUTH_SESSION_KEY);
              router.replace("/sign-in");
            }}
          >
            Sign out
          </Button>
        </aside>

        {/* Main content */}
        <section className="min-w-0 px-4 py-5 sm:px-6 lg:h-screen lg:overflow-y-auto lg:px-8">

          {/* Topbar */}
          <header className="sticky top-0 z-30 mb-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card/92 px-4 py-3 shadow-sm backdrop-blur">
            <div className="flex items-center gap-3">
              <Breadcrumb>
                <BreadcrumbList>
                  <BreadcrumbItem>
                    <BreadcrumbLink href="/">Client</BreadcrumbLink>
                  </BreadcrumbItem>
                  {selectedEvent && (
                    <>
                      <BreadcrumbSeparator />
                      <BreadcrumbItem>
                        <BreadcrumbPage>{selectedEvent.eventName}</BreadcrumbPage>
                      </BreadcrumbItem>
                    </>
                  )}
                </BreadcrumbList>
              </Breadcrumb>
            </div>
            <div className="flex items-center gap-2">
              <Input
                className="h-9 w-52 rounded-lg border-border text-sm"
                placeholder="Search events…"
              />
              <Badge
                variant="outline"
                className="hidden h-9 rounded-lg border-(--prism-amber)/35 bg-accent px-3 text-(--prism-amber) sm:inline-flex"
              >
                Client session
              </Badge>
              <Avatar className="size-9 rounded-lg">
                <AvatarFallback className="rounded-lg bg-(--prism-ink) text-xs font-black text-sidebar-foreground">
                  {session.name.slice(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
            </div>
          </header>

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
                        Quick access to your event workspace — briefing, billing, documents, and layout review.
                      </p>
                    </div>
                    <StatusBadge status={selectedEvent.clientPortalStatus} />
                  </div>

                  {/* Quick action cards */}
                  <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
                    {[
                      { label: "Briefing", detail: "Review venue and service notes", icon: FileCheck2, nextTab: "briefing" as DetailTab, color: "bg-secondary text-foreground" },
                      { label: "Floorplan", detail: "Submit preferences and review layout", icon: MapPinned, nextTab: "floorplan" as DetailTab, color: "bg-(--prism-amber-soft) text-(--prism-amber)" },
                      { label: "Documents", detail: "Conforme files and approvals", icon: FileText, nextTab: "documents" as DetailTab, color: "bg-secondary text-primary" },
                      { label: "Billing", detail: "Milestones and statement status", icon: ReceiptText, nextTab: "billing" as DetailTab, color: "bg-(--prism-signal-soft) text-(--prism-danger)" },
                      { label: "Activity", detail: "Event changes and PMCM actions", icon: Activity, nextTab: "activity" as DetailTab, color: "bg-muted text-muted-foreground" },
                    ].map((action) => (
                      <button
                        key={action.label}
                        onClick={() => setTab(action.nextTab)}
                        className="group rounded-xl border border-border bg-card p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-md"
                      >
                        <span className={`grid size-9 place-items-center rounded-lg ${action.color}`}>
                          <action.icon className="size-4" />
                        </span>
                        <p className="mt-3.5 text-sm font-black text-foreground">{action.label}</p>
                        <p className="mt-0.5 text-xs leading-5 text-muted-foreground">{action.detail}</p>
                      </button>
                    ))}
                  </div>
                </section>

                <RolePageHeader
                  eyebrow="Confirmed client portal"
                  title="Your event is open because the signed conforme is on file."
                  description="Use this space for briefing details, document submissions, billing visibility, and read-only review of PMCM's official floorplan. Layout edits stay with PMCM after review starts."
                  meta={[<StatusBadge key="portal-status" status={selectedEvent.clientPortalStatus} />]}
                />

                {/* Event cards */}
                <section>
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <h3 className="text-sm font-black text-foreground">Your events</h3>
                    <Badge variant="outline" className="rounded-full border-(--prism-amber)/35 bg-accent text-(--prism-amber) text-xs">
                      {events.length} active
                    </Badge>
                  </div>
                  <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                    {events.slice(0, 4).map((ev) => {
                      const draftsForEvent = state.floorPlanDrafts.filter((d) => d.eventId === ev.id);
                      const activeForEvent = draftsForEvent.find((d) => d.isActive) ?? draftsForEvent[0];
                      return (
                        <button
                          key={ev.id}
                          onClick={() => { setSelectedEventId(ev.id); setTab("overview"); }}
                          className={`overflow-hidden rounded-xl border bg-card text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${
                            ev.id === selectedEvent.id ? "border-primary/40" : "border-border hover:border-primary/25"
                          }`}
                        >
                          <div className="relative aspect-16/7 bg-muted">
                            <div className="absolute inset-0 bg-[linear-gradient(#EAD5CE_1px,transparent_1px),linear-gradient(90deg,#EAD5CE_1px,transparent_1px)] bg-size-[22px_22px]" />
                            <div className="absolute left-[12%] top-[20%] h-[46%] w-[30%] rounded-sm border border-primary/20 bg-white/70" />
                            <div className="absolute left-[52%] top-[18%] h-[20%] w-[34%] rounded-sm border border-primary/20 bg-white/80" />
                          </div>
                          <div className="p-3.5">
                            <p className="text-[10px] font-black uppercase tracking-[0.15em] text-(--prism-amber)">{ev.clientName}</p>
                            <p className="mt-1 truncate text-sm font-black text-foreground">{ev.eventName}</p>
                            <div className="mt-3 flex items-center justify-between gap-2">
                              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                                <CalendarDays className="size-3" />
                                {ev.eventDate}
                              </span>
                              <StatusBadge status={activeForEvent?.status ?? ev.status} />
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </section>

                {/* Metric tiles */}
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  <PrismMetricTile label="Portal status" value={selectedEvent.clientPortalStatus.replace("_", " ")} icon={BadgeCheck} />
                  <PrismMetricTile
                    label="Floorplan"
                    value={officialDraft ? officialDraft.status.replace("_", " ") : preferenceDrafts.length ? "Preference sent" : "Pending"}
                    icon={MapPinned}
                  />
                  <PrismMetricTile label="Billing" value={billing ? billing.status.replace("_", " ") : "Pending"} icon={ReceiptText} />
                  <PrismMetricTile label="Activity items" value={audit.length} icon={Activity} />
                </div>

                {/* Tab strip */}
                <div className="flex gap-1 overflow-x-auto rounded-xl border border-border bg-card p-1.5 shadow-sm">
                  {DETAIL_TABS.map(({ id, label, icon: Icon }) => (
                    <button
                      key={id}
                      onClick={() => setTab(id)}
                      className={`flex h-9 shrink-0 items-center gap-2 rounded-lg px-3.5 text-sm font-semibold transition ${
                        tab === id
                          ? "bg-(--prism-ink) text-white shadow-sm"
                          : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                      }`}
                    >
                      <Icon className="size-3.5" />
                      {label}
                    </button>
                  ))}
                </div>

                {/* Tab content */}
                {tab === "overview" && (
                  <ClientDefenseWorkspace
                    conforme={clientConforme}
                    briefing={{
                      eventName: selectedEvent.eventName,
                      eventDate: selectedEvent.eventDate,
                      venue: briefing?.venue ?? "Venue to be confirmed",
                      guestCount: briefing?.guestCount ? `${briefing.guestCount} guests` : "Guest count pending",
                      packageLabel: briefing?.budgetRange ?? "PMCM planning package",
                      notes: briefing?.notes ?? "PMCM will keep this workspace updated as planning decisions are approved.",
                    }}
                    floorplan={{
                      status: officialFloorplanStatus,
                      updatedAt: officialDraft?.updatedAt,
                      summary: officialDraft
                        ? `${officialDraft.name} is available as the PMCM official client copy. Client access is read-only.`
                        : "No official client-view floorplan has been published yet.",
                      onOpen: officialDraft ? () => openFloorplanEditor(officialDraft, true) : undefined,
                    }}
                    billing={billingMilestones}
                    documents={clientDocuments}
                    activity={clientActivityItems}
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
                        <h3 className="text-sm font-bold text-foreground">Draft event floorplan</h3>
                      </header>
                      <div className="p-5 space-y-5">
                        {/* Canvas presets */}
                        <div className="rounded-xl border border-border bg-secondary/50 p-4">
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div>
                              <p className="text-sm font-bold text-foreground">Canvas editor</p>
                              <p className="mt-0.5 text-xs leading-5 text-muted-foreground">
                                Pick a preset to open the canvas, arrange the room, then submit for PMCM to use.
                              </p>
                            </div>
                            {preferenceDrafts[0] && (
                              <Button
                                size="sm"
                                onClick={() => openFloorplanEditor(preferenceDrafts[0])}
                                className="rounded-lg font-bold"
                              >
                                Open latest draft
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
                          <FieldGroup label="Draft title">
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
                          <Button disabled={busy === "layout-preference"} className="gap-2 rounded-lg font-bold" type="submit">
                            <Send className="size-4" /> Submit floorplan draft
                          </Button>
                        </form>

                        {/* Existing drafts */}
                        {preferenceDrafts.length > 0 && (
                          <div className="space-y-2 border-t border-border pt-4">
                            <p className="text-xs font-bold text-muted-foreground uppercase tracking-wide">Your drafts</p>
                            {preferenceDrafts.slice(0, 4).map((draft) => (
                              <div key={draft.id} className="flex items-center justify-between gap-3 rounded-lg border border-border bg-background p-3 text-sm">
                                <div className="min-w-0">
                                  <p className="truncate font-semibold text-foreground">{draft.name}</p>
                                  <StatusBadge status={draft.status} className="mt-1.5" />
                                </div>
                                <Button variant="outline" size="sm" className="shrink-0 rounded-lg" onClick={() => openFloorplanEditor(draft)}>
                                  Open editor
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
                                <p className="mt-0.5 text-xs text-muted-foreground">Read-only PMCM version for approval or revision comments.</p>
                              </div>
                              <StatusBadge status={officialDraft.status} />
                            </div>
                            <Button
                              variant="outline"
                              className="w-full rounded-lg font-bold"
                              onClick={() => openFloorplanEditor(officialDraft, true)}
                            >
                              Open read-only editor
                            </Button>
                            <LayoutPreview project={officialProject} />
                          </div>
                        ) : (
                          <EmptyState
                            icon={LockKeyhole}
                            title="No official layout yet"
                            description="PMCM will submit an official layout here after reviewing your preference."
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
                description="The client portal opens after PMCM accepts the inquiry and the signed conforme is uploaded."
                className="mt-8"
              />
            )}
          </div>
        </section>
      </div>
    </main>
  );
}

function SidebarNavButton({
  icon: Icon,
  label,
  active,
  onClick,
  badge,
  small,
}: {
  icon: LucideIcon;
  label: string;
  active?: boolean;
  onClick?: () => void;
  badge?: number;
  small?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center justify-between rounded-lg px-3 text-left transition ${
        small ? "h-8 text-sm" : "h-10 text-sm font-semibold"
      } ${
        active
          ? "bg-white/12 text-white"
          : "text-sidebar-foreground/70 hover:bg-white/8 hover:text-white"
      }`}
    >
      <span className="flex items-center gap-3">
        <Icon className="size-4 shrink-0" />
        {label}
      </span>
      {badge !== undefined && badge > 0 && (
        <span className="grid min-w-5 place-items-center rounded-full bg-white/12 px-1.5 text-[11px] text-sidebar-foreground">
          {badge}
        </span>
      )}
    </button>
  );
}
