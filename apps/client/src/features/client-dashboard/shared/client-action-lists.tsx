"use client";

import Link from "next/link";
import { CheckCircle2, type LucideIcon } from "lucide-react";
import { formatPortalDate, formatPortalDateTime } from "@prism/ui/format-date";
import { Button } from "@prism/ui/components/button";
import { PrismSection, PrismSectionGroupLabel } from "@prism/ui/page-blocks";
import { formatStatusLabel, type ClientDashboardAction } from "../workspace/model/client-dashboard-view-rules";
import { addendumAmountLabel } from "../addenda/model/client-addenda-rules";
import { groupClientActionsByEvent } from "../home/model/client-home-action-groups";
import { clientActionRowTone, dueState, orderClientActionsByUrgency } from "../home/model/client-home-summary";
import { ClientListEmpty, ClientListRow } from "./client-list-ui";

type OnAction = (action: ClientDashboardAction) => void;

function DecisionFacts({ action, todayKey }: { action: ClientDashboardAction; todayKey: string }) {
  const due = dueState(action.dueAt, todayKey);
  const decision = action.decision;
  const facts: Array<{ text: string; strong?: boolean }> = [];
  if (decision?.kind === "proposal") {
    facts.push({ text: decision.revisionsLeft === 1 ? "1 change request left" : `${decision.revisionsLeft} change requests left` });
  }
  if (decision?.kind === "addendum") facts.push({ text: addendumAmountLabel(decision.financialDelta), strong: decision.financialDelta !== 0 });
  if (due) facts.push({ text: due.label, strong: due.tone !== "neutral" });
  if (!facts.length) return null;
  return (
    <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
      {facts.map((fact) => <span key={fact.text} className={fact.strong ? "font-semibold text-attention" : undefined}>{fact.text}</span>)}
    </p>
  );
}

/** A decision the client owes: what it is, what deciding does, the facts that bear on it, and one way to act. */
export function ClientDecisionCard({ action, todayKey, onAction, showEvent }: { action: ClientDashboardAction; todayKey: string; onAction: OnAction; showEvent: boolean }) {
  const Icon: LucideIcon = action.icon;
  const changeNote = action.decision?.kind === "proposal" ? action.decision.changeNote.trim() : "";
  return (
    <li className="rounded-lg border border-l-[3px] border-border border-l-primary bg-card p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <span aria-hidden className="grid size-9 shrink-0 place-items-center rounded-md bg-primary/10 text-primary">
          <Icon className="size-4" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-foreground">{action.title}</p>
          {showEvent && action.eventName ? <p className="text-xs text-muted-foreground">{action.eventName}</p> : null}
          <p className="mt-1 text-sm text-foreground">{action.description}</p>
          {changeNote ? <p className="mt-1 text-sm text-muted-foreground">What changed: {changeNote}</p> : null}
          <DecisionFacts action={action} todayKey={todayKey} />
        </div>
        <Button
          type="button"
          className="w-full shrink-0 sm:w-auto"
          aria-label={action.eventName ? `${action.ctaLabel} for ${action.eventName}` : action.ctaLabel}
          onClick={() => onAction(action)}
        >
          {action.ctaLabel}
        </Button>
      </div>
    </li>
  );
}

function ActionRow({ action, todayKey, onAction, showEvent }: { action: ClientDashboardAction; todayKey: string; onAction: OnAction; showEvent: boolean }) {
  const settled = action.stage === "done";
  const due = settled ? null : dueState(action.dueAt, todayKey);
  const tone = settled ? "done" : action.stage === "needs_client" ? clientActionRowTone(action) : "neutral";
  const meta = [showEvent ? action.eventName : null, action.description].filter(Boolean).join(" · ");
  const status = settled
    ? (action.decidedAt ? formatPortalDate(action.decidedAt) : "Done")
    : due?.label ?? formatStatusLabel(action.status);
  return (
    <ClientListRow
      icon={settled ? CheckCircle2 : action.icon}
      tone={tone}
      title={action.title}
      meta={meta || undefined}
      metaTitle={meta || undefined}
      tag={action.stage === "needs_client" && action.priority === "critical" ? "Blocking" : undefined}
      status={status}
      statusTitle={action.dueAt ? formatPortalDateTime(action.dueAt) : undefined}
      action={action.ctaLabel}
      onOpen={() => onAction(action)}
    />
  );
}

function RowList({ actions, todayKey, onAction, showEvent }: { actions: ClientDashboardAction[]; todayKey: string; onAction: OnAction; showEvent: boolean }) {
  return <ul className="divide-y divide-border">{actions.map((action) => <ActionRow key={action.id} action={action} todayKey={todayKey} onAction={onAction} showEvent={showEvent} />)}</ul>;
}

/** Decisions as cards, then the rest of what the client owes as rows. */
function NeedsYouBody({ actions, todayKey, onAction, showEvent }: { actions: ClientDashboardAction[]; todayKey: string; onAction: OnAction; showEvent: boolean }) {
  const decisions = actions.filter((action) => action.decision);
  const tasks = actions.filter((action) => !action.decision);
  return (
    <>
      {decisions.length ? (
        <ul className="space-y-3 p-4">
          {decisions.map((action) => <ClientDecisionCard key={action.id} action={action} todayKey={todayKey} onAction={onAction} showEvent={showEvent} />)}
        </ul>
      ) : null}
      {tasks.length ? <div className={decisions.length ? "border-t border-border" : undefined}><RowList actions={tasks} todayKey={todayKey} onAction={onAction} showEvent={showEvent} /></div> : null}
    </>
  );
}

/**
 * Everything the client's action list holds, in one order on every screen: what needs the client, what is with
 * PMCM, news to read and, inside one event, what was recently settled. The account view groups the client's own
 * items by event; `leadActionId` is a step a hero above already shows, so it is not listed twice.
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
  scope: "account" | "event";
  leadActionId?: string;
  /** Offered beside "You're all caught up" inside an event. */
  emptyAction?: { label: string; href: string };
}) {
  const own = orderClientActionsByUrgency(actions.filter((action) => action.stage === "needs_client"));
  const withPmcm = actions.filter((action) => action.stage === "with_pmcm");
  const toReview = actions.filter((action) => action.stage === "to_review");
  const done = scope === "event"
    ? actions.filter((action) => action.stage === "done").sort((a, b) => (b.decidedAt ?? "").localeCompare(a.decidedAt ?? ""))
    : [];
  const listed = own.filter((action) => action.id !== leadActionId);
  const several = scope === "account" && new Set(actions.map((action) => action.eventId ?? "")).size > 1;

  if (scope === "account" && own.length + withPmcm.length + toReview.length === 0) {
    return <ClientListEmpty icon={CheckCircle2} title="You're all caught up" description="Nothing needs you right now. PMCM will let you know when something is ready for you." />;
  }

  return (
    <div className="space-y-6">
      {listed.length ? (
        <PrismSection id="client-actions" title={listed.length === own.length ? "Needs you" : "Also needs you"} count={listed.length} flush>
          {several
            ? groupClientActionsByEvent(listed).map((group, index) => (
              <div key={group.eventId || "account"} className={index ? "border-t border-border" : undefined}>
                <PrismSectionGroupLabel>{group.eventName}</PrismSectionGroupLabel>
                <NeedsYouBody actions={[...group.now, ...group.later]} todayKey={todayKey} onAction={onAction} showEvent={false} />
              </div>
            ))
            : <NeedsYouBody actions={listed} todayKey={todayKey} onAction={onAction} showEvent={false} />}
        </PrismSection>
      ) : scope === "event" ? (
        <PrismSection id="client-actions" title="Needs you" count={0}>
          <div className="flex flex-wrap items-center gap-3">
            <CheckCircle2 aria-hidden className="size-5 shrink-0 text-success" />
            <p className="min-w-0 flex-1 basis-60 text-sm text-muted-foreground">
              <span className="font-semibold text-foreground">You&apos;re all caught up.</span>{" "}
              {withPmcm.length ? "The rest is with PMCM. We'll let you know when something is ready for you." : "PMCM will let you know when something is ready for you."}
            </p>
            {emptyAction ? <Button asChild variant="outline" size="sm"><Link href={emptyAction.href}>{emptyAction.label}</Link></Button> : null}
          </div>
        </PrismSection>
      ) : null}
      {withPmcm.length ? (
        <PrismSection id="client-actions-pmcm" title="Waiting on PMCM" count={withPmcm.length} description="You've done your part. PMCM has these now." flush>
          <RowList actions={withPmcm} todayKey={todayKey} onAction={onAction} showEvent={several} />
        </PrismSection>
      ) : null}
      {toReview.length ? (
        <PrismSection id="client-actions-updates" title="New to read" count={toReview.length} flush>
          <RowList actions={toReview} todayKey={todayKey} onAction={onAction} showEvent={several} />
        </PrismSection>
      ) : null}
      {done.length ? (
        <PrismSection id="client-actions-done" title="Recently decided" count={done.length} flush>
          <RowList actions={done} todayKey={todayKey} onAction={onAction} showEvent={false} />
        </PrismSection>
      ) : null}
    </div>
  );
}
