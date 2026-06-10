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
  Share2,
  Tags,
  Truck,
  Upload,
  UsersRound,
  type LucideIcon,
} from "lucide-react";
import {
  prismApi,
  type PrismAuditLog,
  type PrismApprovalRequest,
  type PrismBillingStatement,
  type PrismBriefing,
  type PrismComplianceCheck,
  type PrismCoordinatorWorkspace,
  type PrismDefenseReadiness,
  type PrismDemoState,
  type PrismDocument,
  type PrismEvent,
  type PrismEventDayStatusFeed,
  type PrismFloorPlanDraft,
  type PrismLiveOps,
  type PrismNotificationLog,
  type PrismPostEventDocument,
  type PrismSupplierQuoteRequest,
} from "@/lib/prism-api";
import { PrismDashboardShell, type PrismNavItem } from "@prism/ui";
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
  PAREPanel,
  Phase4Workspace,
  SupplierDirectory,
  SupplierQuotePlanner,
} from "@/app/components/pmcm";
import {
  EventOverviewPanels,
} from "@/app/components/pmcm/event-command-cockpit";
import { cloneTemplateObjects, loadTemplates, type FloorPlanTemplate } from "@/app/components/editor/templates";
import type { Project } from "@/app/components/editor/types";
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
} from "@/features/event-dashboard/event-dashboard.selectors";
import {
  CLIENT_DETAIL_ROUTES,
  EVENT_DETAIL_ROUTES,
  EVENT_TAB_ROUTES,
  EVENT_WORKSPACE_ROUTE_ITEMS,
  EVENT_WORKSPACE_ROUTE_TABS,
  SIDEBAR_STATIC_ROUTES,
  routeStateFromPath,
} from "@/features/event-dashboard/event-dashboard.routing";
import type {
  DashboardSection,
  DetailTab,
  EventDashboardClientProps,
  RouteState,
} from "@/features/event-dashboard/event-dashboard.routing";

export type { EventDashboardClientProps };

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
  | { name: "editor"; event: PrismEvent; draft: PrismFloorPlanDraft; project: Project };

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

type TimedCache<T> = { value: T; loadedAt: number };
type EventCommandData = {
  liveOps: PrismLiveOps;
  statusFeed: PrismEventDayStatusFeed;
  defenseReadiness: PrismDefenseReadiness;
};

const EVENT_DASHBOARD_CACHE_MS = 30_000;
const EVENT_WORKSPACE_CACHE_MS = 20_000;

let pmcmStateCache: TimedCache<PrismDemoState> | null = null;
let pmcmStateRequest: Promise<PrismDemoState> | null = null;
let approvalRequestsCache: TimedCache<PrismApprovalRequest[]> | null = null;
let approvalRequestsRequest: Promise<PrismApprovalRequest[]> | null = null;
const coordinatorWorkspaceCache = new Map<string, TimedCache<PrismCoordinatorWorkspace>>();
const coordinatorWorkspaceRequests = new Map<string, Promise<PrismCoordinatorWorkspace>>();
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

  pmcmStateRequest = prismApi
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

  approvalRequestsRequest = prismApi
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

  const request = prismApi
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
    prismApi.liveOps(eventId),
    prismApi.eventDayStatusFeed(eventId),
    prismApi.defenseReadiness(eventId),
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
  return (
    <div
      className={`animate-pulse rounded-md bg-gradient-to-r from-muted/80 via-muted/50 to-muted/80 ring-1 ring-border/30 ${className}`}
    />
  );
}

function SkeletonCard({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <section
      className={`relative overflow-hidden rounded-xl border border-border/80 bg-card/95 p-4 shadow-sm ring-1 ring-black/5 sm:p-5 ${className}`}
    >
      <span className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-(--prism-signal)/60 via-transparent to-transparent" />
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
      <section className="w-full max-w-sm rounded-xl border border-border/80 bg-card/95 p-5 shadow-sm ring-1 ring-black/5">
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
          <div className="mt-5 grid gap-2 sm:grid-cols-4">
            {Array.from({ length: 4 }).map((_, index) => (
              <SkeletonLine key={index} className="h-9 rounded-full" />
            ))}
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
            <SkeletonLine key={index} className="h-9 w-28 rounded-full" />
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
  if (routeState.section === "dashboard") return "dashboard";
  if (routeState.section === "suppliers") return "suppliers";
  if (routeState.section === "audit") return "audit";
  if (routeState.section === "clients") return "clients";
  if (routeState.section === "calendar") return "calendar";
  if (routeState.section === "tasks") return "tasks";
  if (routeState.section === "team") return routeState.eventId ? "event-staff" : "dashboard";
  if (routeState.section === "files") return routeState.eventId ? "event-files" : "dashboard";
  if (routeState.section === "messages") return routeState.eventId ? "event-messages" : "dashboard";
  if (routeState.section === "finance") return routeState.eventId ? "event-budget" : "dashboard";
  if (routeState.section === "settings") return "settings";
  if (routeState.section === "inquiries") return "inquiries";
  if (routeState.section === "events-list") return "events-list";
  if (!routeState.eventId) return "dashboard";

  return EVENT_WORKSPACE_ROUTE_ITEMS[routeState.view ?? "overview"] ?? EVENT_WORKSPACE_ROUTE_ITEMS[EVENT_TAB_ROUTES[routeState.tab]] ?? "event-overview";
}

function loadingShellNavItems(hasEvent: boolean): PrismNavItem[] {
  return eventPortalNavItems({ hasEvent });
}

function eventPortalNavItems({
  hasEvent,
  eventName,
  inquiryCount,
  taskCount,
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

function auditMessage(item: PrismAuditLog): EventMessage {
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

function outboundMessage(item: PrismNotificationLog): EventMessage {
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
  event: PrismEvent;
  audit: PrismAuditLog[];
  notificationLogs: PrismNotificationLog[];
}): EventMessageThread[] {
  const clientAudit = audit.filter((item) =>
    /client|briefing|conforme|proposal|billing|floor/i.test(`${item.actorRole} ${item.action} ${item.category}`),
  );
  const coordinatorAudit = audit.filter((item) => /coordinator|assignment|event day/i.test(`${item.action} ${item.category}`));
  const supplierAudit = audit.filter((item) => /supplier|quote|Supplier/i.test(`${item.action} ${item.category}`));

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
  event: PrismEvent;
  session: EventSession;
  audit: PrismAuditLog[];
  notificationLogs: PrismNotificationLog[];
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

function EventFilePreview({ event, item }: { event: PrismEvent; item: EventFileHubItem }) {
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
  event: PrismEvent;
  documents: PrismDocument[];
  drafts: PrismFloorPlanDraft[];
  billingStatements: PrismBillingStatement[];
  quoteRequests: PrismSupplierQuoteRequest[];
  briefing?: PrismBriefing;
  checks: PrismComplianceCheck[];
  postEventDocuments: PrismPostEventDocument[];
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
  events: PrismEvent[];
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
  pendingApprovals: PrismApprovalRequest[];
  selectedEvent?: PrismEvent;
  defenseReadiness: PrismDefenseReadiness | null;
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
          <h2 className="text-sm font-black text-foreground">Event next actions</h2>
        </CardHeader>
        <CardBody className="space-y-3">
          {nextActions.length ? nextActions.slice(0, 5).map((action) => (
            <div key={action.key} className="rounded-md border border-border bg-muted/20 px-3 py-2">
              <p className="text-xs font-black text-foreground">{action.label}</p>
              <p className="mt-1 text-xs text-muted-foreground">{action.detail}</p>
            </div>
          )) : (
            <EmptyState icon={CheckCircle2} title="No open blockers" description="The selected event has no current readiness action items." />
          )}
        </CardBody>
      </Card>
    </div>
  );
}

function EventSettingsWorkspace({ session, selectedEvent }: { session: EventSession; selectedEvent?: PrismEvent }) {
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
  events: PrismEvent[];
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
  state: PrismDemoState;
  events: PrismEvent[];
  selectedEvent?: PrismEvent;
  unreviewedInquiries: number;
  pendingApprovals: PrismApprovalRequest[];
  defenseReadiness: PrismDefenseReadiness | null;
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
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
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
      </div>

      {/* Events + approvals */}
      <div className={`grid gap-5 ${pendingApprovals.length > 0 ? "xl:grid-cols-[minmax(0,1fr)_340px]" : ""}`}>
        <EventQueueCard
          events={events}
          selectedEventId={selectedEvent?.id}
          onSelectEvent={(id) => onNavigateEvent(id)}
          onReset={onReset}
          onNavigateEvent={(id) => onNavigateEvent(id, "overview")}
        />

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
                  <p className="text-xs text-muted-foreground">{req.email} - {lbl(req.role)}</p>
                </div>
              ))}
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}

/* ── Main dashboard export ─────────────────────────────────── */

export default function EventDashboard({
  section: initialSection,
  tab: initialTab,
  eventId: initialEventId,
  clientId: initialClientId,
  view: initialView,
}: EventDashboardClientProps = {}) {
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
  const [state, setState] = useState<PrismDemoState | null>(null);
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
    const draft = await prismApi.createFloorPlanDraft(selectedEvent.id, {
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
    const project = await prismApi.loadPlan(draft.floorPlanId);
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
          onSave={(project) => prismApi.savePlan(project)}
          onSubmit={async (project) => {
            await prismApi.savePlan(project);
            await prismApi.submitFloorPlanDraft(screen.event.id, screen.draft.id);
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
        sidebarMode="single"
        onNavSelect={handleSidebarNav}
        user={{ name: session.name, detail: lbl(session.role), initials: session.name.slice(0, 2).toUpperCase() }}
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
    assignmentCount: assignments.length,
    quoteCount: quotes.length,
    draftCount: drafts.length,
    paymentCount: payments.length,
    closeoutCount: openCheckCount,
  });
  const activeNavItem = shellNavItems.find((item) => item.id === activeSidebarItemId);

  /* Section routing flags */
  const isHome = section === "dashboard";
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
        : isClients ? activeNavItem?.label ?? "Client Desk"
        : isCalendar ? activeNavItem?.label ?? "Calendar"
        : isTasks ? activeNavItem?.label ?? "Task Queue"
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
      user={{ name: session.name, detail: lbl(session.role), initials: session.name.slice(0, 2).toUpperCase() }}
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
              onAccept={(inq) => run("accept inquiry", () => prismApi.acceptInquiry(inq.id))}
              onPend={(inq) => run("pend inquiry", () => prismApi.pendInquiry(inq.id))}
              onDecline={(inq, reason) => run("decline inquiry", () => prismApi.declineInquiry(inq.id, reason))}
              busy={Boolean(busy)}
            />
            <ClientOnboardingTracker
              inquiries={state.inquiries}
              onUploadConforme={(inq) => run("upload conforme", () => prismApi.uploadConforme(inq.id))}
              onSendReminder={(inq) => run("conforme reminder", () => prismApi.sendConformeReminder(inq.id))}
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
                prismApi.assignCoordinator(selectedEvent.id, { coordinatorId: coordinator.id, role, overrideConflict: override })
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
              onRecordPayment={(milestoneId, input) => run("record payment", () => prismApi.recordPayment(selectedEvent.id, milestoneId, input))}
              onSendBilling={(billingId) => run("send billing", () => prismApi.sendBillingStatement(selectedEvent.id, billingId))}
            />
          ) : (
            <EmptyState icon={ReceiptText} title="Select an event" description="Finance opens inside a confirmed event so billing can stay tied to proposal and conforme records." />
          )
        ) : section === "suppliers" ? (
          <SupplierDirectory
            categories={supplierCategories}
            suppliers={suppliers}
            onToggleBni={(supplier, value) => run("supplier BNI flag", () => prismApi.updateSupplier(supplier.id, { bniMember: value }))}
            onCreateSupplier={(input) => run("create supplier", () => prismApi.createSupplier(input))}
            onUpdateSupplier={(supplierId, input) => run("update supplier", () => prismApi.updateSupplier(supplierId, input))}
            onChangeTier={(supplierId, tier, reason) => run("supplier tier change", () => prismApi.changeSupplierTier(supplierId, { tier, reason }))}
            onAddReview={(supplierId, input) => run("supplier private review", () => prismApi.addSupplierReview(supplierId, { ...input, eventId: selectedEvent?.id }))}
            onAddCertification={(supplierId, input) => run("supplier certification", () => prismApi.addSupplierCertification(supplierId, input))}
            onOpenEvent={(eventId) => navigateEvent(eventId, "overview")}
            busy={Boolean(busy)}
          />
        ) : section === "audit" ? (
          <AuditTrailPanel events={events} users={state.users} session={session} />
        ) : isInquiries ? (
          <>
            <InquiryIntakeLog
              inquiries={state.inquiries}
              onAccept={(inq) => run("accept inquiry", () => prismApi.acceptInquiry(inq.id))}
              onPend={(inq) => run("pend inquiry", () => prismApi.pendInquiry(inq.id))}
              onDecline={(inq, reason) => run("decline inquiry", () => prismApi.declineInquiry(inq.id, reason))}
              busy={Boolean(busy)}
            />
            <ClientOnboardingTracker
              inquiries={state.inquiries}
              onUploadConforme={(inq) => run("upload conforme", () => prismApi.uploadConforme(inq.id))}
              onSendReminder={(inq) => run("conforme reminder", () => prismApi.sendConformeReminder(inq.id))}
              busy={Boolean(busy)}
            />
          </>
        ) : isEventsList ? (
          <EventQueueCard
            events={eventsForView}
            selectedEventId={selectedEvent?.id}
            onSelectEvent={(id) => navigateEvent(id)}
            onReset={() => run("reset", prismApi.reset)}
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
              onReset={() => run("reset", prismApi.reset)}
            />

            {/* Inquiry + onboarding below the command grid */}
            <InquiryIntakeLog
              inquiries={state.inquiries}
              onAccept={(inq) => run("accept inquiry", () => prismApi.acceptInquiry(inq.id))}
              onPend={(inq) => run("pend inquiry", () => prismApi.pendInquiry(inq.id))}
              onDecline={(inq, reason) => run("decline inquiry", () => prismApi.declineInquiry(inq.id, reason))}
              busy={Boolean(busy)}
            />

            <ClientOnboardingTracker
              inquiries={state.inquiries}
              onUploadConforme={(inq) => run("upload conforme", () => prismApi.uploadConforme(inq.id))}
              onSendReminder={(inq) => run("conforme reminder", () => prismApi.sendConformeReminder(inq.id))}
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
                        <Button size="sm" disabled={!!busy} onClick={() => run("approve account", () => prismApi.approveApprovalRequest(request.id))} className="rounded-lg font-bold">
                          Approve
                        </Button>
                        <Button size="sm" variant="outline" disabled={!!busy} onClick={() => run("decline account", () => prismApi.declineApprovalRequest(request.id))} className="rounded-lg font-bold">
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
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" className="rounded-lg font-bold" onClick={() => run("briefing", () => prismApi.submitBriefing(selectedEvent.id))}>
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
                  onSubmitBriefing={() => run("briefing", () => prismApi.submitBriefing(selectedEvent.id))}
                  onOpenSupplierDesk={() => navigateEventTab("suppliers")}
                  onRunCompliance={() => run("compliance", () => prismApi.runCompliance(selectedEvent.id, "planning"))}
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
                                  <Button size="sm" className="rounded-lg font-bold" onClick={() => run("submit draft", () => prismApi.submitFloorPlanDraft(selectedEvent.id, draft.id))}>
                                    Submit
                                  </Button>
                                )}
                                {draft.status !== "approved" && (
                                  <Button size="sm" variant="outline" className="rounded-lg border-(--prism-success)/25 bg-(--prism-success)/8 font-bold text-(--prism-success) hover:bg-(--prism-success)/15" onClick={() => run("approve draft", () => prismApi.approveFloorPlanDraft(selectedEvent.id, draft.id))}>
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
                        onRequestQuotes={(input) => run("request supplier quotes", () => prismApi.requestSupplierQuotes(selectedEvent.id, input))}
                        onSelectQuote={(quoteId) => run("select supplier quote", () => prismApi.selectSupplierQuote(selectedEvent.id, quoteId))}
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
                        onWithdraw={(requestId) => run("withdraw supplier", () => prismApi.withdrawSupplier(selectedEvent.id, requestId))}
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
                    prismApi.assignCoordinator(selectedEvent.id, { coordinatorId: coordinator.id, role, overrideConflict: override })
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
                  onCreateTask={(input) => runLiveOps("create task", () => prismApi.createEventDayTask(selectedEvent.id, input))}
                  onUpdateTask={(taskId, input) => runLiveOps("update task", () => prismApi.updateEventDayTask(selectedEvent.id, taskId, input))}
                  onEscalateTask={(taskId, input) => runLiveOps("escalate task", () => prismApi.escalateEventDayTask(selectedEvent.id, taskId, input))}
                  onCreateIssue={(input) => runLiveOps("create issue", () => prismApi.createUrgentIssue(selectedEvent.id, input))}
                  onUpdateIssue={(issueId, input) => runLiveOps("update issue", () => prismApi.updateUrgentIssue(selectedEvent.id, issueId, input))}
                  onEscalateIssue={(issueId, input) => runLiveOps("escalate issue", () => prismApi.escalateUrgentIssue(selectedEvent.id, issueId, input))}
                  onUpdateCoordinatorAttendance={(assignmentId, input) => runLiveOps("attendance", () =>
                    prismApi.updateCoordinatorAttendance(selectedEvent.id, assignmentId, { ...input, markedBy: session.name })
                  )}
                  onReplaceCoordinator={(assignmentId, input) => runLiveOps("replace coordinator", () =>
                    prismApi.replaceCoordinator(selectedEvent.id, assignmentId, input)
                  )}
                  onVerifySupplierStatus={(requestId, input) => runLiveOps("verify supplier", () =>
                    prismApi.verifySupplierStatus(selectedEvent.id, requestId, { ...input, verifiedBy: session.name })
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
                  onRecordPayment={(milestoneId, input) => run("record payment", () => prismApi.recordPayment(selectedEvent.id, milestoneId, input))}
                  onSendBilling={(billingId) => run("send billing", () => prismApi.sendBillingStatement(selectedEvent.id, billingId))}
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
                  onCreateRule={(input) => run("create compliance rule", () => prismApi.createComplianceRule(input))}
                  onRunCompliance={(phase) => run("run compliance", () => prismApi.runCompliance(selectedEvent.id, phase))}
                  onResolveCompliance={(checkId) => run("resolve compliance", () =>
                    prismApi.resolveCompliance(selectedEvent.id, checkId, { action: "resolve", note: "Resolved during PMCM review.", actorName: "Ms. Mys" })
                  )}
                  onOverrideCompliance={(checkId, reason) => run("override compliance", () =>
                    prismApi.resolveCompliance(selectedEvent.id, checkId, { action: "override", overrideReason: reason, actorName: "Ms. Mys" })
                  )}
                  onCreateBillingSource={(input) => run("create billing source", () => prismApi.createBillingSource(selectedEvent.id, input))}
                  onApproveBillingSource={(sourceId) => run("approve billing source", () => prismApi.approveBillingSource(selectedEvent.id, sourceId, "Approved by PMCM."))}
                  onGenerateBillingStatement={(sourceId) => run("generate billing statement", () => prismApi.generateBillingStatement(selectedEvent.id, sourceId))}
                  onLoadCloseGates={() => prismApi.closeGates(selectedEvent.id)}
                  onArchive={(reason) => run("archive event", () => prismApi.archiveEvent(selectedEvent.id, reason))}
                  onLoadInsights={() => prismApi.eventInsights(selectedEvent.id)}
                  onGenerateInsights={() => run("generate insights", () => prismApi.generateEventInsights(selectedEvent.id))}
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
