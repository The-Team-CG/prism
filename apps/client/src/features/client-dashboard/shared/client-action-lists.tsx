"use client";

import Link from "next/link";
import { CheckCircle2, Clock } from "lucide-react";
import { daysUntil, formatPortalDate, formatPortalDateTime, manilaCalendarKey } from "@prism/ui/format-date";
import { PrismListCluster, type PrismListTone } from "@prism/ui/action-list";
import { Button } from "@prism/ui/components/button";
import { PrismEmptyLine, PrismSection } from "@prism/ui/page-blocks";
import { formatStatusLabel, type ClientDashboardAction } from "../workspace/model/client-dashboard-view-rules";
import { addendumSignedAmount } from "../addenda/model/client-addenda-rules";
import { CLIENT_PROPOSAL_REVISION_CAP } from "../proposal/model/proposal-review-rules";
import { clientActionRowTone, dueState } from "../home/model/client-home-summary";
import { ClientListEmpty, ClientListRow } from "./client-list-ui";

type OnAction = (action: ClientDashboardAction) => void;

/** Within this many days a dated item stays in "Needs you" on Home; later ones wait under "Later". */
export const CLIENT_NEEDS_YOU_WINDOW_DAYS = 7;

/**
 * What the client should see first on Home: decisions, anything blocking or overdue, and what is due within a week.
 * The rest is real work but can wait, so it collapses under "Later".
 */
export function isClientActionNow(action: ClientDashboardAction, todayKey: string): boolean {
  if (action.decision || action.priority === "critical") return true;
  // A dated item follows its date, even when it holds a stage back; an undated blocker cannot wait.
  if (!action.dueAt) return Boolean(action.blocking);
  const days = daysUntil(manilaCalendarKey(action.dueAt), todayKey);
  return days !== null && days <= CLIENT_NEEDS_YOU_WINDOW_DAYS;
}

/** Blockers first, then decisions, then what holds a stage back, then the rest; soonest due first within each. */
export function orderNeedsYou(actions: ClientDashboardAction[]): ClientDashboardAction[] {
  const rank = (action: ClientDashboardAction) =>
    action.priority === "critical" ? 0 : action.decision ? 1 : action.blocking || action.priority === "attention" ? 2 : 3;
  const due = (action: ClientDashboardAction) => action.dueAt ?? "9999";
  return actions
    .map((action, index) => ({ action, index }))
    .sort((a, b) => rank(a.action) - rank(b.action) || due(a.action).localeCompare(due(b.action)) || a.index - b.index)
    .map((entry) => entry.action);
}

/** The figure a row lines up in its status column, and what that figure means. */
function rowStatus(action: ClientDashboardAction, todayKey: string): { status: string; detail?: string; tone?: PrismListTone; title?: string } {
  if (action.stage === "done") return { status: action.decidedAt ? formatPortalDate(action.decidedAt) : "Done", tone: "done" };
  const decision = action.decision;
  if (decision?.kind === "addendum") {
    if (decision.financialDelta === 0) return { status: "No change", detail: "to your contract amount" };
    return { status: addendumSignedAmount(decision.financialDelta), detail: decision.financialDelta > 0 ? "to your contract" : "from your contract", tone: "attention" };
  }
  if (decision?.kind === "proposal") {
    return { status: `${decision.revisionsLeft} of ${CLIENT_PROPOSAL_REVISION_CAP} left`, detail: "change requests", tone: "neutral" };
  }
  const due = dueState(action.dueAt, todayKey);
  if (due) return { status: due.label, tone: due.tone, title: action.dueAt ? formatPortalDateTime(action.dueAt) : undefined };
  return { status: formatStatusLabel(action.status) };
}

/** Colour marks only what the client still owes: settled rows read as done, decisions and other people's work stay grey. */
function rowTone(action: ClientDashboardAction): PrismListTone {
  if (action.stage === "done") return "done";
  if (action.stage !== "needs_client" || action.decision) return "neutral";
  return clientActionRowTone(action);
}

function rowMeta(action: ClientDashboardAction, showEvent: boolean): string | undefined {
  const meta = [showEvent ? action.eventName : null, action.description].filter(Boolean).join(" · ");
  return meta || undefined;
}

/** What changed in a proposal version, as the decision row's second line. */
function changeNoteDetail(action: ClientDashboardAction) {
  const note = action.decision?.kind === "proposal" ? action.decision.changeNote.trim() : "";
  return note ? <><span className="font-semibold">What changed:</span> {note}</> : undefined;
}

function ActionRow({ action, todayKey, onAction, showEvent, primary }: {
  action: ClientDashboardAction;
  todayKey: string;
  onAction: OnAction;
  showEvent: boolean;
  primary: boolean;
}) {
  const owed = action.stage === "needs_client";
  const meta = rowMeta(action, showEvent);
  const status = rowStatus(action, todayKey);
  return (
    <ClientListRow
      icon={action.stage === "done" ? CheckCircle2 : action.icon}
      tone={rowTone(action)}
      decision={owed && Boolean(action.decision)}
      primary={primary}
      title={action.title}
      meta={meta}
      metaTitle={meta}
      detail={changeNoteDetail(action)}
      tag={owed && action.priority === "critical" ? "Blocking" : undefined}
      status={status.status}
      statusDetail={status.detail}
      statusTone={status.tone}
      statusTitle={status.title}
      action={action.ctaLabel}
      onOpen={() => onAction(action)}
    />
  );
}

function RowList({ actions, todayKey, onAction, showEvent, primaryId }: {
  actions: ClientDashboardAction[];
  todayKey: string;
  onAction: OnAction;
  showEvent: boolean;
  primaryId?: string;
}) {
  return (
    <ul className="divide-y divide-border">
      {actions.map((action) => <ActionRow key={action.id} action={action} todayKey={todayKey} onAction={onAction} showEvent={showEvent} primary={action.id === primaryId} />)}
    </ul>
  );
}

/** "Layout preferences, feedback and 2 more": what the collapsed Later group holds, by kind. */
function laterSummary(actions: ClientDashboardAction[]): string {
  const titles = [...new Set(actions.map((action) => action.title.toLowerCase()))];
  const text = titles.length <= 2 ? titles.join(" and ") : `${titles.slice(0, 2).join(", ")} and ${titles.length - 2} more`;
  return text.charAt(0).toUpperCase() + text.slice(1);
}

type ListScope = "account" | "event";

/**
 * The client's actions sorted into the list's sections. On Home, what needs the client splits into now and Later;
 * inside an event every owed item is "now", and recently decided items get their own section.
 */
function clientActionGroups(actions: ClientDashboardAction[], scope: ListScope, todayKey: string, leadActionId?: string) {
  const own = orderNeedsYou(actions.filter((action) => action.stage === "needs_client" && action.id !== leadActionId));
  const inEvent = scope === "event";
  const now = inEvent ? own : own.filter((action) => isClientActionNow(action, todayKey));
  return {
    own,
    now,
    later: inEvent ? [] : own.filter((action) => !isClientActionNow(action, todayKey)),
    withPmcm: actions.filter((action) => action.stage === "with_pmcm"),
    toReview: actions.filter((action) => action.stage === "to_review"),
    done: inEvent ? actions.filter((action) => action.stage === "done").sort((a, b) => (b.decidedAt ?? "").localeCompare(a.decidedAt ?? "")) : [],
    // Inside an event the first decision carries the screen's one filled button; on Home the hero already has it.
    primaryId: inEvent ? now.find((action) => action.decision)?.id : undefined,
    hasLead: Boolean(leadActionId && actions.some((action) => action.id === leadActionId)),
  };
}

type ActionGroups = ReturnType<typeof clientActionGroups>;
type RowProps = { todayKey: string; onAction: OnAction; showEvent: boolean };

function NeedsYouSection({ groups, rows }: { groups: ActionGroups; rows: RowProps }) {
  const { own, now, later, primaryId, hasLead } = groups;
  return (
    <PrismSection id="client-actions" title={hasLead ? "Also needs you" : "Needs you"} count={own.length} headerOutside flush>
      <ul className="divide-y divide-border">
        {now.map((action) => <ActionRow key={action.id} action={action} {...rows} primary={action.id === primaryId} />)}
        {later.length ? (
          <PrismListCluster icon={Clock} title={`Later · ${later.length}`} meta={laterSummary(later)}>
            {later.map((action) => <ActionRow key={action.id} action={action} {...rows} primary={false} />)}
          </PrismListCluster>
        ) : null}
      </ul>
    </PrismSection>
  );
}

/** Inside an event with nothing owed: one line, and a way to ask for a change when there is one. */
function CaughtUpSection({ restWithPmcm, emptyAction }: { restWithPmcm: boolean; emptyAction?: { label: string; href: string } }) {
  return (
    <PrismSection id="client-actions" title="Needs you" count={0} headerOutside>
      <PrismEmptyLine
        icon={CheckCircle2}
        action={emptyAction ? <Button asChild variant="outline" size="sm"><Link href={emptyAction.href}>{emptyAction.label}</Link></Button> : undefined}
      >
        <span className="font-semibold text-foreground">You&apos;re all caught up.</span>{" "}
        {restWithPmcm ? "The rest is with PMCM. We'll let you know when something is ready for you." : "PMCM will let you know when something is ready for you."}
      </PrismEmptyLine>
    </PrismSection>
  );
}

function RowsSection({ id, title, description, actions, rows }: { id: string; title: string; description?: string; actions: ClientDashboardAction[]; rows: RowProps }) {
  if (actions.length === 0) return null;
  return (
    <PrismSection id={id} title={title} count={actions.length} description={description} headerOutside flush>
      <RowList actions={actions} {...rows} />
    </PrismSection>
  );
}

/** Home has nothing at all for the client: no owed work, nothing with PMCM, no news, and no hero step. */
function nothingOnHome(groups: ActionGroups) {
  return groups.own.length + groups.withPmcm.length + groups.toReview.length === 0 && !groups.hasLead;
}

/**
 * Everything the client's action list holds, in one order on every screen: what needs the client, what is with
 * PMCM, news to read and, inside one event, what was recently decided. Each section is one heading and one surface
 * of aligned rows; decisions are tinted rows in the same grid. On Home the hero above already carries the screen's
 * filled button and `leadActionId` names its step, so the list adds none; inside an event the first decision gets it.
 */
export function ClientActionLists({
  actions,
  onAction,
  todayKey,
  scope,
  leadActionId,
  emptyAction,
}: {
  actions: ClientDashboardAction[];
  onAction: OnAction;
  todayKey: string;
  scope: ListScope;
  leadActionId?: string;
  /** Offered beside "You're all caught up" inside an event. */
  emptyAction?: { label: string; href: string };
}) {
  const groups = clientActionGroups(actions, scope, todayKey, leadActionId);
  const rows: RowProps = { todayKey, onAction, showEvent: scope === "account" };
  const owesSomething = groups.now.length + groups.later.length > 0;

  if (scope === "account" && nothingOnHome(groups)) {
    return <ClientListEmpty icon={CheckCircle2} title="You're all caught up" description="Nothing needs you right now. PMCM will let you know when something is ready for you." />;
  }

  return (
    <div className="space-y-6">
      {owesSomething ? <NeedsYouSection groups={groups} rows={rows} /> : null}
      {!owesSomething && scope === "event" ? <CaughtUpSection restWithPmcm={groups.withPmcm.length > 0} emptyAction={emptyAction} /> : null}
      <RowsSection id="client-actions-pmcm" title="Waiting on PMCM" description="You've done your part. PMCM has these now." actions={groups.withPmcm} rows={rows} />
      <RowsSection id="client-actions-updates" title="New to read" actions={groups.toReview} rows={rows} />
      <RowsSection id="client-actions-done" title="Recently decided" actions={groups.done} rows={{ ...rows, showEvent: false }} />
    </div>
  );
}

/**
 * The top of an event's "Needs you" on its overview: a few rows in the shared order after the step the hero leads
 * with, and a link to the full list. Nothing renders when the hero's step is all there is.
 */
export function ClientNeedsYouPreview({ actions, onAction, todayKey, leadActionId, allHref, limit = 3 }: {
  actions: ClientDashboardAction[];
  onAction: OnAction;
  todayKey: string;
  leadActionId?: string;
  allHref: string;
  limit?: number;
}) {
  const rest = orderNeedsYou(actions.filter((action) => action.stage === "needs_client" && action.id !== leadActionId));
  if (rest.length === 0) return null;
  return (
    <PrismSection
      id="overview-needs-you"
      title={leadActionId ? "Also needs you" : "Needs you"}
      count={rest.length}
      headerOutside
      flush
      action={<Link href={allHref} className="text-sm font-medium text-primary hover:text-primary/80">{rest.length > limit ? `See all ${rest.length}` : "Open actions"}</Link>}
    >
      <RowList actions={rest.slice(0, limit)} todayKey={todayKey} onAction={onAction} showEvent={false} />
    </PrismSection>
  );
}
