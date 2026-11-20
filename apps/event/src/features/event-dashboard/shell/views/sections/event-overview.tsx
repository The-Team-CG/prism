"use client";

import { useState, type ReactNode } from "react";
import { Check, Copy, Gauge } from "lucide-react";
import { derivePrismLifecycleStage, hasEventDatePassed, isBeforePrismEventDay, prismCalendarDateKey } from "@prism/types";
import type { PrismBriefing, PrismDefenseReadiness, PrismDefenseReadinessAction, PrismEvent, PrismFloorPlanDraft, PrismPaymentMilestone, PrismPmcmEventAttention } from "@prism/types";
import { ProgressRing, type AttentionLine, type RingTone } from "@prism/ui/event-cards";
import { manilaDateKey } from "@prism/ui/format-date";
import { formatPeso } from "@prism/ui/payment-track";
import { PrismPanel } from "@prism/ui/page-blocks";
import { Button } from "@prism/ui/components/button";
import { StatusBadge } from "@prism/ui/components/status-badge";
import { RouteLink, cx, label } from "@/features/pmcm-kit";
import type { EventOverviewGlance, EventShortcutCounts } from "@/features/pmcm-overview";
import { EVENT_TAB_ROUTES, eventWorkspaceHref, type DetailTab } from "../../model/event-dashboard-routing";
import { attentionLines } from "../../model/event-card-groups";
import { EventOverviewHero, OverviewAtAGlance, OverviewComingUp, OverviewNeedsYou, OverviewNextStepBar, type AreaTone, type GlanceFact } from "./event-overview-glance";

function isDetailTab(value: string): value is DetailTab {
  return Object.hasOwn(EVENT_TAB_ROUTES, value);
}

const ACTION_DOT: Record<PrismDefenseReadinessAction["status"], string> = { done: "bg-success", attention: "bg-attention", blocked: "bg-danger" };

function plural(count: number, one: string, many = `${one}s`) {
  return `${count} ${count === 1 ? one : many}`;
}

type Summary = PrismDefenseReadiness["summary"] | undefined;
type AreaState = { status: string; tone: AreaTone };

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

function billingArea(summary: Summary, overdue: number | undefined): AreaState {
  if (overdue) return { status: `${plural(overdue, "payment")} overdue`, tone: "attention" };
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

/** What the client has paid against the current milestones, or the billing state while there are none. */
function paidFact(milestones: PrismPaymentMilestone[] | undefined, summary: Summary, overdue: number | undefined): AreaState {
  const current = (milestones ?? []).filter((milestone) => !milestone.supersededAt);
  const total = current.reduce((sum, milestone) => sum + milestone.amount, 0);
  if (total <= 0) return billingArea(summary, overdue);
  const paid = current.reduce((sum, milestone) => sum + milestone.amountPaid, 0);
  if (paid >= total) return { status: `${formatPeso(total)} paid in full`, tone: "done" };
  return { status: `${formatPeso(paid)} of ${formatPeso(total)}`, tone: overdue ? "attention" : "idle" };
}

/**
 * The event's facts at a glance, each opening the page that owns it: where and how big it is, how suppliers, the
 * team, money and the floor plan stand, and after the event how close it is to closing. It replaces a grid of every
 * area, which repeated the sidebar.
 */
export function overviewGlanceFacts({
  event,
  briefing,
  milestones,
  readiness,
  activeDraft,
  draftCount,
  quoteCount,
  quoteRequestCount,
  openCheckCount,
  preEvent,
  counts,
}: {
  event: Pick<PrismEvent, "venue">;
  briefing?: Pick<PrismBriefing, "venue" | "guestCount"> | null;
  milestones?: PrismPaymentMilestone[];
  readiness: PrismDefenseReadiness | null;
  activeDraft?: PrismFloorPlanDraft;
  draftCount: number;
  quoteCount: number;
  quoteRequestCount: number;
  openCheckCount: number;
  preEvent: boolean;
  /** Overdue payments, once that read arrives. */
  counts: EventShortcutCounts;
}): GlanceFact[] {
  const summary = readiness?.summary;
  const venue = briefing?.venue || event.venue;
  const facts: GlanceFact[] = [
    { tab: "briefing", label: "Venue", ...(venue ? { status: venue, tone: "idle" as const } : { status: "To be confirmed", tone: "attention" as const }) },
    { tab: "registration", label: "Guests", status: briefing?.guestCount ? `${briefing.guestCount} expected` : "Not in the briefing yet", tone: "idle" },
    { tab: "suppliers", label: "Suppliers", ...supplierArea(summary, quoteCount, quoteRequestCount) },
    { tab: "coordinators", label: "Team", ...teamArea(summary) },
    { tab: "billing", label: "Paid", ...paidFact(milestones, summary, counts.billing) },
    { tab: "floorplans", label: "Floor plan", ...floorplanArea(activeDraft, draftCount) },
  ];
  if (!preEvent) {
    facts.push({ tab: "live-ops", label: "Event day", ...liveOpsArea(summary) }, { tab: "closure", label: "Closure", ...closureArea(summary, openCheckCount, preEvent) });
  }
  return facts;
}

export type OverviewNextStep = {
  title: string;
  detail?: string;
  href?: string;
  tab?: DetailTab;
  actionLabel: string;
  /** The step is starting the event day itself: a button rather than a link. */
  startEventDay?: boolean;
};

/**
 * The one thing to do next on this event, under the hero with the page's only filled button: start the event day
 * when it is here, then a finished event's close-out, then anything blocking, then the venue visit the floor plan
 * waits on, then the first item waiting on PMCM, and otherwise the first thing holding readiness back.
 */
export function overviewNextStep({ eventDay, lines, visitBlocksFloorplan, pending }: {
  eventDay: boolean;
  lines: AttentionLine[];
  visitBlocksFloorplan: boolean;
  pending: PrismDefenseReadinessAction[];
}): OverviewNextStep | null {
  if (eventDay) return { title: "Event day is here", detail: "Start live operations when the team is on site.", actionLabel: "Start event day", startEventDay: true };
  const closeOut = lines.find((line) => line.id === "close-out");
  if (closeOut) return { title: closeOut.text, detail: closeOut.detail, href: closeOut.href, actionLabel: "Start close-out" };
  const blocker = lines.find((line) => line.severity === "critical");
  if (blocker) return { title: blocker.text, detail: blocker.detail, href: blocker.href, actionLabel: "Open" };
  const visit = lines.find((line) => line.id === "ocular-visit");
  if (visit) return { title: visit.text, detail: "The official floor plan starts once the visit is done.", href: visit.href, actionLabel: "Schedule visit" };
  if (visitBlocksFloorplan) {
    return { title: "Schedule or waive the ocular visit", detail: "The official floor plan can't start until the venue visit is done or waived.", href: `#${OCULAR_VISIT_ANCHOR}`, actionLabel: "Go to the visit" };
  }
  const first = lines[0];
  if (first) return { title: first.text, detail: first.detail, href: first.href, actionLabel: "Open" };
  const action = pending.find((item) => isDetailTab(item.targetTab));
  if (action && isDetailTab(action.targetTab)) return { title: action.label, detail: action.detail, tab: action.targetTab, actionLabel: "Open" };
  return null;
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

function readinessTone(readiness: PrismDefenseReadiness | null): RingTone {
  const score = readiness?.score ?? null;
  if (score === null) return "primary";
  if (score >= 80) return "success";
  return readiness?.overallStatus === "blocked" ? "danger" : "attention";
}

function readinessCaption(readiness: PrismDefenseReadiness | null, pending: number) {
  if (!readiness) return "Run a compliance check to score this event.";
  if (pending === 0) return "Nothing is holding the score back.";
  return pending === 1 ? "1 thing holds the score back." : `${pending} things hold the score back.`;
}

function ReadinessSection({ eventId, readiness, pending, busy, onRunCompliance, onOpenTab, className }: {
  eventId: string;
  readiness: PrismDefenseReadiness | null;
  pending: PrismDefenseReadinessAction[];
  busy: boolean;
  onRunCompliance: () => void;
  onOpenTab: (tab: DetailTab) => void;
  className?: string;
}) {
  const score = readiness?.score ?? null;
  // The check runs from the footer, so the title keeps its full width beside the count.
  const footer = <Button size="sm" variant="ghost" disabled={busy} onClick={onRunCompliance} className="-ml-2 h-7 px-2 text-xs">Run compliance check</Button>;
  return (
    <PrismPanel id="overview-readiness" title="Readiness" icon={Gauge} aside={pending.length ? `${pending.length} to clear` : undefined} footer={footer} className={className}>
      <div className="flex items-center gap-4">
        <ProgressRing value={score} label={score === null ? "Readiness not scored yet" : `Readiness ${score}%`} tone={readinessTone(readiness)}>
          <span className="text-lg font-semibold tabular-nums text-foreground">{score === null ? "—" : `${score}%`}</span>
        </ProgressRing>
        <div className="min-w-0">
          {readiness ? <StatusBadge status={readiness.overallStatus} label={label(readiness.overallStatus)} /> : null}
          <p className="mt-1.5 text-xs text-muted-foreground">{readinessCaption(readiness, pending.length)}</p>
        </div>
      </div>
      <ReadinessReasons eventId={eventId} pending={pending} onOpenTab={onOpenTab} />
    </PrismPanel>
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
  if (!code) return <span className="font-normal text-ink-foreground/70">Generated after setup</span>;
  return (
    <button
      type="button"
      onClick={() => {
        void navigator.clipboard?.writeText(code).then(() => {
          setCopied(true);
          window.setTimeout(() => setCopied(false), 1500);
        });
      }}
      className="inline-flex items-center gap-1.5 font-mono text-sm font-semibold text-ink-foreground hover:underline"
      aria-label={`Copy guest code ${code}`}
    >
      {code}
      {copied ? <Check className="size-3.5 text-success" aria-hidden /> : <Copy className="size-3.5 text-ink-foreground/60" aria-hidden />}
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
  briefing,
  milestones,
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
  /** Ocular visit status and its collapsed controls; rendered under Readiness. */
  ocularVisit?: ReactNode;
  /** The client asked for a venue visit that is not scheduled yet. */
  visitRequested?: boolean;
  /** The client's briefing, for the venue and guest count. */
  briefing?: Pick<PrismBriefing, "venue" | "guestCount"> | null;
  /** The current payment milestones, for what the client has paid so far. */
  milestones?: PrismPaymentMilestone[];
  /** The reads beside the workspace: Inbox items, client activity, dated work and the area counts. */
  glance?: EventOverviewGlance;
  coverUrl?: string;
}) {
  const todayKey = glance?.todayKey ?? manilaDateKey();
  const closeOut = needsCloseOut(event, prismCalendarDateKey());
  const pending = (readiness?.nextActions ?? []).filter((action) => action.status !== "done");
  const reasons = closeOut ? overviewNextActions(pending, true).slice(1) : pending;
  const stage = derivePrismLifecycleStage(event);
  const facts = overviewGlanceFacts({ event, briefing, milestones, readiness, activeDraft, draftCount: drafts.length, quoteCount, quoteRequestCount, openCheckCount, preEvent: isBeforePrismEventDay(stage), counts: glance?.shortcuts ?? {} });
  const eventDay = canStartEventDay && isEventDayClose(event.eventDate) && !closeOut;
  const lines = overviewNeedsYouLines({ event, attention: glance?.attention, closeOut, visitRequested, todayKey });
  const nextStep = overviewNextStep({ eventDay, lines, visitBlocksFloorplan: Boolean(ocularVisit) && !activeDraft, pending: reasons });
  const heroFacts = [
    { label: "Client portal", value: label(event.clientPortalStatus) },
    { label: "Guest code", value: <GuestCode code={event.guestAccessCode} /> },
  ];

  return (
    <div className="space-y-4">
      <EventOverviewHero event={event} coverUrl={coverUrl} clientActivity={glance?.clientActivity} todayKey={todayKey} facts={heroFacts} />

      {nextStep ? <OverviewNextStepBar step={nextStep} eventId={event.id} busy={busy} onStartEventDay={onStartEventDay} onOpenTab={onOpenTab} /> : null}

      {/* Needs you and Readiness side by side at one height; the venue visit sits under them while it is open. */}
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="min-w-0">
          <OverviewNeedsYou lines={lines} loading={glance !== undefined && glance.attention === undefined} />
        </div>
        <ReadinessSection eventId={event.id} readiness={readiness} pending={reasons} busy={busy} onRunCompliance={onRunCompliance} onOpenTab={onOpenTab} />
      </div>
      {ocularVisit ? <div id={OCULAR_VISIT_ANCHOR} className="scroll-mt-20">{ocularVisit}</div> : null}

      <div className="grid gap-4 lg:grid-cols-3">
        <OverviewComingUp eventId={event.id} items={glance?.comingUp} todayKey={todayKey} />
        <div className="min-w-0 lg:col-span-2">
          <OverviewAtAGlance eventId={event.id} facts={facts} onOpenTab={onOpenTab} />
        </div>
      </div>
    </div>
  );
}
