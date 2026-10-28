"use client";

import Link from "next/link";
import { formatPortalDateTime } from "@prism/ui/format-date";
import type { PrismSupplierQuote, PrismSupplierReadinessItem, PrismSupplierReadinessBoard } from "@prism/types";
import { groupReadinessItemsByEvent, readinessConcernLabel, readinessSetupLabel } from "../../model/supplier-workspace-rules";
import { supplierNextStep, supplierWorkHref } from "../../model/supplier-next-step";
import { Card, CardBody, CardHeader } from "./shell-ui";

function ReadinessDetails({ item }: { item: PrismSupplierReadinessItem }) {
  const next = supplierNextStep(item, false);
  const selected = item.quoteStatus === "selected";
  return (
    <details className="group mt-2">
      <summary className="inline-flex min-h-11 cursor-pointer items-center text-sm text-muted-foreground transition-colors hover:text-foreground">
        <span className="group-open:hidden">Show details</span>
        <span className="hidden group-open:inline">Hide details</span>
      </summary>
      <div className="mt-1 space-y-3 text-sm">
        <p className="max-w-2xl leading-6 text-muted-foreground">{next.detail}</p>
        {selected ? (
          <dl className="grid gap-3 sm:grid-cols-3">
            <div><dt className="text-muted-foreground">Contract</dt><dd className="mt-0.5 capitalize text-foreground">{item.contractStatus.replaceAll("_", " ")}</dd></div>
            <div><dt className="text-muted-foreground">Preparation</dt><dd className="mt-0.5 text-foreground">{item.readinessStatus === "confirmed" ? "Readiness confirmed" : "Readiness not confirmed"}</dd></div>
            <div><dt className="text-muted-foreground">Onsite</dt><dd className="mt-0.5 text-foreground">{readinessSetupLabel(item.setupStatus)}</dd></div>
          </dl>
        ) : null}
        {item.schedule ? <p className="text-muted-foreground">Location: {item.schedule.location || "—"}</p> : null}
      </div>
    </details>
  );
}

function ReadinessRow({ item, hasQuote }: { item: PrismSupplierReadinessItem; hasQuote: boolean }) {
  const next = supplierNextStep(item, hasQuote);
  const selected = item.quoteStatus === "selected";
  const when = selected && item.schedule
    ? `Arrive ${formatPortalDateTime(item.schedule.ingressAt)}`
    : `Quote due ${formatPortalDateTime(item.dueAt, "—")}`;
  const concern = item.concerns[0];
  return (
    <li className="py-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-foreground">{next.title}</p>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {item.category} · <span className={item.ingressLate ? "font-medium text-danger" : undefined}>{when}</span>
          </p>
          {concern ? <p className="mt-1 text-sm text-attention">{readinessConcernLabel(concern.kind)}: {concern.message}</p> : null}
        </div>
        <Link
          href={supplierWorkHref(item)}
          className="inline-flex min-h-11 shrink-0 items-center self-start rounded-md text-sm font-semibold text-primary outline-none hover:text-primary/80 focus-visible:ring-2 focus-visible:ring-primary sm:min-h-9"
        >
          {next.action}<span className="sr-only"> for {item.category} at {item.eventName}</span>
        </Link>
      </div>
      <ReadinessDetails item={item} />
    </li>
  );
}

export function DashboardPage({ readinessBoard, quoteByRequest, quoteNeedingSubmission, handoffPending }: {
  readinessBoard: PrismSupplierReadinessBoard | null;
  quoteByRequest: Map<string, PrismSupplierQuote>;
  quoteNeedingSubmission: number;
  handoffPending: number;
}) {
  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_17rem]">
      {/* Summary links carry actions, so on phones they sit above the list as one divided row. */}
      <nav aria-label="Work summary" className="grid grid-cols-2 divide-x divide-border rounded-lg border border-border bg-card xl:order-2 xl:self-start xl:grid-cols-1 xl:divide-x-0 xl:divide-y">
        <Link href="/dashboard/requests" className="min-w-0 px-4 py-3 outline-none hover:bg-muted/40 focus-visible:ring-2 focus-visible:ring-primary xl:px-5 xl:py-4">
          <p className="text-sm text-muted-foreground">Awaiting your quote</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums text-foreground">{quoteNeedingSubmission}</p>
        </Link>
        <Link href="/dashboard/bookings" className="min-w-0 px-4 py-3 outline-none hover:bg-muted/40 focus-visible:ring-2 focus-visible:ring-primary xl:px-5 xl:py-4">
          <p className="text-sm text-muted-foreground">Bookings to prepare</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums text-foreground">{handoffPending}</p>
        </Link>
      </nav>
      <Card className="xl:order-1 xl:row-span-2">
        <CardHeader>
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-lg font-semibold text-foreground">Next steps</h2>
            {readinessBoard ? <p className="text-xs text-muted-foreground">Updated {formatPortalDateTime(readinessBoard.generatedAt)}</p> : null}
          </div>
          <p className="mt-1 text-sm text-muted-foreground">Soonest deadline first.</p>
        </CardHeader>
        <CardBody className="py-1">
          {!readinessBoard ? (
            <p role="status" className="py-4 text-sm text-muted-foreground">We could not load your work. Use Refresh above to try again.</p>
          ) : readinessBoard.items.length ? (
            groupReadinessItemsByEvent(readinessBoard.items).map((group) => (
              <section key={group.eventId} aria-label={group.eventName + " work"} className="border-b border-border py-3 last:border-b-0">
                <h3 className="break-words text-sm font-medium text-muted-foreground" title={group.eventName}>{group.eventName}</h3>
                <ul className="divide-y divide-border">
                  {group.items.map((item) => <ReadinessRow key={item.id} item={item} hasQuote={quoteByRequest.has(item.requestId)} />)}
                </ul>
              </section>
            ))
          ) : (
            <p className="py-4 text-sm text-muted-foreground">No requests or booking updates to review. New work from PMCM will appear here.</p>
          )}
        </CardBody>
      </Card>
      <p className="text-xs leading-5 text-muted-foreground xl:order-3 xl:col-start-2">A submitted quote is an offer. PMCM selection, your confirmation and contract review are separate steps.</p>
    </div>
  );
}
