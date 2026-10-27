"use client";

import Link from "next/link";
import { formatPortalDateTime } from "@prism/ui/format-date";
import type { PrismSupplierQuote, PrismSupplierReadinessItem, PrismSupplierReadinessBoard } from "@prism/types";
import { groupReadinessItemsByEvent, readinessConcernLabel, readinessSetupLabel } from "../../model/supplier-workspace-rules";
import { supplierNextStep, supplierWorkHref } from "../../model/supplier-next-step";
import { Card, CardBody, CardHeader } from "./shell-ui";

function ReadinessItem({ item, hasQuote }: { item: PrismSupplierReadinessItem; hasQuote: boolean }) {
  const next = supplierNextStep(item, hasQuote);
  const selected = item.quoteStatus === "selected";
  return (
    <article className="py-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h4 className="text-base font-semibold text-foreground">{next.title}</h4>
        <p className={item.ingressLate ? "text-sm font-medium text-danger" : "text-xs text-muted-foreground"}>{next.owner}</p>
      </div>
      <p className="mt-1 text-sm font-medium text-foreground">{item.category}</p>
      <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">{next.detail}</p>
      {!selected ? <p className="mt-2 text-sm text-muted-foreground">Quote deadline: {formatPortalDateTime(item.dueAt, "Not specified")}</p> : null}
      {selected ? (
        <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-3">
          <div><dt className="text-xs text-muted-foreground">Contract</dt><dd className="mt-1">{item.contractStatus.replaceAll("_", " ")}</dd></div>
          <div><dt className="text-xs text-muted-foreground">Preparation</dt><dd className="mt-1">{item.readinessStatus === "confirmed" ? "Readiness confirmed" : "Readiness not confirmed"}</dd></div>
          <div><dt className="text-xs text-muted-foreground">Onsite</dt><dd className="mt-1">{readinessSetupLabel(item.setupStatus)}</dd></div>
        </dl>
      ) : null}
      {item.schedule ? <p className="mt-3 text-sm text-muted-foreground">Arrival: {formatPortalDateTime(item.schedule.ingressAt)} · {item.schedule.location || "Location not specified"}</p> : null}
      {item.concerns.map((concern) => <p key={concern.kind + ":" + (concern.at ?? "")} className="mt-2 text-sm text-attention">{readinessConcernLabel(concern.kind)}: {concern.message}</p>)}
      <Link href={supplierWorkHref(item)} className="mt-3 inline-flex min-h-11 items-center rounded-md px-1 text-sm font-semibold text-primary outline-none focus-visible:ring-2 focus-visible:ring-primary">{next.action}<span className="sr-only"> for {item.category} at {item.eventName}</span></Link>
    </article>
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
      <Card>
        <CardHeader><h2 className="text-lg font-semibold text-foreground">Your next steps</h2><p className="mt-1 text-sm text-muted-foreground">Quote requests and booked work, with the next action for each.</p>{readinessBoard ? <p className="mt-2 text-xs text-muted-foreground">Updated {formatPortalDateTime(readinessBoard.generatedAt)} · Philippine time</p> : null}</CardHeader>
        <CardBody>
          {!readinessBoard ? <p role="status" className="text-sm text-muted-foreground">We could not load your work. Use Refresh above to try again.</p> : readinessBoard.items.length ? groupReadinessItemsByEvent(readinessBoard.items).map((group) => (
            <section key={group.eventId} aria-label={group.eventName + " work"} className="mb-5 last:mb-0">
              <h3 className="border-b border-border pb-3 text-base font-semibold text-foreground">{group.eventName}</h3>
              <div className="divide-y divide-border">{group.items.map((item) => <ReadinessItem key={item.id} item={item} hasQuote={quoteByRequest.has(item.requestId)} />)}</div>
            </section>
          )) : <p className="text-sm text-muted-foreground">No requests or booking updates to review. New work from PMCM will appear here.</p>}
        </CardBody>
      </Card>
      <aside className="space-y-4">
        <Link href="/dashboard/requests" className="block rounded-lg bg-card p-5 outline-none focus-visible:ring-2 focus-visible:ring-primary"><p className="text-sm font-semibold text-foreground">Requests & quotes</p><p className="mt-2 text-sm text-muted-foreground">{quoteNeedingSubmission} awaiting your quote</p></Link>
        <Link href="/dashboard/bookings" className="block rounded-lg bg-card p-5 outline-none focus-visible:ring-2 focus-visible:ring-primary"><p className="text-sm font-semibold text-foreground">Bookings</p><p className="mt-2 text-sm text-muted-foreground">{handoffPending} with preparation steps remaining</p></Link>
        <p className="px-1 text-xs leading-5 text-muted-foreground">A submitted quote is an offer. PMCM selection, your confirmation and contract review are separate steps.</p>
      </aside>
    </div>
  );
}
