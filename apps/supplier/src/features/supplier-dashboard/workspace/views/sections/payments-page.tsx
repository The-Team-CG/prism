"use client";

import Link from "next/link";
import { AlertTriangle, CalendarClock, CheckCircle2, FileCheck2, MessageSquareText, Upload, Wallet } from "lucide-react";
import type { PrismSupplierPayableMilestone, PrismSupplierPayoutRecord, PrismSupplierWorkflowWorkspace } from "@prism/types";
import { Button } from "@prism/ui/components/button";
import { Card } from "@prism/ui/components/card";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@prism/ui/components/empty";
import { formatPortalDate, manilaDateKey } from "@prism/ui/format-date";
import { PrismSection } from "@prism/ui/page-blocks";
import { formatPeso, MoneyTile, MoneyTiles, PaymentEventCard, PaymentTimeline, type PaymentStep } from "@prism/ui/payment-track";
import { payoutReceiptState, payoutStep, supplierBookings, supplierPaymentTotals, unscheduledBookings, type SupplierBooking } from "../../model/supplier-payments";
import type { PrismSupplierQuote, PrismSupplierReadinessBoard, SupplierWorkspace } from "../../model/supplier-workspace-types";
import { usePayoutReceipt, type PayoutReceiptViewModel } from "../../view-models/use-payout-receipt";
import { PayoutReceiptDialog } from "./payout-receipt-dialog";

function Tiles({ totals }: { totals: ReturnType<typeof supplierPaymentTotals> }) {
  return (
    <MoneyTiles count={3}>
      <MoneyTile icon={CheckCircle2} label="Paid to you" value={formatPeso(totals.paid)} detail="Released by PMCM" tone="bg-success-soft text-success" />
      <MoneyTile
        icon={CalendarClock}
        label="Next payment"
        value={totals.next ? formatPeso(totals.next.remainingBalance) : "—"}
        detail={totals.next?.dueDate ? `${totals.next.label} · due ${formatPortalDate(totals.next.dueDate)}` : "Nothing scheduled"}
        tone={totals.next ? "bg-attention-soft text-attention" : "bg-muted text-muted-foreground"}
      />
      <MoneyTile
        icon={totals.late > 0 ? AlertTriangle : Wallet}
        label="Still to come"
        value={formatPeso(totals.toCome)}
        detail={totals.late > 0 ? `${formatPeso(totals.late)} is past its due date` : totals.unscheduled > 0 ? `${formatPeso(totals.unscheduled)} not scheduled yet` : "Across your bookings"}
        tone={totals.late > 0 ? "bg-danger-soft text-danger" : "bg-primary-soft text-primary"}
      />
    </MoneyTiles>
  );
}

const linkButton = "inline-flex items-center gap-1 font-medium text-primary hover:text-primary/80";

/** The supplier's side of one transfer: confirm it arrived, then send the official receipt, or see both done. */
function ReceiptAction({ record, payable, receipts }: { record: PrismSupplierPayoutRecord; payable: PrismSupplierPayableMilestone; receipts: PayoutReceiptViewModel }) {
  if (record.kind !== "release") return null;
  const state = payoutReceiptState(record, payable.history);
  const open = (alreadyConfirmed: boolean) => receipts.open({ record, eventId: payable.eventId, label: payable.label, alreadyConfirmed });
  if (state === "reversed") return null;
  if (state === "unconfirmed") return <button type="button" className={linkButton} onClick={() => open(false)}><CheckCircle2 className="size-3" aria-hidden /> I received this</button>;
  const confirmed = <span className="inline-flex items-center gap-1 text-success"><CheckCircle2 className="size-3" aria-hidden /> You confirmed it {formatPortalDate(record.receivedAt)}</span>;
  if (state === "confirmed") return <>{confirmed}<button type="button" className={linkButton} onClick={() => open(true)}><Upload className="size-3" aria-hidden /> Send official receipt</button></>;
  return <>{confirmed}<span className="inline-flex items-center gap-1"><FileCheck2 className="size-3" aria-hidden /> {record.officialReceipt?.fileName}</span></>;
}

function Releases({ step, booking, fresh, receipts }: { step: PaymentStep; booking: SupplierBooking; fresh?: ReadonlySet<string>; receipts: PayoutReceiptViewModel }) {
  const payable = booking.payables.find((item) => item.id === step.id);
  if (!payable?.history.length) return null;
  return (
    <ul className="space-y-1 text-xs text-muted-foreground">
      {payable.history.map((record) => (
        <li key={record.id} className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span>{record.kind === "reversal" ? "Reversed" : "Sent"} {formatPeso(record.amount)} on {formatPortalDate(record.paymentDate)} · {record.method}{record.referenceNumber ? ` · ${record.referenceNumber}` : ""}</span>
          {fresh?.has(record.id) ? <span className="rounded-md bg-success-soft px-1.5 py-0.5 text-[11px] font-semibold text-success">New</span> : null}
          <ReceiptAction record={record} payable={payable} receipts={receipts} />
        </li>
      ))}
    </ul>
  );
}

/** One booking: the event, the agreed amount, and each payout PMCM owes on a bar and a timeline. */
function BookingCard({ booking, todayKey, fresh, receipts }: { booking: SupplierBooking; todayKey: string; fresh?: ReadonlySet<string>; receipts: PayoutReceiptViewModel }) {
  const steps = booking.payables.map((payable) => payoutStep(payable, todayKey));
  const paid = booking.payables.reduce((sum, payable) => sum + payable.amountReleased, 0);
  return (
    <PaymentEventCard
      title={booking.eventName}
      detail={[booking.category, booking.terms ? `Your terms: ${booking.terms}` : null].filter(Boolean).join(" · ")}
      paid={paid}
      total={booking.contract}
      totalWord="agreed"
      steps={steps}
      empty="PMCM has not set the payment schedule for this booking yet."
    >
      {steps.length ? <PaymentTimeline steps={steps} label={`Payments for ${booking.eventName}`} detail={(step) => <Releases step={step} booking={booking} fresh={fresh} receipts={receipts} />} /> : null}
    </PaymentEventCard>
  );
}

/**
 * Bookings PMCM has not scheduled payments for yet, together under one note instead of a card each saying the same
 * thing: the event, the terms the supplier proposed and the agreed amount.
 */
function UnscheduledBookings({ bookings, agreed }: { bookings: SupplierBooking[]; agreed: number }) {
  if (bookings.length === 0) return null;
  return (
    <PrismSection
      id="payments-unscheduled"
      title="Waiting for a payment schedule"
      count={bookings.length}
      description="PMCM has not scheduled these agreed amounts yet. Each gets its payments on its booking card once it does."
      action={<p className="text-right text-xs text-muted-foreground"><span className="block text-base font-semibold tabular-nums text-foreground">{formatPeso(agreed)}</span>agreed in total</p>}
      flush
    >
      <ul className="divide-y divide-border">
        {bookings.map((booking) => (
          <li key={booking.requestId} className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-0.5 px-5 py-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-foreground">{booking.eventName}</p>
              <p className="text-xs text-muted-foreground">{[booking.category, booking.terms ? `Your terms: ${booking.terms}` : null].filter(Boolean).join(" · ")}</p>
            </div>
            <p className="text-sm font-semibold tabular-nums text-foreground">
              {booking.contract === null ? "Amount to be confirmed" : booking.payables.length === 0 ? formatPeso(booking.contract) : `${formatPeso(booking.unscheduled)} of ${formatPeso(booking.contract)} not scheduled`}
            </p>
          </li>
        ))}
      </ul>
    </PrismSection>
  );
}

/**
 * What PMCM pays the supplier: totals first (paid, next, still to come), then each booking by event with its payouts on
 * a timeline. A payment that should have arrived is one message away.
 */
export function PaymentsPage({ workspace, workflowWorkspace, selectedQuotes, readinessBoard, freshPayouts }: {
  workspace: SupplierWorkspace;
  workflowWorkspace: PrismSupplierWorkflowWorkspace | null;
  selectedQuotes: PrismSupplierQuote[];
  readinessBoard: PrismSupplierReadinessBoard | null;
  /** Payouts sent since the last visit, marked "New". */
  freshPayouts?: ReadonlySet<string>;
}) {
  const payables = workflowWorkspace?.payables ?? [];
  const receipts = usePayoutReceipt(workspace.supplier.id);
  const todayKey = manilaDateKey();
  const bookings = supplierBookings({ payables, selectedQuotes, quoteRequests: workspace.quoteRequests, readinessBoard });
  if (bookings.length === 0) {
    return (
      <Card>
        <Empty className="border-0 p-6 md:p-8">
          <EmptyHeader>
            <EmptyMedia variant="icon"><Wallet /></EmptyMedia>
            <EmptyTitle>No payments yet</EmptyTitle>
            <EmptyDescription>Once PMCM selects your quote, the agreed amount and its payment schedule appear here.</EmptyDescription>
          </EmptyHeader>
        </Empty>
      </Card>
    );
  }
  const waiting = unscheduledBookings(bookings);
  const totals = supplierPaymentTotals(payables, todayKey, waiting.agreed);
  return (
    <div className="space-y-4">
      <Tiles totals={totals} />
      {bookings.filter((booking) => booking.payables.length > 0).map((booking) => <BookingCard key={booking.requestId} booking={booking} todayKey={todayKey} fresh={freshPayouts} receipts={receipts} />)}
      <UnscheduledBookings bookings={waiting.bookings} agreed={waiting.agreed} />
      <PayoutReceiptDialog vm={receipts} />
      <p className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
        A payment should have arrived but has not?
        <Button asChild size="sm" variant="outline"><Link href="/dashboard/messages"><MessageSquareText className="size-4" aria-hidden /> Message PMCM</Link></Button>
      </p>
    </div>
  );
}
