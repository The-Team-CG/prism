"use client";

import { useState, type ReactNode } from "react";
import {
  CalendarCheck,
  Check,
  ChevronRight,
  ClipboardCheck,
  Copy,
  MapPinned,
  Radio,
  ReceiptText,
  Truck,
  UsersRound,
  type LucideIcon,
} from "lucide-react";
import { derivePrismLifecycleStage, hasEventDatePassed, isBeforePrismEventDay, prismCalendarDateKey } from "@prism/types";
import type { PrismDefenseReadiness, PrismDefenseReadinessAction, PrismEvent, PrismFloorPlanDraft, PrismPmcmEventAttention } from "@prism/types";
import type { AttentionLine } from "@prism/ui/event-cards";
import { manilaDateKey } from "@prism/ui/format-date";
import { Button } from "@prism/ui/components/button";
import { StatusBadge } from "@prism/ui/components/status-badge";
import { RouteLink, cx, label } from "@/features/pmcm-kit";
import type { EventOverviewGlance } from "@/features/pmcm-overview";
import { EVENT_TAB_ROUTES, eventWorkspaceHref, type DetailTab } from "../../model/event-dashboard-routing";
import { attentionLines } from "../../model/event-card-groups";
import { EventOverviewHeader, OverviewComingUp, OverviewNeedsYou } from "./event-overview-glance";

type AreaCard = { tab: DetailTab; title: string; icon: LucideIcon; status: string; tone: "done" | "attention" | "idle" };

function isDetailTab(value: string): value is DetailTab {
  return Object.hasOwn(EVENT_TAB_ROUTES, value);
}

const TONE_DOT: Record<AreaCard["tone"], string> = { done: "bg-success", attention: "bg-attention", idle: "bg-border" };
const ACTION_DOT: Record<PrismDefenseReadinessAction["status"], string> = { done: "bg-success", attention: "bg-attention", blocked: "bg-danger" };

function plural(count: number, one: string, many = `${one}s`) {
  return `${count} ${count === 1 ? one : many}`;
}

type Summary = PrismDefenseReadiness["summary"] | undefined;
type AreaState = Pick<AreaCard, "status" | "tone">;

function planningArea(summary: Summary): AreaState {
  if (!summary) return { status: "Briefing, proposal and decisions", tone: "idle" };
  return summary.briefingSubmitted ? { status: "Briefing submitted", tone: "done" } : { status: "Briefing not submitted yet", tone: "attention" };
}

function floorplanArea(activeDraft: PrismFloorPlanDraft | undefined, draftCount: number): AreaState {
  if (activeDraft) return { status: "Official layout approved", tone: "done" };
  return { status: draftCount ? `${plural(draftCount, "draft")}, none approved` : "No layout started", tone: "attention" };
}

function supplierArea(summary: Summary, quoteCount: number, quoteRequestCount: number): AreaState {
  if (summary?.selectedSuppliers) return { status: `${plural(summary.selectedSuppliers, "supplier")} selected`, tone: "done" };
  if (quoteRequestCount) return { status: `${plural(quoteCount, "quote")} from ${plural(quoteRequestCount, "request")}`, tone: "attention" };
  return { status: "No quote requests yet", tone: "idle" };
}

function teamArea(summary: Summary): AreaState {
  if (!summary) return { status: "Coordinator assignments", tone: "idle" };
  if (!summary.coordinatorAssignments) return { status: "Nobody assigned yet", tone: "attention" };
  if (summary.pendingCoordinatorAcknowledgments) return { status: `${plural(summary.pendingCoordinatorAcknowledgments, "assignment")} awaiting confirmation`, tone: "attention" };
  return { status: `${plural(summary.coordinatorAssignments, "coordinator")} confirmed`, tone: "done" };
}

function liveOpsArea(summary: Summary): AreaState {
  return summary?.openLiveOpsItems ? { status: plural(summary.openLiveOpsItems, "open item"), tone: "attention" } : { status: "Nothing open on the event-day desk", tone: "idle" };
}

function billingArea(summary: Summary): AreaState {
  if (!summary) return { status: "Statements and payments", tone: "idle" };
  if (!summary.billingStatements) return { status: "No billing statement yet", tone: "attention" };
  if (summary.unpaidMilestones) return { status: `${plural(summary.unpaidMilestones, "payment")} outstanding`, tone: "attention" };
  return { status: "All payments settled", tone: "done" };
}

function closureArea(summary: Summary, openCheckCount: number, preEvent: boolean): AreaState {
  if (preEvent) return { status: "Opens after the event", tone: "idle" };
  if (summary?.closureReady) return { status: "Ready to close", tone: "done" };
  if (openCheckCount) return { status: plural(openCheckCount, "open check"), tone: "attention" };
  return { status: "Closes after the event", tone: "idle" };
}

function areaCards({
  readiness,
  activeDraft,
  draftCount,
  quoteCount,
  quoteRequestCount,
  openCheckCount,
  preEvent,
}: {
  readiness: PrismDefenseReadiness | null;
  activeDraft?: PrismFloorPlanDraft;
  draftCount: number;
  quoteCount: number;
  quoteRequestCount: number;
  openCheckCount: number;
  preEvent: boolean;
}): AreaCard[] {
  const summary = readiness?.summary;
  return [
    { tab: "briefing", title: "Planning & decisions", icon: ClipboardCheck, ...planningArea(summary) },
    { tab: "floorplans", title: "Floorplans", icon: MapPinned, ...floorplanArea(activeDraft, draftCount) },
    { tab: "suppliers", title: "Suppliers", icon: Truck, ...supplierArea(summary, quoteCount, quoteRequestCount) },
    { tab: "coordinators", title: "Team & roles", icon: UsersRound, ...teamArea(summary) },
    { tab: "live-ops", title: "Live operations", icon: Radio, ...liveOpsArea(summary) },
    { tab: "billing", title: "Billing", icon: ReceiptText, ...billingArea(summary) },
    { tab: "closure", title: "Closure", icon: CalendarCheck, ...closureArea(summary, openCheckCount, preEvent) },
  ];
}

const CLOSE_OUT_ACTION: PrismDefenseReadinessAction = {
  key: "close-out",
  label: "This event has ended — close it out",
  detail: "Work through the closure checks and deliverables, then archive the event.",
  status: "attention",
  targetTab: "closure",
};

/** A past event that is not archived is owed its close-out, so it is the one next step. */
export function needsCloseOut(event: Pick<PrismEvent, "eventDate" | "archived">, todayKey: string): boolean {
  return !event.archived && hasEventDatePassed(event.eventDate, todayKey);
}

/** After the event only money and wrap-up work remain; planning, supplier and team readiness are over. */
const AFTER_EVENT_ACTION_KEYS = new Set(["billing", "closure"]);

/** Once the event date has passed, the close-out leads and only post-event work stays on the list. */
export function overviewNextActions(pending: PrismDefenseReadinessAction[], closeOut: boolean): PrismDefenseReadinessAction[] {
  if (!closeOut) return pending;
  return [CLOSE_OUT_ACTION, ...pending.filter((action) => AFTER_EVENT_ACTION_KEYS.has(action.key))];
}

/** Where the overview's own lines point: the venue-visit panel on this page. */
export const OCULAR_VISIT_ANCHOR = "overview-ocular-visit";

/**
 * What waits on PMCM for this event, in one list: a finished event's close-out first, then a venue visit the client
 * asked for (the Inbox does not track visits), then the Inbox's own items with how long each has waited.
 */
export function overviewNeedsYouLines({ event, attention, closeOut, visitRequested, todayKey }: {
  event: Pick<PrismEvent, "id" | "clientName">;
  attention?: PrismPmcmEventAttention | null;
  closeOut: boolean;
  visitRequested: boolean;
  todayKey: string;
}): AttentionLine[] {
  const own: AttentionLine[] = [];
  if (closeOut) own.push({ id: "close-out", severity: "warning", text: CLOSE_OUT_ACTION.label, detail: CLOSE_OUT_ACTION.detail, href: eventWorkspaceHref(event.id, "closure") });
  if (visitRequested) own.push({ id: "ocular-visit", severity: "warning", text: `Schedule the venue visit ${event.clientName} asked for`, href: `#${OCULAR_VISIT_ANCHOR}` });
  return [...own, ...attentionLines(attention?.top ?? [], todayKey)];
}

/** The readiness reasons shown before "+N more": enough to explain the score without repeating the area tiles. */
const READINESS_REASONS = 4;

function ReadinessReasons({ eventId, pending, onOpenTab }: { eventId: string; pending: PrismDefenseReadinessAction[]; onOpenTab: (tab: DetailTab) => void }) {
  if (pending.length === 0) return null;
  return (
    <ul className="mt-4 grid gap-2 border-t border-border pt-3">
      {pending.slice(0, READINESS_REASONS).map((action) => {
        const tab = isDetailTab(action.targetTab) ? action.targetTab : null;
        const body = (
          <>
            <span aria-hidden className={cx("mt-1.5 size-1.5 shrink-0 rounded-full", ACTION_DOT[action.status])} />
            <span className="min-w-0 flex-1">
              <span className="block text-xs font-medium text-foreground">{action.label}</span>
              <span className="block text-[11px] leading-snug text-muted-foreground">{action.detail}</span>
            </span>
          </>
        );
        return (
          <li key={action.key}>
            {tab ? <RouteLink href={eventWorkspaceHref(eventId, tab)} onNavigate={() => onOpenTab(tab)} className="flex items-start gap-2 rounded-md hover:bg-surface-raised">{body}</RouteLink> : <div className="flex items-start gap-2">{body}</div>}
          </li>
        );
      })}
      {pending.length > READINESS_REASONS ? <li className="pl-3.5 text-[11px] text-muted-foreground">+{pending.length - READINESS_REASONS} more</li> : null}
    </ul>
  );
}

function ReadinessSection({ eventId, readiness, pending, busy, onRunCompliance, onOpenTab }: {
  eventId: string;
  readiness: PrismDefenseReadiness | null;
  pending: PrismDefenseReadinessAction[];
  busy: boolean;
  onRunCompliance: () => void;
  onOpenTab: (tab: DetailTab) => void;
}) {
  const score = readiness?.score ?? null;
  return (
    <section aria-labelledby="overview-readiness" className="rounded-xl border border-border bg-card px-4 py-4 sm:px-5">
      <div className="flex items-center justify-between gap-3">
        <h2 id="overview-readiness" className="font-semibold text-foreground">Readiness</h2>
        <Button size="sm" variant="ghost" disabled={busy} onClick={onRunCompliance} className="h-7 px-2 text-xs">Run compliance check</Button>
      </div>
      <p className="mt-2 flex items-baseline gap-2">
        <span className={cx("text-3xl font-semibold tabular-nums", score === null ? "text-muted-foreground" : score >= 80 ? "text-success" : "text-attention")}>
          {score === null ? "—" : `${score}%`}
        </span>
        {readiness ? <StatusBadge status={readiness.overallStatus} label={label(readiness.overallStatus)} /> : null}
      </p>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={score ?? 0} aria-label="Event readiness">
        <div className={cx("h-full rounded-full", score !== null && score >= 80 ? "bg-success" : "bg-attention")} style={{ width: `${score ?? 0}%` }} />
      </div>
      {readiness && pending.length === 0 ? <p className="mt-3 text-xs text-muted-foreground">Nothing is holding the score back.</p> : null}
      <ReadinessReasons eventId={eventId} pending={pending} onOpenTab={onOpenTab} />
    </section>
  );
}

/** Event day starts tomorrow or has arrived, in Philippine calendar days. */
export function isEventDayClose(eventDate: string, now = new Date()): boolean {
  const day = eventDate.slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return false;
  const tomorrow = manilaDateKey(new Date(now.getTime() + 24 * 60 * 60 * 1000));
  return day <= tomorrow;
}

function GuestCode({ code }: { code?: string | null }) {
  const [copied, setCopied] = useState(false);
  if (!code) return <span className="text-muted-foreground">Generated after setup</span>;
  return (
    <button
      type="button"
      onClick={() => {
        void navigator.clipboard?.writeText(code).then(() => {
          setCopied(true);
          window.setTimeout(() => setCopied(false), 1500);
        });
      }}
      className="inline-flex items-center gap-1.5 font-mono text-sm font-semibold text-foreground hover:text-primary"
      aria-label={`Copy guest code ${code}`}
    >
      {code}
      {copied ? <Check className="size-3.5 text-success" aria-hidden /> : <Copy className="size-3.5 text-muted-foreground" aria-hidden />}
    </button>
  );
}

export function EventWorkspaceOverview({
  event,
  readiness,
  drafts,
  activeDraft,
  quoteRequestCount,
  quoteCount,
  openCheckCount,
  canStartEventDay,
  busy,
  onStartEventDay,
  onRunCompliance,
  onOpenTab,
  ocularVisit,
  visitRequested = false,
  glance,
  coverUrl,
}: {
  event: PrismEvent;
  readiness: PrismDefenseReadiness | null;
  drafts: PrismFloorPlanDraft[];
  activeDraft?: PrismFloorPlanDraft;
  quoteRequestCount: number;
  quoteCount: number;
  openCheckCount: number;
  canStartEventDay: boolean;
  busy: boolean;
  onStartEventDay: () => void;
  onRunCompliance: () => void;
  onOpenTab: (tab: DetailTab) => void;
  /** Ocular visit status and its collapsed controls; rendered under Needs you and Coming up. */
  ocularVisit?: ReactNode;
  /** The client asked for a venue visit that is not scheduled yet. */
  visitRequested?: boolean;
  /** The reads beside the workspace: Inbox items, client activity, dated work and shortcut counts. */
  glance?: EventOverviewGlance;
  coverUrl?: string;
}) {
  const todayKey = glance?.todayKey ?? manilaDateKey();
  const closeOut = needsCloseOut(event, prismCalendarDateKey());
  const pending = (readiness?.nextActions ?? []).filter((action) => action.status !== "done");
  const reasons = closeOut ? overviewNextActions(pending, true).slice(1) : pending;
  const stage = derivePrismLifecycleStage(event);
  const cards = areaCards({ readiness, activeDraft, draftCount: drafts.length, quoteCount, quoteRequestCount, openCheckCount, preEvent: isBeforePrismEventDay(stage) });
  const showEventDayBanner = canStartEventDay && isEventDayClose(event.eventDate) && !closeOut;
  const lines = overviewNeedsYouLines({ event, attention: glance?.attention, closeOut, visitRequested, todayKey });
  const facts = [
    { label: "Client portal", value: <StatusBadge status={event.clientPortalStatus} /> },
    { label: "Guest code", value: <GuestCode code={event.guestAccessCode} /> },
  ];

  return (
    <div className="space-y-5">
      {showEventDayBanner ? (
        <section className="flex flex-wrap items-center justify-between gap-4 rounded-lg border border-primary/25 bg-primary/5 px-5 py-4">
          <div>
            <h2 className="font-semibold text-foreground">Event day is here</h2>
            <p className="mt-0.5 text-sm text-muted-foreground">
              {lines.length ? `${plural(lines.length, "item")} still open below. ` : ""}Start live operations when the team is on site.
            </p>
          </div>
          <Button disabled={busy} onClick={onStartEventDay}>Start event day</Button>
        </section>
      ) : null}

      <EventOverviewHeader event={event} coverUrl={coverUrl} shortcuts={glance?.shortcuts ?? {}} clientActivity={glance?.clientActivity} todayKey={todayKey} facts={facts} />

      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="grid gap-5">
          <OverviewNeedsYou lines={lines} loading={glance !== undefined && glance.attention === undefined} />
          <OverviewComingUp eventId={event.id} items={glance?.comingUp} todayKey={todayKey} />
        </div>
        <ReadinessSection eventId={event.id} readiness={readiness} pending={reasons} busy={busy} onRunCompliance={onRunCompliance} onOpenTab={onOpenTab} />
      </div>

      {ocularVisit ? <div id={OCULAR_VISIT_ANCHOR} className="scroll-mt-20">{ocularVisit}</div> : null}

      <section aria-labelledby="overview-areas">
        <h2 id="overview-areas" className="sr-only">Event areas</h2>
        <ul className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-4">
          {cards.map((card) => (
            <li key={card.tab}>
              <RouteLink
                href={eventWorkspaceHref(event.id, card.tab)}
                onNavigate={() => onOpenTab(card.tab)}
                className="group flex h-full items-start gap-2.5 rounded-lg border border-border bg-card px-3 py-2.5 transition-colors hover:border-primary/30 hover:bg-surface-raised"
              >
                <span className="grid size-7 shrink-0 place-items-center rounded-md bg-muted text-foreground">
                  <card.icon className="size-4" aria-hidden />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2 text-sm font-semibold text-foreground">
                    {card.title}
                    <span aria-hidden className={cx("size-1.5 rounded-full", TONE_DOT[card.tone])} />
                  </span>
                  <span className="mt-0.5 block text-xs text-muted-foreground">{card.status}</span>
                </span>
                <ChevronRight aria-hidden className="mt-1 size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
              </RouteLink>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
