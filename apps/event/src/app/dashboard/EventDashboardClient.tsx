"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
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
  Send,
  Settings,
  ShieldCheck,
  Sparkles,
  Share2,
  Tags,
  Truck,
  Upload,
  UserCheck,
  UsersRound,
  type LucideIcon,
} from "lucide-react";
import {
  mvpApi,
  type MvpAuditLog,
  type MvpApprovalRequest,
  type MvpBillingStatement,
  type MvpBriefing,
  type MvpComplianceCheck,
  type MvpCoordinatorWorkspace,
  type MvpDefenseReadiness,
  type MvpDemoState,
  type MvpDocument,
  type MvpEvent,
  type MvpEventDayStatusFeed,
  type MvpFloorPlanDraft,
  type MvpLiveOps,
  type MvpNotificationLog,
  type MvpPostEventDocument,
  type MvpSupplierQuoteRequest,
} from "@/lib/mvp-api";
import { PrismDashboardShell } from "@prism/ui";
import { Alert, AlertDescription } from "@/app/components/ui/alert";
import { Button } from "@/app/components/ui/button";
import { StatusBadge } from "@/app/components/ui/status-badge";
import { EmptyState } from "@/app/components/ui/empty-state";
import { Badge } from "@/app/components/ui/badge";
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
  EventOverviewPanels,
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
type DashboardSection =
  | "events"
  | "inquiries"
  | "events-list"
  | "clients"
  | "calendar"
  | "tasks"
  | "team"
  | "suppliers"
  | "files"
  | "messages"
  | "finance"
  | "audit"
  | "settings";
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
  if (parts.length === 1) return { section: "events", tab: "overview" };
  if (parts[1] === "inquiries") return { section: "inquiries", tab: "overview" };
  if (parts[1] === "clients") return { section: "clients", tab: "overview" };
  if (parts[1] === "calendar") return { section: "calendar", tab: "overview" };
  if (parts[1] === "tasks") return { section: "tasks", tab: "overview" };
  if (parts[1] === "team") return { section: "team", tab: "coordinators" };
  if (parts[1] === "suppliers") return { section: "suppliers", tab: "overview" };
  if (parts[1] === "files") return { section: "files", tab: "floorplans" };
  if (parts[1] === "messages") return { section: "messages", tab: "activity" };
  if (parts[1] === "finance") return { section: "finance", tab: "billing" };
  if (parts[1] === "audit") return { section: "audit", tab: "overview" };
  if (parts[1] === "settings") return { section: "settings", tab: "overview" };
  if (parts[1] === "events" && parts[2]) {
    return {
      section: "events",
      eventId: decodeURIComponent(parts[2]),
      tab: EVENT_TAB_BY_ROUTE[parts[3] ?? "overview"] ?? "overview",
    };
  }
  if (parts[1] === "events") return { section: "events-list", tab: "overview" };
  return { section: "events", tab: "overview" };
}

function lbl(value: string) {
  return value.replaceAll("_", " ");
}

const phpMoney = new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP", maximumFractionDigits: 0 });

function shortDate(value?: string | null) {
  if (!value) return "No date";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
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

type TimedCache<T> = { value: T; loadedAt: number };
type EventCommandData = {
  liveOps: MvpLiveOps;
  statusFeed: MvpEventDayStatusFeed;
  defenseReadiness: MvpDefenseReadiness;
};

const EVENT_DASHBOARD_CACHE_MS = 30_000;
const EVENT_WORKSPACE_CACHE_MS = 20_000;

let pmcmStateCache: TimedCache<MvpDemoState> | null = null;
let pmcmStateRequest: Promise<MvpDemoState> | null = null;
let approvalRequestsCache: TimedCache<MvpApprovalRequest[]> | null = null;
let approvalRequestsRequest: Promise<MvpApprovalRequest[]> | null = null;
const coordinatorWorkspaceCache = new Map<string, TimedCache<MvpCoordinatorWorkspace>>();
const coordinatorWorkspaceRequests = new Map<string, Promise<MvpCoordinatorWorkspace>>();
const eventCommandDataCache = new Map<string, TimedCache<EventCommandData>>();
const eventCommandDataRequests = new Map<string, Promise<EventCommandData>>();

function isFresh(loadedAt: number, ttl = EVENT_DASHBOARD_CACHE_MS) {
  return Date.now() - loadedAt < ttl;
}

function sessionCacheKey(session: Pick<EventSession, "email" | "role">) {
  return `${session.role}:${session.email.trim().toLowerCase()}`;
}

function getCachedPmcmState() {
  return pmcmStateCache;
}

function loadPmcmState(force = false) {
  if (!force && pmcmStateCache && isFresh(pmcmStateCache.loadedAt)) {
    return Promise.resolve(pmcmStateCache.value);
  }
  if (!force && pmcmStateRequest) return pmcmStateRequest;

  pmcmStateRequest = mvpApi
    .pmcmState()
    .then((next) => {
      pmcmStateCache = { value: next, loadedAt: Date.now() };
      return next;
    })
    .finally(() => {
      pmcmStateRequest = null;
    });

  return pmcmStateRequest;
}

function getCachedApprovalRequests() {
  return approvalRequestsCache;
}

function loadApprovalRequests(force = false) {
  if (!force && approvalRequestsCache && isFresh(approvalRequestsCache.loadedAt)) {
    return Promise.resolve(approvalRequestsCache.value);
  }
  if (!force && approvalRequestsRequest) return approvalRequestsRequest;

  approvalRequestsRequest = mvpApi
    .approvalRequests()
    .then((next) => {
      approvalRequestsCache = { value: next, loadedAt: Date.now() };
      return next;
    })
    .finally(() => {
      approvalRequestsRequest = null;
    });

  return approvalRequestsRequest;
}

function getCachedCoordinatorWorkspace(session: EventSession) {
  return coordinatorWorkspaceCache.get(sessionCacheKey(session));
}

function loadCoordinatorWorkspace(session: EventSession, force = false) {
  const key = sessionCacheKey(session);
  const cached = coordinatorWorkspaceCache.get(key);
  if (!force && cached && isFresh(cached.loadedAt)) return Promise.resolve(cached.value);

  const existing = coordinatorWorkspaceRequests.get(key);
  if (!force && existing) return existing;

  const request = mvpApi
    .coordinatorWorkspace(session)
    .then((next) => {
      coordinatorWorkspaceCache.set(key, { value: next, loadedAt: Date.now() });
      return next;
    })
    .finally(() => {
      coordinatorWorkspaceRequests.delete(key);
    });

  coordinatorWorkspaceRequests.set(key, request);
  return request;
}

function getCachedEventCommandData(eventId: string) {
  return eventCommandDataCache.get(eventId);
}

function loadEventCommandData(eventId: string, force = false) {
  const cached = eventCommandDataCache.get(eventId);
  if (!force && cached && isFresh(cached.loadedAt, EVENT_WORKSPACE_CACHE_MS)) {
    return Promise.resolve(cached.value);
  }

  const existing = eventCommandDataRequests.get(eventId);
  if (!force && existing) return existing;

  const request = Promise.all([
    mvpApi.liveOps(eventId),
    mvpApi.eventDayStatusFeed(eventId),
    mvpApi.defenseReadiness(eventId),
  ])
    .then(([liveOps, statusFeed, defenseReadiness]) => {
      const next = { liveOps, statusFeed, defenseReadiness };
      eventCommandDataCache.set(eventId, { value: next, loadedAt: Date.now() });
      return next;
    })
    .finally(() => {
      eventCommandDataRequests.delete(eventId);
    });

  eventCommandDataRequests.set(eventId, request);
  return request;
}

/* ── Shared card primitive ─────────────────────────────────── */

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-2xl border border-border bg-card shadow-sm ${className}`}>
      {children}
    </div>
  );
}

function CardHeader({ children }: { children: React.ReactNode }) {
  return <div className="border-b border-border px-6 py-4">{children}</div>;
}

function CardBody({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`px-6 py-5 ${className}`}>{children}</div>;
}

function SectionAccent({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-xs font-bold uppercase tracking-widest text-(--prism-signal)">{children}</p>
  );
}

type EventDashboardSkeletonVariant = "command" | "event" | "suppliers" | "audit" | "coordinator";

function SkeletonLine({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-md bg-muted ${className}`} />;
}

function SkeletonCard({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <section className={`rounded-lg border border-border bg-card p-4 shadow-sm ${className}`}>
      {children}
    </section>
  );
}

function MetricSkeletonGrid() {
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {Array.from({ length: 4 }).map((_, index) => (
        <SkeletonCard key={index}>
          <div className="flex items-center gap-3">
            <SkeletonLine className="size-10 shrink-0 rounded-md" />
            <div className="min-w-0 flex-1">
              <SkeletonLine className="h-6 w-16 rounded-md" />
              <SkeletonLine className="mt-2 h-3 w-24 rounded-md" />
            </div>
          </div>
        </SkeletonCard>
      ))}
    </div>
  );
}

function EventDashboardSessionSkeleton() {
  return (
    <main className="grid min-h-screen place-items-center bg-background px-6">
      <section className="w-full max-w-sm rounded-lg border border-border bg-card p-5 shadow-sm">
        <div className="flex items-center gap-3">
          <SkeletonLine className="size-11 rounded-md" />
          <div className="min-w-0 flex-1">
            <SkeletonLine className="h-4 w-32 rounded-md" />
            <SkeletonLine className="mt-2 h-3 w-40 rounded-md" />
          </div>
        </div>
        <SkeletonLine className="mt-5 h-3 w-full rounded-md" />
        <SkeletonLine className="mt-2 h-3 w-4/5 rounded-md" />
      </section>
    </main>
  );
}

function EventDashboardSkeleton({ variant = "event" }: { variant?: EventDashboardSkeletonVariant }) {
  if (variant === "suppliers") {
    return (
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="space-y-4">
          <SkeletonCard>
            <SkeletonLine className="h-3 w-32 rounded-full" />
            <SkeletonLine className="mt-3 h-7 w-72 max-w-full rounded-md" />
            <SkeletonLine className="mt-4 h-10 w-full max-w-md rounded-lg" />
          </SkeletonCard>
          <SkeletonCard>
            {Array.from({ length: 5 }).map((_, index) => (
              <div key={index} className="flex items-center gap-3 border-b border-border py-3 last:border-b-0">
                <SkeletonLine className="size-9 rounded-md" />
                <div className="min-w-0 flex-1">
                  <SkeletonLine className="h-4 w-44 rounded-md" />
                  <SkeletonLine className="mt-2 h-3 w-64 max-w-full rounded-md" />
                </div>
                <SkeletonLine className="h-7 w-20 rounded-full" />
              </div>
            ))}
          </SkeletonCard>
        </div>
        <SkeletonCard className="min-h-72">
          <SkeletonLine className="h-4 w-40 rounded-md" />
          {Array.from({ length: 5 }).map((_, index) => (
            <SkeletonLine key={index} className="mt-4 h-10 w-full rounded-lg" />
          ))}
        </SkeletonCard>
      </div>
    );
  }

  if (variant === "audit") {
    return (
      <div className="space-y-5">
        <SkeletonCard>
          <SkeletonLine className="h-3 w-28 rounded-full" />
          <SkeletonLine className="mt-3 h-7 w-64 rounded-md" />
          <SkeletonLine className="mt-4 h-10 w-full max-w-lg rounded-lg" />
        </SkeletonCard>
        <div className="grid gap-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <SkeletonCard key={index}>
              <div className="flex items-start gap-3">
                <SkeletonLine className="size-8 shrink-0 rounded-md" />
                <div className="min-w-0 flex-1">
                  <SkeletonLine className="h-4 w-56 max-w-full rounded-md" />
                  <SkeletonLine className="mt-2 h-3 w-72 max-w-full rounded-md" />
                </div>
                <SkeletonLine className="h-7 w-24 rounded-full" />
              </div>
            </SkeletonCard>
          ))}
        </div>
      </div>
    );
  }

  if (variant === "command") {
    return (
      <div className="space-y-5">
        <SkeletonCard>
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div className="min-w-0 flex-1">
              <SkeletonLine className="h-3 w-28 rounded-full" />
              <SkeletonLine className="mt-3 h-8 w-80 max-w-full rounded-md" />
              <SkeletonLine className="mt-3 h-4 w-full max-w-xl rounded-md" />
            </div>
            <SkeletonLine className="h-10 w-32 rounded-md" />
          </div>
        </SkeletonCard>
        <MetricSkeletonGrid />
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_24rem]">
          <SkeletonCard>
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={index} className="border-b border-border py-3 last:border-b-0">
                <SkeletonLine className="h-4 w-64 max-w-full rounded-md" />
                <SkeletonLine className="mt-2 h-3 w-44 rounded-md" />
              </div>
            ))}
          </SkeletonCard>
          <SkeletonCard className="min-h-60">
            <SkeletonLine className="h-4 w-36 rounded-md" />
            <SkeletonLine className="mt-5 h-24 w-full rounded-lg" />
            <SkeletonLine className="mt-4 h-4 w-4/5 rounded-md" />
            <SkeletonLine className="mt-2 h-4 w-2/3 rounded-md" />
          </SkeletonCard>
        </div>
      </div>
    );
  }

  if (variant === "coordinator") {
    return (
      <div className="space-y-5">
        <MetricSkeletonGrid />
        <div className="grid gap-4 lg:grid-cols-2">
          <SkeletonCard className="min-h-64">
            <SkeletonLine className="h-4 w-40 rounded-md" />
            <SkeletonLine className="mt-5 h-20 w-full rounded-lg" />
            <SkeletonLine className="mt-3 h-20 w-full rounded-lg" />
          </SkeletonCard>
          <SkeletonCard className="min-h-64">
            <SkeletonLine className="h-4 w-44 rounded-md" />
            <SkeletonLine className="mt-5 h-32 w-full rounded-lg" />
          </SkeletonCard>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <SkeletonCard>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <SkeletonLine className="h-3 w-32 rounded-full" />
            <SkeletonLine className="mt-3 h-8 w-80 max-w-full rounded-md" />
            <SkeletonLine className="mt-3 h-4 w-60 rounded-md" />
            <div className="mt-3 flex flex-wrap gap-2">
              <SkeletonLine className="h-7 w-24 rounded-full" />
              <SkeletonLine className="h-7 w-32 rounded-full" />
              <SkeletonLine className="h-7 w-28 rounded-full" />
            </div>
          </div>
          <div className="flex gap-2">
            <SkeletonLine className="h-9 w-28 rounded-md" />
            <SkeletonLine className="h-9 w-24 rounded-md" />
          </div>
        </div>
      </SkeletonCard>
      <MetricSkeletonGrid />
      <SkeletonCard>
        <div className="flex flex-wrap gap-2">
          {Array.from({ length: 7 }).map((_, index) => (
            <SkeletonLine key={index} className="h-10 w-28 rounded-md" />
          ))}
        </div>
      </SkeletonCard>
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_24rem]">
        <SkeletonCard className="min-h-72">
          <SkeletonLine className="h-4 w-40 rounded-md" />
          <SkeletonLine className="mt-5 h-36 w-full rounded-lg" />
          <SkeletonLine className="mt-4 h-4 w-3/4 rounded-md" />
        </SkeletonCard>
        <SkeletonCard className="min-h-72">
          <SkeletonLine className="h-4 w-36 rounded-md" />
          {Array.from({ length: 4 }).map((_, index) => (
            <SkeletonLine key={index} className="mt-4 h-12 w-full rounded-lg" />
          ))}
        </SkeletonCard>
      </div>
    </div>
  );
}

function eventDashboardSkeletonVariant(routeState: RouteState): EventDashboardSkeletonVariant {
  if (routeState.section === "suppliers") return "suppliers";
  if (routeState.section === "audit") return "audit";
  if (routeState.eventId) return "event";
  return "command";
}

function activeSidebarItemFromRoute(routeState: RouteState) {
  if (routeState.section === "suppliers") return "supplier-directory";
  if (routeState.section === "audit") return "audit-log";
  if (routeState.section === "clients") return "client-desk";
  if (routeState.section === "calendar") return "calendar-desk";
  if (routeState.section === "tasks") return "task-desk";
  if (routeState.section === "team") return "team-desk";
  if (routeState.section === "files") return "file-hub";
  if (routeState.section === "messages") return "command-messages";
  if (routeState.section === "finance") return "finance-desk";
  if (routeState.section === "settings") return "settings";
  if (routeState.section === "inquiries") return "command-inquiries";
  if (routeState.section === "events-list") return "command-events";
  if (!routeState.eventId) return "command-home";

  return ({
    overview: "event-overview",
    floorplans: "event-floorplans",
    briefing: "event-briefing",
    suppliers: "event-suppliers",
    coordinators: "event-coordinators",
    "live-ops": "event-live-ops",
    billing: "event-billing",
    closure: "event-closure",
    activity: "event-messages",
  } satisfies Record<DetailTab, string>)[routeState.tab];
}

function loadingShellNavItems(hasEvent: boolean) {
  return [
    { id: "command-home", icon: Home, label: "Dashboard", section: "Command" },
    { id: "command-inquiries", icon: FileCheck2, label: "Inquiries", section: "Command" },
    { id: "command-events", icon: CalendarDays, label: "Events", section: "Command" },
    { id: "client-desk", icon: CircleUserRound, label: "Clients", section: "Directories" },
    { id: "calendar-desk", icon: CalendarClock, label: "Calendar", section: "Command" },
    { id: "task-desk", icon: ClipboardCheck, label: "Tasks", section: "Command" },
    { id: "team-desk", icon: UsersRound, label: "Team", section: "Directories" },
    { id: "supplier-directory", icon: Tags, label: "Suppliers", section: "Directories" },
    { id: "file-hub", icon: FileText, label: "Files", section: "Operations", disabled: !hasEvent },
    { id: "command-messages", icon: MessageSquareText, label: "Message", section: "Operations", disabled: !hasEvent },
    { id: "finance-desk", icon: ReceiptText, label: "Finance", section: "Operations", disabled: !hasEvent },
    { id: "event-overview", icon: LayoutGrid, label: "Overview", section: "Event Workspace", disabled: !hasEvent },
    { id: "event-briefing", icon: FileCheck2, label: "Briefing", section: "Event Workspace", disabled: !hasEvent },
    { id: "event-floorplans", icon: MapPinned, label: "Floor Plans", section: "Event Workspace", disabled: !hasEvent },
    { id: "event-suppliers", icon: Truck, label: "Suppliers", section: "Event Workspace", disabled: !hasEvent },
    { id: "event-coordinators", icon: UserCheck, label: "Coordinators", section: "Event Workspace", disabled: !hasEvent },
    { id: "event-live-ops", icon: Radio, label: "Live Ops", section: "Event Workspace", disabled: !hasEvent },
    { id: "event-billing", icon: ReceiptText, label: "Billing", section: "Event Workspace", disabled: !hasEvent },
    { id: "event-messages", icon: MessageSquareText, label: "Messages", section: "Event Workspace", disabled: !hasEvent },
    { id: "event-closure", icon: Archive, label: "Closure", section: "Event Workspace", disabled: !hasEvent },
    { id: "audit-log", icon: ShieldCheck, label: "Reports", section: "Admin" },
    { id: "settings", icon: Settings, label: "Settings", section: "Admin" },
  ];
}

type EventMessage = {
  id: string;
  author: string;
  initials: string;
  body: string;
  time: string;
  mine?: boolean;
  status?: string;
};

type EventMessageThread = {
  id: string;
  title: string;
  detail: string;
  tag: string;
  status: string;
  messages: EventMessage[];
};

function initialsFrom(value: string) {
  return (
    value
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join("") || "PM"
  );
}

function messageTime(value?: string) {
  if (!value) return "Now";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

function auditMessage(item: MvpAuditLog): EventMessage {
  const author = item.actor || "PMCM Team";
  return {
    id: `audit-${item.id}`,
    author,
    initials: initialsFrom(author),
    body: item.action,
    time: messageTime(item.createdAt),
    mine: item.actorRole === "pmcm-admin",
    status: lbl(item.category || item.actionType || "update"),
  };
}

function outboundMessage(item: MvpNotificationLog): EventMessage {
  const channel = lbl(item.channel);
  return {
    id: `outbound-${item.id}`,
    author: "PMCM Team",
    initials: "PM",
    body: item.message,
    time: messageTime(item.createdAt),
    mine: true,
    status: `${channel} to ${item.recipient}`,
  };
}

function buildEventMessageThreads({
  event,
  audit,
  notificationLogs,
}: {
  event: MvpEvent;
  audit: MvpAuditLog[];
  notificationLogs: MvpNotificationLog[];
}): EventMessageThread[] {
  const clientAudit = audit.filter((item) =>
    /client|briefing|conforme|proposal|billing|floor/i.test(`${item.actorRole} ${item.action} ${item.category}`),
  );
  const coordinatorAudit = audit.filter((item) => /coordinator|assignment|event day/i.test(`${item.action} ${item.category}`));
  const supplierAudit = audit.filter((item) => /supplier|quote|vendor/i.test(`${item.action} ${item.category}`));

  const clientOutbound = notificationLogs.filter((item) => /client|briefing|billing|proposal|floor/i.test(item.message));
  const coordinatorOutbound = notificationLogs.filter((item) => /coordinator|assignment/i.test(item.message));
  const supplierOutbound = notificationLogs.filter((item) => /supplier|quote|menu|setup|contract/i.test(item.message));

  const clientMessages = [
    ...clientAudit.slice(0, 4).map(auditMessage),
    ...clientOutbound.slice(0, 4).map(outboundMessage),
  ];
  const coordinatorMessages = [
    ...coordinatorAudit.slice(0, 4).map(auditMessage),
    ...coordinatorOutbound.slice(0, 5).map(outboundMessage),
  ];
  const supplierMessages = [
    ...supplierAudit.slice(0, 4).map(auditMessage),
    ...supplierOutbound.slice(0, 4).map(outboundMessage),
  ];
  const internalMessages = audit.slice(0, 6).map(auditMessage);

  return [
    {
      id: "client",
      title: event.clientName,
      detail: `${event.eventName} client thread`,
      tag: "Client",
      status: `${clientMessages.length || 1} item${clientMessages.length === 1 ? "" : "s"}`,
      messages: clientMessages.length
        ? clientMessages
        : [{
            id: "client-empty",
            author: "PMCM Team",
            initials: "PM",
            body: `Client coordination thread for ${event.eventName}.`,
            time: "Now",
            mine: true,
            status: "ready",
          }],
    },
    {
      id: "coordinators",
      title: "Coordinator Team",
      detail: "Assignments, call times, and day-of updates",
      tag: "Team",
      status: `${coordinatorMessages.length || 1} item${coordinatorMessages.length === 1 ? "" : "s"}`,
      messages: coordinatorMessages.length
        ? coordinatorMessages
        : [{
            id: "coordinators-empty",
            author: "PMCM Team",
            initials: "PM",
            body: "Coordinator thread is ready for assignment confirmations and day-of status replies.",
            time: "Now",
            mine: true,
            status: "ready",
          }],
    },
    {
      id: "suppliers",
      title: "Supplier Desk",
      detail: "Quotes, setup notes, attachments, and confirmations",
      tag: "Supplier",
      status: `${supplierMessages.length || 1} item${supplierMessages.length === 1 ? "" : "s"}`,
      messages: supplierMessages.length
        ? supplierMessages
        : [{
            id: "suppliers-empty",
            author: "PMCM Team",
            initials: "PM",
            body: "Supplier thread is ready for quote follow-ups, call times, contracts, and setup confirmations.",
            time: "Now",
            mine: true,
            status: "ready",
          }],
    },
    {
      id: "internal",
      title: "PMCM Internal",
      detail: "Team-only operational updates",
      tag: "Internal",
      status: `${internalMessages.length || 1} item${internalMessages.length === 1 ? "" : "s"}`,
      messages: internalMessages.length
        ? internalMessages
        : [{
            id: "internal-empty",
            author: "PMCM Team",
            initials: "PM",
            body: "Internal thread is ready for PMCM coordination notes.",
            time: "Now",
            mine: true,
            status: "ready",
          }],
    },
  ];
}

function EventMessagesWorkspace({
  event,
  session,
  audit,
  notificationLogs,
}: {
  event: MvpEvent;
  session: EventSession;
  audit: MvpAuditLog[];
  notificationLogs: MvpNotificationLog[];
}) {
  const threads = useMemo(
    () => buildEventMessageThreads({ event, audit, notificationLogs }),
    [audit, event, notificationLogs],
  );
  const [activeThreadId, setActiveThreadId] = useState(threads[0]?.id ?? "client");
  const [draft, setDraft] = useState("");
  const [localMessages, setLocalMessages] = useState<Record<string, EventMessage[]>>({});

  useEffect(() => {
    if (threads.some((thread) => thread.id === activeThreadId)) return;
    setActiveThreadId(threads[0]?.id ?? "client");
  }, [activeThreadId, threads]);

  const activeThread = threads.find((thread) => thread.id === activeThreadId) ?? threads[0];
  const messages = activeThread ? [...activeThread.messages, ...(localMessages[activeThread.id] ?? [])] : [];

  function sendMessage() {
    if (!activeThread || !draft.trim()) return;
    const body = draft.trim();
    setLocalMessages((current) => ({
      ...current,
      [activeThread.id]: [
        ...(current[activeThread.id] ?? []),
        {
          id: `local-${activeThread.id}-${Date.now()}`,
          author: session.name,
          initials: initialsFrom(session.name),
          body,
          time: "Now",
          mine: true,
          status: "draft",
        },
      ],
    }));
    setDraft("");
  }

  if (!activeThread) {
    return <EmptyState icon={MessageSquareText} title="No message threads" description="Select an event workspace to view PMCM messages." />;
  }

  return (
    <section className="overflow-hidden rounded-lg border border-primary/12 bg-card shadow-none">
      <div className="grid min-h-[680px] lg:grid-cols-[20rem_minmax(0,1fr)]">
        <aside className="border-b border-border bg-secondary/45 lg:border-b-0 lg:border-r">
          <div className="border-b border-border p-4">
            <p className="text-sm font-black text-foreground">Event Threads</p>
            <p className="mt-1 truncate text-xs text-muted-foreground">{event.eventName}</p>
            <div className="relative mt-3">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
              <input
                className="h-10 w-full rounded-md border border-border bg-card pl-9 pr-3 text-sm outline-none focus:border-primary"
                placeholder="Search threads..."
              />
            </div>
          </div>
          <div className="p-2">
            {threads.map((thread) => (
              <button
                key={thread.id}
                type="button"
                data-active={thread.id === activeThread.id}
                onClick={() => setActiveThreadId(thread.id)}
                className="flex w-full items-start gap-3 rounded-md px-3 py-3 text-left transition hover:bg-card data-[active=true]:bg-card data-[active=true]:shadow-sm"
              >
                <span className="mt-0.5 grid size-9 shrink-0 place-items-center rounded-full bg-primary/10 text-xs font-black text-primary">
                  {initialsFrom(thread.title)}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center justify-between gap-2">
                    <span className="truncate text-sm font-black text-foreground">{thread.title}</span>
                    <span className="text-[11px] font-bold text-muted-foreground">{thread.status}</span>
                  </span>
                  <span className="mt-1 block truncate text-xs text-muted-foreground">{thread.detail}</span>
                  <span className="mt-2 inline-flex rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-black text-primary">
                    {thread.tag}
                  </span>
                </span>
              </button>
            ))}
          </div>
        </aside>

        <div className="flex min-w-0 flex-col bg-background">
          <div className="border-b border-border bg-card px-5 py-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-base font-black text-foreground">{activeThread.title}</p>
                <p className="mt-1 truncate text-xs font-semibold text-muted-foreground">{activeThread.detail}</p>
              </div>
              <div className="flex flex-wrap gap-2 text-[11px] font-black text-muted-foreground">
                <span className="rounded-full bg-secondary px-2.5 py-1">{activeThread.tag}</span>
                <span className="rounded-full bg-secondary px-2.5 py-1">{event.status}</span>
                <span className="rounded-full bg-secondary px-2.5 py-1">{event.floorPlanStatus}</span>
              </div>
            </div>
          </div>

          <div className="flex-1 space-y-4 overflow-y-auto px-5 py-6">
            <div className="mx-auto w-fit rounded-md bg-secondary px-3 py-1 text-[11px] font-black text-muted-foreground">
              {event.eventDate}
            </div>
            {messages.map((message) => (
              <div key={message.id} className={`flex items-end gap-2 ${message.mine ? "justify-end" : "justify-start"}`}>
                {!message.mine ? (
                  <span className="grid size-8 shrink-0 place-items-center rounded-full bg-secondary text-[11px] font-black text-foreground">
                    {message.initials}
                  </span>
                ) : null}
                <div className={`max-w-[min(48rem,82%)] ${message.mine ? "text-right" : "text-left"}`}>
                  <div
                    className={
                      message.mine
                        ? "rounded-2xl rounded-br-md bg-primary px-4 py-3 text-sm font-medium leading-6 text-primary-foreground"
                        : "rounded-2xl rounded-bl-md bg-card px-4 py-3 text-sm font-medium leading-6 text-foreground shadow-sm ring-1 ring-border"
                    }
                  >
                    {message.body}
                  </div>
                  <div className={`mt-1 flex flex-wrap gap-2 text-[11px] font-semibold text-muted-foreground ${message.mine ? "justify-end" : "justify-start"}`}>
                    <span>{message.author}</span>
                    <span>{message.time}</span>
                    {message.status ? <span>{message.status}</span> : null}
                  </div>
                </div>
                {message.mine ? (
                  <span className="grid size-8 shrink-0 place-items-center rounded-full bg-primary text-[11px] font-black text-primary-foreground">
                    {message.initials}
                  </span>
                ) : null}
              </div>
            ))}
          </div>

          <div className="border-t border-border bg-card p-4">
            <div className="flex gap-2">
              <input
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    sendMessage();
                  }
                }}
                className="h-11 min-w-0 flex-1 rounded-md border border-border bg-background px-3 text-sm outline-none focus:border-primary"
                placeholder={`Reply to ${activeThread.title}...`}
              />
              <button
                type="button"
                disabled={!draft.trim()}
                onClick={sendMessage}
                className="grid size-11 shrink-0 place-items-center rounded-md bg-primary text-primary-foreground transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-45"
                aria-label="Send message"
              >
                <Send className="size-4" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ── Home page stat card ───────────────────────────────────── */

type EventFileHubItem = {
  id: string;
  title: string;
  subtitle: string;
  category: string;
  status: string;
  date: string;
  owner: string;
  extension: string;
  kind: "invoice" | "floorplan" | "briefing" | "contract" | "document" | "closeout";
  meta: string;
  amount?: number;
  accent: string;
};

function EventFileThumbnail({ item, active }: { item: EventFileHubItem; active: boolean }) {
  if (item.kind === "floorplan") {
    return (
      <div className="relative h-28 overflow-hidden rounded-md border border-border bg-[#fff8f2]">
        <div className="absolute inset-0 bg-[linear-gradient(#eadbd3_1px,transparent_1px),linear-gradient(90deg,#eadbd3_1px,transparent_1px)] bg-size-[18px_18px]" />
        <div className="absolute left-4 top-4 h-14 w-24 rounded-sm border border-primary/30 bg-primary/10" />
        <div className="absolute bottom-4 right-4 grid grid-cols-3 gap-1">
          {Array.from({ length: 9 }).map((_, index) => (
            <span key={index} className="size-3 rounded-full bg-(--prism-success)/55" />
          ))}
        </div>
        <div className="absolute bottom-3 left-4 h-2 w-20 rounded-full bg-(--prism-amber)/70" />
      </div>
    );
  }

  return (
    <div className="h-28 overflow-hidden rounded-md border border-border bg-white p-4 shadow-xs">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className={`h-2 w-14 rounded-full ${item.accent}`} />
          <div className="mt-3 h-2 w-24 rounded-full bg-muted" />
          <div className="mt-2 h-2 w-16 rounded-full bg-muted" />
        </div>
        <div className="h-9 w-12 rounded-sm border border-border bg-muted/40" />
      </div>
      <div className="mt-5 grid grid-cols-3 gap-2">
        <div className="h-2 rounded-full bg-muted" />
        <div className="h-2 rounded-full bg-muted" />
        <div className="h-2 rounded-full bg-muted" />
      </div>
      <div className={active ? "mt-4 h-1 rounded-full bg-primary" : "mt-4 h-1 rounded-full bg-muted"} />
    </div>
  );
}

function EventFilePreview({ event, item }: { event: MvpEvent; item: EventFileHubItem }) {
  return (
    <div className="min-h-[30rem] bg-[#f8fbf8] p-5">
      <div className="mx-auto max-w-3xl rounded-md border border-border bg-white p-7 shadow-sm">
        <div className="flex items-start justify-between gap-6">
          <div>
            <p className="text-2xl font-black text-foreground">
              {item.kind === "invoice" ? "Invoice" : item.kind === "floorplan" ? "Floor Plan" : item.category}
            </p>
            <p className="mt-1 text-xs font-semibold text-muted-foreground">{item.meta}</p>
          </div>
          <div className="text-right">
            <p className="text-sm font-black text-primary">P.R.I.S.M.</p>
            <p className="mt-1 text-xs text-muted-foreground">PMCM Event Operations</p>
            <p className="text-xs text-muted-foreground">{event.eventDate}</p>
          </div>
        </div>

        <div className="mt-8 grid gap-5 border-y border-border py-5 sm:grid-cols-2">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.16em] text-muted-foreground">Event</p>
            <p className="mt-2 text-sm font-black text-foreground">{event.eventName}</p>
            <p className="mt-1 text-xs text-muted-foreground">{event.clientName}</p>
          </div>
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.16em] text-muted-foreground">File owner</p>
            <p className="mt-2 text-sm font-black text-foreground">{item.owner}</p>
            <p className="mt-1 text-xs text-muted-foreground">{item.date}</p>
          </div>
        </div>

        {item.kind === "floorplan" ? (
          <div className="mt-7 overflow-hidden rounded-md border border-border bg-[#fff6ee]">
            <div className="relative aspect-16/9 bg-[linear-gradient(#eadbd3_1px,transparent_1px),linear-gradient(90deg,#eadbd3_1px,transparent_1px)] bg-size-[24px_24px]">
              <div className="absolute left-[12%] top-[18%] h-[24%] w-[28%] rounded-sm border border-primary/35 bg-primary/10" />
              <div className="absolute right-[14%] top-[16%] h-[18%] w-[22%] rounded-sm border border-(--prism-amber)/45 bg-(--prism-amber)/15" />
              <div className="absolute bottom-[18%] left-[18%] grid grid-cols-6 gap-2">
                {Array.from({ length: 24 }).map((_, index) => (
                  <span key={index} className="size-3 rounded-full bg-(--prism-success)/60" />
                ))}
              </div>
              <div className="absolute bottom-[14%] right-[14%] h-3 w-32 rounded-full bg-primary/70" />
            </div>
          </div>
        ) : (
          <div className="mt-7 overflow-hidden rounded-md border border-border">
            <div className="grid grid-cols-[1fr_6rem_7rem] bg-muted/45 px-4 py-2 text-[10px] font-black uppercase tracking-[0.12em] text-muted-foreground">
              <span>Item</span>
              <span>Qty</span>
              <span className="text-right">Amount</span>
            </div>
            {[
              ["Event planning document", "1", item.amount ? phpMoney.format(item.amount) : "Attached"],
              ["Client and operations reference", "1", item.status],
              ["PMCM audit-safe copy", "1", item.extension],
            ].map(([labelText, qty, amount]) => (
              <div key={labelText} className="grid grid-cols-[1fr_6rem_7rem] border-t border-border px-4 py-3 text-xs">
                <span className="font-semibold text-foreground">{labelText}</span>
                <span className="text-muted-foreground">{qty}</span>
                <span className="text-right font-bold text-foreground">{amount}</span>
              </div>
            ))}
          </div>
        )}

        <div className="mt-7 grid gap-3 sm:grid-cols-3">
          {["Status", "Category", "Source"].map((labelText) => (
            <div key={labelText} className="rounded-md border border-border bg-muted/20 px-3 py-2">
              <p className="text-[10px] font-black uppercase tracking-[0.14em] text-muted-foreground">{labelText}</p>
              <p className="mt-1 truncate text-xs font-black text-foreground">
                {labelText === "Status" ? item.status : labelText === "Category" ? item.category : item.subtitle}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function EventFileHub({
  event,
  documents,
  drafts,
  billingStatements,
  quoteRequests,
  briefing,
  checks,
  postEventDocuments,
  onOpenFloorplans,
  onOpenBriefing,
  onOpenSuppliers,
  onOpenBilling,
  onOpenClosure,
}: {
  event: MvpEvent;
  documents: MvpDocument[];
  drafts: MvpFloorPlanDraft[];
  billingStatements: MvpBillingStatement[];
  quoteRequests: MvpSupplierQuoteRequest[];
  briefing?: MvpBriefing;
  checks: MvpComplianceCheck[];
  postEventDocuments: MvpPostEventDocument[];
  onOpenFloorplans: () => void;
  onOpenBriefing: () => void;
  onOpenSuppliers: () => void;
  onOpenBilling: () => void;
  onOpenClosure: () => void;
}) {
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [view, setView] = useState<"grid" | "list">("grid");

  const items = useMemo<EventFileHubItem[]>(() => {
    const uploaded = documents.map((document) => ({
      id: `document-${document.id}`,
      title: document.fileName,
      subtitle: "Uploaded file",
      category: lbl(document.type),
      status: lbl(document.status),
      date: shortDate(document.uploadedAt),
      owner: event.clientName,
      extension: document.fileName.split(".").pop()?.toUpperCase() || "FILE",
      kind: "document" as const,
      meta: `Document ${document.id}`,
      accent: "bg-primary",
    }));

    const floorplans = drafts.map((draft) => ({
      id: `floorplan-${draft.id}`,
      title: `${draft.name}.floorplan`,
      subtitle: "Official layout",
      category: "Floorplans",
      status: lbl(draft.status),
      date: shortDate(draft.approvedAt ?? draft.submittedAt ?? draft.updatedAt),
      owner: draft.createdByRole ? lbl(draft.createdByRole) : "PMCM",
      extension: "PLAN",
      kind: "floorplan" as const,
      meta: `Floor plan ${draft.floorPlanId}`,
      accent: "bg-(--prism-success)",
    }));

    const invoices = billingStatements.map((statement) => ({
      id: `billing-${statement.id}`,
      title: `Billing Statement ${statement.number}.pdf`,
      subtitle: "Invoice PDF",
      category: "Billing",
      status: lbl(statement.status),
      date: shortDate(statement.sentAt ?? statement.generatedAt),
      owner: statement.clientName || event.clientName,
      extension: "PDF",
      kind: "invoice" as const,
      meta: statement.number,
      amount: statement.totalAmount,
      accent: "bg-(--prism-amber)",
    }));

    const contracts = quoteRequests
      .filter((request) => request.contractDocumentId || request.assignmentStatus)
      .map((request) => ({
        id: `contract-${request.id}`,
        title: `${request.supplierName} Contract.pdf`,
        subtitle: request.category,
        category: "Supplier Contracts",
        status: lbl(request.assignmentStatus ?? request.status),
        date: shortDate(request.createdAt),
        owner: request.supplierName,
        extension: "PDF",
        kind: "contract" as const,
        meta: request.contractDocumentId ?? request.id,
        accent: "bg-[#13a8a0]",
      }));

    const generated = [
      briefing
        ? {
            id: "briefing-file",
            title: `${event.eventName} Briefing.pdf`,
            subtitle: "Event dossier",
            category: "Briefing",
            status: "Submitted",
            date: shortDate(briefing.submittedAt),
            owner: event.clientName,
            extension: "PDF",
            kind: "briefing" as const,
            meta: briefing.venue,
            accent: "bg-primary",
          }
        : null,
      checks.length
        ? {
            id: "closeout-checks",
            title: `${event.eventName} Closeout Checks.pdf`,
            subtitle: "Compliance report",
            category: "Closeout",
            status: `${checks.filter((check) => check.status === "open").length} open`,
            date: shortDate(checks[0]?.resolvedAt),
            owner: "PMCM",
            extension: "PDF",
            kind: "closeout" as const,
            meta: `${checks.length} checks`,
            accent: "bg-[#64748b]",
          }
        : null,
      ...postEventDocuments.map((document) => ({
        id: `post-event-${document.id}`,
        title: `${document.title}.pdf`,
        subtitle: "Post-event document",
        category: "Closeout",
        status: lbl(document.status),
        date: event.eventDate,
        owner: "PMCM",
        extension: "PDF",
        kind: "closeout" as const,
        meta: document.id,
        accent: "bg-[#64748b]",
      })),
    ].filter(Boolean) as EventFileHubItem[];

    return [...invoices, ...floorplans, ...uploaded, ...contracts, ...generated];
  }, [billingStatements, briefing, checks, documents, drafts, event, postEventDocuments, quoteRequests]);

  const filteredItems = items.filter((item) => {
    const haystack = `${item.title} ${item.category} ${item.owner} ${item.status}`.toLowerCase();
    return haystack.includes(query.trim().toLowerCase());
  });
  const selected = filteredItems.find((item) => item.id === selectedId) ?? filteredItems[0] ?? items[0];

  useEffect(() => {
    if (!selected && selectedId) setSelectedId(null);
    if (selected && selected.id !== selectedId && !filteredItems.some((item) => item.id === selectedId)) {
      setSelectedId(selected.id);
    }
  }, [filteredItems, selected, selectedId]);

  function openSelected() {
    if (!selected) return;
    if (selected.kind === "floorplan") onOpenFloorplans();
    else if (selected.kind === "briefing") onOpenBriefing();
    else if (selected.kind === "contract") onOpenSuppliers();
    else if (selected.kind === "invoice") onOpenBilling();
    else if (selected.kind === "closeout") onOpenClosure();
  }

  if (!items.length) {
    return <EmptyState icon={FileText} title="No files yet" description="Documents will appear after briefing, floorplan, supplier, billing, or closeout records are created." />;
  }

  return (
    <section className="overflow-hidden rounded-lg border border-border bg-card shadow-sm">
      <div className="grid min-h-[760px] lg:grid-cols-[25rem_minmax(0,1fr)]">
        <aside className="min-w-0 border-b border-border bg-card lg:border-b-0 lg:border-r">
          <div className="border-b border-border px-4 py-4">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-black text-foreground">{filteredItems.length} results</p>
              <div className="flex rounded-md border border-border bg-background p-0.5">
                <button type="button" data-active={view === "grid"} onClick={() => setView("grid")} className="grid size-7 place-items-center rounded-sm text-muted-foreground data-[active=true]:bg-primary/10 data-[active=true]:text-primary" aria-label="Grid view">
                  <Grid2X2 className="size-3.5" />
                </button>
                <button type="button" data-active={view === "list"} onClick={() => setView("list")} className="grid size-7 place-items-center rounded-sm text-muted-foreground data-[active=true]:bg-primary/10 data-[active=true]:text-primary" aria-label="List view">
                  <List className="size-3.5" />
                </button>
              </div>
            </div>
            <label className="relative mt-3 block">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
              <input value={query} onChange={(event) => setQuery(event.target.value)} className="h-10 w-full rounded-md border border-border bg-background pl-9 pr-3 text-sm outline-none focus:border-primary" placeholder="Search event files..." />
            </label>
            <div className="mt-3 flex flex-wrap gap-2">
              <button type="button" className="inline-flex h-8 items-center gap-1.5 rounded-md bg-foreground px-3 text-xs font-black text-background"><Share2 className="size-3.5" /> Share Selected</button>
              <button type="button" className="inline-flex h-8 items-center gap-1.5 rounded-md border border-border bg-background px-3 text-xs font-black text-foreground"><Download className="size-3.5" /> Download</button>
              <button type="button" onClick={openSelected} className="inline-flex h-8 items-center gap-1.5 rounded-md border border-border bg-background px-3 text-xs font-black text-foreground"><Eye className="size-3.5" /> Open</button>
              <button type="button" className="grid size-8 place-items-center rounded-md border border-border bg-background text-muted-foreground" aria-label="More file actions"><MoreHorizontal className="size-3.5" /></button>
            </div>
          </div>

          <div className="px-4 py-4">
            <p className="mb-3 text-xs font-black text-foreground">Relevance</p>
            <div className={view === "grid" ? "grid grid-cols-2 gap-3" : "space-y-2"}>
              {filteredItems.map((item) => {
                const active = item.id === selected?.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    data-active={active}
                    onClick={() => setSelectedId(item.id)}
                    className={view === "grid" ? "group min-w-0 rounded-lg border border-transparent bg-background p-2 text-left transition hover:border-primary/20 data-[active=true]:border-primary data-[active=true]:bg-primary/5" : "group flex w-full min-w-0 items-center gap-3 rounded-lg border border-transparent bg-background p-2 text-left transition hover:border-primary/20 data-[active=true]:border-primary data-[active=true]:bg-primary/5"}
                  >
                    {view === "grid" ? (
                      <EventFileThumbnail item={item} active={active} />
                    ) : (
                      <span className="grid size-10 shrink-0 place-items-center rounded-md border border-border bg-white text-[10px] font-black text-primary">{item.extension}</span>
                    )}
                    <span className={view === "grid" ? "mt-2 block min-w-0" : "block min-w-0 flex-1"}>
                      <span className="block truncate text-sm font-black text-foreground">{item.title}</span>
                      <span className="mt-0.5 block truncate text-xs text-muted-foreground">{item.extension} - {item.owner}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </aside>

        {selected ? (
          <div className="min-w-0 bg-background">
            <div className="border-b border-border bg-card">
              <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
                <div className="min-w-0">
                  <p className="truncate text-base font-black text-foreground">{selected.title}</p>
                  <p className="mt-1 truncate text-xs font-semibold text-muted-foreground">{selected.extension} - {selected.category} - {selected.date}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button type="button" className="inline-flex h-8 items-center gap-1.5 rounded-md border border-border bg-background px-3 text-xs font-black text-foreground">Share</button>
                  <button type="button" onClick={openSelected} className="inline-flex h-8 items-center gap-1.5 rounded-md border border-border bg-background px-3 text-xs font-black text-foreground">Open</button>
                </div>
              </div>
              <div className="flex flex-wrap gap-2 border-t border-border px-5 py-3">
                <button type="button" className="inline-flex h-8 items-center gap-1.5 rounded-md border border-border bg-background px-3 text-xs font-black text-foreground"><Pencil className="size-3.5" /> Edit PDF</button>
                <button type="button" className="inline-flex h-8 items-center gap-1.5 rounded-md border border-border bg-background px-3 text-xs font-black text-foreground"><Download className="size-3.5" /> Download</button>
                <button type="button" className="inline-flex h-8 items-center gap-1.5 rounded-md border border-border bg-background px-3 text-xs font-black text-foreground"><FileSignature className="size-3.5" /> Self-Sign</button>
                <button type="button" className="inline-flex h-8 items-center gap-1.5 rounded-md border border-border bg-background px-3 text-xs font-black text-foreground"><MessageSquareText className="size-3.5" /> Comment</button>
                <button type="button" className="grid size-8 place-items-center rounded-md border border-border bg-background text-muted-foreground" aria-label="More preview actions"><MoreHorizontal className="size-3.5" /></button>
                <button type="button" className="ml-auto inline-flex h-8 items-center gap-1.5 rounded-md border border-primary/20 bg-primary/10 px-3 text-xs font-black text-primary"><Upload className="size-3.5" /> Upload new version</button>
              </div>
            </div>
            <EventFilePreview event={event} item={selected} />
          </div>
        ) : null}
      </div>
    </section>
  );
}

function EventCalendarWorkspace({
  events,
  selectedEventId,
  onOpenEvent,
}: {
  events: MvpEvent[];
  selectedEventId?: string | null;
  onOpenEvent: (id: string) => void;
}) {
  const sortedEvents = [...events].sort((a, b) => a.eventDate.localeCompare(b.eventDate));
  const upcoming = sortedEvents.filter((event) => new Date(event.eventDate).getTime() >= Date.now()).slice(0, 6);
  const monthLabel = new Date().toLocaleDateString(undefined, { month: "long", year: "numeric" });
  const calendarDays = Array.from({ length: 35 }, (_, index) => index + 1);
  const eventDaySet = new Set(
    events
      .map((event) => new Date(event.eventDate))
      .filter((date) => !Number.isNaN(date.getTime()))
      .map((date) => date.getDate()),
  );

  return (
    <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_22rem]">
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <SectionAccent>PMCM calendar</SectionAccent>
              <h2 className="mt-1 text-base font-black text-foreground">{monthLabel}</h2>
            </div>
            <StatusBadge status={`${events.length} events`} />
          </div>
        </CardHeader>
        <CardBody>
          <div className="grid grid-cols-7 gap-2 text-center text-xs font-black text-muted-foreground">
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => <span key={day}>{day}</span>)}
          </div>
          <div className="mt-3 grid grid-cols-7 gap-2">
            {calendarDays.map((day) => (
              <div
                key={day}
                className="flex aspect-square min-h-16 flex-col justify-between rounded-md border border-border bg-background p-2 text-left"
              >
                <span className="text-xs font-black text-foreground">{day}</span>
                {eventDaySet.has(day) ? <span className="h-1.5 w-8 rounded-full bg-primary" /> : null}
              </div>
            ))}
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <h2 className="text-sm font-black text-foreground">Upcoming schedule</h2>
        </CardHeader>
        <div className="divide-y divide-border">
          {(upcoming.length ? upcoming : sortedEvents).slice(0, 6).map((event) => (
            <button
              key={event.id}
              type="button"
              onClick={() => onOpenEvent(event.id)}
              data-active={event.id === selectedEventId}
              className="flex w-full items-start gap-3 px-5 py-4 text-left transition hover:bg-muted/30 data-[active=true]:bg-primary/5"
            >
              <span className="grid size-11 shrink-0 place-items-center rounded-md bg-primary/10 text-xs font-black text-primary">
                {shortDate(event.eventDate).split(" ").slice(0, 2).join(" ")}
              </span>
              <span className="min-w-0">
                <span className="block truncate text-sm font-black text-foreground">{event.eventName}</span>
                <span className="mt-1 block truncate text-xs text-muted-foreground">{event.clientName}</span>
                <span className="mt-2 inline-flex"><StatusBadge status={event.status} /></span>
              </span>
            </button>
          ))}
        </div>
      </Card>
    </section>
  );
}

function EventTasksWorkspace({
  unreviewedInquiries,
  pendingApprovals,
  selectedEvent,
  defenseReadiness,
  draftsCount,
  quoteCount,
  paymentCount,
  openCheckCount,
  onNavigateSection,
  onNavigateEventTab,
}: {
  unreviewedInquiries: number;
  pendingApprovals: MvpApprovalRequest[];
  selectedEvent?: MvpEvent;
  defenseReadiness: MvpDefenseReadiness | null;
  draftsCount: number;
  quoteCount: number;
  paymentCount: number;
  openCheckCount: number;
  onNavigateSection: (section: DashboardSection) => void;
  onNavigateEventTab: (tab: DetailTab) => void;
}) {
  const tasks = [
    {
      id: "inquiries",
      label: "Review client inquiries",
      detail: `${unreviewedInquiries} inquiry item(s) need PMCM review.`,
      count: unreviewedInquiries,
      action: () => onNavigateSection("inquiries"),
    },
    {
      id: "approvals",
      label: "Approve portal accounts",
      detail: `${pendingApprovals.length} pending access request(s).`,
      count: pendingApprovals.length,
      action: () => onNavigateSection("clients"),
    },
    {
      id: "floorplans",
      label: "Check floorplan drafts",
      detail: selectedEvent ? `${draftsCount} draft(s) for ${selectedEvent.eventName}.` : "Select an event workspace.",
      count: draftsCount,
      action: () => onNavigateEventTab("floorplans"),
    },
    {
      id: "suppliers",
      label: "Review supplier coverage",
      detail: selectedEvent ? `${quoteCount} supplier quote(s) linked to the event.` : "Select an event workspace.",
      count: quoteCount,
      action: () => onNavigateEventTab("suppliers"),
    },
    {
      id: "billing",
      label: "Check billing milestones",
      detail: selectedEvent ? `${paymentCount} payment milestone(s) to monitor.` : "Select an event workspace.",
      count: paymentCount,
      action: () => onNavigateEventTab("billing"),
    },
    {
      id: "closure",
      label: "Resolve closeout gates",
      detail: selectedEvent ? `${openCheckCount} open closeout check(s).` : "Select an event workspace.",
      count: openCheckCount,
      action: () => onNavigateEventTab("closure"),
    },
  ];
  const nextActions = defenseReadiness?.nextActions ?? [];

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_22rem]">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <ClipboardCheck className="size-4 text-(--prism-signal)" />
            <h2 className="text-sm font-black text-foreground">Task queue</h2>
          </div>
        </CardHeader>
        <div className="divide-y divide-border">
          {tasks.map((task) => (
            <button key={task.id} type="button" onClick={task.action} className="flex w-full items-center justify-between gap-4 px-6 py-4 text-left transition hover:bg-muted/30">
              <span className="min-w-0">
                <span className="block text-sm font-black text-foreground">{task.label}</span>
                <span className="mt-1 block text-xs text-muted-foreground">{task.detail}</span>
              </span>
              <span className="grid size-9 shrink-0 place-items-center rounded-full bg-primary/10 text-xs font-black text-primary">{task.count}</span>
            </button>
          ))}
        </div>
      </Card>

      <Card>
        <CardHeader>
          <h2 className="text-sm font-black text-foreground">Defense next actions</h2>
        </CardHeader>
        <CardBody className="space-y-3">
          {nextActions.length ? nextActions.slice(0, 5).map((action) => (
            <div key={action.key} className="rounded-md border border-border bg-muted/20 px-3 py-2">
              <p className="text-xs font-black text-foreground">{action.label}</p>
              <p className="mt-1 text-xs text-muted-foreground">{action.detail}</p>
            </div>
          )) : (
            <EmptyState icon={CheckCircle2} title="No defense blockers" description="The selected event has no current defense-readiness action items." />
          )}
        </CardBody>
      </Card>
    </div>
  );
}

function EventSettingsWorkspace({ session, selectedEvent }: { session: EventSession; selectedEvent?: MvpEvent }) {
  return (
    <div className="grid gap-4 lg:grid-cols-3">
      {[
        { label: "Signed in as", value: session.name, detail: lbl(session.role) },
        { label: "Default workspace", value: selectedEvent?.eventName ?? "No event selected", detail: selectedEvent?.clientName ?? "Pick an event from Events." },
        { label: "Notifications", value: "Email + Viber", detail: "Production adapters are still gated by notification infrastructure." },
      ].map((item) => (
        <Card key={item.label}>
          <CardBody>
            <p className="text-[10px] font-black uppercase tracking-[0.16em] text-muted-foreground">{item.label}</p>
            <p className="mt-2 text-lg font-black text-foreground">{item.value}</p>
            <p className="mt-1 text-sm text-muted-foreground">{item.detail}</p>
          </CardBody>
        </Card>
      ))}
      <Card className="lg:col-span-3">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Settings className="size-4 text-(--prism-signal)" />
            <h2 className="text-sm font-black text-foreground">Workspace controls</h2>
          </div>
        </CardHeader>
        <CardBody className="grid gap-3 md:grid-cols-3">
          {["Role-safe access", "Audit logging", "Client portal gating"].map((item) => (
            <div key={item} className="rounded-md border border-border bg-muted/20 px-4 py-3">
              <p className="text-sm font-black text-foreground">{item}</p>
              <p className="mt-1 text-xs text-muted-foreground">Managed by PMCM event command policy.</p>
            </div>
          ))}
        </CardBody>
      </Card>
    </div>
  );
}

function CommandStat({
  label,
  value,
  icon: Icon,
  accent = "text-(--prism-signal)",
  onClick,
}: {
  label: string;
  value: string | number;
  icon: LucideIcon;
  accent?: string;
  onClick?: () => void;
}) {
  const inner = (
    <div className="flex items-center gap-4 rounded-2xl border border-border bg-card px-5 py-4 shadow-sm transition hover:shadow-md">
      <span className={`grid size-11 shrink-0 place-items-center rounded-xl bg-muted ${accent}`}>
        <Icon className="size-5" />
      </span>
      <div className="min-w-0">
        <p className="text-2xl font-black leading-none text-foreground">{value}</p>
        <p className="mt-1 text-xs font-semibold text-muted-foreground">{label}</p>
      </div>
    </div>
  );
  if (onClick) {
    return (
      <button type="button" onClick={onClick} className="w-full text-left">
        {inner}
      </button>
    );
  }
  return inner;
}

/* ── Event queue card (inline, no right rail) ──────────────── */

function EventQueueCard({
  events,
  selectedEventId,
  onSelectEvent,
  onReset,
  onNavigateEvent,
}: {
  events: MvpEvent[];
  selectedEventId?: string;
  onSelectEvent: (id: string) => void;
  onReset: () => void;
  onNavigateEvent: (id: string) => void;
}) {
  function statusAccent(status: string) {
    if (/approved|confirmed|complete|paid/i.test(status)) return "border-l-(--prism-success)";
    if (/planning|in_progress|active|draft/i.test(status)) return "border-l-(--prism-signal)";
    if (/pending|review/i.test(status)) return "border-l-(--prism-amber)";
    return "border-l-border";
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-3">
          <div>
            <SectionAccent>Active events</SectionAccent>
            <h2 className="mt-1 text-base font-bold text-foreground">
              {events.length} confirmed workspace{events.length === 1 ? "" : "s"}
            </h2>
          </div>
          <button
            type="button"
            onClick={onReset}
            title="Reset demo data"
            className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-semibold text-muted-foreground transition hover:border-(--prism-signal)/30 hover:text-foreground"
          >
            <RotateCcw className="size-3" /> Reset demo
          </button>
        </div>
      </CardHeader>
      {events.length === 0 ? (
        <CardBody>
          <EmptyState
            icon={CalendarDays}
            title="No confirmed events"
            description="Accept an inquiry and upload signed conforme to activate an event workspace."
          />
        </CardBody>
      ) : (
        <div className="divide-y divide-border">
          {events.map((ev) => (
            <button
              key={ev.id}
              type="button"
              onClick={() => onNavigateEvent(ev.id)}
              className={`group flex w-full items-center justify-between gap-4 border-l-4 ${statusAccent(ev.status)} px-6 py-4 text-left transition hover:bg-muted/30`}
            >
              <div className="min-w-0">
                <p className={`truncate text-sm font-bold ${ev.id === selectedEventId ? "text-(--prism-signal)" : "text-foreground"}`}>
                  {ev.eventName}
                </p>
                <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1"><CalendarDays className="size-3" />{ev.eventDate ?? "Date pending"}</span>
                  <span>{ev.clientName}</span>
                </div>
              </div>
              <StatusBadge status={ev.status} />
            </button>
          ))}
        </div>
      )}
    </Card>
  );
}

/* ── Home / command page ───────────────────────────────────── */

function CommandHomePage({
  session,
  state,
  events,
  selectedEvent,
  unreviewedInquiries,
  pendingApprovals,
  defenseReadiness,
  onNavigateSection,
  onNavigateEvent,
  onReset,
}: {
  session: EventSession;
  state: MvpDemoState;
  events: MvpEvent[];
  selectedEvent?: MvpEvent;
  unreviewedInquiries: number;
  pendingApprovals: MvpApprovalRequest[];
  defenseReadiness: MvpDefenseReadiness | null;
  onNavigateSection: (section: DashboardSection) => void;
  onNavigateEvent: (id: string, tab?: DetailTab) => void;
  onReset: () => void;
}) {
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const firstName = session.name.split(" ")[0];

  const daysToEvent = (() => {
    if (!selectedEvent?.eventDate) return null;
    try {
      const diff = Math.ceil(
        (new Date(selectedEvent.eventDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24),
      );
      return diff > 0 ? diff : 0;
    } catch { return null; }
  })();

  const recentAudit = (state.auditLogs ?? []).slice(0, 5);

  return (
    <div className="space-y-6">
      {/* Greeting banner */}
      <div className="relative overflow-hidden rounded-2xl bg-linear-to-br from-(--prism-signal) to-[#8b0f48] px-6 py-7 text-white shadow-lg sm:px-8 sm:py-8">
        <div className="relative z-10">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-white/70">P.R.I.S.M Event Command</p>
              <h1 className="mt-1 text-2xl font-black leading-tight sm:text-3xl">
                {greeting}, {firstName}.
              </h1>
              <p className="mt-2 max-w-xl text-sm leading-6 text-white/80">
                {events.length > 0
                  ? `${events.length} active event workspace${events.length === 1 ? "" : "s"}. ${unreviewedInquiries > 0 ? `${unreviewedInquiries} unreviewed inquiry${unreviewedInquiries === 1 ? "" : "s"} need attention.` : "No unreviewed inquiries."}`
                  : "No confirmed events yet. Accept an inquiry and upload the signed conforme to activate the first workspace."}
              </p>
              <div className="mt-5 flex flex-wrap gap-2">
                <Button
                  className="rounded-lg bg-white font-bold text-(--prism-signal) hover:bg-white/90"
                  onClick={() => onNavigateSection("events-list")}
                >
                  <CalendarDays className="size-4" /> View events
                </Button>
                {unreviewedInquiries > 0 && (
                  <Button
                    variant="ghost"
                    className="rounded-lg font-semibold text-white hover:bg-white/15 hover:text-white"
                    onClick={() => onNavigateSection("inquiries")}
                  >
                    Review {unreviewedInquiries} inquiry{unreviewedInquiries === 1 ? "" : "s"}
                  </Button>
                )}
              </div>
            </div>
            {daysToEvent !== null && (
              <div className="hidden shrink-0 flex-col items-center rounded-xl bg-white/15 px-5 py-4 text-center backdrop-blur-sm sm:flex">
                <span className="text-4xl font-black leading-none">{daysToEvent}</span>
                <span className="mt-1 text-xs font-semibold uppercase tracking-wider text-white/70">days to event</span>
                {selectedEvent && (
                  <span className="mt-1 max-w-30 truncate text-[10px] text-white/60">{selectedEvent.eventName}</span>
                )}
              </div>
            )}
          </div>
        </div>
        <span className="pointer-events-none absolute -right-12 -top-12 size-48 rounded-full bg-white/6" />
        <span className="pointer-events-none absolute -bottom-16 -right-8 size-64 rounded-full bg-white/4" />
      </div>

      {/* Command stats grid */}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <CommandStat
          label="Active events"
          value={events.length}
          icon={CalendarDays}
          accent="text-(--prism-signal)"
          onClick={() => onNavigateSection("events-list")}
        />
        <CommandStat
          label="Pending inquiries"
          value={unreviewedInquiries}
          icon={FileCheck2}
          accent="text-(--prism-amber)"
          onClick={() => onNavigateSection("inquiries")}
        />
        <CommandStat
          label="Pending approvals"
          value={pendingApprovals.length}
          icon={ShieldCheck}
          accent="text-(--prism-success)"
        />
        <CommandStat
          label="Defense score"
          value={defenseReadiness ? `${defenseReadiness.score}%` : "—"}
          icon={CheckCircle2}
          accent="text-(--prism-signal)"
        />
      </div>

      {/* Events + recent activity */}
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
        <EventQueueCard
          events={events}
          selectedEventId={selectedEvent?.id}
          onSelectEvent={(id) => onNavigateEvent(id)}
          onReset={onReset}
          onNavigateEvent={(id) => onNavigateEvent(id, "overview")}
        />

        <div className="space-y-4">
          {/* Pending approvals inline */}
          {pendingApprovals.length > 0 && (
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <ShieldCheck className="size-4 text-(--prism-signal)" />
                  <h3 className="text-sm font-bold text-foreground">Pending approvals</h3>
                  <Badge className="ml-auto rounded-full bg-(--prism-amber-soft) px-2 py-0.5 text-[10px] font-bold text-(--prism-amber)">
                    {pendingApprovals.length}
                  </Badge>
                </div>
              </CardHeader>
              <div className="divide-y divide-border">
                {pendingApprovals.slice(0, 3).map((req) => (
                  <div key={req.id} className="px-6 py-3.5">
                    <p className="truncate text-sm font-bold text-foreground">{req.name}</p>
                    <p className="text-xs text-muted-foreground">{req.email} — {lbl(req.role)}</p>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {/* Recent activity */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Sparkles className="size-4 text-(--prism-signal)" />
                <h3 className="text-sm font-bold text-foreground">Recent activity</h3>
              </div>
            </CardHeader>
            {recentAudit.length > 0 ? (
              <div className="divide-y divide-border">
                {recentAudit.map((item) => (
                  <div key={item.id} className="flex items-start gap-3 px-6 py-3.5">
                    <span className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-full bg-muted text-[10px] font-bold text-foreground">
                      {item.actor.slice(0, 2).toUpperCase()}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-foreground line-clamp-1">{item.action}</p>
                      <p className="text-xs text-muted-foreground">{item.actor} — {item.createdAt}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <CardBody>
                <p className="text-sm text-muted-foreground">Actions and system events will appear here.</p>
              </CardBody>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}

/* ── Main dashboard export ─────────────────────────────────── */

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
  const [selectedEventId, setSelectedEventId] = useState<string | null>(routeState.eventId ?? null);
  const [section, setSection] = useState<DashboardSection>(routeState.section);
  const [tab, setTab] = useState<DetailTab>(routeState.tab);
  const [sidebarActiveOverride, setSidebarActiveOverride] = useState<string | null>(null);
  const [approvalRequests, setApprovalRequests] = useState<MvpApprovalRequest[]>([]);
  const [liveOps, setLiveOps] = useState<MvpLiveOps | null>(null);
  const [statusFeed, setStatusFeed] = useState<MvpEventDayStatusFeed | null>(null);
  const [defenseReadiness, setDefenseReadiness] = useState<MvpDefenseReadiness | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  async function refresh(current = session) {
    if (!current) return;
    if (current.role === "coordinator") {
      const next = await loadCoordinatorWorkspace(current, true);
      setCoordinatorState(next);
      setState(null);
      return;
    }
    if (current.role !== "pmcm-admin") return;
    const [next, requests] = await Promise.all([
      loadPmcmState(true),
      loadApprovalRequests(true),
    ]);
    setState(next);
    setApprovalRequests(requests);
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

    if (cachedState) {
      setState(cachedState.value);
      setCoordinatorState(null);
    }
    if (cachedApprovals) {
      setApprovalRequests(cachedApprovals.value);
    }

    const stateIsFresh = cachedState && isFresh(cachedState.loadedAt);
    const approvalsAreFresh = cachedApprovals && isFresh(cachedApprovals.loadedAt);
    if (stateIsFresh && approvalsAreFresh) {
      return () => {
        cancelled = true;
      };
    }

    Promise.all([
      stateIsFresh ? Promise.resolve(cachedState.value) : loadPmcmState(!cachedState),
      approvalsAreFresh ? Promise.resolve(cachedApprovals.value) : loadApprovalRequests(!cachedApprovals),
    ])
      .then(([next, requests]) => {
        if (cancelled) return;
        setState(next);
        setApprovalRequests(requests);
        setCoordinatorState(null);
        setError(null);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Unable to load event portal");
      });

    return () => {
      cancelled = true;
    };
  }, [router]);

  useEffect(() => {
    setSection(routeState.section);
    setTab(routeState.tab);
    if (routeState.eventId) setSelectedEventId(routeState.eventId);
  }, [routeState.eventId, routeState.section, routeState.tab]);

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
  const documents = (state?.documents ?? []).filter((item) => item.eventId === selectedEvent?.id);
  const postEventDocuments = (state?.postEventDocuments ?? []).filter((item) => item.eventId === selectedEvent?.id);
  const eventInsights = (state?.eventInsights ?? []).filter((item) => item.eventId === selectedEvent?.id);
  const notificationLogs = (state?.notificationLogs ?? [])
    .filter((item) => !item.eventId || item.eventId === selectedEvent?.id)
    .slice(0, 8);
  const briefing = state?.briefings.find((item) => item.eventId === selectedEvent?.id);
  const selectedInquiry = state?.inquiries.find((item) => item.id === selectedEvent?.inquiryId);
  const audit = (state?.auditLogs ?? []).filter((item) => item.eventId === selectedEvent?.id || !item.eventId).slice(0, 14);
  const activeDraft = drafts.find((d) => d.isActive);
  const pendingApprovals = approvalRequests.filter((req) => req.status === "pending");

  useEffect(() => {
    if (!session || screen.name !== "portal") return;

    router.prefetch("/dashboard");
    router.prefetch("/dashboard/inquiries");
    router.prefetch("/dashboard/events");
    router.prefetch("/dashboard/clients");
    router.prefetch("/dashboard/calendar");
    router.prefetch("/dashboard/tasks");
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

  async function createPreset(preset: Preset) {
    if (!selectedEvent) return;
    const draft = await mvpApi.createFloorPlanDraft(selectedEvent.id, {
      name: `${preset.name} PMCM draft`,
      sourceType: preset.id === "blank" ? "blank" : "preset",
      width: 30, height: 20, gridSize: 1,
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
    setSidebarActiveOverride(null);
    setSection("events");
    setSelectedEventId(eventId);
    setTab(nextTab);
    router.push(eventRoute(eventId, nextTab));
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
    if (nextSection === "clients") { router.push("/dashboard/clients"); return; }
    if (nextSection === "calendar") { router.push("/dashboard/calendar"); return; }
    if (nextSection === "tasks") { router.push("/dashboard/tasks"); return; }
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
    switch (id) {
      case "command-home": router.push("/dashboard"); setSection("events"); return;
      case "command-inquiries": navigateSection("inquiries", { preserveSidebarActive: true }); return;
      case "command-events": navigateSection("events-list", { preserveSidebarActive: true }); return;
      case "client-desk": navigateSection("clients", { preserveSidebarActive: true }); return;
      case "calendar-desk": navigateSection("calendar", { preserveSidebarActive: true }); return;
      case "task-desk": navigateSection("tasks", { preserveSidebarActive: true }); return;
      case "team-desk": navigateSection("team", { preserveSidebarActive: true }); return;
      case "file-hub": navigateSection("files", { preserveSidebarActive: true }); return;
      case "command-messages": navigateSection("messages", { preserveSidebarActive: true }); return;
      case "finance-desk": navigateSection("finance", { preserveSidebarActive: true }); return;
      case "event-overview": navigateEventTab("overview", { preserveSidebarActive: true }); return;
      case "event-briefing": navigateEventTab("briefing", { preserveSidebarActive: true }); return;
      case "event-floorplans": navigateEventTab("floorplans", { preserveSidebarActive: true }); return;
      case "event-suppliers": navigateEventTab("suppliers", { preserveSidebarActive: true }); return;
      case "event-coordinators": navigateEventTab("coordinators", { preserveSidebarActive: true }); return;
      case "event-live-ops": navigateEventTab("live-ops", { preserveSidebarActive: true }); return;
      case "event-billing": navigateEventTab("billing", { preserveSidebarActive: true }); return;
      case "event-messages": navigateEventTab("activity", { preserveSidebarActive: true }); return;
      case "event-closure": navigateEventTab("closure", { preserveSidebarActive: true }); return;
      case "supplier-directory": navigateSection("suppliers", { preserveSidebarActive: true }); return;
      case "audit-log": navigateSection("audit", { preserveSidebarActive: true }); return;
      case "settings": navigateSection("settings", { preserveSidebarActive: true }); return;
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
      <CoordinatorView session={session} state={coordinatorState} onRefresh={() => refresh(session)} />
    );
  }

  /* PMCM loading */
  if (!state) {
    const loadingVariant = eventDashboardSkeletonVariant(routeState);
    const loadingTitle =
      routeState.section === "suppliers"
        ? "Supplier Directory"
        : routeState.section === "audit"
          ? "Audit Trail"
          : routeState.section === "clients"
            ? "Client Desk"
          : routeState.section === "calendar"
            ? "Calendar"
          : routeState.section === "tasks"
            ? "Tasks"
          : routeState.section === "team"
            ? "Team & Coordinators"
          : routeState.section === "files"
            ? "Event File Hub"
          : routeState.section === "messages"
            ? "Event Messages"
          : routeState.section === "finance"
            ? "Finance Desk"
          : routeState.section === "inquiries"
            ? "Inquiry Intake"
          : routeState.section === "events-list"
            ? "All Events"
          : routeState.section === "settings"
            ? "Settings"
          : routeState.eventId
            ? "Event workspace"
            : "Event Manager";
    const loadingEyebrow =
      routeState.section === "suppliers"
        ? "Supplier directory"
        : routeState.section === "audit"
          ? "Audit log"
          : routeState.section === "clients"
            ? "Clients"
          : routeState.section === "calendar"
            ? "Calendar"
          : routeState.section === "tasks"
            ? "Tasks"
          : routeState.section === "team"
            ? "Team"
          : routeState.section === "files"
            ? "Files"
          : routeState.section === "messages"
            ? "Messages"
          : routeState.section === "finance"
            ? "Finance"
          : routeState.section === "inquiries"
            ? "Inquiries"
          : routeState.section === "events-list"
            ? "Events"
          : routeState.section === "settings"
            ? "Settings"
          : routeState.eventId
            ? "Event workspace"
            : "Command home";

    return (
      <PrismDashboardShell
        productLabel="P.R.I.S.M"
        roleLabel="PMCM Event Command"
        eyebrow={loadingEyebrow}
        title={loadingTitle}
        description="Loading the PMCM event command data, route context, and workspace queue."
        activeItemId={activeSidebarItemFromRoute(routeState)}
        navItems={loadingShellNavItems(Boolean(routeState.eventId))}
        onNavSelect={handleSidebarNav}
        user={{ name: session.name, detail: lbl(session.role), initials: session.name.slice(0, 2).toUpperCase() }}
        searchPlaceholder="Search events, suppliers, inquiries..."
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

  const activeSidebarItemId =
    section === "suppliers" ? "supplier-directory"
    : section === "audit" ? "audit-log"
    : section === "clients" ? "client-desk"
    : section === "calendar" ? "calendar-desk"
    : section === "tasks" ? "task-desk"
    : section === "team" ? "team-desk"
    : section === "files" ? "file-hub"
    : section === "messages" ? "command-messages"
    : section === "finance" ? "finance-desk"
    : section === "settings" ? "settings"
    : section === "inquiries" ? "command-inquiries"
    : section === "events-list" ? "command-events"
    : routeState.eventId
      ? ({
          overview: "event-overview",
          floorplans: "event-floorplans",
          briefing: "event-briefing",
          suppliers: "event-suppliers",
          coordinators: "event-coordinators",
          "live-ops": "event-live-ops",
          billing: "event-billing",
          closure: "event-closure",
          activity: "event-messages",
        } satisfies Record<DetailTab, string>)[tab]
      : "command-home";

  const shellNavItems = [
    { id: "command-home", icon: Home, label: "Dashboard", section: "Command" },
    { id: "client-desk", icon: CircleUserRound, label: "Clients", section: "Directories", badge: state.inquiries.length || undefined },
    { id: "command-events", icon: CalendarDays, label: "Events", section: "Command" },
    { id: "calendar-desk", icon: CalendarClock, label: "Calendar", section: "Command" },
    { id: "task-desk", icon: ClipboardCheck, label: "Tasks", section: "Command", badge: openActionCount || undefined },
    { id: "file-hub", icon: FileText, label: "Files", section: "Operations", disabled: eventWorkspaceDisabled },
    { id: "team-desk", icon: UsersRound, label: "Team", section: "Directories", badge: coordinators.length || undefined },
    { id: "command-messages", icon: MessageSquareText, label: "Message", section: "Operations", disabled: eventWorkspaceDisabled },
    { id: "audit-log", icon: ShieldCheck, label: "Reports", section: "Admin" },
    { id: "settings", icon: Settings, label: "Settings", section: "Admin" },
    { id: "command-inquiries", icon: FileCheck2, label: "Inquiries", section: "Command", badge: unreviewedInquiries || undefined },
    { id: "supplier-directory", icon: Tags, label: "Suppliers", section: "Directories" },
    { id: "finance-desk", icon: ReceiptText, label: "Finance", section: "Operations", badge: payments.length || undefined, disabled: eventWorkspaceDisabled },
    { id: "event-overview", icon: LayoutGrid, label: "Overview", section: "Event Workspace", disabled: eventWorkspaceDisabled },
    { id: "event-briefing", icon: FileCheck2, label: "Briefing", section: "Event Workspace", disabled: eventWorkspaceDisabled },
    { id: "event-floorplans", icon: MapPinned, label: "Floor Plans", section: "Event Workspace", badge: drafts.length || undefined, disabled: eventWorkspaceDisabled },
    { id: "event-suppliers", icon: Truck, label: "Suppliers", section: "Event Workspace", badge: quotes.length || undefined, disabled: eventWorkspaceDisabled },
    { id: "event-coordinators", icon: UserCheck, label: "Coordinators", section: "Event Workspace", badge: assignments.length || undefined, disabled: eventWorkspaceDisabled },
    { id: "event-live-ops", icon: Radio, label: "Live Ops", section: "Event Workspace", disabled: eventWorkspaceDisabled },
    { id: "event-billing", icon: ReceiptText, label: "Billing", section: "Event Workspace", badge: payments.length || undefined, disabled: eventWorkspaceDisabled },
    { id: "event-messages", icon: MessageSquareText, label: "Messages", section: "Event Workspace", disabled: eventWorkspaceDisabled },
    { id: "event-closure", icon: Archive, label: "Closure", section: "Event Workspace", badge: openCheckCount || undefined, disabled: eventWorkspaceDisabled },
  ];

  /* Section routing flags */
  const isHome = section === "events" && !routeState.eventId;
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
        : isClients ? "Client Desk"
        : isCalendar ? "Calendar"
        : isTasks ? "Task Queue"
        : isTeam ? "Team & Coordinators"
        : isFiles ? "Event File Hub"
        : isMessages ? "Event Messages"
        : isFinance ? "Finance Desk"
        : isSettings ? "Settings"
        : isInquiries ? "Inquiry Intake"
        : isEventsList ? "All Events"
        : selectedEvent?.eventName ?? "Event Manager"
      }
      description={
        section === "suppliers" ? "Master supplier directory with category tagging, tiering, and performance reviews."
        : section === "audit" ? "Complete audit trail of all actions, approvals, and system events."
        : isClients ? "Client intake, conforme status, approval requests, and portal readiness."
        : isCalendar ? "Event dates, planning windows, supplier deadlines, and onsite schedule checkpoints."
        : isTasks ? "PMCM actions across inquiries, approvals, planning, finance, live operations, and closure."
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
      onNavSelect={handleSidebarNav}
      user={{ name: session.name, detail: lbl(session.role), initials: session.name.slice(0, 2).toUpperCase() }}
      searchPlaceholder="Search events, suppliers, inquiries..."
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
        ) : isSettings ? (
          <EventSettingsWorkspace session={session} selectedEvent={selectedEvent} />
        ) : isClients ? (
          <>
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
                mvpApi.assignCoordinator(selectedEvent.id, { coordinatorId: coordinator.id, role, overrideConflict: override })
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
              onRecordPayment={(milestoneId, input) => run("record payment", () => mvpApi.recordPayment(selectedEvent.id, milestoneId, input))}
              onSendBilling={(billingId) => run("send billing", () => mvpApi.sendBillingStatement(selectedEvent.id, billingId))}
            />
          ) : (
            <EmptyState icon={ReceiptText} title="Select an event" description="Finance opens inside a confirmed event so billing can stay tied to proposal and conforme records." />
          )
        ) : section === "suppliers" ? (
          <SupplierDirectory
            categories={supplierCategories}
            suppliers={suppliers}
            onToggleBni={(supplier, value) => run("supplier BNI flag", () => mvpApi.updateSupplier(supplier.id, { bniMember: value }))}
            onCreateSupplier={(input) => run("create supplier", () => mvpApi.createSupplier(input))}
            onUpdateSupplier={(supplierId, input) => run("update supplier", () => mvpApi.updateSupplier(supplierId, input))}
            onChangeTier={(supplierId, tier, reason) => run("supplier tier change", () => mvpApi.changeSupplierTier(supplierId, { tier, reason }))}
            onAddReview={(supplierId, input) => run("supplier private review", () => mvpApi.addSupplierReview(supplierId, { ...input, eventId: selectedEvent?.id }))}
            onAddCertification={(supplierId, input) => run("supplier certification", () => mvpApi.addSupplierCertification(supplierId, input))}
            onOpenEvent={(eventId) => navigateEvent(eventId, "overview")}
            busy={Boolean(busy)}
          />
        ) : section === "audit" ? (
          <AuditTrailPanel events={events} users={state.users} session={session} />
        ) : isInquiries ? (
          <>
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
          </>
        ) : isEventsList ? (
          <EventQueueCard
            events={events}
            selectedEventId={selectedEvent?.id}
            onSelectEvent={(id) => navigateEvent(id)}
            onReset={() => run("reset", mvpApi.reset)}
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
              onReset={() => run("reset", mvpApi.reset)}
            />

            {/* Inquiry + onboarding below the command grid */}
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
                          {lbl(request.role)} — {request.organization}
                        </p>
                      </div>
                      <div className="flex shrink-0 flex-wrap gap-2">
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
                    <StatusBadge status={selectedEvent.floorPlanStatus} label={`Floorplan ${lbl(selectedEvent.floorPlanStatus)}`} />
                    {defenseReadiness && (
                      <StatusBadge
                        status={defenseReadiness.overallStatus === "ready" ? "completed" : defenseReadiness.overallStatus === "blocked" ? "open" : "pending"}
                        label={`Defense ${defenseReadiness.score}%`}
                      />
                    )}
                  </div>
                </div>
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
                  onSubmitBriefing={() => run("briefing", () => mvpApi.submitBriefing(selectedEvent.id))}
                  onOpenSupplierDesk={() => navigateEventTab("suppliers")}
                  onRunCompliance={() => run("compliance", () => mvpApi.runCompliance(selectedEvent.id, "planning"))}
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
                      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                        {PRESETS.slice(0, 4).map((preset) => (
                          <button
                            key={preset.id}
                            onClick={() => run("create floorplan", () => createPreset(preset))}
                            className="rounded-xl border border-border bg-muted/30 p-4 text-left transition hover:border-(--prism-signal)/40 hover:bg-(--prism-signal-soft)"
                          >
                            <p className="text-sm font-bold text-foreground">{preset.name}</p>
                            <p className="mt-1 text-xs leading-5 text-muted-foreground">{preset.description}</p>
                          </button>
                        ))}
                      </div>
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
                        <EmptyState icon={LayoutGrid} title="No floorplan drafts yet" description="Pick a preset above to create the first PMCM draft for this event." />
                      ) : (
                        <div className="space-y-4">
                          {drafts.map((draft) => (
                            <div key={draft.id} className="rounded-xl border border-border bg-muted/20 p-4">
                              <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                  <p className="truncate text-sm font-bold text-foreground">{draft.name}</p>
                                  <p className="mt-0.5 text-xs text-muted-foreground">{lbl(draft.sourceType)} — {draft.createdByRole ?? "pmcm-admin"}</p>
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
                                  <Button size="sm" className="rounded-lg font-bold" onClick={() => run("submit draft", () => mvpApi.submitFloorPlanDraft(selectedEvent.id, draft.id))}>
                                    Submit
                                  </Button>
                                )}
                                {draft.status !== "approved" && (
                                  <Button size="sm" variant="outline" className="rounded-lg border-(--prism-success)/25 bg-(--prism-success)/8 font-bold text-(--prism-success) hover:bg-(--prism-success)/15" onClick={() => run("approve draft", () => mvpApi.approveFloorPlanDraft(selectedEvent.id, draft.id))}>
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
                      <EmptyState icon={FileCheck2} title="No briefing submitted yet" description="Use the quick action to submit a demo briefing for this event." />
                    )}
                  </CardBody>
                </Card>
              )}

              {tab === "suppliers" && (
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
                      onRequestQuotes={(input) => run("request supplier quotes", () => mvpApi.requestSupplierQuotes(selectedEvent.id, input))}
                      onSelectQuote={(quoteId) => run("select supplier quote", () => mvpApi.selectSupplierQuote(selectedEvent.id, quoteId))}
                      busy={Boolean(busy)}
                    />
                  </CardBody>
                </Card>
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
                  onCreateTask={(input) => runLiveOps("create task", () => mvpApi.createEventDayTask(selectedEvent.id, input))}
                  onUpdateTask={(taskId, input) => runLiveOps("update task", () => mvpApi.updateEventDayTask(selectedEvent.id, taskId, input))}
                  onEscalateTask={(taskId, input) => runLiveOps("escalate task", () => mvpApi.escalateEventDayTask(selectedEvent.id, taskId, input))}
                  onCreateIssue={(input) => runLiveOps("create issue", () => mvpApi.createUrgentIssue(selectedEvent.id, input))}
                  onUpdateIssue={(issueId, input) => runLiveOps("update issue", () => mvpApi.updateUrgentIssue(selectedEvent.id, issueId, input))}
                  onEscalateIssue={(issueId, input) => runLiveOps("escalate issue", () => mvpApi.escalateUrgentIssue(selectedEvent.id, issueId, input))}
                  onUpdateCoordinatorAttendance={(assignmentId, input) => runLiveOps("attendance", () =>
                    mvpApi.updateCoordinatorAttendance(selectedEvent.id, assignmentId, { ...input, markedBy: session.name })
                  )}
                  onReplaceCoordinator={(assignmentId, input) => runLiveOps("replace coordinator", () =>
                    mvpApi.replaceCoordinator(selectedEvent.id, assignmentId, input)
                  )}
                  onVerifySupplierStatus={(requestId, input) => runLiveOps("verify supplier", () =>
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
                  onSendBilling={(billingId) => run("send billing", () => mvpApi.sendBillingStatement(selectedEvent.id, billingId))}
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
                  onApproveBillingSource={(sourceId) => run("approve billing source", () => mvpApi.approveBillingSource(selectedEvent.id, sourceId, "Approved by PMCM."))}
                  onGenerateBillingStatement={(sourceId) => run("generate billing statement", () => mvpApi.generateBillingStatement(selectedEvent.id, sourceId))}
                  onLoadCloseGates={() => mvpApi.closeGates(selectedEvent.id)}
                  onArchive={(reason) => run("archive event", () => mvpApi.archiveEvent(selectedEvent.id, reason))}
                  onLoadInsights={() => mvpApi.eventInsights(selectedEvent.id)}
                  onGenerateInsights={() => run("generate insights", () => mvpApi.generateEventInsights(selectedEvent.id))}
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
    </PrismDashboardShell>
  );
}
