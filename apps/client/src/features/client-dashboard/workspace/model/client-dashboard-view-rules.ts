import type { LucideIcon } from "lucide-react";
import {
  BadgeCheck,
  ClipboardList,
  FileText,
  MapPinned,
  MessageSquareText,
  Presentation,
  ReceiptText,
} from "lucide-react";
import type { PrismClientActionItem, PrismClientActionStage, PrismClientDecisionFacts, PrismClientWorkspace, PrismEvent, PrismFloorPlanDraft } from "@prism/types";
import type { ClientPlanLayout } from "@/features/floorplan/snapshot-project";
import type { DetailTab } from "./client-dashboard-types";

/** PMCM's official plans; a client's own preference is never official, however it was reviewed. */
export function draftIsOfficial(draft: PrismFloorPlanDraft) {
  return draft.sourceType !== "client_preference" &&
    (draft.status === "in_review" || draft.status === "approved" || draft.status === "revision_requested");
}

/** Enum values read as sentence case: "in_planning" → "In planning". */
export function formatStatusLabel(status?: string) {
  if (!status) return "Pending";
  const words = status.replaceAll(/[_-]+/g, " ").trim().toLowerCase();
  return words.charAt(0).toUpperCase() + words.slice(1);
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
  const [year, month, day] = date.slice(0, 10).split("-");
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
  eventId?: string;
  eventName?: string;
  icon: LucideIcon;
  targetTab: DetailTab;
  status: string;
  tone: "primary" | "success" | "warning" | "neutral";
  /** Who moves it next, as the server decided: the client, PMCM, nobody (news), or settled. */
  stage: PrismClientActionStage;
  /** Urgent or overdue now, rather than a requirement for a later stage. */
  blocking?: boolean;
  /** Server priority and raw due date, for list colour and due phrases. */
  priority?: PrismClientActionItem["priority"];
  dueAt?: string | null;
  decidedAt?: string | null;
  /** What the client needs to know to decide; present on proposal and addendum decisions. */
  decision?: PrismClientDecisionFacts;
};

export const money = new Intl.NumberFormat("en-PH", {
  style: "currency",
  currency: "PHP",
  maximumFractionDigits: 0,
});

export function clientActionIcon(kind: PrismClientActionItem["kind"]): LucideIcon {
  if (kind === "billing") return ReceiptText;
  if (kind === "document" || kind === "closure") return FileText;
  if (kind === "addendum") return FileText;
  if (kind === "floorplan") return MapPinned;
  if (kind === "approval") return BadgeCheck;
  if (kind === "feedback") return MessageSquareText;
  if (kind === "change_request") return ClipboardList;
  return Presentation;
}

export function clientActionTarget(kind: PrismClientActionItem["kind"]): DetailTab {
  if (kind === "addendum") return "overview";
  if (kind === "billing") return "billing";
  if (kind === "document" || kind === "closure") return "documents";
  if (kind === "floorplan") return "floorplan";
  if (kind === "approval") return "proposal";
  if (kind === "feedback" || kind === "change_request") return "activity";
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
    detail: item.dueAt ? `Due ${formatEventDate(item.dueAt)}` : "No deadline set",
    ctaLabel: clientActionLabel(item),
    href: item.href,
    eventId: item.eventId,
    eventName: item.eventName,
    icon: clientActionIcon(item.kind),
    targetTab: clientActionTarget(item.kind),
    status: item.status,
    tone: clientActionTone(item.priority),
    stage: item.stage,
    blocking: item.stage === "needs_client" && (item.priority === "critical" || item.priority === "warning"),
    priority: item.priority,
    dueAt: item.dueAt ?? null,
    decidedAt: item.decidedAt ?? null,
    decision: item.decision,
  };
}

const CLIENT_ACTION_LABEL: Partial<Record<PrismClientActionItem["kind"], string>> = {
  addendum: "Review and sign",
  billing: "Review payment",
  briefing: "Complete briefing",
  feedback: "Share feedback",
  closure: "Review closeout",
  document: "Review documents",
  change_request: "View request",
};

function clientActionLabel(item: PrismClientActionItem): string {
  if (item.kind === "floorplan") return item.id.startsWith("floorplan:preferences:") ? "Add preferences" : "View layout";
  if (item.decision?.kind === "proposal") return item.stage === "needs_client" ? "Review proposal" : "Read proposal";
  if (item.kind === "approval" && item.href?.endsWith("/proposal")) return "View proposal";
  if (item.kind === "addendum" && item.stage !== "needs_client") return "View addendum";
  return CLIENT_ACTION_LABEL[item.kind] ?? "View details";
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
      label: "Files",
      done:
        docs.length > 0 &&
        !docs.some((d) => /needs|pending|requested/i.test(d.status)),
    },
  ];
}

export const FLOOR_PLAN_PREVIEW_CACHE_MS = 60_000;
export const floorPlanPreviewCache = new Map<
  string,
  { layout: ClientPlanLayout; loadedAt: number }
>();

export function isFresh(loadedAt: number, ttl: number) {
  return Date.now() - loadedAt < ttl;
}

export function floorPlanPreviewCacheKey(eventId: string, draft: PrismFloorPlanDraft) {
  return `${eventId}:${draft.id}:${draft.updatedAt ?? draft.status}`;
}
