import type { LucideIcon } from "lucide-react";
import {
  BadgeCheck,
  FileText,
  MapPinned,
  MessageSquareText,
  Presentation,
  ReceiptText,
} from "lucide-react";
import type { PrismClientActionItem, PrismClientWorkspace, PrismEvent, PrismFloorPlanDraft } from "@prism/types";
import type { CanvasObject as VenueObject, Project } from "@/features/floorplan/editor";
import type { DetailTab } from "./client-dashboard-types";

export function draftIsOfficial(draft: PrismFloorPlanDraft) {
  return draft.status === "in_review" || draft.status === "approved" || draft.status === "revision_requested";
}

export function objectBox(object: VenueObject, project: Project) {
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

export function formatStatusLabel(status?: string) {
  return status ? status.replaceAll("_", " ") : "Pending";
}

export function clientFloorplanDashboardActionLabel(status?: PrismEvent["floorPlanStatus"]) {
  if (status === "not_started") return "Set layout preferences";
  if (status === "in_review" || status === "approved") return "View official floorplan";
  return "Open floor plan";
}

export const EVENT_MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

export function eventDateParts(date?: string | null) {
  if (!date) return { day: "--", month: "TBD", year: "" };
  const [year, month, day] = date.split("-");
  const monthIndex = Number(month) - 1;
  return {
    day: day?.padStart(2, "0") ?? "--",
    month: EVENT_MONTHS[monthIndex]?.toUpperCase() ?? "TBD",
    year: year ?? "",
  };
}

export function formatEventDate(date?: string | null) {
  const parts = eventDateParts(date);
  if (!date || parts.month === "TBD") return "Date pending";
  return `${EVENT_MONTHS[EVENT_MONTHS.findIndex((month) => month.toUpperCase() === parts.month)]} ${Number(parts.day)}, ${parts.year}`;
}

export function portalBadgeStatus(status?: PrismEvent["clientPortalStatus"]) {
  return status === "unlocked" ? "approved" : "locked";
}

export function portalBadgeLabel(status?: PrismEvent["clientPortalStatus"]) {
  return status === "unlocked" ? "Conforme signed" : "Portal locked";
}

export type ClientDashboardAction = {
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

export const money = new Intl.NumberFormat("en-PH", {
  style: "currency",
  currency: "PHP",
  maximumFractionDigits: 0,
});

export function clientActionIcon(kind: PrismClientActionItem["kind"]): LucideIcon {
  if (kind === "billing") return ReceiptText;
  if (kind === "document" || kind === "closure") return FileText;
  if (kind === "floorplan") return MapPinned;
  if (kind === "approval") return BadgeCheck;
  if (kind === "feedback") return MessageSquareText;
  return Presentation;
}

export function clientActionTarget(kind: PrismClientActionItem["kind"]): DetailTab {
  if (kind === "billing") return "billing";
  if (kind === "document" || kind === "closure") return "documents";
  if (kind === "floorplan") return "floorplan";
  if (kind === "approval") return "proposal";
  if (kind === "feedback") return "activity";
  return "briefing";
}

export function clientActionTone(
  priority: PrismClientActionItem["priority"],
): ClientDashboardAction["tone"] {
  if (priority === "critical" || priority === "warning") return "warning";
  if (priority === "attention") return "primary";
  return "neutral";
}

export function actionCenterItemToDashboardAction(
  item: PrismClientActionItem,
): ClientDashboardAction {
  return {
    id: item.id,
    title: item.label,
    description: item.description,
    detail: formatEventDate(item.dueAt),
    ctaLabel: "Open",
    href: item.href,
    icon: clientActionIcon(item.kind),
    targetTab: clientActionTarget(item.kind),
    status: item.status,
    tone: clientActionTone(item.priority),
  };
}

export function selectNextAction(actions: ClientDashboardAction[]) {
  return (
    actions.find((action) => action.tone === "warning") ??
    actions.find((action) => action.tone === "primary") ??
    actions[0]
  );
}


export function greetingByTime(name: string) {
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const firstName = name.split(" ")[0];
  return `${greeting}, ${firstName}.`;
}

export function eventProgressDots(ev: PrismEvent, state: PrismClientWorkspace) {
  const drafts = state.floorPlanDrafts.filter((d) => d.eventId === ev.id);
  const billing = state.billingStatements.find((b) => b.eventId === ev.id);
  const docs = state.documents.filter((d) => d.eventId === ev.id);
  const briefing = state.briefings.find((b) => b.eventId === ev.id);

  return [
    { label: "Briefing", done: Boolean(briefing) },
    { label: "Floor plan", done: drafts.some((d) => d.status === "approved") },
    {
      label: "Billing",
      done: billing?.status === "approved" || billing?.status === "paid",
    },
    {
      label: "Documents",
      done:
        docs.length > 0 &&
        !docs.some((d) => /needs|pending|requested/i.test(d.status)),
    },
  ];
}

export const FLOOR_PLAN_PREVIEW_CACHE_MS = 60_000;
export const floorPlanPreviewCache = new Map<
  string,
  { project: Project; loadedAt: number }
>();

export function isFresh(loadedAt: number, ttl: number) {
  return Date.now() - loadedAt < ttl;
}

export function floorPlanPreviewCacheKey(eventId: string, draft: PrismFloorPlanDraft) {
  return `${eventId}:${draft.id}:${draft.updatedAt ?? draft.status}`;
}
