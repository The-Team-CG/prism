"use client";

import Link from "next/link";
import { AlertTriangle, CalendarClock, CheckCircle2, MessageSquareText, Wallet, type LucideIcon } from "lucide-react";
import type { PrismSupplierWorkflowWorkspace } from "@prism/types";
import { Button } from "@prism/ui/components/button";
import { Card } from "@prism/ui/components/card";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@prism/ui/components/empty";
import { formatPortalDate, manilaDateKey } from "@prism/ui/format-date";
import { formatPeso, PaymentProgressBar, PaymentTimeline, type PaymentStep } from "@prism/ui/payment-track";
import { cn } from "@/app/components/ui/utils";
import { payoutStep, supplierBookings, supplierPaymentTotals, type SupplierBooking } from "../../model/supplier-payments";
import type { PrismSupplierQuote, PrismSupplierReadinessBoard, SupplierWorkspace } from "../../model/supplier-workspace-types";

function Tile({ icon: Icon, label, value, detail, tone }: { icon: LucideIcon; label: string; value: string; detail: string; tone: string }) {
  return (
    <Card className="flex-row items-center gap-3 p-4">
      <span aria-hidden className={cn("grid size-10 shrink-0 place-items-center rounded-full", tone)}><Icon className="size-5" /></span>
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-lg font-semibold tabular-nums text-foreground">{value}</p>
        <p className="text-xs text-muted-foreground">{detail}</p>
      </div>
    </Card>
  );
}

function Tiles({ totals }: { totals: ReturnType<typeof supplierPaymentTotals> }) {
  return (
    <div className="grid gap-3 sm:grid-cols-3">
      <Tile icon={CheckCircle2} label="Paid to you" value={formatPeso(totals.paid)} detail="Released by PMCM" tone="bg-success-soft text-success" />
      <Tile
        icon={CalendarClock}
        label="Next payment"
        value={totals.next ? formatPeso(totals.next.remainingBalance) : "—"}
        detail={totals.next?.dueDate ? `${totals.next.label} · due ${formatPortalDate(totals.next.dueDate)}` : "Nothing scheduled"}
        tone={totals.next ? "bg-attention-soft text-attention" : "bg-muted text-muted-foreground"}
      />
      <Tile
        icon={totals.late > 0 ? AlertTriangle : Wallet}
        label="Still to come"
        value={formatPeso(totals.toCome)}
        detail={totals.late > 0 ? `${formatPeso(totals.late)} is past its due date` : "Across your bookings"}
        tone={totals.late > 0 ? "bg-danger-soft text-danger" : "bg-primary-soft text-primary"}
      />
    </div>
  );
}

function Releases({ step, booking, fresh }: { step: PaymentStep; booking: SupplierBooking; fresh?: ReadonlySet<string> }) {
  const payable = booking.payables.find((item) => item.id === step.id);
  if (!payable?.history.length) return null;
  return (
    <ul className="space-y-1 text-xs text-muted-foreground">
      {payable.history.map((record) => (
        <li key={record.id} className="flex flex-wrap items-center gap-x-2">
          <span>{record.kind === "reversal" ? "Reversed" : "Sent"} {formatPeso(record.amount)} on {formatPortalDate(record.paymentDate)} · {record.method}{record.referenceNumber ? ` · ${record.referenceNumber}` : ""}</span>
          {fresh?.has(record.id) ? <span className="rounded-md bg-success-soft px-1.5 py-0.5 text-[11px] font-semibold text-success">New</span> : null}
        </li>
      ))}
    </ul>
  );
}

/** One booking: the event, the agreed amount, and each payout PMCM owes on a bar and a timeline. */
function BookingCard({ booking, todayKey, fresh }: { booking: SupplierBooking; todayKey: string; fresh?: ReadonlySet<string> }) {
  const steps = booking.payables.map((payable) => payoutStep(payable, todayKey));
  const paid = booking.payables.reduce((sum, payable) => sum + payable.amountReleased, 0);
  return (
    <Card className="gap-4 p-5">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-base font-semibold text-foreground">{booking.eventName}</h2>
          <p className="text-xs text-muted-foreground">{[booking.category, booking.terms ? `Your terms: ${booking.terms}` : null].filter(Boolean).join(" · ")}</p>
        </div>
        <p className="text-right text-xs text-muted-foreground">
          <span className="block text-base font-semibold tabular-nums text-foreground">{formatPeso(paid)}</span>
          {booking.contract !== null ? `of ${formatPeso(booking.contract)} agreed` : "paid so far"}
        </p>
      </header>
      {steps.length === 0 ? (
        <p className="rounded-md bg-muted/50 px-3 py-2 text-sm text-muted-foreground">PMCM has not set the payment schedule for this booking yet.</p>
      ) : (
        <>
          <PaymentProgressBar steps={steps} />
          <PaymentTimeline steps={steps} label={`Payments for ${booking.eventName}`} detail={(step) => <Releases step={step} booking={booking} fresh={fresh} />} />
        </>
      )}
    </Card>
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
  const totals = supplierPaymentTotals(payables, todayKey);
  return (
    <div className="space-y-4">
      <Tiles totals={totals} />
      {bookings.map((booking) => <BookingCard key={booking.requestId} booking={booking} todayKey={todayKey} fresh={freshPayouts} />)}
      <p className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
        A payment should have arrived but has not?
        <Button asChild size="sm" variant="outline"><Link href="/dashboard/messages"><MessageSquareText className="size-4" aria-hidden /> Message PMCM</Link></Button>
      </p>
    </div>
  );
}
