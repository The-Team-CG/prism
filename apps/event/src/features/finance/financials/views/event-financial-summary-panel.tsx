"use client";

import { useResource } from "@prism/portal-query";
import type { PrismEventFinancialSummary } from "@prism/types";
import { PrismEmptyLine, PrismSection, PrismStatRow } from "@prism/ui/page-blocks";
import { Scale } from "lucide-react";
import { money } from "@/features/pmcm-kit";
import { eventFinancialSummary } from "../data/event-financials-resource";
import { categoriesOverEstimate, marginBasisLabel, marginTone, overdueDetail, receivedTrustDetail, signedAmount } from "../model/financial-summary-rules";

const fmt = (amount: number) => money.format(amount);

function CollectionFigures({ summary }: { summary: PrismEventFinancialSummary }) {
  const { price, collections } = summary;
  return (
    <PrismStatRow
      label="Collections"
      stats={[
        { label: "Billed", value: price.billed === null ? "No statement" : fmt(price.billed), detail: price.statementNumber ? `Statement ${price.statementNumber}` : undefined },
        { label: "Received", value: fmt(collections.received), detail: receivedTrustDetail(collections, fmt) },
        { label: "Outstanding", value: fmt(collections.outstanding), tone: collections.overdue > 0 ? "attention" : "neutral", detail: overdueDetail(collections, fmt) },
        { label: "Unapplied for this event", value: fmt(collections.unapplied), tone: "attention", empty: collections.unapplied === 0, detail: "Received, not yet on a milestone" },
      ]}
    />
  );
}

function CostAndMarginFigures({ summary }: { summary: PrismEventFinancialSummary }) {
  const { costs, margin } = summary;
  return (
    <PrismStatRow
      label="Supplier cost and margin"
      stats={[
        { label: "Committed to suppliers", value: fmt(costs.committed), detail: "Selected supplier quotes" },
        { label: "Paid to suppliers", value: fmt(costs.actual), detail: costs.toPay > 0 ? `${fmt(costs.toPay)} still to pay` : undefined },
        {
          label: "Expected margin",
          value: margin.expected === null ? "No price yet" : signedAmount(margin.expected, fmt),
          tone: marginTone(margin.expected),
          detail: marginBasisLabel(margin.basis),
        },
        { label: "Cash to date", value: signedAmount(margin.cashToDate, fmt), tone: marginTone(margin.cashToDate), detail: "Received less paid to suppliers" },
      ]}
    />
  );
}

function CategoryTable({ summary }: { summary: PrismEventFinancialSummary }) {
  if (summary.categories.length === 0) return null;
  const over = categoriesOverEstimate(summary);
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <caption className="sr-only">Estimated price, committed cost and amount paid, by category</caption>
        <thead>
          <tr className="border-b border-border text-left text-xs text-muted-foreground">
            <th scope="col" className="py-2 pr-4 font-medium">Category</th>
            <th scope="col" className="px-4 py-2 text-right font-medium">Estimated price</th>
            <th scope="col" className="px-4 py-2 text-right font-medium">Committed cost</th>
            <th scope="col" className="px-4 py-2 text-right font-medium">Paid</th>
            <th scope="col" className="py-2 pl-4 text-right font-medium">Expected margin</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border tabular-nums">
          {summary.categories.map((line) => (
            <tr key={line.category}>
              <th scope="row" className="py-2 pr-4 text-left font-medium text-foreground">{line.category}{over.includes(line.category) ? <span className="ml-2 text-xs font-normal text-danger">over estimate</span> : null}</th>
              <td className="px-4 py-2 text-right">{fmt(line.estimatedPrice)}</td>
              <td className="px-4 py-2 text-right">{fmt(line.committedCost)}</td>
              <td className="px-4 py-2 text-right">{fmt(line.actualCost)}</td>
              <td className="py-2 pl-4 text-right">{signedAmount(line.expectedMargin, fmt)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Notes({ notes }: { notes: string[] }) {
  if (notes.length === 0) return null;
  return (
    <section aria-label="Where to be careful" className="space-y-1.5">
      <h3 className="text-xs font-semibold text-muted-foreground">Where to be careful</h3>
      <ul className="list-disc space-y-1 pl-5 text-sm text-foreground">
        {notes.map((note) => <li key={note}>{note}</li>)}
      </ul>
    </section>
  );
}

function Body({ summary }: { summary: PrismEventFinancialSummary }) {
  return (
    <div className="space-y-6 px-5 py-5">
      <CollectionFigures summary={summary} />
      <CostAndMarginFigures summary={summary} />
      <CategoryTable summary={summary} />
      <Notes notes={summary.notes} />
      <p className="text-xs text-muted-foreground">
        Estimated price is the proposal estimate shown to the client. Committed cost is what selected supplier quotes cost. Paid is what has been released to suppliers, reversals netted out.
      </p>
    </div>
  );
}

/** Where this event stands: collected against billed (and how far to trust it), supplier cost committed and paid, and the margin. */
export function EventFinancialSummaryPanel({ eventId }: { eventId: string }) {
  const summary = useResource(eventFinancialSummary, eventId);
  return (
    <PrismSection id="event-financial-summary" title="Reconciliation and margin" description="Billed against received, supplier cost against what was estimated, and the margin that follows." flush>
      {summary.data ? <Body summary={summary.data} /> : <PanelStatus failed={summary.status === "error"} />}
    </PrismSection>
  );
}

function PanelStatus({ failed }: { failed: boolean }) {
  return (
    <div className="px-5 py-5">
      <PrismEmptyLine icon={Scale}>{failed ? "Could not load this event's financial summary. Try again in a moment." : "Working out where this event stands…"}</PrismEmptyLine>
    </div>
  );
}
