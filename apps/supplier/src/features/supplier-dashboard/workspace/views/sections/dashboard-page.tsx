"use client";

import Link from "next/link";
import { ArrowRight, ChevronDown } from "lucide-react";
import { formatPortalDate, formatPortalDateTime } from "@prism/ui/format-date";
import type { PrismSupplierQuote, PrismSupplierReadinessItem, PrismSupplierReadinessBoard } from "@prism/types";
import { quoteDeadlineUrgency, readinessConcernLabel, readinessSetupLabel } from "../../model/supplier-workspace-rules";
import { groupSupplierNextSteps, splitSupplierNextSteps, supplierNextStep, supplierStepFigure, supplierStepGroupTitle, supplierTodaySummary, supplierWorkHref } from "../../model/supplier-next-step";
import { Button } from "@prism/ui/components/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@prism/ui/components/collapsible";
import { PrismEmptyLine, PrismHero, PrismPageColumn, PrismSection } from "@prism/ui/page-blocks";

function ReadinessDetails({ item, hasQuote }: { item: PrismSupplierReadinessItem; hasQuote: boolean }) {
  const next = supplierNextStep(item, hasQuote);
  const selected = item.quoteStatus === "selected";
  return (
    <CollapsibleContent className="space-y-3 px-5 pb-4 text-sm">
      <p className="max-w-2xl leading-6 text-muted-foreground">{next.detail}</p>
      {selected ? (
        <dl className="grid gap-3 sm:grid-cols-3">
          <div><dt className="text-muted-foreground">Contract</dt><dd className="mt-0.5 capitalize text-foreground">{item.contractStatus.replaceAll("_", " ")}</dd></div>
          <div><dt className="text-muted-foreground">Preparation</dt><dd className="mt-0.5 text-foreground">{item.readinessStatus === "confirmed" ? "Readiness confirmed" : "Readiness not confirmed"}</dd></div>
          <div><dt className="text-muted-foreground">Onsite</dt><dd className="mt-0.5 text-foreground">{readinessSetupLabel(item.setupStatus)}</dd></div>
        </dl>
      ) : null}
      {item.schedule ? <p className="text-muted-foreground">Location: {item.schedule.location || "—"}</p> : null}
    </CollapsibleContent>
  );
}

/** The date that matters for this step: the quote deadline while bidding, then arrival or the event day. */
function nextStepWhen(item: PrismSupplierReadinessItem) {
  const eventDay = item.eventDate ? `Event ${formatPortalDate(item.eventDate)}` : null;
  if (item.quoteStatus !== "selected") return [`Quote due ${formatPortalDate(item.dueAt, "—")}`, eventDay].filter(Boolean).join(" · ");
  if (item.schedule) return `Arrive ${formatPortalDateTime(item.schedule.ingressAt)}`;
  return eventDay ?? "Schedule not set yet";
}

function ReadinessRow({ item, hasQuote }: { item: PrismSupplierReadinessItem; hasQuote: boolean }) {
  const next = supplierNextStep(item, hasQuote);
  const concern = item.concerns[0];
  const urgency = quoteDeadlineUrgency(item);
  const whenClass = item.ingressLate || urgency === "overdue" ? "text-sm font-medium text-danger" : urgency === "soon" ? "text-sm font-medium text-attention" : "text-sm text-muted-foreground";
  return (
    <li>
      <Collapsible>
        <div className="flex items-start gap-3 px-5 py-4">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-foreground">{next.title}</p>
            <p className="break-words text-sm text-muted-foreground">{item.eventName ?? "Assigned event"} · {item.category}</p>
            <p className={whenClass}>{nextStepWhen(item)}{urgency === "overdue" ? " · overdue" : ""}</p>
            {concern ? <p className="text-sm text-attention">{readinessConcernLabel(concern.kind)}: {concern.message}</p> : null}
          </div>
          <div className="flex shrink-0 flex-col items-end">
            <Link
              href={supplierWorkHref(item)}
              className="inline-flex min-h-11 items-center rounded-md text-sm font-semibold text-foreground outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-primary sm:min-h-9"
            >
              {next.action}<span className="sr-only"> for {item.category} at {item.eventName}</span>
            </Link>
            <CollapsibleTrigger className="group inline-flex min-h-11 items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground sm:min-h-9">
              Details<span className="sr-only"> for {item.category} at {item.eventName}</span>
              <ChevronDown aria-hidden="true" className="size-4 transition-transform group-data-[state=open]:rotate-180" />
            </CollapsibleTrigger>
          </div>
        </div>
        <ReadinessDetails item={item} hasQuote={hasQuote} />
      </Collapsible>
    </li>
  );
}

/** The lead: the supplier's most urgent step, with how long it has left (or how late it is) and its one action. */
function TodayLead({ item, hasQuote, count = 1 }: { item: PrismSupplierReadinessItem; hasQuote: boolean; count?: number }) {
  const next = supplierNextStep(item, hasQuote);
  const urgency = quoteDeadlineUrgency(item);
  return (
    <PrismHero
      label={["Your next step", nextStepWhen(item), urgency === "overdue" ? "overdue" : null].filter(Boolean).join(" · ")}
      title={supplierStepGroupTitle(next.title, count)}
      meta={count === 1 ? `${item.eventName ?? "Assigned event"} · ${item.category}` : "Choose a booking below to continue."}
      figure={count === 1 ? supplierStepFigure(item) : undefined}
    >
      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-4">
        <p className="min-w-0 flex-1 basis-64 text-sm text-ink-foreground/70">{next.detail}</p>
        {count === 1 ? <Button asChild>
          <Link href={supplierWorkHref(item)}>{next.action}<ArrowRight className="size-4" /><span className="sr-only"> for {item.category} at {item.eventName}</span></Link>
        </Button> : null}
      </div>
    </PrismHero>
  );
}

function BookingChoices({ items, title, hasQuote }: {
  items: PrismSupplierReadinessItem[];
  title: string;
  hasQuote: (item: PrismSupplierReadinessItem) => boolean;
}) {
  return (
    <details className="rounded-lg bg-card">
      <summary className="cursor-pointer px-5 py-4 text-sm font-semibold">{title}</summary>
      <ul className="divide-y divide-border">
        {items.map((item) => <ReadinessRow key={item.id} item={item} hasQuote={hasQuote(item)} />)}
      </ul>
    </details>
  );
}

export function DashboardPage({ readinessBoard, quoteByRequest }: {
  readinessBoard: PrismSupplierReadinessBoard | null;
  quoteByRequest: Map<string, PrismSupplierQuote>;
}) {
  const hasQuote = (item: PrismSupplierReadinessItem) => quoteByRequest.has(item.requestId);
  const steps = readinessBoard ? splitSupplierNextSteps(readinessBoard.items, hasQuote) : null;
  if (!steps) {
    return <p role="status" className="text-sm text-muted-foreground">We could not load your work. Use Refresh above to try again.</p>;
  }
  const [leadGroup, ...more] = groupSupplierNextSteps(steps.yourTurn, hasQuote);
  const lead = leadGroup?.items[0];
  const nothingAtAll = !steps.yourTurn.length && !steps.waiting.length;
  return (
    <PrismPageColumn>
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <p className="text-base text-muted-foreground">{supplierTodaySummary(steps.yourTurn.length, steps.waiting.length)}</p>
        {readinessBoard ? <p className="text-xs text-muted-foreground">Updated {formatPortalDateTime(readinessBoard.generatedAt)}</p> : null}
      </div>
      {lead ? <TodayLead item={lead} hasQuote={hasQuote(lead)} count={leadGroup.items.length} /> : null}
      {leadGroup && leadGroup.items.length > 1 ? (
        <div className="rounded-lg border border-border">
          <BookingChoices items={leadGroup.items} title={`Choose from ${leadGroup.items.length} bookings`} hasQuote={hasQuote} />
        </div>
      ) : null}
      {nothingAtAll ? <PrismEmptyLine>No requests or booking updates to review. New work from PMCM will appear here.</PrismEmptyLine> : null}
      {more.length ? (
        <PrismSection id="supplier-also-yours" title="Also needs you" count={more.reduce((count, group) => count + group.items.length, 0)} flush>
          <ul className="divide-y divide-border">
            {more.map((group) => group.items.length === 1 ? (
              <ReadinessRow key={group.title} item={group.items[0]} hasQuote={hasQuote(group.items[0])} />
            ) : (
              <li key={group.title}>
                <BookingChoices items={group.items} title={supplierStepGroupTitle(group.title, group.items.length)} hasQuote={hasQuote} />
              </li>
            ))}
          </ul>
        </PrismSection>
      ) : null}
      {steps.waiting.length ? (
        <PrismSection id="supplier-waiting" title="Waiting on PMCM" count={steps.waiting.length} description="These are with PMCM. A submitted quote is an offer; selection, your confirmation and contract review are separate steps." flush>
          <ul className="divide-y divide-border">
            {steps.waiting.map((item) => <ReadinessRow key={item.id} item={item} hasQuote={hasQuote(item)} />)}
          </ul>
        </PrismSection>
      ) : null}
    </PrismPageColumn>
  );
}
