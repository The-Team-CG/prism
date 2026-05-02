"use client";

import dynamic from "next/dynamic";
import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowRight,
  BadgeCheck,
  CalendarClock,
  ClipboardList,
  Clock3,
  Filter,
  FileCheck2,
  KeyRound,
  LayoutGrid,
  ListFilter,
  LockKeyhole,
  MapPinned,
  MessageSquareText,
  Radio,
  RotateCcw,
  Search,
  ShieldCheck,
  Star,
  Tags,
  Truck,
  UserCheck,
  UserRound,
  UsersRound,
  type LucideIcon,
} from "lucide-react";
import {
  mvpApi,
  type DemoRole,
  type MvpAuditLog,
  type MvpApprovalRequest,
  type MvpCoordinator,
  type MvpCoordinatorAssignment,
  type MvpCoordinatorRoleRequirement,
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
  type MvpUser,
} from "@/lib/mvp-api";
import { PrismDashboardShell } from "@prism/ui";
import { Alert, AlertDescription } from "@/app/components/ui/alert";
import { Avatar, AvatarFallback } from "@/app/components/ui/avatar";
import { Badge } from "@/app/components/ui/badge";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/app/components/ui/breadcrumb";
import { Button } from "@/app/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/app/components/ui/card";
import { Input } from "@/app/components/ui/input";
import { Separator } from "@/app/components/ui/separator";
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
} from "./components/pmcm";
import { PRESETS, type Preset } from "./components/editor/presets";
import type { Project } from "./components/editor/types";

const EditorShell = dynamic(
  () => import("./components/editor/EditorShell").then((mod) => mod.EditorShell),
  {
    ssr: false,
    loading: () => (
      <div className="grid size-full place-items-center bg-background text-sm text-muted-foreground">
        Loading PMCM editor...
      </div>
    ),
  },
);

type EventSession = MvpUser & { signedInAt: string };
type Screen =
  | { name: "portal" }
  | { name: "editor"; event: MvpEvent; draft: MvpFloorPlanDraft; project: Project };
type DetailTab = "overview" | "floorplans" | "briefing" | "suppliers" | "coordinators" | "live-ops" | "billing" | "closure" | "activity";

const EVENT_SESSION_KEY = "prism:event-command-session";

const money = new Intl.NumberFormat("en-PH", {
  style: "currency",
  currency: "PHP",
  maximumFractionDigits: 0,
});

function cx(...classes: Array<string | false | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function label(value: string) {
  return value.replaceAll("_", " ");
}

function dateKey(value?: string | null) {
  return value ? value.slice(0, 10) : "";
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

function SupplierTierBadge({ tier }: { tier: string }) {
  return (
    <span className={cx("inline-flex rounded-full border px-2.5 py-1 text-xs font-black", tierTone(tier))}>
      {tierLabel(tier)}
    </span>
  );
}

function RatingStars({ rating }: { rating: number | null }) {
  if (rating === null) return <span className="text-xs font-semibold text-muted-foreground">Unrated</span>;
  const rounded = Math.round(rating);

  return (
    <span className="inline-flex items-center gap-1" aria-label={`${rating.toFixed(1)} out of 5`}>
      {Array.from({ length: 5 }, (_, index) => (
        <Star
          key={index}
          className={cx(
            "size-3.5",
            index < rounded ? "fill-(--prism-amber) text-(--prism-amber)" : "text-border",
          )}
        />
      ))}
      <span className="ml-1 text-xs font-black text-foreground">{rating.toFixed(1)}</span>
    </span>
  );
}

function readSession() {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(EVENT_SESSION_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as EventSession;
  } catch {
    window.localStorage.removeItem(EVENT_SESSION_KEY);
    return null;
  }
}

function saveSession(session: EventSession) {
  window.localStorage.setItem(EVENT_SESSION_KEY, JSON.stringify(session));
}

function Brand({ session, onSignOut }: { session?: EventSession | null; onSignOut?: () => void }) {
  return (
    <header className="border-b border-border bg-card/92 px-5 py-3.5 backdrop-blur sm:px-8">
      <div className="mx-auto flex max-w-[1480px] items-center justify-between gap-4">
        <a href="http://localhost:3001" className="flex items-center gap-3">
          <span className="flex h-10 w-28 items-center justify-center rounded-lg border border-border bg-white px-2.5 shadow-sm">
            <img src="/pmcm-logo.png" alt="PMCM logo" className="h-7 w-full object-contain" />
          </span>
          <span>
            <span className="block text-xs font-black uppercase tracking-[0.22em] text-foreground">P.R.I.S.M</span>
            <span className="block text-xs text-muted-foreground">Event Command</span>
          </span>
        </a>
        <div className="flex items-center gap-2">
          {session && (
            <span className="hidden rounded-lg border border-border bg-secondary px-3 py-2 text-sm font-bold text-foreground sm:inline-flex">
              {session.name} · {label(session.role)}
            </span>
          )}
          {onSignOut && (
            <Button variant="outline" size="sm" onClick={onSignOut} className="rounded-lg font-bold">
              Sign out
            </Button>
          )}
        </div>
      </div>
    </header>
  );
}

function Panel({ title, icon: Icon, children, aside }: { title: string; icon: LucideIcon; children: React.ReactNode; aside?: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-border bg-card shadow-sm">
      <header className="flex items-center justify-between gap-3 border-b border-border px-5 py-3.5">
        <div className="flex items-center gap-2.5">
          <span className="grid size-7 place-items-center rounded-md bg-secondary text-(--prism-amber)">
            <Icon className="size-3.5" />
          </span>
          <h3 className="text-sm font-bold text-foreground">{title}</h3>
        </div>
        {aside}
      </header>
      <div className="p-5">{children}</div>
    </section>
  );
}

function Metric({ label, value, icon: Icon }: { label: string; value: string | number; icon: LucideIcon }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-border bg-card p-4 shadow-sm">
      <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-secondary text-primary">
        <Icon className="size-4" />
      </span>
      <div className="min-w-0">
        <p className="text-xl font-black leading-none text-foreground">{value}</p>
        <p className="mt-1 truncate text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
      </div>
    </div>
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

function SignIn({ onSignedIn }: { onSignedIn: (session: EventSession) => void }) {
  const [email, setEmail] = useState("mys@pmcm.test");
  const [password, setPassword] = useState("prism-admin");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const session = await mvpApi.login({ email, password });
      if (session.role !== "pmcm-admin" && session.role !== "coordinator") {
        setError(session.role === "client" ? "Client accounts belong in prism-client at http://localhost:3001." : "Supplier accounts belong in prism-supplier at http://localhost:3002.");
        return;
      }
      saveSession(session);
      onSignedIn(session);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign in failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="min-h-screen bg-background text-foreground">
      <Brand />
      <section className="mx-auto grid min-h-[calc(100vh-73px)] max-w-[1180px] items-center gap-8 px-5 py-10 lg:grid-cols-[minmax(0,1fr)_420px]">
        <div>
          <Badge variant="outline" className="rounded-full border-(--prism-amber)/35 bg-accent px-3 py-1.5 text-xs font-black uppercase tracking-[0.14em] text-(--prism-amber)">
            <Radio className="size-4" /> Internal command only
          </Badge>
          <h1 className="mt-6 max-w-3xl text-5xl font-black leading-none text-foreground sm:text-6xl">
            PMCM event manager and coordinator command portal.
          </h1>
          <p className="mt-5 max-w-2xl text-base leading-7 text-muted-foreground">
            PMCM owns event creation, floorplan editing, supplier readiness, compliance, billing, and coordinator acknowledgments here. Clients use the separate client portal.
          </p>
        </div>
        <section className="rounded-xl border border-border bg-card shadow-[0_24px_80px_rgba(23,18,22,0.12)]">
          <form onSubmit={submit} className="p-6">
            <span className="grid size-11 place-items-center rounded-xl bg-secondary text-primary">
              <LockKeyhole className="size-5" />
            </span>
            <h2 className="mt-4 text-2xl font-black text-foreground">Event sign in</h2>
            <p className="mt-1 text-sm text-muted-foreground">Approved PMCM and coordinator accounts only.</p>
            <div className="mt-5 flex flex-col gap-3">
              <Input value={email} onChange={(ev) => setEmail(ev.target.value)} className="h-11" placeholder="Email" />
              <Input value={password} onChange={(ev) => setPassword(ev.target.value)} type="password" className="h-11" placeholder="Password" />
              {error && (
                <Alert variant="destructive" className="rounded-xl">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}
              <Button disabled={busy} className="h-11 w-full rounded-xl font-black">
                {busy ? "Signing in…" : "Sign in"} <ArrowRight className="size-4" />
              </Button>
            </div>
          </form>
          <div className="grid gap-1.5 border-t border-border px-6 py-4 text-xs text-muted-foreground">
            <p><span className="font-bold text-foreground">PMCM:</span> mys@pmcm.test / prism-admin</p>
            <p><span className="font-bold text-foreground">Coordinator:</span> marco@pmcm.test / prism-coordinator</p>
          </div>
        </section>
      </section>
    </main>
  );
}

function PmcmPortal({
  session,
  state,
  onRefresh,
  onOpenEditor,
}: {
  session: EventSession;
  state: MvpDemoState;
  onRefresh: () => Promise<void>;
  onOpenEditor: (event: MvpEvent, draft: MvpFloorPlanDraft, preset?: Preset) => Promise<void>;
}) {
  const [selectedEventId, setSelectedEventId] = useState<string | null>(state.events[0]?.id ?? null);
  const [section, setSection] = useState<"events" | "suppliers" | "audit">("events");
  const [tab, setTab] = useState<DetailTab>("overview");
  const [approvalRequests, setApprovalRequests] = useState<MvpApprovalRequest[]>([]);
  const [liveOps, setLiveOps] = useState<MvpLiveOps | null>(null);
  const [statusFeed, setStatusFeed] = useState<MvpEventDayStatusFeed | null>(null);
  const [defenseReadiness, setDefenseReadiness] = useState<MvpDefenseReadiness | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const events = state.events.filter((event) => !event.archived);
  const supplierCategories = state.supplierCategories ?? [];
  const suppliers = state.suppliers ?? [];
  const coordinators = state.coordinators ?? [];
  const coordinatorRoleRequirements = state.coordinatorRoleRequirements ?? [];
  const selectedEvent = events.find((event) => event.id === selectedEventId) ?? events[0];
  const unreviewedInquiries = state.inquiries.filter((inquiry) => inquiry.status === "new").length;
  const drafts = selectedEvent ? state.floorPlanDrafts.filter((draft) => draft.eventId === selectedEvent.id) : [];
  const quoteRequests = (state.supplierQuoteRequests ?? []).filter((item) => item.eventId === selectedEvent?.id);
  const quotes = (state.supplierQuotes ?? []).filter((item) => item.eventId === selectedEvent?.id);
  const complianceRules = state.complianceRules ?? [];
  const checks = state.complianceChecks.filter((item) => item.eventId === selectedEvent?.id);
  const assignments = state.coordinatorAssignments.filter((item) => item.eventId === selectedEvent?.id);
  const payments = (state.paymentMilestones ?? []).filter((item) => item.eventId === selectedEvent?.id);
  const billingSources = (state.billingSources ?? []).filter((item) => item.eventId === selectedEvent?.id);
  const billingStatements = (state.billingStatements ?? []).filter((item) => item.eventId === selectedEvent?.id);
  const eventInsights = (state.eventInsights ?? []).filter((item) => item.eventId === selectedEvent?.id);
  const briefing = state.briefings.find((item) => item.eventId === selectedEvent?.id);
  const selectedInquiry = state.inquiries.find((item) => item.id === selectedEvent?.inquiryId);
  const audit = state.auditLogs.filter((item) => item.eventId === selectedEvent?.id || !item.eventId).slice(0, 14);
  const activeDraft = drafts.find((draft) => draft.isActive);
  const pendingApprovals = approvalRequests.filter((request) => request.status === "pending");

  async function refreshApprovals() {
    setApprovalRequests(await mvpApi.approvalRequests());
  }

  useEffect(() => {
    refreshApprovals().catch((err) => setError(err instanceof Error ? err.message : "Unable to load approval requests"));
  }, []);

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
    Promise.all([mvpApi.liveOps(selectedEvent.id), mvpApi.eventDayStatusFeed(selectedEvent.id), mvpApi.defenseReadiness(selectedEvent.id)])
      .then(([nextLiveOps, nextStatusFeed, nextDefenseReadiness]) => {
        setLiveOps(nextLiveOps);
        setStatusFeed(nextStatusFeed);
        setDefenseReadiness(nextDefenseReadiness);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Unable to load event readiness"));
  }, [selectedEvent?.id]);

  async function run(labelText: string, action: () => Promise<unknown>) {
    setBusy(labelText);
    setError(null);
    try {
      await action();
      await onRefresh();
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

  async function runLiveOps(labelText: string, action: () => Promise<unknown>) {
    setBusy(labelText);
    setError(null);
    try {
      await action();
      await onRefresh();
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
    await onOpenEditor(selectedEvent, draft, preset);
  }

  async function acceptInquiry(inquiry: MvpInquiry) {
    await run("accept inquiry", () => mvpApi.acceptInquiry(inquiry.id));
  }

  async function pendInquiry(inquiry: MvpInquiry) {
    await run("pend inquiry", () => mvpApi.pendInquiry(inquiry.id));
  }

  async function declineInquiry(inquiry: MvpInquiry, reason: string) {
    await run("decline inquiry", () => mvpApi.declineInquiry(inquiry.id, reason));
  }

  async function uploadConformeForInquiry(inquiry: MvpInquiry) {
    await run("upload conforme", () => mvpApi.uploadConforme(inquiry.id));
  }

  async function sendConformeReminder(inquiry: MvpInquiry) {
    await run("conforme reminder", () => mvpApi.sendConformeReminder(inquiry.id));
  }

  async function toggleSupplierBni(supplier: MvpSupplier, nextValue: boolean) {
    await run("supplier BNI flag", () => mvpApi.updateSupplier(supplier.id, { bniMember: nextValue }));
  }

  async function createSupplier(input: {
    categoryId: string;
    name: string;
    contactName?: string;
    email?: string;
    phone?: string;
    tier?: "tier_1" | "tier_2" | "pending_first_event";
    serviceInclusions?: string;
    performanceNotes?: string;
  }) {
    await run("create supplier", () => mvpApi.createSupplier(input));
  }

  async function updateSupplierProfile(supplierId: string, input: {
    name?: string;
    contactName?: string;
    email?: string;
    phone?: string;
    serviceInclusions?: string;
    performanceNotes?: string;
  }) {
    await run("update supplier", () => mvpApi.updateSupplier(supplierId, input));
  }

  async function changeSupplierTier(supplierId: string, tier: "tier_1" | "tier_2" | "pending_first_event", reason: string) {
    await run("supplier tier change", () => mvpApi.changeSupplierTier(supplierId, { tier, reason }));
  }

  async function addSupplierReview(supplierId: string, input: { rating: number; notes: string; reviewedBy?: string }) {
    await run("supplier private review", () => mvpApi.addSupplierReview(supplierId, { ...input, eventId: selectedEvent?.id }));
  }

  async function addSupplierCertification(supplierId: string, input: {
    fileName: string;
    documentType: string;
    issuer?: string;
    expiresAt?: string;
    status?: "submitted" | "verified" | "expired" | "rejected";
    notes?: string;
  }) {
    await run("supplier certification", () => mvpApi.addSupplierCertification(supplierId, input));
  }

  async function requestSupplierQuotes(input: {
    categoryId: string;
    supplierIds: string[];
    confidentialBid: boolean;
    deadline?: string;
  }) {
    if (!selectedEvent) return;
    await run("request supplier quotes", () => mvpApi.requestSupplierQuotes(selectedEvent.id, input));
  }

  async function selectSupplierQuote(quoteId: string) {
    if (!selectedEvent) return;
    await run("select supplier quote", () => mvpApi.selectSupplierQuote(selectedEvent.id, quoteId));
  }

  async function recordPayment(
    milestoneId: string,
    input: {
      amountReceived: number;
      paymentDate: string;
      paymentMethod: "Bank Transfer" | "GCash" | "Cheque";
      referenceNumber?: string;
    },
  ) {
    if (!selectedEvent) return;
    await run("record payment", () => mvpApi.recordPayment(selectedEvent.id, milestoneId, input));
  }

  async function sendBillingStatement(billingId: string) {
    if (!selectedEvent) return;
    await run("send billing statement", () => mvpApi.sendBillingStatement(selectedEvent.id, billingId));
  }

  async function createComplianceRule(input: {
    title: string;
    conditionKey: string;
    phase: string;
    severity: string;
    layer: string;
    note: string;
  }) {
    await run("create compliance rule", () => mvpApi.createComplianceRule(input));
  }

  async function runComplianceChecks(phase: string) {
    if (!selectedEvent) return;
    await run("run compliance", () => mvpApi.runCompliance(selectedEvent.id, phase));
  }

  async function resolveComplianceCheck(checkId: string) {
    if (!selectedEvent) return;
    await run("resolve compliance", () =>
      mvpApi.resolveCompliance(selectedEvent.id, checkId, {
        action: "resolve",
        note: "Resolved during PMCM review.",
        actorName: "Ms. Mys",
      }),
    );
  }

  async function overrideComplianceCheck(checkId: string, reason: string) {
    if (!selectedEvent) return;
    await run("override compliance", () =>
      mvpApi.resolveCompliance(selectedEvent.id, checkId, {
        action: "override",
        overrideReason: reason,
        actorName: "Ms. Mys",
      }),
    );
  }

  async function createBillingSource(input: {
    sourceLabel: string;
    lineItems: Array<{ label: string; amount: number }>;
    paymentSchedule: Array<{ label: string; percentage: number }>;
  }) {
    if (!selectedEvent) return;
    await run("create billing source", () => mvpApi.createBillingSource(selectedEvent.id, input));
  }

  async function approveBillingSource(sourceId: string) {
    if (!selectedEvent) return;
    await run("approve billing source", () => mvpApi.approveBillingSource(selectedEvent.id, sourceId, "Approved by PMCM for billing generation."));
  }

  async function generateBillingStatement(sourceId: string) {
    if (!selectedEvent) return;
    await run("generate billing statement", () => mvpApi.generateBillingStatement(selectedEvent.id, sourceId));
  }

  async function loadCloseGates() {
    if (!selectedEvent) throw new Error("No event selected");
    return mvpApi.closeGates(selectedEvent.id);
  }

  async function archiveSelectedEvent(overrideReason?: string) {
    if (!selectedEvent) return;
    await run("archive event", () => mvpApi.archiveEvent(selectedEvent.id, overrideReason));
  }

  async function loadEventInsights() {
    if (!selectedEvent) throw new Error("No event selected");
    return mvpApi.eventInsights(selectedEvent.id);
  }

  async function generateEventInsights() {
    if (!selectedEvent) return;
    await run("generate insights", () => mvpApi.generateEventInsights(selectedEvent.id));
  }

  async function assignCoordinator(coordinator: MvpCoordinator, role: string, overrideConflict = false) {
    if (!selectedEvent) return;
    await run("coordinator assignment", () =>
      mvpApi.assignCoordinator(selectedEvent.id, {
        coordinatorId: coordinator.id,
        role,
        overrideConflict,
      }),
    );
  }

  async function createEventDayTask(input: {
    title: string;
    assignedRole?: string;
    ownerName?: string;
    priority?: string;
    notes?: string;
    slaDueAt?: string;
  }) {
    if (!selectedEvent) return;
    await runLiveOps("create event-day task", () => mvpApi.createEventDayTask(selectedEvent.id, input));
  }

  async function updateEventDayTask(taskId: string, input: { status?: "open" | "in_progress" | "done" | "blocked"; notes?: string }) {
    if (!selectedEvent) return;
    await runLiveOps("update event-day task", () => mvpApi.updateEventDayTask(selectedEvent.id, taskId, input));
  }

  async function escalateEventDayTask(
    taskId: string,
    input: { escalationLevel: "role_lead" | "pmcm" | "critical"; notes: string; ownerRole?: string; ownerName?: string },
  ) {
    if (!selectedEvent) return;
    await runLiveOps("escalate event-day task", () => mvpApi.escalateEventDayTask(selectedEvent.id, taskId, input));
  }

  async function createUrgentIssue(input: {
    title: string;
    severity?: "low" | "medium" | "high" | "critical";
    ownerRole?: string;
    description?: string;
    slaDueAt?: string;
  }) {
    if (!selectedEvent) return;
    await runLiveOps("create urgent issue", () => mvpApi.createUrgentIssue(selectedEvent.id, input));
  }

  async function updateUrgentIssue(issueId: string, input: { status?: "open" | "assigned" | "resolved" | "cancelled"; resolution?: string }) {
    if (!selectedEvent) return;
    await runLiveOps("update urgent issue", () => mvpApi.updateUrgentIssue(selectedEvent.id, issueId, input));
  }

  async function escalateUrgentIssue(
    issueId: string,
    input: { escalationLevel: "role_lead" | "pmcm" | "critical"; notes: string; ownerRole?: string; ownerName?: string },
  ) {
    if (!selectedEvent) return;
    await runLiveOps("escalate urgent issue", () => mvpApi.escalateUrgentIssue(selectedEvent.id, issueId, input));
  }

  async function updateCoordinatorAttendance(
    assignmentId: string,
    input: { status: "present" | "late" | "absent" | "replaced"; notes?: string },
  ) {
    if (!selectedEvent) return;
    await runLiveOps("update coordinator attendance", () =>
      mvpApi.updateCoordinatorAttendance(selectedEvent.id, assignmentId, { ...input, markedBy: session.name }),
    );
  }

  async function replaceCoordinator(
    assignmentId: string,
    input: { replacementCoordinatorId: string; role: string; reason: string },
  ) {
    if (!selectedEvent) return;
    await runLiveOps("replace coordinator", () => mvpApi.replaceCoordinator(selectedEvent.id, assignmentId, input));
  }

  async function verifySupplierStatus(
    requestId: string,
    input: { verificationStatus: "self_reported" | "verified" | "disputed"; notes?: string },
  ) {
    if (!selectedEvent) return;
    await runLiveOps("verify supplier setup", () =>
      mvpApi.verifySupplierStatus(selectedEvent.id, requestId, { ...input, verifiedBy: session.name }),
    );
  }

  function openSupplierEvent(eventId: string) {
    setSelectedEventId(eventId);
    setSection("events");
    setTab("overview");
  }

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
    onSelect: () => setTab(action.targetTab as DetailTab),
  })) ?? [
    {
      id: "review-inquiries",
      label: "Review inquiries",
      description: "Accept a qualified inquiry and unlock the conforme path.",
      onSelect: () => setSection("events"),
    },
    {
      id: "supplier-desk",
      label: "Open supplier desk",
      description: "Review quote coverage and supplier readiness without leaving PMCM command.",
      onSelect: () => setSection("suppliers"),
    },
  ];

  const eventRail = (
    <section className="rounded-lg border border-border bg-card p-3 shadow-sm">
      <div className="flex items-center justify-between gap-3 px-2 pb-2">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.16em] text-primary">Event queue</p>
          <p className="mt-1 text-xs text-muted-foreground">{events.length} confirmed workspace(s)</p>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={() => run("reset", mvpApi.reset)}
          title="Reset demo data"
          className="size-8 rounded-md"
        >
          <RotateCcw aria-hidden="true" />
          <span className="sr-only">Reset demo data</span>
        </Button>
      </div>
      <div className="flex flex-col gap-1.5">
        {events.map((ev) => (
          <button
            key={ev.id}
            type="button"
            onClick={() => { setSection("events"); setSelectedEventId(ev.id); setTab("overview"); }}
            className={cx(
              "w-full rounded-md border p-3 text-left transition",
              ev.id === selectedEvent?.id
                ? "border-primary/40 bg-secondary"
                : "border-border bg-background hover:border-primary/25",
            )}
          >
            <p className="truncate text-sm font-bold text-foreground">{ev.eventName}</p>
            <p className="mt-0.5 truncate text-xs text-muted-foreground">{ev.clientName}</p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              <StatusBadge status={ev.clientPortalStatus} />
              <StatusBadge status={ev.floorPlanStatus} />
            </div>
          </button>
        ))}
      </div>
    </section>
  );

  return (
    <PrismDashboardShell
      productLabel="P.R.I.S.M"
      roleLabel="PMCM Event Command"
      eyebrow="Operations cockpit"
      title={selectedEvent?.eventName ?? "Event Manager"}
      description="Conforme gates, floorplans, suppliers, billing, compliance, live operations, and closure in one command surface."
      activeItemId={section}
      navItems={shellNavItems}
      onNavSelect={(id) => setSection(id as "events" | "suppliers" | "audit")}
      commandActions={commandActions}
      rightRail={section === "events" ? eventRail : undefined}
    >
      <section className="min-w-0 space-y-4">
        {error && (
          <Alert variant="destructive" className="rounded-xl">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {section === "suppliers" ? (
          <SupplierDirectory
            categories={supplierCategories}
            suppliers={suppliers}
            onToggleBni={toggleSupplierBni}
            onCreateSupplier={createSupplier}
            onUpdateSupplier={updateSupplierProfile}
            onChangeTier={changeSupplierTier}
            onAddReview={addSupplierReview}
            onAddCertification={addSupplierCertification}
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
            <div className="grid gap-3 xl:grid-cols-2">
              {pendingApprovals.map((request) => (
                <div key={request.id} className="rounded-xl border border-border bg-secondary/40 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-bold text-foreground">{request.name}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">{request.email}</p>
                      <p className="mt-1.5 text-[10px] font-black uppercase tracking-[0.14em] text-(--prism-amber)">
                        {label(request.role)} · {request.organization}
                      </p>
                    </div>
                    <StatusBadge status={request.status} />
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      disabled={!!busy}
                      onClick={() => run("approve account", () => mvpApi.approveApprovalRequest(request.id))}
                      className="rounded-lg font-bold"
                    >
                      Approve
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={!!busy}
                      onClick={() => run("decline account", () => mvpApi.declineApprovalRequest(request.id))}
                      className="rounded-lg font-bold"
                    >
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
          onAccept={acceptInquiry}
          onPend={pendInquiry}
          onDecline={declineInquiry}
          busy={Boolean(busy)}
        />

        <ClientOnboardingTracker
          inquiries={state.inquiries}
          onUploadConforme={uploadConformeForInquiry}
          onSendReminder={sendConformeReminder}
          busy={Boolean(busy)}
        />

        {selectedEvent ? (
          <>
            {/* Event header */}
            <section className="rounded-xl border border-border bg-card px-5 py-4 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.18em] text-(--prism-amber)">Confirmed event</p>
                  <h2 className="mt-1.5 text-2xl font-black text-foreground">{selectedEvent.eventName}</h2>
                  <p className="mt-1 text-sm text-muted-foreground">{selectedEvent.clientName} · {selectedEvent.eventDate}</p>
                </div>
                <div className="flex flex-wrap justify-end gap-2">
                  <StatusBadge status={selectedEvent.floorPlanStatus} />
                  {defenseReadiness && <StatusBadge status={defenseReadiness.overallStatus} label={`Defense ${label(defenseReadiness.overallStatus)}`} />}
                </div>
              </div>
            </section>

            {defenseReadiness && (
              <section className="rounded-xl border border-primary/15 bg-card px-5 py-4 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="max-w-2xl">
                    <p className="text-[10px] font-black uppercase tracking-[0.18em] text-(--prism-amber)">Defense Control</p>
                    <h3 className="mt-1 text-lg font-black text-foreground">{defenseReadiness.score}% lifecycle ready</h3>
                    <p className="mt-1 text-sm leading-6 text-muted-foreground">
                      Current stage: {label(defenseReadiness.lifecycleStage)}. Live AI, QR scanning, production notifications, and external integrations stay deferred for this defense pass.
                    </p>
                  </div>
                  <div className="rounded-lg border border-border bg-secondary/60 px-4 py-3 text-right">
                    <p className="text-[10px] font-black uppercase tracking-wide text-muted-foreground">Guest count</p>
                    <p className="mt-1 text-2xl font-black text-foreground">{defenseReadiness.summary.guestAttendanceCount}</p>
                    <p className="text-xs text-muted-foreground">{defenseReadiness.summary.pendingFeedbackModeration} feedback item(s) pending</p>
                  </div>
                </div>
                <div className="mt-4 grid gap-2 md:grid-cols-2 xl:grid-cols-4">
                  {defenseReadiness.nextActions.map((action) => (
                    <button
                      key={action.key}
                      type="button"
                      onClick={() => setTab(action.targetTab as DetailTab)}
                      className="rounded-lg border border-border bg-secondary/45 p-3 text-left transition hover:border-primary/30 hover:bg-secondary"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-black text-foreground">{action.label}</p>
                        <StatusBadge status={action.status} />
                      </div>
                      <p className="mt-1 text-xs leading-5 text-muted-foreground">{action.detail}</p>
                    </button>
                  ))}
                </div>
              </section>
            )}

            {/* Metrics */}
            <div className="grid gap-3 md:grid-cols-4">
              <Metric label="Drafts" value={drafts.length} icon={LayoutGrid} />
              <Metric label="Active layout" value={activeDraft ? "1" : "0"} icon={BadgeCheck} />
              <Metric label="Supplier quotes" value={quotes.length} icon={Truck} />
              <Metric label="Open checks" value={checks.filter((item) => item.status === "open").length} icon={ShieldCheck} />
            </div>

            {/* Tab strip */}
            <div className="flex gap-1 overflow-x-auto rounded-xl border border-border bg-card p-1.5 shadow-sm">
              {(["overview", "floorplans", "briefing", "suppliers", "coordinators", "live-ops", "billing", "closure", "activity"] as DetailTab[]).map((item) => (
                <button
                  key={item}
                  onClick={() => setTab(item)}
                  className={cx(
                    "flex h-9 shrink-0 items-center rounded-lg px-3.5 text-sm font-semibold capitalize transition",
                    tab === item
                      ? "bg-(--prism-ink) text-white shadow-sm"
                      : "text-muted-foreground hover:bg-secondary hover:text-foreground",
                  )}
                >
                  {item.replace("-", " ")}
                </button>
              ))}
            </div>

            {tab === "overview" && (
              <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
                <Panel title="Event record" icon={ClipboardList}>
                  <div className="divide-y divide-border text-sm">
                    {[
                      { label: "Readiness", value: selectedEvent.readiness ?? "—" },
                      { label: "Client portal", value: <StatusBadge status={selectedEvent.clientPortalStatus} /> },
                      { label: "Floor plan", value: <StatusBadge status={selectedEvent.floorPlanStatus} /> },
                      { label: "Guest code", value: selectedEvent.guestAccessCode ?? "Generated after event" },
                    ].map(({ label: lbl, value }) => (
                      <div key={lbl} className="flex items-center justify-between gap-4 py-2.5 not-last:border-b not-last:border-border">
                        <span className="font-semibold text-muted-foreground">{lbl}</span>
                        <span className="text-right font-semibold text-foreground">{value}</span>
                      </div>
                    ))}
                  </div>
                </Panel>
                <Panel title="Next operator actions" icon={Radio}>
                  <div className="flex flex-col gap-2">
                    <Button size="sm" className="w-full justify-start rounded-lg font-bold" onClick={() => run("briefing", () => mvpApi.submitBriefing(selectedEvent.id))}>
                      Submit client briefing
                    </Button>
                    <Button size="sm" variant="outline" className="w-full justify-start rounded-lg font-bold" onClick={() => setTab("suppliers")}>
                      Open quote request builder
                    </Button>
                    <Button size="sm" variant="outline" className="w-full justify-start rounded-lg font-bold" onClick={() => run("compliance", () => mvpApi.runCompliance(selectedEvent.id, "planning"))}>
                      Run compliance
                    </Button>
                    <Button size="sm" variant="outline" className="w-full justify-start rounded-lg font-bold" onClick={() => setTab("coordinators")}>
                      Open coordinator desk
                    </Button>
                    <Button size="sm" variant="outline" className="w-full justify-start rounded-lg font-bold" onClick={() => setTab("live-ops")}>
                      Open live ops
                    </Button>
                  </div>
                </Panel>
              </div>
            )}

            {tab === "floorplans" && (
              <div className="space-y-4">
                <Panel title="Start PMCM draft" icon={MapPinned}>
                  <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                    {PRESETS.slice(0, 4).map((preset) => (
                      <button
                        key={preset.id}
                        onClick={() => run("create floorplan", () => createPreset(preset))}
                        className="rounded-xl border border-border bg-secondary/60 p-4 text-left transition hover:border-primary/35 hover:bg-secondary"
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
                    <div className="grid gap-3 xl:grid-cols-3">
                      {drafts.map((draft) => (
                        <div key={draft.id} className="rounded-xl border border-border bg-secondary/40 p-4">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="truncate text-sm font-bold text-foreground">{draft.name}</p>
                              <p className="mt-0.5 text-xs text-muted-foreground">{label(draft.sourceType)} · {draft.createdByRole ?? "pmcm-admin"}</p>
                            </div>
                            <StatusBadge status={draft.status} />
                          </div>
                          {draft.clientPreference && (
                            <div className="mt-3 rounded-lg border border-border bg-card p-3 text-xs leading-5 text-muted-foreground">
                              <p><span className="font-bold text-foreground">Seating:</span> {draft.clientPreference.seatingStyle}</p>
                              <p><span className="font-bold text-foreground">Stage:</span> {draft.clientPreference.stagePreference}</p>
                            </div>
                          )}
                          <div className="mt-4 flex flex-wrap gap-2">
                            <Button size="sm" variant="outline" className="rounded-lg font-bold" onClick={() => run("open draft", () => onOpenEditor(selectedEvent, draft))}>Open/Edit</Button>
                            {draft.status !== "in_review" && draft.status !== "approved" && (
                              <Button size="sm" className="rounded-lg font-bold" onClick={() => run("submit draft", () => mvpApi.submitFloorPlanDraft(selectedEvent.id, draft.id))}>Submit</Button>
                            )}
                            {draft.status !== "approved" && (
                              <Button size="sm" variant="outline" className="rounded-lg border-(--prism-success)/25 bg-(--prism-success)/8 font-bold text-(--prism-success) hover:bg-(--prism-success)/12" onClick={() => run("approve draft", () => mvpApi.approveFloorPlanDraft(selectedEvent.id, draft.id))}>Approve</Button>
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
                  onRequestQuotes={requestSupplierQuotes}
                  onSelectQuote={selectSupplierQuote}
                  busy={Boolean(busy)}
                />
              </Panel>
            )}

            {tab === "coordinators" && selectedEvent && (
              <CoordinatorAssignmentDesk
                event={selectedEvent}
                coordinators={coordinators}
                assignments={state.coordinatorAssignments}
                roleRequirements={coordinatorRoleRequirements}
                busy={Boolean(busy)}
                onAssign={assignCoordinator}
              />
            )}

            {tab === "live-ops" && selectedEvent && (
              <LiveOperationsWorkspace
                event={selectedEvent}
                liveOps={liveOps}
                statusFeed={statusFeed}
                coordinators={coordinators}
                busy={Boolean(busy)}
                onReload={loadLiveOps}
                onCreateTask={createEventDayTask}
                onUpdateTask={updateEventDayTask}
                onEscalateTask={escalateEventDayTask}
                onCreateIssue={createUrgentIssue}
                onUpdateIssue={updateUrgentIssue}
                onEscalateIssue={escalateUrgentIssue}
                onUpdateCoordinatorAttendance={updateCoordinatorAttendance}
                onReplaceCoordinator={replaceCoordinator}
                onVerifySupplierStatus={verifySupplierStatus}
              />
            )}

            {tab === "billing" && (
              <FinancialWorkspace
                event={selectedEvent}
                inquiry={selectedInquiry}
                billingStatements={billingStatements}
                payments={payments}
                busy={Boolean(busy)}
                onRecordPayment={recordPayment}
                onSendBilling={sendBillingStatement}
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
                onCreateRule={createComplianceRule}
                onRunCompliance={runComplianceChecks}
                onResolveCompliance={resolveComplianceCheck}
                onOverrideCompliance={overrideComplianceCheck}
                onCreateBillingSource={createBillingSource}
                onApproveBillingSource={approveBillingSource}
                onGenerateBillingStatement={generateBillingStatement}
                onLoadCloseGates={loadCloseGates}
                onArchive={archiveSelectedEvent}
                onLoadInsights={loadEventInsights}
                onGenerateInsights={generateEventInsights}
              />
            )}

            {tab === "activity" && (
              <Panel title="Activity and notifications" icon={MessageSquareText}>
                <div className="space-y-3">
                  {assignments.map((assignment: MvpCoordinatorAssignment) => (
                    <div key={assignment.id} className="rounded-md border border-border bg-muted p-3 text-sm">
                      <p className="font-black">{assignment.coordinatorName}</p>
                      <p className="mt-1 text-muted-foreground">{assignment.role} · {label(assignment.status)}</p>
                    </div>
                  ))}
                  {audit.map((item) => (
                    <div key={item.id} className="flex gap-3 rounded-md bg-background p-3 text-sm">
                      <Clock3 className="mt-0.5 size-4 text-(--prism-amber)" />
                      <div><p className="font-black">{item.action}</p><p className="text-muted-foreground">{item.actor}</p></div>
                    </div>
                  ))}
                </div>
              </Panel>
            )}
          </>
        ) : (
          <Panel title="No confirmed events" icon={AlertTriangle}>
            <p className="text-sm text-muted-foreground">Accept an inquiry and upload signed conforme to create the first PMCM event workspace.</p>
          </Panel>
        )}
          </>
        )}
      </section>
    </PrismDashboardShell>
  );
}

export default function EventCommandHome() {
  const [session, setSession] = useState<EventSession | null>(null);
  const [state, setState] = useState<MvpDemoState | null>(null);
  const [screen, setScreen] = useState<Screen>({ name: "portal" });
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    const next = await mvpApi.pmcmState();
    setState(next);
  }

  useEffect(() => {
    const current = readSession();
    if (!current) return;
    setSession(current);
    refresh().catch((err) => setError(err instanceof Error ? err.message : "Unable to load event portal"));
  }, []);

  useEffect(() => {
    if (!session || screen.name !== "portal") return;
    const intervalId = window.setInterval(() => {
      refresh().catch((err) => setError(err instanceof Error ? err.message : "Unable to refresh event portal"));
    }, 30_000);

    return () => window.clearInterval(intervalId);
  }, [session, screen.name]);

  async function openEditor(event: MvpEvent, draft: MvpFloorPlanDraft, preset?: Preset) {
    const fallback = buildProject(event, draft, preset);
    const project = preset ? fallback : await mvpApi.loadPlan(draft.floorPlanId, fallback);
    if (preset) await mvpApi.savePlan(project);
    setScreen({ name: "editor", event, draft, project });
  }

  if (!session) return <SignIn onSignedIn={(next) => { setSession(next); refresh().catch((err) => setError(err instanceof Error ? err.message : "Unable to load event portal")); }} />;

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
            await refresh();
            setScreen({ name: "portal" });
          }}
          onBack={() => setScreen({ name: "portal" })}
        />
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-background text-foreground">
      <Brand
        session={session}
        onSignOut={() => {
          window.localStorage.removeItem(EVENT_SESSION_KEY);
          setSession(null);
          setState(null);
        }}
      />
      <section className="mx-auto max-w-[1480px] px-5 py-6 sm:px-8">
        <Card className="sticky top-0 z-30 mb-5 gap-0 rounded-lg border-primary/12 bg-card/92 shadow-[0_12px_40px_rgba(23,18,22,0.06)] backdrop-blur">
          <CardContent className="p-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <Button variant="ghost" size="icon" className="hidden size-9 rounded-md sm:inline-flex">
                  <Radio className="size-4" />
                </Button>
                <Separator orientation="vertical" className="hidden h-4 bg-[#EAD5CE] sm:block" />
                <Breadcrumb className="hidden sm:block">
                  <BreadcrumbList>
                    <BreadcrumbItem>
                      <BreadcrumbLink href="/">Event</BreadcrumbLink>
                    </BreadcrumbItem>
                    <BreadcrumbSeparator />
                    <BreadcrumbItem>
                      <BreadcrumbPage>{session.role === "coordinator" ? "Coordinator Command" : "PMCM Manager"}</BreadcrumbPage>
                    </BreadcrumbItem>
                  </BreadcrumbList>
                </Breadcrumb>
              </div>
              <div className="flex items-center gap-3">
                <Badge variant="outline" className="rounded-full border-[#F06030]/30 bg-accent text-(--prism-amber)">
                  {label(session.role)}
                </Badge>
                <Avatar className="size-9 rounded-md">
                  <AvatarFallback className="rounded-md">{session.name.slice(0, 2).toUpperCase()}</AvatarFallback>
                </Avatar>
              </div>
            </div>
            <div className="mt-3 flex min-w-[18rem] flex-1 items-center gap-3">
              <Input className="h-10 bg-white" placeholder="Search events, approval requests, suppliers..." />
            </div>
          </CardContent>
        </Card>
        {error && (
          <Alert variant="destructive" className="mb-5 rounded-lg">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        {!state ? (
          <Card className="grid min-h-[420px] place-items-center rounded-lg border-primary/12 bg-card text-sm text-muted-foreground">
            Loading event command data...
          </Card>
        ) : session.role === "coordinator" ? (
          <CoordinatorView session={session} state={state} onRefresh={refresh} />
        ) : (
          <PmcmPortal session={session} state={state} onRefresh={refresh} onOpenEditor={openEditor} />
        )}
      </section>
    </main>
  );
}
