"use client";

import Link from "next/link";
import { Archive, ArrowRight, CalendarCheck, RefreshCcw, CalendarClock, ClipboardCheck, FileSignature, Radio, ReceiptText, Send, Truck, type LucideIcon } from "lucide-react";
import { formatPortalDate, formatPortalDateTime } from "@prism/ui/format-date";
import type { PrismSupplierQuote, PrismSupplierReadinessItem, PrismSupplierReadinessBoard } from "@prism/types";
import { quoteDeadlineUrgency, readinessConcernLabel } from "../../model/supplier-workspace-rules";
import { groupSupplierNextSteps, splitSupplierNextSteps, supplierNextStep, supplierRowStatus, supplierStepFigure, supplierStepGroupTitle, supplierTodaySummary, supplierWorkHref, type SupplierStepKind } from "../../model/supplier-next-step";
import { Button } from "@prism/ui/components/button";
import { PrismEmptyLine, PrismPageColumn } from "@prism/ui/page-blocks";
import { PrismListCluster, PrismListRow, PrismListSection } from "@prism/ui/action-list";
import { EventCover, NextStepHero } from "@prism/ui/event-cards";
import { useEventCoverUrl } from "../../view-models/use-event-cover-url";

const STEP_ICON: Record<SupplierStepKind, LucideIcon> = {
  quote: ReceiptText,
  "quote-submitted": Send,
  closed: Archive,
  arrival: Truck,
  confirm: CalendarCheck,
  "contract-fix": FileSignature,
  contract: FileSignature,
  schedule: CalendarClock,
  readiness: ClipboardCheck,
  "contract-review": FileSignature,
  updates: Radio,
};

/** The date that matters for this step: the quote deadline while bidding, then arrival or the event day. */
function nextStepWhen(item: PrismSupplierReadinessItem) {
  const eventDay = item.eventDate ? `Event ${formatPortalDate(item.eventDate)}` : null;
  if (item.quoteStatus !== "selected") return [`Quote due ${formatPortalDate(item.dueAt, "—")}`, eventDay].filter(Boolean).join(" · ");
  if (item.schedule) return `Arrive ${formatPortalDateTime(item.schedule.ingressAt)}`;
  return eventDay ?? "Schedule not set yet";
}

/**
 * One piece of work as the shared row the client home and the PMCM Inbox use: the step, its booking, when it is due
 * and what opening it does. Work waiting on PMCM stays grey: its dates are not the supplier's to chase.
 */
function WorkRow({ item, hasQuote, waiting = false }: { item: PrismSupplierReadinessItem; hasQuote: boolean; waiting?: boolean }) {
  const next = supplierNextStep(item, hasQuote);
  const status = supplierRowStatus(item);
  const concern = item.concerns[0];
  const tone = waiting ? "neutral" : concern && status?.tone !== "urgent" ? "attention" : status?.tone ?? "neutral";
  return (
    <PrismListRow
      icon={STEP_ICON[next.kind]}
      tone={tone}
      title={next.title}
      meta={[item.eventName ?? "Assigned event", item.category, concern ? `${readinessConcernLabel(concern.kind)}: ${concern.message}` : null].filter(Boolean).join(" · ")}
      metaTitle={next.detail}
      status={status?.label}
      statusTone={waiting ? "neutral" : status?.tone}
      statusTitle={nextStepWhen(item)}
      action={next.action}
      href={supplierWorkHref(item)}
      link={Link}
    />
  );
}

/** Several bookings at the same step, as one row that opens to list them. */
function WorkGroup({ title, items, hasQuote }: { title: string; items: PrismSupplierReadinessItem[]; hasQuote: (item: PrismSupplierReadinessItem) => boolean }) {
  const [first] = items;
  const late = items.some((item) => supplierRowStatus(item)?.tone === "urgent");
  return (
    <PrismListCluster
      icon={STEP_ICON[supplierNextStep(first, hasQuote(first)).kind]}
      tone={late ? "urgent" : "attention"}
      title={supplierStepGroupTitle(title, items.length)}
      meta={items.map((item) => item.eventName ?? "Assigned event").filter((name, index, names) => names.indexOf(name) === index).join(" · ")}
    >
      {items.map((item) => <WorkRow key={item.id} item={item} hasQuote={hasQuote(item)} />)}
    </PrismListCluster>
  );
}

/** The lead: the supplier's most urgent step, with how long it has left (or how late it is) and its one action. */
function TodayLead({ item, hasQuote, count = 1 }: { item: PrismSupplierReadinessItem; hasQuote: boolean; count?: number }) {
  const next = supplierNextStep(item, hasQuote);
  const urgency = quoteDeadlineUrgency(item);
  const coverUrl = useEventCoverUrl(item.eventId, item.coverObjectId);
  const single = count === 1;
  return (
    <NextStepHero
      when={[nextStepWhen(item), urgency === "overdue" ? "overdue" : null].filter(Boolean).join(" · ")}
      title={supplierStepGroupTitle(next.title, count)}
      event={single ? <p><span className="font-medium text-ink-foreground">{item.eventName ?? "Assigned event"}</span> · {item.category}</p> : "Choose a booking below to continue."}
      detail={next.detail}
      figure={single ? supplierStepFigure(item) : undefined}
      cover={single ? <EventCover eventType={item.eventType} imageUrl={coverUrl} tag={false} className="h-full" /> : undefined}
      action={single ? (
        <Button asChild>
          <Link href={supplierWorkHref(item)}>{next.action}<ArrowRight className="size-4" /><span className="sr-only"> for {item.category} at {item.eventName}</span></Link>
        </Button>
      ) : undefined}
    />
  );
}

/**
 * Refresh on the page, as PMCM's Inbox and the coordinator's Now have it. A phone's top bar keeps to search, messages
 * and notifications; from a tablet up the top bar has its own Refresh, so this one is the phone's.
 */
function TodayRefresh({ refreshing, onRefresh, className }: { refreshing: boolean; onRefresh: () => void; className?: string }) {
  return (
    <Button type="button" variant="ghost" size="sm" disabled={refreshing} onClick={onRefresh} className={className}>
      <RefreshCcw aria-hidden="true" className={refreshing ? "animate-spin" : undefined} />
      {refreshing ? "Refreshing…" : "Refresh"}
    </Button>
  );
}

export function DashboardPage({ readinessBoard, quoteByRequest, refreshing, onRefresh }: {
  readinessBoard: PrismSupplierReadinessBoard | null;
  quoteByRequest: Map<string, PrismSupplierQuote>;
  refreshing: boolean;
  onRefresh: () => void;
}) {
  if (!readinessBoard) {
    return (
      <div role="status" className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
        <p>We could not load your work.</p>
        <TodayRefresh refreshing={refreshing} onRefresh={onRefresh} />
      </div>
    );
  }
  const hasQuote = (item: PrismSupplierReadinessItem) => quoteByRequest.has(item.requestId);
  const steps = splitSupplierNextSteps(readinessBoard.items, hasQuote);
  const [leadGroup, ...more] = groupSupplierNextSteps(steps.yourTurn, hasQuote);
  const lead = leadGroup?.items[0];
  const nothingAtAll = !steps.yourTurn.length && !steps.waiting.length;
  return (
    <PrismPageColumn>
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <p className="text-base text-muted-foreground">{supplierTodaySummary(steps.yourTurn.length, steps.waiting.length)}</p>
        <p className="flex items-center gap-1 text-xs text-muted-foreground">
          Updated {formatPortalDateTime(readinessBoard.generatedAt)}
          <TodayRefresh refreshing={refreshing} onRefresh={onRefresh} className="-my-1 md:hidden" />
        </p>
      </div>
      {lead ? <TodayLead item={lead} hasQuote={hasQuote(lead)} count={leadGroup.items.length} /> : null}
      {leadGroup && leadGroup.items.length > 1 ? (
        <PrismListSection id="supplier-lead-choices" title="Choose a booking" count={leadGroup.items.length}>
          {leadGroup.items.map((item) => <WorkRow key={item.id} item={item} hasQuote={hasQuote(item)} />)}
        </PrismListSection>
      ) : null}
      {nothingAtAll ? <PrismEmptyLine>No requests or booking updates to review. New work from PMCM will appear here.</PrismEmptyLine> : null}
      {more.length ? (
        <PrismListSection id="supplier-also-yours" title="Also needs you" count={more.reduce((count, group) => count + group.items.length, 0)}>
          {more.map((group) => group.items.length === 1
            ? <WorkRow key={group.title} item={group.items[0]} hasQuote={hasQuote(group.items[0])} />
            : <WorkGroup key={group.title} title={group.title} items={group.items} hasQuote={hasQuote} />)}
        </PrismListSection>
      ) : null}
      {steps.waiting.length ? (
        <PrismListSection id="supplier-waiting" title="Waiting on PMCM" count={steps.waiting.length} description="These are with PMCM. A submitted quote is an offer; selection, your confirmation and contract review are separate steps.">
          {steps.waiting.map((item) => <WorkRow key={item.id} item={item} hasQuote={hasQuote(item)} waiting />)}
        </PrismListSection>
      ) : null}
    </PrismPageColumn>
  );
}
