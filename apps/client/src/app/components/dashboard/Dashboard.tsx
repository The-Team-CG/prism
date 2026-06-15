"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  BadgeCheck,
  CalendarDays,
  ChevronRight,
  CheckCircle2,
  Clock,
  FileCheck2,
  FileText,
  Home,
  LockKeyhole,
  MapPinned,
  MessageSquareText,
  MoreVertical,
  Presentation,
  ReceiptText,
  Send,
  ShieldCheck,
  Sparkles,
  Timer,
  WalletCards,
  type LucideIcon,
} from "lucide-react";
import { PRISM_LEGACY_SESSION_STORAGE_KEYS, PRISM_SESSION_STORAGE_KEYS, clearPrismSession } from "@prism/types";
import {
  prismApi,
  type CreatePrismInquiryInput,
  type PrismBillingStatement,
  type PrismBriefing,
  type PrismClientActionItem,
  type PrismClientWorkspace,
  type PrismDocument,
  type PrismEvent,
  type PrismFloorPlanDraft,
  type PrismPaymentMilestone,
} from "@/lib/prism-api";
import { Alert, AlertDescription } from "../ui/alert";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { StatusBadge } from "../ui/status-badge";
import { EmptyState } from "../ui/empty-state";
import {
  PrismBrandLogo,
  PrismDashboardShell,
} from "@prism/ui";
import { cn } from "../ui/utils";
import { cloneTemplateObjects, loadTemplates, type FloorPlanTemplate } from "../editor/templates";
import type { CanvasObject as VenueObject, Project } from "../editor/types";
import {
  ClientBillingTab,
  ClientBriefingTab,
  ClientDocumentsTab,
  ClientOverviewTab,
  ClientProposalTab,
  DashboardSkeleton,
  DashboardSessionSkeleton,
  clientActivityActor,
  clientActivityTitle,
} from "./dashboard-tabs";
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
} from "@/features/client-dashboard/client-dashboard.navigation";
import {
  selectClientEvents,
  selectEventDrafts,
  selectEventWorkspaceResources,
  selectSelectedClientEvent,
} from "@/features/client-dashboard/client-dashboard.selectors";
import { useClientDashboardState } from "@/features/client-dashboard/use-client-dashboard-state";
import type {
  ClientDashboardRoute,
  ClientPortalView,
  ClientSidebarRenderItem,
  ClientSidebarSubItem,
  DetailTab,
} from "@/features/client-dashboard/client-dashboard.types";

export type { ClientDashboardRoute, ClientPortalView };

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

type Screen =
  | { name: "dashboard" }
  | { name: "editor"; event: PrismEvent; draft: PrismFloorPlanDraft; project: Project; readOnly: boolean };

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

function ClientPortalSidebar({
  navItems,
  activeItemId,
  onSelect,
  collapsed,
}: {
  navItems: ClientSidebarRenderItem[];
  activeItemId: string;
  onSelect: (id: string) => void;
  collapsed: boolean;
}) {
  const [openGroups, setOpenGroups] = useState<Set<string>>(() => {
    const open = new Set<string>();
    for (const item of navItems) {
      const subItemActive = item.subItems?.some((sub) => sub.id === activeItemId) ?? false;
      if (subItemActive || item.id === activeItemId) open.add(item.id);
    }
    return open;
  });

  const toggleGroup = (id: string) => {
    setOpenGroups((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div className="flex h-full w-full min-w-0 flex-col bg-card text-foreground">
      <PrismBrandLogo
        href="/"
        title="P.R.I.S.M."
        detail="Client Portal"
        compact={collapsed}
        className={cn("min-h-16 shrink-0 px-3", collapsed && "justify-center px-2")}
        markClassName="size-8 bg-transparent ring-0"
      />

      <nav className="flex min-h-0 flex-1 flex-col overflow-y-auto px-3 pb-4 pt-1">
        <div className="flex flex-col gap-1">
          {navItems.map((item) => {
            const hasSubItems = Boolean(item.subItems?.length);
            const subItemActive = item.subItems?.some((sub) => sub.id === activeItemId) ?? false;
            const itemActive = item.id === activeItemId || subItemActive;
            const isOpen = openGroups.has(item.id);
            const Icon = item.icon;

            return (
              <div key={item.id} className="min-w-0">
                <button
                  type="button"
                  disabled={item.disabled}
                  data-active={itemActive}
                  onClick={() => {
                    onSelect(item.id);
                    if (hasSubItems) toggleGroup(item.id);
                  }}
                  title={collapsed ? item.label : undefined}
                  className={cn(
                    "flex h-9 w-full items-center gap-2.5 overflow-hidden rounded-md px-2.5 text-left text-sm font-medium text-muted-foreground transition hover:bg-secondary hover:text-foreground focus-visible:bg-secondary focus-visible:text-foreground disabled:cursor-not-allowed disabled:opacity-45 data-[active=true]:bg-primary/10 data-[active=true]:font-semibold data-[active=true]:text-primary",
                    collapsed && "justify-center px-0",
                  )}
                >
                  <Icon aria-hidden="true" className="size-4 shrink-0" />
                  {!collapsed && (
                    <>
                      <span className="min-w-0 flex-1 truncate">{item.label}</span>
                      {hasSubItems && (
                        <ChevronRight
                          className={cn("size-3.5 shrink-0 text-muted-foreground/60 transition-transform", isOpen && "rotate-90")}
                          aria-hidden="true"
                        />
                      )}
                    </>
                  )}
                </button>

                {hasSubItems && isOpen && !collapsed && (
                  <div className="ml-4 mt-1 flex flex-col gap-0.5 border-l border-border/60 pl-2">
                    {item.subItems?.map((subItem) => (
                      <button
                        key={subItem.id}
                        type="button"
                        disabled={item.disabled || subItem.disabled}
                        data-active={subItem.id === activeItemId}
                        onClick={() => onSelect(subItem.id)}
                        className="flex min-h-7 w-full items-center gap-2 rounded-md px-2 py-1 text-left text-xs font-semibold text-muted-foreground transition hover:bg-secondary hover:text-foreground disabled:cursor-not-allowed disabled:opacity-45 data-[active=true]:bg-primary/10 data-[active=true]:font-bold data-[active=true]:text-primary"
                      >
                        <span className="size-1.5 shrink-0 rounded-full bg-current opacity-40" aria-hidden="true" />
                        <span className="min-w-0 flex-1 truncate">{subItem.label}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </nav>
    </div>
  );
}

function draftIsOfficial(draft: PrismFloorPlanDraft) {
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

const EVENT_MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function eventDateParts(date?: string) {
  if (!date) return { day: "--", month: "TBD", year: "" };
  const [year, month, day] = date.split("-");
  const monthIndex = Number(month) - 1;
  return {
    day: day?.padStart(2, "0") ?? "--",
    month: EVENT_MONTHS[monthIndex]?.toUpperCase() ?? "TBD",
    year: year ?? "",
  };
}

function formatEventDate(date?: string) {
  const parts = eventDateParts(date);
  if (!date || parts.month === "TBD") return "Date pending";
  return `${EVENT_MONTHS[EVENT_MONTHS.findIndex((month) => month.toUpperCase() === parts.month)]} ${Number(parts.day)}, ${parts.year}`;
}

function portalBadgeStatus(status?: PrismEvent["clientPortalStatus"]) {
  return status === "unlocked" ? "approved" : "locked";
}

function portalBadgeLabel(status?: PrismEvent["clientPortalStatus"]) {
  return status === "unlocked" ? "Conforme signed" : "Portal locked";
}

type ClientDashboardAction = {
  id: string;
  title: string;
  description: string;
  detail: string;
  ctaLabel: string;
  href?: string;
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

function getClientDashboardActions({
  selectedEvent,
  briefing,
  billing,
  payments,
  documents,
  officialDraft,
}: {
  selectedEvent: PrismEvent;
  briefing?: PrismBriefing;
  billing?: PrismBillingStatement;
  payments: PrismPaymentMilestone[];
  documents: PrismDocument[];
  officialDraft?: PrismFloorPlanDraft;
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

function clientActionIcon(kind: PrismClientActionItem["kind"]): LucideIcon {
  if (kind === "billing") return ReceiptText;
  if (kind === "document" || kind === "closure") return FileText;
  if (kind === "floorplan") return MapPinned;
  if (kind === "approval") return BadgeCheck;
  if (kind === "feedback") return MessageSquareText;
  return Presentation;
}

function clientActionTarget(kind: PrismClientActionItem["kind"]): DetailTab {
  if (kind === "billing") return "billing";
  if (kind === "document" || kind === "closure") return "documents";
  if (kind === "floorplan") return "floorplan";
  if (kind === "approval") return "proposal";
  if (kind === "feedback") return "activity";
  return "briefing";
}

function clientActionTone(priority: PrismClientActionItem["priority"]): ClientDashboardAction["tone"] {
  if (priority === "critical" || priority === "warning") return "warning";
  if (priority === "attention") return "primary";
  return "neutral";
}

function actionCenterItemToDashboardAction(item: PrismClientActionItem): ClientDashboardAction {
  return {
    id: item.id,
    title: item.label,
    description: item.description,
    detail: item.dueAt ? formatEventDate(item.dueAt) : formatStatusLabel(item.status),
    ctaLabel: "Open",
    href: item.href,
    icon: clientActionIcon(item.kind),
    targetTab: clientActionTarget(item.kind),
    status: item.status,
    tone: clientActionTone(item.priority),
  };
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

function eventProgressDots(ev: PrismEvent, state: PrismClientWorkspace) {
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

function NoticeBanner({ tone, children }: { tone: "danger" | "success"; children: React.ReactNode }) {
  const cls = tone === "danger"
    ? "border-(--prism-signal)/20 bg-(--prism-signal)/8 text-(--prism-signal) border-l-(--prism-signal)"
    : "border-(--prism-success)/20 bg-(--prism-success)/8 text-(--prism-success) border-l-(--prism-success)";
  return (
    <div className={`rounded-lg border border-l-4 px-4 py-3 text-sm leading-6 ${cls}`}>{children}</div>
  );
}

function PageHeader({ eyebrow, title, description, meta, action }: {
  eyebrow?: string;
  title: string;
  description?: string;
  meta?: Array<string | React.ReactNode>;
  action?: React.ReactNode;
}) {
  return (
    <section className="rounded-md border border-border bg-card px-4 py-3 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          {eyebrow ? <p className="text-[10px] font-black uppercase text-muted-foreground">{eyebrow}</p> : null}
          <h2 className="mt-0.5 text-lg font-black leading-tight text-foreground sm:text-xl">{title}</h2>
          {description ? <p className="mt-1 max-w-3xl text-sm leading-5 text-muted-foreground">{description}</p> : null}
          {meta?.length ? (
            <div className="mt-2 flex flex-wrap gap-2">
              {meta.map((item, i) =>
                typeof item === "string"
                  ? <span key={i} className="rounded-full border border-border bg-card px-2.5 py-0.5 text-xs font-semibold text-foreground">{item}</span>
                  : <span key={i}>{item}</span>
              )}
            </div>
          ) : null}
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
    </section>
  );
}

function EventWorkspaceNav({
  items,
  activeItemId,
  onSelect,
}: {
  items: ClientSidebarSubItem[];
  activeItemId: string;
  onSelect: (item: ClientSidebarSubItem) => void;
}) {
  return (
    <nav aria-label="Selected event sections" className="border-t border-border">
      <div className="overflow-x-auto">
        <div className="flex min-w-max items-center px-2">
          {items.map((item) => {
            const active = item.id === activeItemId;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onSelect(item)}
                className={cn(
                  "relative h-11 shrink-0 px-3 text-sm font-semibold text-muted-foreground transition-colors hover:text-foreground",
                  active && "text-(--prism-signal)",
                )}
              >
                {item.label}
                {active ? (
                  <span className="absolute inset-x-3 bottom-0 h-0.5 rounded-full bg-(--prism-signal)" />
                ) : null}
              </button>
            );
          })}
        </div>
      </div>
    </nav>
  );
}

function EventSummaryCard({
  event,
  dots,
  billingStatement,
  briefing,
  documentCount,
  onOpen,
  className,
}: {
  event: PrismEvent;
  dots: Array<{ label: string; done: boolean }>;
  billingStatement?: PrismBillingStatement;
  briefing?: PrismBriefing;
  documentCount: number;
  onOpen: () => void;
  className?: string;
}) {
  const dateParts = eventDateParts(event.eventDate);

  return (
    <article className={cn("overflow-hidden rounded-xl border border-border bg-card shadow-sm", className)}>
      <div className="bg-(--prism-ink) px-4 py-4 text-white">
        <div className="flex items-start justify-between gap-3">
          <div className="rounded-md bg-white px-3 py-2 text-center text-(--prism-ink)">
            <p className="text-lg font-black leading-none">{dateParts.day}</p>
            <p className="mt-1 text-[10px] font-black uppercase leading-none">{dateParts.month}</p>
          </div>
          <StatusBadge status={event.status} label={formatStatusLabel(event.status)} />
        </div>
        <div className="mt-8">
          <h3 className="line-clamp-2 text-lg font-black leading-tight">{event.eventName}</h3>
          <p className="mt-1 text-xs font-semibold text-white/70">{event.clientName}</p>
        </div>
      </div>
      <div className="space-y-4 p-4">
        <div className="grid gap-2 text-sm">
          <div className="flex items-center gap-2 text-muted-foreground">
            <CalendarDays className="size-4 shrink-0" />
            <span className="truncate">{formatEventDate(event.eventDate)}</span>
          </div>
          <div className="flex items-center gap-2 text-muted-foreground">
            <MapPinned className="size-4 shrink-0" />
            <span className="truncate">{briefing?.venue ?? "Venue pending"}</span>
          </div>
          <div className="flex items-center gap-2 text-muted-foreground">
            <WalletCards className="size-4 shrink-0" />
            <span className="truncate">{billingStatement ? formatStatusLabel(billingStatement.status) : "Billing pending"}</span>
          </div>
          <div className="flex items-center gap-2 text-muted-foreground">
            <FileText className="size-4 shrink-0" />
            <span className="truncate">{documentCount} document{documentCount === 1 ? "" : "s"} on file</span>
          </div>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {dots.map((dot) => (
            <span
              key={dot.label}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-[11px] font-semibold",
                dot.done
                  ? "border-(--prism-success)/20 bg-(--prism-success)/8 text-(--prism-success)"
                  : "border-border bg-muted/40 text-muted-foreground",
              )}
            >
              <span className={cn("size-1.5 rounded-full", dot.done ? "bg-(--prism-success)" : "bg-muted-foreground/35")} />
              {dot.label}
            </span>
          ))}
        </div>
        <Button className="w-full rounded-lg font-bold" onClick={onOpen}>
          Open workspace <ArrowRight className="size-3.5" />
        </Button>
      </div>
    </article>
  );
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

const FLOOR_PLAN_PREVIEW_CACHE_MS = 60_000;
const floorPlanPreviewCache = new Map<string, { project: Project; loadedAt: number }>();

function isFresh(loadedAt: number, ttl: number) {
  return Date.now() - loadedAt < ttl;
}

function floorPlanPreviewCacheKey(eventId: string, draft: PrismFloorPlanDraft) {
  return `${eventId}:${draft.id}:${draft.status}`;
}

export function Dashboard({
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

    prismApi
      .loadFloorPlanSnapshot(
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
        ? await prismApi.loadFloorPlanSnapshot(
            selectedEvent.id,
            draft.id,
            draft.status === "approved" ? "approved" : "submitted",
            session ?? undefined,
          )
        : await prismApi.loadPlan(draft.floorPlanId, session ?? undefined);
    setScreen({ name: "editor", event: selectedEvent, draft, project, readOnly: locked });
  }

  async function createEditorDraft(template: FloorPlanTemplate) {
    if (!selectedEvent) return;
    setBusy(`editor-${template.id}`);
    setError(null);
    setNotice(null);
    try {
      const objects = cloneTemplateObjects(template);
      const draft = await prismApi.createFloorPlanPreference(
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
      await prismApi.createFloorPlanPreference(
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

  const derivedClientActions = selectedEvent
    ? getClientDashboardActions({
        selectedEvent,
        briefing,
        billing,
        payments,
        documents,
        officialDraft,
      })
    : [];
  const contractClientActions = selectedEvent && actionCenter
    ? actionCenter.items
        .filter((item) => item.eventId === selectedEvent.id)
        .map(actionCenterItemToDashboardAction)
    : [];
  const clientActions = actionCenter
    ? [
        ...contractClientActions,
        ...derivedClientActions.filter(
          (action) => action.tone === "success" && !contractClientActions.some((contractAction) => contractAction.targetTab === action.targetTab),
        ),
      ]
    : derivedClientActions;
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
      await prismApi.createInquiry(payload);
      setRequestForm(initialRequestForm);
      setNotice("New event request submitted. PMCM will review it before conforme and portal activation.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to submit event request");
    } finally {
      setBusy(null);
    }
  }

  const signOut = () => {
    clearPrismSession(PRISM_SESSION_STORAGE_KEYS.client, {
      legacyKeys: [PRISM_LEGACY_SESSION_STORAGE_KEYS.clientMockAuth],
    });
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
                clearPrismSession(PRISM_SESSION_STORAGE_KEYS.client, {
                  legacyKeys: [PRISM_LEGACY_SESSION_STORAGE_KEYS.clientMockAuth],
                });
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
        ? "Loading your saved client details for the guided event request."
        : route === "events"
          ? "Loading your confirmed PMCM event workspaces."
          : "Loading your client event workspace, actions, files, billing, and PMCM updates.");

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
          onSave={editable ? (project) => prismApi.savePlan(project, session ?? undefined) : undefined}
          onSubmit={
            editable
              ? async (project) => {
                  await prismApi.savePlan(project, session ?? undefined);
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
    const nextOpenPayment = payments.find((p) => p.status !== "paid");
    const documentsNeedingReview = documents.filter((document) => /needs|pending|requested/i.test(document.status));
    const layoutStatus = officialDraft ? formatStatusLabel(officialDraft.status) : "Not started";

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

        {selectedEvent && (
          <div className="grid gap-3 sm:grid-cols-3">
            {[
              {
                label: "Next action",
                value: nextAction?.title ?? "No client action pending",
                icon: FileCheck2,
                accent: "text-(--prism-signal)",
                onSelect: () => nextAction ? runClientAction(nextAction) : navigateToEventRoute("overview"),
              },
              {
                label: "Layout review",
                value: layoutStatus,
                icon: MapPinned,
                accent: "text-(--prism-amber)",
                onSelect: () => navigateToEventRoute("floorplan"),
              },
              {
                label: nextOpenPayment ? "Next payment" : "Documents",
                value: nextOpenPayment?.dueDate ?? `${documentsNeedingReview.length} needing review`,
                icon: nextOpenPayment ? WalletCards : FileText,
                accent: "text-(--prism-success)",
                onSelect: () => nextOpenPayment ? navigateToEventRoute("billing") : navigateToEventRoute("documents"),
              },
            ].map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.label}
                  type="button"
                  onClick={item.onSelect}
                  className="flex min-w-0 items-center gap-4 rounded-xl border border-border bg-card px-4 py-4 text-left shadow-sm transition-colors hover:border-(--prism-signal)/30 hover:bg-(--prism-signal-soft)"
                >
                  <span className={`grid size-10 shrink-0 place-items-center rounded-full bg-muted ${item.accent}`}>
                    <Icon className="size-4" />
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-base font-bold leading-tight text-foreground">{item.value}</span>
                    <span className="mt-0.5 block text-xs text-muted-foreground">{item.label}</span>
                  </span>
                </button>
              );
            })}
          </div>
        )}

        {/* Event card grid */}
        {events.length > 0 ? (
          <div>
            <div className="mb-3 flex items-center justify-between gap-3">
              <h2 className="text-base font-black text-foreground">Your events</h2>
              <button
                type="button"
                onClick={() => router.push("/dashboard/events")}
                className="inline-flex items-center gap-1 text-xs font-semibold text-(--prism-signal) hover:underline"
              >
                View all <ArrowRight className="size-3" />
              </button>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {events.slice(0, 3).map((ev) => {
                const dots = eventProgressDots(ev, state);
                const statement = state.billingStatements.find((b) => b.eventId === ev.id);
                const eventBriefing = state.briefings.find((b) => b.eventId === ev.id);
                const eventDocs = state.documents.filter((document) => document.eventId === ev.id);
                return (
                  <EventSummaryCard
                    key={ev.id}
                    event={ev}
                    dots={dots}
                    billingStatement={statement}
                    briefing={eventBriefing}
                    documentCount={eventDocs.length}
                    onOpen={() => {
                      setSelectedEventId(ev.id);
                      router.push(dashboardHref("overview", ev.id));
                    }}
                  />
                );
              })}
            </div>
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-border bg-muted/20 px-8 py-12 text-center">
            <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-[var(--prism-signal-soft)]">
              <CalendarDays className="size-6 text-[var(--prism-signal)]" />
            </span>
            <h3 className="mt-4 text-base font-black text-foreground">No events yet</h3>
            <p className="mt-2 max-w-sm mx-auto text-sm leading-6 text-muted-foreground">
              Your event workspace opens after PMCM accepts your inquiry and records the signed conforme. Submit a request to get started.
            </p>
            <Button className="mt-5 rounded-lg font-bold" onClick={() => router.push("/dashboard/request")}>
              <Send className="size-4" /> Submit an event request
            </Button>
          </div>
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
    type EventFilterId = "events-all" | "events-upcoming" | "events-in-planning" | "events-completed" | "events-cancelled";
    const eventFilterOptions: Array<{
      id: EventFilterId;
      label: string;
      href: string;
      matches: (ev: PrismEvent) => boolean;
    }> = [
      { id: "events-all", label: "All", href: "/dashboard/events", matches: () => true },
      {
        id: "events-upcoming",
        label: "Upcoming",
        href: "/dashboard/events/upcoming",
        matches: (ev) => ev.status !== "completed" && ev.status !== "cancelled",
      },
      {
        id: "events-in-planning",
        label: "In planning",
        href: "/dashboard/events/in-planning",
        matches: (ev) => /planning|confirmed|active|pending/i.test(ev.status),
      },
      {
        id: "events-completed",
        label: "Completed",
        href: "/dashboard/events/completed",
        matches: (ev) => /completed|closed|archived/i.test(ev.status),
      },
      {
        id: "events-cancelled",
        label: "Cancelled",
        href: "/dashboard/events/cancelled",
        matches: (ev) => /cancelled|canceled/i.test(ev.status),
      },
    ];
    const activeEventFilterId =
      portalView === "dashboard-upcoming-events"
        ? "events-upcoming"
        : eventFilterOptions.some((option) => option.id === portalView)
          ? portalView as EventFilterId
          : "events-all";
    const activeEventFilter = eventFilterOptions.find((option) => option.id === activeEventFilterId) ?? eventFilterOptions[0];
    const visibleEvents = events.filter((ev) => {
      const query = eventSearch.trim().toLowerCase();
      if (!activeEventFilter.matches(ev)) return false;
      if (!query) return true;
      return `${ev.eventName} ${ev.eventDate} ${ev.status}`.toLowerCase().includes(query);
    });

    return (
      <div className="space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-black text-foreground">{portalViewMeta?.title ?? "My events"}</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {portalViewMeta?.description ?? `${events.length} confirmed event${events.length === 1 ? "" : "s"} with PMCM`}
            </p>
          </div>
          <Button className="rounded-lg font-bold" onClick={() => router.push("/dashboard/request")}>
            <Send className="size-4" /> New request
          </Button>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex flex-wrap gap-2" role="tablist" aria-label="Event status filters">
            {eventFilterOptions.map((filter) => {
              const active = filter.id === activeEventFilterId;
              return (
                <button
                  key={filter.id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => router.push(filter.href)}
                  className={cn(
                    "inline-flex h-9 items-center gap-2 rounded-lg border px-3 text-sm font-semibold transition-colors",
                    active
                      ? "border-(--prism-signal) bg-(--prism-signal-soft) text-(--prism-signal)"
                      : "border-border bg-card text-muted-foreground hover:text-foreground",
                  )}
                >
                  {filter.label}
                  <span className={cn("text-xs", active ? "text-(--prism-signal)" : "text-muted-foreground")}>
                    {events.filter(filter.matches).length}
                  </span>
                </button>
              );
            })}
          </div>
          <Input
            value={eventSearch}
            onChange={(ev) => setEventSearch(ev.target.value)}
            placeholder="Search by name, date, or status..."
            className="w-full rounded-lg sm:ml-auto sm:max-w-sm"
          />
        </div>

        {visibleEvents.length ? (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {visibleEvents.map((ev) => {
              const dots = eventProgressDots(ev, state);
              const statement = state.billingStatements.find((b) => b.eventId === ev.id);
              const eventBriefing = state.briefings.find((b) => b.eventId === ev.id);
              const eventDocs = state.documents.filter((document) => document.eventId === ev.id);
              return (
                <EventSummaryCard
                  key={ev.id}
                  event={ev}
                  dots={dots}
                  billingStatement={statement}
                  briefing={eventBriefing}
                  documentCount={eventDocs.length}
                  onOpen={() => {
                    setSelectedEventId(ev.id);
                    router.push(dashboardHref("overview", ev.id));
                  }}
                />
              );
            })}
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-border bg-muted/20 px-8 py-16 text-center">
            <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-muted">
              <CalendarDays className="size-6 text-muted-foreground" />
            </span>
            <h3 className="mt-4 text-base font-black text-foreground">No events found</h3>
            <p className="mt-2 max-w-sm mx-auto text-sm text-muted-foreground">
              {eventSearch ? "Try a different search term." : "Submit a new event request to get started."}
            </p>
            {!eventSearch && (
              <Button className="mt-5 rounded-lg font-bold" onClick={() => router.push("/dashboard/request")}>
                <Send className="size-4" /> New event request
              </Button>
            )}
          </div>
        )}
      </div>
    );
  };

  /* ── Request page ──────────────────────────────────────────── */

  const renderRequestPage = () => (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-black text-foreground">{portalViewMeta?.title ?? "New event request"}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {portalViewMeta?.description ?? "Tell PMCM about your next event. Your account details are pre-filled. PMCM reviews all requests before activating the workspace."}
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

  const renderCalendarPage = () => {
    type CalendarItemKind = "event" | "payment" | "deadline" | "approval" | "meeting";
    type CalendarItem = {
      id: string;
      date: string;
      title: string;
      detail: string;
      status: string;
      kind: CalendarItemKind;
    };

    const toIsoDate = (date: Date) => {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, "0");
      const day = String(date.getDate()).padStart(2, "0");
      return `${year}-${month}-${day}`;
    };
    const dateFromIso = (date: string) => new Date(`${date}T00:00:00`);
    const addDays = (date: string, days: number) => {
      const value = dateFromIso(date);
      value.setDate(value.getDate() + days);
      return toIsoDate(value);
    };
    const formatCalendarDate = (date: string) =>
      dateFromIso(date).toLocaleDateString("en-US", { month: "short", day: "numeric" });
    const calendarItemClass = (item: CalendarItem) => {
      if (item.kind === "event") return "border-primary/20 bg-primary/10 text-primary";
      if (item.kind === "payment" && item.status === "paid") return "border-(--prism-success)/25 bg-(--prism-success)/10 text-(--prism-success)";
      if (item.kind === "payment") return "border-(--prism-warning)/25 bg-(--prism-warning)/10 text-(--prism-warning)";
      if (item.kind === "approval") return "border-(--prism-signal)/25 bg-(--prism-signal-soft) text-foreground";
      return "border-border bg-muted text-foreground";
    };

    const eventIds = new Set(events.map((ev) => ev.id));
    const allPayments = state.paymentMilestones.filter((payment) => eventIds.has(payment.eventId));
    const eventDates: CalendarItem[] = events.map((ev) => ({
        id: `event-${ev.id}`,
        date: ev.eventDate,
        title: ev.eventName,
        detail: "Event date",
        status: ev.status,
        kind: "event",
    }));
    const paymentDates: CalendarItem[] = allPayments.map((payment) => {
        const ev = events.find((candidate) => candidate.id === payment.eventId);
        return {
          id: `payment-${payment.id}`,
          date: payment.dueDate,
          title: payment.label,
          detail: ev ? `${ev.eventName} payment due` : "Payment due",
          status: payment.status,
          kind: "payment",
        };
    });
    const planningDates: CalendarItem[] = events.flatMap((ev) => [
      {
        id: `approval-${ev.id}`,
        date: addDays(ev.eventDate, -14),
        title: "Layout approval",
        detail: ev.eventName,
        status: ev.floorPlanStatus || "pending",
        kind: "approval" as const,
      },
      {
        id: `deadline-${ev.id}`,
        date: addDays(ev.eventDate, -7),
        title: "Final planning deadline",
        detail: ev.eventName,
        status: ev.status,
        kind: "deadline" as const,
      },
    ]);
    const calendarItems = [...eventDates, ...paymentDates, ...planningDates]
      .filter((item) => {
        if (portalView === "calendar-event-dates") return item.kind === "event";
        if (portalView === "calendar-payment-due-dates") return item.kind === "payment";
        if (portalView === "calendar-meetings") return item.kind === "meeting";
        if (portalView === "calendar-deadlines") return item.kind === "deadline" || item.kind === "payment";
        if (portalView === "calendar-approval-deadlines") return item.kind === "approval";
        return true;
      })
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    const monthSource = selectedEvent?.eventDate ?? calendarItems.find((item) => item.kind === "event")?.date ?? calendarItems[0]?.date ?? toIsoDate(new Date());
    const monthDate = dateFromIso(monthSource);
    const monthStart = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1);
    const gridStart = new Date(monthStart);
    gridStart.setDate(monthStart.getDate() - monthStart.getDay());
    const monthLabel = monthStart.toLocaleDateString("en-US", { month: "long", year: "numeric" });
    const todayIso = toIsoDate(new Date());
    const itemsByDate = calendarItems.reduce<Map<string, CalendarItem[]>>((map, item) => {
      const group = map.get(item.date) ?? [];
      group.push(item);
      map.set(item.date, group);
      return map;
    }, new Map());
    const monthCells = Array.from({ length: 42 }, (_, index) => {
      const date = new Date(gridStart);
      date.setDate(gridStart.getDate() + index);
      const iso = toIsoDate(date);
      return {
        date,
        iso,
        isCurrentMonth: date.getMonth() === monthStart.getMonth(),
        isToday: iso === todayIso,
        items: itemsByDate.get(iso) ?? [],
      };
    });
    const weekdayLabels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const legend: Array<{ label: string; className: string }> = [
      { label: "Event", className: "bg-primary" },
      { label: "Payment", className: "bg-(--prism-warning)" },
      { label: "Approval", className: "bg-(--prism-signal)" },
      { label: "Deadline", className: "bg-muted-foreground" },
    ];

    return (
      <div className="space-y-5">
        <section className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-4">
            <h1 className="text-2xl font-black text-foreground">{monthLabel}</h1>
            <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
              {legend.map((item) => (
                <span key={item.label} className="inline-flex items-center gap-1.5">
                  <span className={cn("size-2 rounded-full", item.className)} />
                  {item.label}
                </span>
              ))}
            </div>
          </div>
          <div className="overflow-x-auto">
            <div className="min-w-[760px]">
              <div className="grid grid-cols-7 border-b border-border bg-muted/30">
                {weekdayLabels.map((day) => (
                  <div key={day} className="border-r border-border px-3 py-2 text-xs font-bold text-muted-foreground last:border-r-0">
                    {day}
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-7">
                {monthCells.map((cell, index) => (
                  <div
                    key={cell.iso}
                    className={cn(
                      "min-h-[116px] border-b border-r border-border p-2",
                      (index + 1) % 7 === 0 && "border-r-0",
                      !cell.isCurrentMonth && "bg-muted/20 text-muted-foreground",
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <span
                        className={cn(
                          "grid size-7 place-items-center rounded-lg text-xs font-bold",
                          cell.isToday ? "bg-primary text-primary-foreground" : "text-foreground",
                          !cell.isCurrentMonth && !cell.isToday && "text-muted-foreground",
                        )}
                      >
                        {cell.date.getDate()}
                      </span>
                    </div>
                    <div className="mt-2 space-y-1">
                      {cell.items.slice(0, 3).map((item) => (
                        <div
                          key={item.id}
                          className={cn("truncate rounded-md border px-2 py-1 text-[11px] font-semibold", calendarItemClass(item))}
                          title={`${item.title} - ${item.detail}`}
                        >
                          {item.title}
                        </div>
                      ))}
                      {cell.items.length > 3 ? (
                        <p className="px-2 text-[11px] font-semibold text-muted-foreground">+{cell.items.length - 3} more</p>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-border bg-card p-5 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-base font-black text-foreground">{portalViewMeta?.title ?? "Schedule"}</h2>
            <span className="text-xs font-semibold text-muted-foreground">
              {calendarItems.length} item{calendarItems.length === 1 ? "" : "s"}
            </span>
          </div>
          {calendarItems.length ? (
            <div className="mt-4 divide-y divide-border">
              {calendarItems.map((item) => (
                <div key={item.id} className="grid gap-3 py-3 sm:grid-cols-[72px_minmax(0,1fr)_auto] sm:items-center">
                  <span className="text-sm font-bold text-foreground">{formatCalendarDate(item.date)}</span>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold text-foreground">{item.title}</p>
                    <p className="mt-1 truncate text-xs text-muted-foreground">{item.detail}</p>
                  </div>
                  <StatusBadge status={item.status} label={formatStatusLabel(item.status)} />
                </div>
              ))}
            </div>
          ) : (
            <div className="mt-4 rounded-xl border border-dashed border-border px-6 py-8">
              <EmptyState icon={CalendarDays} title="No calendar items yet" description="Event dates and deadlines will appear after portal activation." />
            </div>
          )}
        </section>
      </div>
    );
  };

  const renderApprovalsPage = () => {
    const approvalItems = selectedEvent ? [
      {
        title: "Contracts",
        detail: documents.filter((document) => /contract|conforme|moa|nda/i.test(document.type)).length
          ? "Contract files are available for this event."
          : "Contracts will appear after PMCM uploads them.",
        status: documents.some((document) => /contract|conforme|moa|nda/i.test(document.type)) ? "approved" : "pending",
      },
      {
        title: "Quotations",
        detail: billing ? `${billing.number} is linked to the approved proposal package.` : "Quotation and billing details are being prepared.",
        status: billing?.status ?? "pending",
      },
      {
        title: "Layouts / Designs",
        detail: officialDraft ? `Official layout is ${formatStatusLabel(officialDraft.status)}.` : "PMCM has not published an official layout yet.",
        status: officialDraft?.status ?? "pending",
      },
      {
        title: "Final Confirmation",
        detail: selectedEvent.readiness ? `Readiness is ${formatStatusLabel(selectedEvent.readiness)}.` : "Final confirmation is pending.",
        status: selectedEvent.readiness ?? selectedEvent.status,
      },
    ] : [];
    const visibleApprovalItems = approvalItems.filter((item) => {
      if (portalView === "approvals-pending" || portalView === "dashboard-pending-approvals") return item.status !== "approved";
      if (portalView === "approvals-approved") return item.status === "approved";
      if (portalView === "approvals-needs-revision") return /revision|changes/i.test(item.status);
      if (portalView === "approvals-contracts") return item.title === "Contracts";
      if (portalView === "approvals-quotations") return item.title === "Quotations";
      if (portalView === "approvals-final-confirmation") return item.title === "Final Confirmation";
      return true;
    });

    const statusIcon = (status: string) => {
      if (/approved|done|confirmed/i.test(status)) return <CheckCircle2 className="size-4 text-(--prism-success)" />;
      if (/pending|waiting|preparation/i.test(status)) return <Clock className="size-4 text-(--prism-amber)" />;
      return <BadgeCheck className="size-4 text-muted-foreground" />;
    };

    return (
      <div className="space-y-5">
        {!isEventScopedView && portalViewMeta && (
          <PageHeader eyebrow="Client approvals" title={portalViewMeta.title} description={portalViewMeta.description} />
        )}
        {!selectedEvent && !isEventScopedView ? (
          <div className="rounded-2xl border border-dashed border-border bg-muted/20 px-8 py-12 text-center">
            <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-muted">
              <BadgeCheck className="size-6 text-muted-foreground" />
            </span>
            <h3 className="mt-4 text-base font-black text-foreground">No active event</h3>
            <p className="mt-2 max-w-sm mx-auto text-sm leading-6 text-muted-foreground">
              Select an event from My Events to view approval items.
            </p>
            <Button variant="outline" className="mt-5 rounded-lg font-semibold" onClick={() => router.push("/dashboard/events")}>
              Go to My Events
            </Button>
          </div>
        ) : (
          <div className="grid gap-3">
            {visibleApprovalItems.length ? visibleApprovalItems.map((item) => (
              <div key={item.title} className="flex flex-wrap items-start justify-between gap-4 rounded-xl border border-border bg-card px-5 py-4 shadow-sm hover:border-(--prism-signal)/20 transition-colors">
                <div className="flex items-start gap-3 min-w-0">
                  <span className="mt-0.5 shrink-0">{statusIcon(item.status)}</span>
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-foreground">{item.title}</p>
                    <p className="mt-0.5 text-xs leading-5 text-muted-foreground">{item.detail}</p>
                  </div>
                </div>
                <StatusBadge status={item.status} label={formatStatusLabel(item.status)} />
              </div>
            )) : (
              <div className="rounded-2xl border border-dashed border-border bg-muted/20 px-8 py-12 text-center">
                <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-muted">
                  <BadgeCheck className="size-6 text-muted-foreground" />
                </span>
                <h3 className="mt-4 text-base font-black text-foreground">All clear</h3>
                <p className="mt-2 text-sm text-muted-foreground">No approval items in this view.</p>
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  const renderFilesPage = () => {
    type FileFilterId =
      | "files-all"
      | "files-contracts"
      | "files-quotations"
      | "files-invoices-receipts"
      | "files-event-layouts"
      | "files-uploaded"
      | "files-shared";

    const eventIds = new Set(events.map((ev) => ev.id));
    const allFiles = state.documents.filter((document) => eventIds.has(document.eventId));
    const textForFile = (document: PrismDocument) => `${document.type} ${document.fileName}`.toLowerCase();
    const fileFilterOptions: Array<{
      id: FileFilterId;
      label: string;
      href: string;
      matches: (document: PrismDocument) => boolean;
    }> = [
      { id: "files-all", label: "All files", href: "/dashboard/files", matches: () => true },
      {
        id: "files-contracts",
        label: "Contracts",
        href: "/dashboard/files/contracts",
        matches: (document) => /contract|conforme|moa|nda/.test(textForFile(document)),
      },
      {
        id: "files-quotations",
        label: "Quotations",
        href: "/dashboard/files/quotations",
        matches: (document) => /quotation|quote/.test(textForFile(document)),
      },
      {
        id: "files-invoices-receipts",
        label: "Invoices",
        href: "/dashboard/files/invoices-receipts",
        matches: (document) => /invoice|receipt|billing|payment/.test(textForFile(document)),
      },
      {
        id: "files-event-layouts",
        label: "Event layouts",
        href: "/dashboard/files/event-layouts",
        matches: (document) => /layout|floor|plan/.test(textForFile(document)),
      },
      {
        id: "files-uploaded",
        label: "Uploaded files",
        href: "/dashboard/files/uploaded",
        matches: (document) => /upload|client|asset|speaker|logo|visual|permit/.test(textForFile(document)),
      },
      {
        id: "files-shared",
        label: "Shared files",
        href: "/dashboard/files/shared",
        matches: (document) => document.status === "approved" || document.status === "issued",
      },
    ];
    const activeFileFilterId = fileFilterOptions.some((option) => option.id === portalView)
      ? portalView as FileFilterId
      : "files-all";
    const activeFolder = fileFilterOptions.find((option) => option.id === activeFileFilterId) ?? fileFilterOptions[0];
    const files = allFiles.filter(activeFolder.matches);
    const folderRows = fileFilterOptions.map((folder) => ({
      ...folder,
      count: allFiles.filter(folder.matches).length,
    }));
    const latestFile = files[0] ?? allFiles[0];
    const latestFileEvent = latestFile ? events.find((candidate) => candidate.id === latestFile.eventId) : undefined;
    const activeFileSize = files.length ? `${Math.max(files.length * 2.4, 1.2).toFixed(1)} Mb` : "0 Mb";

    return (
      <div className="space-y-5">
        <section className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-border bg-card px-6 py-5 shadow-sm">
          <div>
            <h1 className="text-2xl font-black text-foreground">{activeFolder.label}</h1>
            <p className="mt-1 text-sm text-muted-foreground">{files.length} file{files.length === 1 ? "" : "s"} across all your PMCM events</p>
          </div>
          <div className="flex items-center gap-2">
            {folderRows.filter((f) => f.count > 0).length > 0 && (
              <span className="text-xs text-muted-foreground font-semibold">
                {allFiles.length} total · {activeFileSize}
              </span>
            )}
          </div>
        </section>

        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_260px]">
          <section className="rounded-2xl border border-border bg-card p-5 shadow-sm">
            <h2 className="text-base font-black text-foreground">Folders</h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {folderRows.map((folder) => {
                const isActive = folder.id === activeFileFilterId;
                return (
                  <button
                    key={folder.id}
                    type="button"
                    onClick={() => router.push(folder.href)}
                    className={cn(
                      "group min-w-0 rounded-xl border p-3 text-left transition hover:-translate-y-0.5 hover:shadow-sm",
                      isActive
                        ? "border-(--prism-success)/40 bg-(--prism-success)/10"
                        : "border-border bg-background hover:border-(--prism-success)/30",
                    )}
                  >
                    <div
                      className={cn(
                        "relative h-20 rounded-lg",
                        isActive ? "bg-(--prism-success)/30" : "bg-muted",
                      )}
                    >
                      <span
                        className={cn(
                          "absolute -top-1 left-0 h-4 w-16 rounded-t-lg",
                          isActive ? "bg-(--prism-success)/30" : "bg-muted",
                        )}
                      />
                      <span className="absolute right-2 top-2 opacity-0 transition group-hover:opacity-100">
                        <MoreVertical className="size-4 text-muted-foreground" />
                      </span>
                    </div>
                    <div className="mt-3 flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-bold text-foreground">{folder.label}</p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {folder.count} file{folder.count === 1 ? "" : "s"}
                        </p>
                      </div>
                      <MoreVertical className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                    </div>
                  </button>
                );
              })}
            </div>
          </section>

          <aside className="rounded-2xl border border-border bg-card p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-black text-foreground">Details</h2>
              <MoreVertical className="size-4 text-muted-foreground" />
            </div>
            <div className="mt-5">
              <div className="relative h-24 rounded-xl bg-(--prism-success)/25">
                <span className="absolute -top-1 left-0 h-5 w-20 rounded-t-xl bg-(--prism-success)/25" />
              </div>
              <div className="mt-5 space-y-3 text-xs">
                <div className="flex justify-between gap-3">
                  <span className="text-muted-foreground">Name</span>
                  <span className="truncate font-semibold text-foreground">{activeFolder.label}</span>
                </div>
                <div className="flex justify-between gap-3">
                  <span className="text-muted-foreground">Type</span>
                  <span className="font-semibold text-foreground">File folder</span>
                </div>
                <div className="flex justify-between gap-3">
                  <span className="text-muted-foreground">Files</span>
                  <span className="font-semibold text-foreground">{files.length}</span>
                </div>
                <div className="flex justify-between gap-3">
                  <span className="text-muted-foreground">Size</span>
                  <span className="font-semibold text-foreground">{activeFileSize}</span>
                </div>
                <div className="flex justify-between gap-3">
                  <span className="text-muted-foreground">Last edited</span>
                  <span className="truncate font-semibold text-foreground">{latestFile?.uploadedAt ?? "No files"}</span>
                </div>
              </div>
            </div>
          </aside>
        </div>

        <section className="rounded-2xl border border-border bg-card p-5 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-black text-foreground">Recently opened</h2>
              <p className="mt-1 text-xs text-muted-foreground">
                {latestFileEvent ? `${latestFileEvent.eventName} file activity` : "Client-visible file activity"}
              </p>
            </div>
          </div>

          {files.length ? (
            <div className="mt-4 overflow-x-auto">
              <div className="min-w-[620px]">
                <div className="grid grid-cols-[minmax(220px,1.4fr)_140px_minmax(180px,1fr)_150px_120px] gap-3 border-b border-border px-2 pb-2 text-[11px] font-bold text-muted-foreground">
                  <span>File name</span>
                  <span>Folder</span>
                  <span>Event</span>
                  <span>Last modified</span>
                  <span>Status</span>
                </div>
                <div className="divide-y divide-border">
                  {files.map((file) => {
                    const ev = events.find((candidate) => candidate.id === file.eventId);
                    return (
                      <div
                        key={file.id}
                        className="grid grid-cols-[minmax(220px,1.4fr)_140px_minmax(180px,1fr)_150px_120px] items-center gap-3 px-2 py-3 text-sm"
                      >
                        <div className="flex min-w-0 items-center gap-3">
                          <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-(--prism-warning)/12 text-(--prism-warning)">
                            <FileText className="size-4" />
                          </span>
                          <span className="truncate font-bold text-foreground">{file.fileName}</span>
                        </div>
                        <span className="truncate text-xs text-muted-foreground">{formatStatusLabel(file.type)}</span>
                        <span className="truncate text-xs text-muted-foreground">{ev?.eventName ?? "Event file"}</span>
                        <span className="truncate text-xs text-muted-foreground">{file.uploadedAt}</span>
                        <StatusBadge status={file.status} label={formatStatusLabel(file.status)} />
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          ) : (
            <div className="mt-4 rounded-xl border border-dashed border-border px-6 py-8">
              <EmptyState icon={FileText} title="No files yet" description="Contracts, quotations, invoices, receipts, and layout files will appear here." />
            </div>
          )}
        </section>
      </div>
    );
  };

  const renderPortalBillingPage = () => {
    if (!selectedEvent) {
      return <EmptyState icon={WalletCards} title="No billing workspace yet" description="Billing opens after your event workspace is activated." />;
    }

    return (
      <div className="space-y-5">
        <PageHeader
          eyebrow="Billing & payments"
          title={portalViewMeta?.title ?? selectedEvent.eventName}
          description={portalViewMeta?.description ?? "Quotations, invoices, payment schedule, receipts, and balance for the selected event."}
        />
        <ClientBillingTab payments={payments} billing={billing} />
      </div>
    );
  };

  const renderEventDetailsPage = () => (
    <div className="grid gap-4 lg:grid-cols-2">
      <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
        <p className="text-sm font-bold text-foreground">Event details</p>
        <div className="mt-4 grid gap-3 text-sm">
          <div className="flex justify-between gap-3"><span className="text-muted-foreground">Event name</span><span className="font-semibold text-foreground">{selectedEvent?.eventName}</span></div>
          <div className="flex justify-between gap-3"><span className="text-muted-foreground">Client</span><span className="font-semibold text-foreground">{selectedEvent?.clientName}</span></div>
          <div className="flex justify-between gap-3"><span className="text-muted-foreground">Date</span><span className="font-semibold text-foreground">{selectedEvent?.eventDate}</span></div>
          <div className="flex justify-between gap-3"><span className="text-muted-foreground">Status</span><StatusBadge status={selectedEvent?.status ?? "pending"} label={formatStatusLabel(selectedEvent?.status)} /></div>
        </div>
      </div>
      <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
        <p className="text-sm font-bold text-foreground">Briefing basis</p>
        <div className="mt-4 grid gap-3 text-sm">
          <div className="flex justify-between gap-3"><span className="text-muted-foreground">Venue</span><span className="font-semibold text-foreground">{briefing?.venue ?? "To be confirmed"}</span></div>
          <div className="flex justify-between gap-3"><span className="text-muted-foreground">Guests</span><span className="font-semibold text-foreground">{briefing?.guestCount ? `${briefing.guestCount} guests` : "Pending"}</span></div>
          <div className="flex justify-between gap-3"><span className="text-muted-foreground">Budget</span><span className="font-semibold text-foreground">{briefing?.budgetRange ?? "Pending"}</span></div>
          <div className="flex justify-between gap-3"><span className="text-muted-foreground">Submitted</span><span className="font-semibold text-foreground">{briefing?.submittedAt ?? "Pending"}</span></div>
        </div>
      </div>
    </div>
  );

  const renderProgressPage = () => {
    const dots = selectedEvent && state ? eventProgressDots(selectedEvent, state) : [];
    return (
      <div className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {dots.map((dot) => (
            <div key={dot.label} className="rounded-xl border border-border bg-card px-4 py-4 shadow-sm">
              <div className={`mb-3 size-2.5 rounded-full ${dot.done ? "bg-(--prism-success)" : "bg-muted-foreground/30"}`} />
              <p className="text-sm font-bold text-foreground">{dot.label}</p>
              <p className="mt-1 text-xs text-muted-foreground">{dot.done ? "Complete" : "Pending"}</p>
            </div>
          ))}
        </div>
        <div className="grid gap-4 xl:grid-cols-3">
          {renderActionGroup("Needs your action", "Client decisions that can move planning forward.", clientActions.filter((a) => a.tone === "primary" || a.tone === "warning"))}
          {renderActionGroup("Waiting on PMCM", "Being prepared or reviewed by the event team.", clientActions.filter((a) => a.tone === "neutral"))}
          {renderActionGroup("Completed", "Finished client-visible workflow items.", clientActions.filter((a) => a.tone === "success"))}
        </div>
      </div>
    );
  };

  const renderSchedulePage = () => (
    <div className="space-y-3">
      <div className="rounded-xl border border-border bg-card px-5 py-4 shadow-sm">
        <p className="text-sm font-bold text-foreground">Event date</p>
        <p className="mt-1 text-sm text-muted-foreground">{selectedEvent?.eventDate ?? "Pending"}</p>
      </div>
      {payments.map((payment) => (
        <div key={payment.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card px-5 py-4 shadow-sm">
          <div>
            <p className="text-sm font-bold text-foreground">{payment.label}</p>
            <p className="mt-1 text-xs text-muted-foreground">Payment due date</p>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm font-semibold text-foreground">{payment.dueDate}</span>
            <StatusBadge status={payment.status} label={formatStatusLabel(payment.status)} />
          </div>
        </div>
      ))}
    </div>
  );

  const renderGuestsPage = () => (
    <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
      <p className="text-xs font-bold uppercase tracking-widest text-(--prism-signal)">Guests / attendees</p>
      <h2 className="mt-1 text-xl font-black text-foreground">{briefing?.guestCount ? `${briefing.guestCount} expected guests` : "Guest count pending"}</h2>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">
        Guest registration details remain PMCM-managed. Client-visible attendee summaries will appear here once the event team publishes them.
      </p>
      {selectedEvent?.guestAccessCode ? (
        <Badge className="mt-4 rounded-full">Guest access code: {selectedEvent.guestAccessCode}</Badge>
      ) : null}
    </div>
  );

  const renderPreferencesPage = () => (
    <div className="space-y-5">
      <ClientBriefingTab briefing={briefing} />
      {renderFloorPlanPage()}
    </div>
  );

  const renderFinalSummaryPage = () => (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {[
        { label: "Event", value: formatStatusLabel(selectedEvent?.status), status: selectedEvent?.status ?? "pending" },
        { label: "Layout", value: officialDraft ? formatStatusLabel(officialDraft.status) : "Pending", status: officialDraft?.status ?? "pending" },
        { label: "Billing", value: billing ? formatStatusLabel(billing.status) : "Pending", status: billing?.status ?? "pending" },
        { label: "Files", value: `${documents.length} file${documents.length === 1 ? "" : "s"}`, status: documents.length ? "approved" : "pending" },
      ].map((item) => (
        <div key={item.label} className="rounded-xl border border-border bg-card px-4 py-4 shadow-sm">
          <p className="text-xs font-semibold text-muted-foreground">{item.label}</p>
          <p className="mt-2 text-lg font-black text-foreground">{item.value}</p>
          <div className="mt-3"><StatusBadge status={item.status} label={formatStatusLabel(item.status)} /></div>
        </div>
      ))}
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
              <EmptyState icon={MapPinned} title="No floor plan draft yet" description="Start from a saved layout template or send guided notes below." />
            )}

            {!approved && (
              <div className="mt-5">
                <p className="mb-3 text-xs font-bold uppercase tracking-widest text-muted-foreground">Saved layout templates</p>
                {floorPlanTemplates.length ? (
                  <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                    {floorPlanTemplates.slice(0, 4).map((template) => (
                      <button
                        key={template.id}
                        disabled={busy === `editor-${template.id}`}
                        onClick={() => createEditorDraft(template)}
                        className="rounded-xl border border-border bg-background p-3.5 text-left transition hover:border-(--prism-signal)/40 hover:bg-(--prism-signal-soft) disabled:opacity-60"
                      >
                        <p className="text-sm font-bold text-foreground">{template.name}</p>
                        <p className="mt-0.5 text-xs leading-5 text-muted-foreground">{template.description || template.venue || "Saved PMCM floor plan template"}</p>
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="rounded-xl border border-dashed border-border bg-background p-3.5 text-xs text-muted-foreground">
                    No saved templates yet. Send guided layout notes and PMCM can save reusable templates from confirmed plans.
                  </p>
                )}
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
    const chatMessages = [
      ...notifications.map((item) => ({
        id: item.id,
        text: item.message,
        timestamp: item.createdAt,
        sender: "PMCM",
        initials: "PM",
        fromPmcm: true,
      })),
      ...audit.map((item) => ({
        id: item.id,
        text: clientActivityTitle(item.action),
        timestamp: item.createdAt,
        sender: clientActivityActor(item.actor),
        initials: item.actor.slice(0, 2).toUpperCase(),
        fromPmcm: item.actor.toLowerCase().includes("pmcm") || item.actor.toLowerCase().includes("coordinator"),
      })),
    ].sort((a, b) => (a.timestamp ?? "").localeCompare(b.timestamp ?? ""));

    const clientInitials = session.name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase();

    return (
      <div className="space-y-4">
        {/* Chat header — only shown when not inside the event workspace (which already shows the event header) */}
        <div className="flex items-center gap-3 rounded-2xl border border-border bg-card px-5 py-4 shadow-sm">
          <span className="grid size-10 shrink-0 place-items-center rounded-full bg-[var(--prism-signal)] text-white font-black text-sm">
            PM
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-black text-foreground">PMCM Events</p>
            <p className="text-xs text-muted-foreground">
              {selectedEvent ? `Chat for ${selectedEvent.eventName}` : "Your event coordination team"}
            </p>
          </div>
          <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <span className="size-2 rounded-full bg-(--prism-success)" />
            Active
          </span>
        </div>

        {/* Chat thread */}
        <div className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden flex flex-col" style={{ minHeight: "420px" }}>
          <div className="flex-1 overflow-y-auto px-5 py-5 space-y-4">
            {chatMessages.length ? chatMessages.map((msg) => (
              <div key={msg.id} className={`flex items-end gap-3 ${msg.fromPmcm ? "" : "flex-row-reverse"}`}>
                <span className={`grid size-8 shrink-0 place-items-center rounded-full text-[11px] font-black ${
                  msg.fromPmcm
                    ? "bg-[var(--prism-signal)]/10 text-[var(--prism-signal)]"
                    : "bg-muted text-muted-foreground"
                }`}>
                  {msg.fromPmcm ? "PM" : clientInitials}
                </span>
                <div className={`max-w-[72%] ${msg.fromPmcm ? "" : "items-end"} flex flex-col gap-1`}>
                  <div className={`rounded-2xl px-4 py-2.5 text-sm leading-5 ${
                    msg.fromPmcm
                      ? "rounded-bl-md bg-muted text-foreground"
                      : "rounded-br-md bg-[var(--prism-signal)] text-white"
                  }`}>
                    {msg.text}
                  </div>
                  <span className={`text-[10px] text-muted-foreground/60 ${msg.fromPmcm ? "pl-1" : "pr-1 text-right"}`}>
                    {msg.sender} · {msg.timestamp}
                  </span>
                </div>
              </div>
            )) : (
              <div className="flex h-full flex-col items-center justify-center py-12 text-center">
                <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-muted">
                  <MessageSquareText className="size-6 text-muted-foreground" />
                </span>
                <h3 className="mt-4 text-base font-black text-foreground">No messages yet</h3>
                <p className="mt-2 max-w-xs text-sm text-muted-foreground">
                  PMCM will send updates and coordination notes here once your event workspace is active.
                </p>
              </div>
            )}
          </div>

          {/* Message input */}
          <div className="border-t border-border bg-muted/20 px-4 py-3">
            <div className="flex items-center gap-2 rounded-xl border border-border bg-background px-3 py-2">
              <Input
                placeholder="Message PMCM…"
                className="flex-1 border-0 bg-transparent p-0 shadow-none focus-visible:ring-0 text-sm"
                disabled
              />
              <button
                type="button"
                disabled
                className="grid size-8 shrink-0 place-items-center rounded-lg bg-[var(--prism-signal)]/20 text-[var(--prism-signal)] opacity-50 cursor-not-allowed"
              >
                <Send className="size-3.5" />
              </button>
            </div>
            <p className="mt-1.5 text-center text-[10px] text-muted-foreground">
              Messaging available after portal activation · Contact PMCM directly for urgent matters
            </p>
          </div>
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
        {route === "details" && renderEventDetailsPage()}
        {route === "progress" && renderProgressPage()}
        {route === "schedule" && renderSchedulePage()}
        {route === "guests" && renderGuestsPage()}
        {route === "preferences" && renderPreferencesPage()}
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
        {route === "approvals" && renderApprovalsPage()}
        {route === "floorplan" && renderFloorPlanPage()}
        {route === "documents" && <ClientDocumentsTab documents={documents} />}
        {route === "billing" && <ClientBillingTab payments={payments} billing={billing} />}
        {route === "messages" && renderMessagesPage()}
        {route === "changes" && renderActionGroup("Change requests", "Client-visible revision and change items for this event.", clientActions)}
        {route === "summary" && renderFinalSummaryPage()}
      </div>
    );
  };

  const pageContent = (
    <div className="space-y-5">
      {error && <NoticeBanner tone="danger">{error}</NoticeBanner>}
      {notice && <NoticeBanner tone="success">{notice}</NoticeBanner>}
      {route === "home" && renderHomePage()}
      {route === "request" && renderRequestPage()}
      {route === "events" && renderEventsPage()}
      {route === "calendar" && renderCalendarPage()}
      {route === "approvals" && !isEventScopedView && renderApprovalsPage()}
      {route === "messages" && !isEventScopedView && renderMessagesPage()}
      {route === "files" && renderFilesPage()}
      {route === "billing" && !isEventScopedView && renderPortalBillingPage()}
      {isEventScopedView && renderEventPage()}
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
      {pageContent}
    </PrismDashboardShell>
  );
}
