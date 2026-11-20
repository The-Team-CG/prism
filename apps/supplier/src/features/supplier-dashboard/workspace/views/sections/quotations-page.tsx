"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, BadgeCheck, CircleSlash, FileText, Send, type LucideIcon } from "lucide-react";
import { Button } from "@prism/ui/components/button";
import { Card, CardContent } from "@prism/ui/components/card";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@prism/ui/components/empty";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@prism/ui/components/sheet";
import { PrismListRow, type PrismListTone } from "@prism/ui/action-list";
import { PrismSection, PrismStatRow } from "@prism/ui/page-blocks";
import { formatMoney } from "../../model/supplier-workspace-rules";
import { formatPortalDate } from "@prism/ui/format-date";
import { quoteOutcome, quoteHistory, type QuoteOutcome, type QuoteHistoryRow } from "../../model/quote-history";
import { supplierBookingHref } from "../../model/supplier-next-step";
import { supplierWorkTargetHref, type PrismSupplierReadinessBoard, type SupplierWorkspace } from "../../model/supplier-workspace-types";
import { QuoteReadOnly } from "./request-quote-card";

const OUTCOME_LOOK: Record<QuoteOutcome, { icon: LucideIcon; tone: PrismListTone; label: string }> = {
  pending: { icon: Send, tone: "neutral", label: "With PMCM" },
  selected: { icon: BadgeCheck, tone: "done", label: "Selected" },
  "not-selected": { icon: CircleSlash, tone: "neutral", label: "Not selected" },
  closed: { icon: CircleSlash, tone: "neutral", label: "Closed" },
};

function QuoteRow({ row, onOpen }: { row: QuoteHistoryRow; onOpen: () => void }) {
  const look = OUTCOME_LOOK[row.outcome];
  const revised = (row.quote.revisionNumber ?? 1) > 1;
  return (
    <PrismListRow
      icon={look.icon}
      tone={look.tone}
      title={row.eventName}
      tag={look.label}
      meta={[row.quote.category, revised && row.quote.revisedAt ? `Revised ${formatPortalDate(row.quote.revisedAt)}` : `Sent ${formatPortalDate(row.quote.createdAt)}`].join(" · ")}
      status={formatMoney(row.quote.amount)}
      statusTone="neutral"
      action={row.outcome === "selected" ? "Open booking" : "View quote"}
      {...(row.outcome === "selected" && row.quote.requestId ? { href: supplierBookingHref(row.quote.requestId), link: Link } : { onOpen })}
    />
  );
}

/**
 * Every quote the supplier has sent: how many, how many PMCM selected and what they are worth, then each quote with
 * its amount and outcome. A selected quote opens its booking; any other opens the quote as sent.
 */
export function QuotationsPage({ workspace, readinessBoard }: { workspace: SupplierWorkspace; readinessBoard: PrismSupplierReadinessBoard | null }) {
  const [openQuoteId, setOpenQuoteId] = useState<string | null>(null);

  if (!workspace.supplierQuotes.length) {
    return (
      <Card>
        <CardContent>
          <Empty className="border-0 p-6 md:p-8">
            <EmptyHeader>
              <EmptyMedia variant="icon"><FileText /></EmptyMedia>
              <EmptyTitle>No quotes sent yet.</EmptyTitle>
              <EmptyDescription>Quotes you send from Requests appear here with PMCM&apos;s decision.</EmptyDescription>
            </EmptyHeader>
          </Empty>
        </CardContent>
      </Card>
    );
  }

  const history = quoteHistory(workspace.supplierQuotes, workspace.quoteRequests, readinessBoard?.items ?? []);
  const openRow = history.rows.find((row) => row.quote.id === openQuoteId) ?? null;

  return (
    <div className="grid gap-6">
      <PrismStatRow
        label="Your quotes"
        stats={[
          { label: "Quotes sent", value: history.rows.length },
          { label: "Selected by PMCM", value: history.selected.count, detail: history.selected.count ? `${formatMoney(history.selected.amount)} in bookings` : undefined },
          { label: "With PMCM", value: history.pending, detail: "Waiting for a decision", empty: history.pending === 0 },
          { label: "Not selected", value: history.notSelected, empty: history.notSelected === 0 },
        ]}
      />
      <PrismSection id="quotes-list" title="Your quotes" description="Newest first. Selected quotes open their booking." flush>
        <ul className="divide-y divide-border">
          {history.rows.map((row) => <QuoteRow key={row.quote.id} row={row} onOpen={() => setOpenQuoteId(row.quote.id)} />)}
        </ul>
      </PrismSection>

      <Sheet open={openRow !== null} onOpenChange={(open) => { if (!open) setOpenQuoteId(null); }}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
          {openRow ? (
            <>
              <SheetHeader>
                <SheetTitle className="break-words">{openRow.eventName}</SheetTitle>
                <SheetDescription>{openRow.quote.category} · {OUTCOME_LOOK[quoteOutcome(openRow.quote, openRow.request)].label} · sent {formatPortalDate(openRow.quote.createdAt)}</SheetDescription>
              </SheetHeader>
              <div className="grid gap-5 px-4 pb-6">
                {openRow.request?.message ? (
                  <section aria-label="What PMCM asked for" className="rounded-lg bg-muted/50 px-3 py-2.5 text-sm">
                    <p className="text-xs text-muted-foreground">What PMCM asked for</p>
                    <p className="mt-0.5 whitespace-pre-wrap text-foreground">{openRow.request.message}</p>
                  </section>
                ) : null}
                <QuoteReadOnly quote={openRow.quote} />
                {openRow.outcome === "pending" && openRow.quote.requestId ? (
                  <Button asChild variant="outline" className="w-fit">
                    <Link href={supplierWorkTargetHref("requests", openRow.quote.requestId)}>Open the request<ArrowRight className="size-4" /></Link>
                  </Button>
                ) : null}
              </div>
            </>
          ) : null}
        </SheetContent>
      </Sheet>
    </div>
  );
}
