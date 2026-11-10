"use client";

import Link from "next/link";
import { ChevronDown } from "lucide-react";
import { formatPortalDate, formatPortalDateTime } from "@prism/ui/format-date";
import type { PrismSupplierQuote, PrismSupplierReadinessItem, PrismSupplierReadinessBoard } from "@prism/types";
import { quoteDeadlineUrgency, readinessConcernLabel, readinessSetupLabel } from "../../model/supplier-workspace-rules";
import { splitSupplierNextSteps, supplierNextStep, supplierWorkHref } from "../../model/supplier-next-step";
import { Card, CardContent, CardHeader } from "@prism/ui/components/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@prism/ui/components/collapsible";
import { Item, ItemActions, ItemContent, ItemDescription, ItemTitle } from "@prism/ui/components/item";

function ReadinessDetails({ item, hasQuote }: { item: PrismSupplierReadinessItem; hasQuote: boolean }) {
  const next = supplierNextStep(item, hasQuote);
  const selected = item.quoteStatus === "selected";
  return (
    <>
      <CollapsibleContent className="space-y-3 pb-3 text-sm">
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
    </>
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
        <Item size="sm" className="items-start gap-3 px-0 py-3">
          <ItemContent className="min-w-0 gap-0.5">
            <ItemTitle className="text-sm font-semibold text-foreground">{next.title}</ItemTitle>
            <ItemDescription className="break-words text-sm text-muted-foreground">{item.eventName ?? "Assigned event"} · {item.category}</ItemDescription>
            <p className={whenClass}>{nextStepWhen(item)}{urgency === "overdue" ? " · overdue" : ""}</p>
            {concern ? <p className="text-sm text-attention">{readinessConcernLabel(concern.kind)}: {concern.message}</p> : null}
          </ItemContent>
          <ItemActions className="shrink-0 flex-col items-end gap-0">
            <Link
              href={supplierWorkHref(item)}
              className="inline-flex min-h-11 items-center rounded-md text-sm font-semibold text-primary outline-none hover:text-primary/80 focus-visible:ring-2 focus-visible:ring-primary sm:min-h-9"
            >
              {next.action}<span className="sr-only"> for {item.category} at {item.eventName}</span>
            </Link>
            <CollapsibleTrigger className="group inline-flex min-h-11 items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground sm:min-h-9">
              Details<span className="sr-only"> for {item.category} at {item.eventName}</span>
              <ChevronDown aria-hidden="true" className="size-4 transition-transform group-data-[state=open]:rotate-180" />
            </CollapsibleTrigger>
          </ItemActions>
        </Item>
        <ReadinessDetails item={item} hasQuote={hasQuote} />
      </Collapsible>
    </li>
  );
}

function NextStepGroup({ title, items, empty, hasQuote }: { title: string; items: PrismSupplierReadinessItem[]; empty?: string; hasQuote: (item: PrismSupplierReadinessItem) => boolean }) {
  if (!items.length && !empty) return null;
  return (
    <section aria-label={title} className="border-b border-border py-3 last:border-b-0">
      <h3 className="text-sm font-medium text-muted-foreground">{title}</h3>
      {items.length ? (
        <ul className="divide-y divide-border">
          {items.map((item) => <ReadinessRow key={item.id} item={item} hasQuote={hasQuote(item)} />)}
        </ul>
      ) : <p className="py-3 text-sm text-muted-foreground">{empty}</p>}
    </section>
  );
}

export function DashboardPage({ readinessBoard, quoteByRequest, quoteNeedingSubmission, handoffPending }: {
  readinessBoard: PrismSupplierReadinessBoard | null;
  quoteByRequest: Map<string, PrismSupplierQuote>;
  quoteNeedingSubmission: number;
  handoffPending: number;
}) {
  const hasQuote = (item: PrismSupplierReadinessItem) => quoteByRequest.has(item.requestId);
  const steps = readinessBoard ? splitSupplierNextSteps(readinessBoard.items, hasQuote) : null;
  return (
    <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_17rem]">
      <Card className="min-w-0 xl:order-1">
        <CardHeader className="pb-4">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-lg font-semibold text-foreground">Next steps</h2>
            {readinessBoard ? <p className="text-xs text-muted-foreground">Updated {formatPortalDateTime(readinessBoard.generatedAt)}</p> : null}
          </div>
          <p className="mt-1 text-sm text-muted-foreground">Soonest deadline first.</p>
        </CardHeader>
        <CardContent className="py-1">
          {!steps ? (
            <p role="status" className="py-4 text-sm text-muted-foreground">We could not load your work. Use Refresh above to try again.</p>
          ) : steps.yourTurn.length || steps.waiting.length ? (
            <>
              <NextStepGroup title="Your turn" items={steps.yourTurn} empty="Nothing needs you right now." hasQuote={hasQuote} />
              <NextStepGroup title="Waiting on PMCM" items={steps.waiting} hasQuote={hasQuote} />
            </>
          ) : (
            <p className="py-4 text-sm text-muted-foreground">No requests or booking updates to review. New work from PMCM will appear here.</p>
          )}
        </CardContent>
      </Card>
      <aside aria-label="Today" className="flex min-w-0 flex-col gap-4 xl:sticky xl:top-6 xl:order-2">
        {/* Summary links carry actions, so on phones they sit above the list as one divided row. */}
        <nav aria-label="Work summary" className="grid grid-cols-2 divide-x divide-border rounded-lg border border-border bg-card xl:grid-cols-1 xl:divide-x-0 xl:divide-y">
          <Link href="/dashboard/requests" className="min-w-0 px-4 py-3 outline-none hover:bg-muted/40 focus-visible:ring-2 focus-visible:ring-primary xl:px-5 xl:py-4">
            <p className="text-sm text-muted-foreground">Awaiting your quote</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums text-foreground">{quoteNeedingSubmission}</p>
          </Link>
          <Link href="/dashboard/bookings" className="min-w-0 px-4 py-3 outline-none hover:bg-muted/40 focus-visible:ring-2 focus-visible:ring-primary xl:px-5 xl:py-4">
            <p className="text-sm text-muted-foreground">Bookings to prepare</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums text-foreground">{handoffPending}</p>
          </Link>
        </nav>
        <p className="text-xs leading-5 text-muted-foreground">A submitted quote is an offer. PMCM selection, your confirmation and contract review are separate steps.</p>
      </aside>
    </div>
  );
}
