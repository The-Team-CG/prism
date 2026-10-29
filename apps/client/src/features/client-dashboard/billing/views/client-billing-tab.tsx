"use client";
import { formatPortalDate, manilaDateKey } from "@prism/ui/format-date";

import { CheckCircle2, FileText, MessageSquareText, ReceiptText, WalletCards } from "lucide-react";
import type { PrismBillingStatement, PrismClientBillingDispute, PrismPaymentMilestone } from "@prism/types";
import Link from "next/link";
import { Button } from "@/app/components/ui/button";
import { StatusBadge } from "@/app/components/ui/status-badge";
import { cn } from "@/app/components/ui/utils";
import { formatDayLabel, formatLabel, money } from "../../shared/tab-ui";
import { dashboardHref } from "../../workspace/shared";
import { ClientFigureStrip, ClientListEmpty, type ClientFigure } from "../../shared/client-list-ui";
import { dueState, nextPaymentFigure } from "../../home/model/client-home-summary";
import { clientBillingSummary, clientMilestoneRemaining } from "../model/client-billing-rules";
import { useClientBillingDisputeViewModel } from "../view-models/use-client-billing-dispute-view-model";
import { useClientStatementDownload } from "../view-models/use-client-statement-download";
import { createPaymentReceiptPdf, paymentReceiptFileName } from "../model/payment-receipt";

export function ClientBillingTab({
  eventId,
  eventName = "Event",
  payments,
  billing,
  disputes = [],
}: {
  eventId?: string;
  eventName?: string;
  payments: PrismPaymentMilestone[];
  billing?: PrismBillingStatement;
  disputes?: PrismClientBillingDispute[];
}) {
  const activePayments = payments.filter((payment) => !payment.supersededAt);
  const historicalPayments = payments.filter((payment) => Boolean(payment.supersededAt));
  const { totalAmount, totalPaid, balance } = clientBillingSummary(activePayments, billing);
  const messagesHref = dashboardHref("messages", eventId);
  const disputeForm = useClientBillingDisputeViewModel({ eventId, billing, disputes });
  const statementDownload = useClientStatementDownload();
  function downloadReceipt(payment: PrismPaymentMilestone["history"][number], milestoneLabel: string) {
    const blob = createPaymentReceiptPdf({ eventName, milestoneLabel, payment });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = paymentReceiptFileName(payment.id);
    anchor.click();
    URL.revokeObjectURL(url);
  }

  const todayKey = manilaDateKey();
  const figures = eventBillingFigures({ totalAmount, totalPaid, balance }, activePayments, todayKey, Boolean(billing));

  return (
    <div className="space-y-4">
      {totalAmount > 0 ? (
        <ClientFigureStrip label="Billing summary" figures={figures} />
      ) : null}

      {billing ? <StatementBar billing={billing} messagesHref={messagesHref} statementDownload={statementDownload} /> : null}
      {statementDownload.error ? <p role="alert" className="text-sm text-destructive">{statementDownload.error}</p> : null}

      {activePayments.length === 0 ? (
        <ClientListEmpty
          icon={ReceiptText}
          title="No payments scheduled yet"
          description="PMCM posts your billing statement once the proposal is approved, and the payment schedule appears here."
          action={<Button asChild variant="outline" size="sm"><Link href={messagesHref}>Message PMCM about billing</Link></Button>}
        />
      ) : (
        <section aria-labelledby="client-payment-schedule" className="overflow-hidden rounded-lg border border-border bg-card">
          <header className="flex items-center justify-between gap-2 border-b border-border px-4 py-3">
            <h2 id="client-payment-schedule" className="flex items-center gap-2 text-sm font-semibold text-foreground">
              Payment schedule <span className="font-normal tabular-nums text-muted-foreground">{activePayments.length}</span>
            </h2>
          </header>
          <ul className="divide-y divide-border">
            {activePayments.map((payment) => (
              <PaymentRow key={payment.id} payment={payment} todayKey={todayKey} onReceipt={(record) => downloadReceipt(record, payment.label)} />
            ))}
          </ul>
        </section>
      )}

      {billing && eventId ? (
        <BillingDisputes billing={billing} activePayments={activePayments} disputeForm={disputeForm} />
      ) : null}

      {historicalPayments.length > 0 ? (
        <details className="group overflow-hidden rounded-lg border border-border bg-card">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-4 py-3 text-sm font-semibold text-foreground">
            Earlier statement payments <span className="font-normal tabular-nums text-muted-foreground">{historicalPayments.length}</span>
          </summary>
          <p className="border-t border-border px-4 py-2 text-xs text-muted-foreground">These payments are credited to the current statement totals above.</p>
          <ul className="divide-y divide-border border-t border-border">
            {historicalPayments.map((payment) => (
              <PaymentRow key={payment.id} payment={payment} todayKey={todayKey} onReceipt={(record) => downloadReceipt(record, payment.label)} superseded />
            ))}
          </ul>
        </details>
      ) : null}
    </div>
  );
}

type PaymentRecord = PrismPaymentMilestone["history"][number];
type RowTone = "urgent" | "attention" | "done" | "neutral";

const ROW_BAR: Record<RowTone, string> = { urgent: "border-l-danger", attention: "border-l-attention", done: "border-l-transparent", neutral: "border-l-transparent" };
const ROW_ICON: Record<RowTone, string> = { urgent: "bg-danger-soft text-danger", attention: "bg-attention-soft text-attention", done: "bg-success-soft text-success", neutral: "bg-muted text-muted-foreground" };
const ROW_STATUS: Record<RowTone, string> = { urgent: "font-semibold text-danger", attention: "font-medium text-attention", done: "text-success", neutral: "text-muted-foreground" };

/** One milestone: what it is, when it's due, how much is left, and a receipt for each payment made. */
function PaymentRow({ payment, todayKey, onReceipt, superseded = false }: { payment: PrismPaymentMilestone; todayKey: string; onReceipt: (record: PaymentRecord) => void; superseded?: boolean }) {
  const { remaining, done, tone, partlyPaid, statusLabel } = paymentRowState(payment, todayKey, superseded);
  return (
    <li className={cn("grid grid-cols-[2rem_minmax(0,1fr)] gap-x-3 gap-y-1 border-l-[3px] py-3 pl-3 pr-4 sm:grid-cols-[2rem_minmax(0,1fr)_10rem_9.5rem]", ROW_BAR[tone])}>
      <span aria-hidden className={cn("grid size-8 place-items-center rounded-md", ROW_ICON[tone])}>
        {done ? <CheckCircle2 className="size-4" /> : <WalletCards className="size-4" />}
      </span>
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold text-foreground">{payment.label}</p>
        <p className="truncate text-xs text-muted-foreground">
          {superseded && payment.supersededAt ? `Superseded ${formatDayLabel(payment.supersededAt)}` : `Due ${formatPortalDate(payment.dueDate)}`}
          {partlyPaid ? ` · ${money.format(payment.amount - remaining)} paid so far` : ""}
        </p>
        <PaymentReceipts history={payment.history} onReceipt={onReceipt} />
      </div>
      <p className={cn("col-start-2 whitespace-nowrap text-xs sm:col-start-auto sm:text-sm", ROW_STATUS[tone])}>{statusLabel}</p>
      <p className="col-start-2 text-sm font-semibold tabular-nums text-foreground sm:col-start-auto sm:text-right">
        {money.format(done ? payment.amount : remaining)}
        {partlyPaid ? <span className="block text-xs font-normal text-muted-foreground">of {money.format(payment.amount)}</span> : null}
      </p>
    </li>
  );
}

function PaymentReceipts({ history, onReceipt }: { history: PaymentRecord[]; onReceipt: (record: PaymentRecord) => void }) {
  if (history.length === 0) return null;
  return (
    <ul className="mt-1.5 space-y-1">
      {history.map((record) => (
        <li key={record.id} className="flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
          <span>{money.format(record.amountReceived)} received {formatPortalDate(record.paymentDate)}</span>
          <button type="button" onClick={() => onReceipt(record)} className="inline-flex items-center gap-1 font-medium text-primary hover:text-primary/80">
            <ReceiptText className="size-3" aria-hidden /> Receipt
          </button>
        </li>
      ))}
    </ul>
  );
}

function paymentRowState(payment: PrismPaymentMilestone, todayKey: string, superseded: boolean) {
  const remaining = clientMilestoneRemaining(payment);
  const done = remaining <= 0 || payment.status === "paid";
  const due = done || superseded ? null : dueState(payment.dueDate, todayKey);
  const tone: RowTone = done ? "done" : due?.tone ?? "neutral";
  return { remaining, done, tone, partlyPaid: !done && remaining < payment.amount, statusLabel: done ? "Paid" : due?.label ?? formatLabel(payment.status) };
}

/** Billing figures for one event: what's left, the next payment, what's paid and the total. */
function eventBillingFigures(summary: { totalAmount: number; totalPaid: number; balance: number }, activePayments: PrismPaymentMilestone[], todayKey: string, hasStatement: boolean): ClientFigure[] {
  const eventIds = new Set(activePayments.map((payment) => payment.eventId));
  const settled = summary.balance <= 0;
  return [
    { label: "Remaining", value: money.format(summary.balance), detail: settled ? "Fully paid" : "Still to pay", tone: settled ? "done" : undefined },
    nextPaymentFigure(activePayments, eventIds, todayKey, (amount) => money.format(amount)),
    { label: "Paid", value: money.format(summary.totalPaid) },
    { label: hasStatement ? "Statement total" : "Scheduled total", value: money.format(summary.totalAmount) },
  ];
}

function StatementBar({ billing, messagesHref, statementDownload }: { billing: PrismBillingStatement; messagesHref: string; statementDownload: ReturnType<typeof useClientStatementDownload> }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-card px-4 py-3">
      <div className="flex min-w-0 items-center gap-3">
        <span aria-hidden className="grid size-8 place-items-center rounded-md bg-muted text-muted-foreground"><FileText className="size-4" /></span>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-foreground">Billing statement {billing.number}</p>
          <p className="text-xs text-muted-foreground">{formatLabel(billing.status)}</p>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Button asChild size="sm" variant="ghost"><Link href={messagesHref}><MessageSquareText className="size-4" /> Ask PMCM</Link></Button>
        {billing.storageObjectId ? (
          <Button size="sm" variant="outline" disabled={statementDownload.busy} onClick={() => void statementDownload.download(billing.storageObjectId, `${billing.number}.pdf`)}>
            <FileText className="size-4" /> {statementDownload.busy ? "Preparing…" : "Download"}
          </Button>
        ) : null}
      </div>
    </div>
  );
}

type DisputeForm = ReturnType<typeof useClientBillingDisputeViewModel>;

/** Open disputes as rows; the form to raise one stays folded until the client asks for it. */
function BillingDisputes({ billing, activePayments, disputeForm }: { billing: PrismBillingStatement; activePayments: PrismPaymentMilestone[]; disputeForm: DisputeForm }) {
  const canSubmit = !disputeForm.submitting && Boolean(disputeForm.amount) && Number(disputeForm.amount) <= billing.totalAmount && Boolean(disputeForm.reason.trim());
  return (
    <section aria-labelledby="client-billing-disputes" className="overflow-hidden rounded-lg border border-border bg-card">
      <details className="group">
        <summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-2 px-4 py-3">
          <span>
            <span id="client-billing-disputes" className="text-sm font-semibold text-foreground">Question a charge</span>
            <span className="block text-xs text-muted-foreground">Tell PMCM which charge you want reviewed. Your reason goes to the event finance team.</span>
          </span>
          <span className="text-sm font-medium text-primary group-open:hidden">Raise a dispute</span>
        </summary>
        <div className="grid gap-3 border-t border-border px-4 py-4 sm:grid-cols-2">
          <label className="grid gap-1 text-xs font-medium text-muted-foreground">Amount disputed
            <input type="number" min="1" max={billing.totalAmount} value={disputeForm.amount} onChange={(event) => disputeForm.setAmount(event.target.value)} className="h-10 rounded-md border border-border bg-background px-3 text-sm text-foreground" />
          </label>
          <label className="grid gap-1 text-xs font-medium text-muted-foreground">Related payment (optional)
            <select value={disputeForm.milestoneId} onChange={(event) => disputeForm.setMilestoneId(event.target.value)} className="h-10 rounded-md border border-border bg-background px-3 text-sm text-foreground">
              <option value="">Whole statement</option>
              {activePayments.map((payment) => <option key={payment.id} value={payment.id}>{payment.label}</option>)}
            </select>
          </label>
          <label className="grid gap-1 text-xs font-medium text-muted-foreground sm:col-span-2">Reason
            <textarea value={disputeForm.reason} onChange={(event) => disputeForm.setReason(event.target.value)} rows={3} maxLength={1000} className="rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground" />
          </label>
          {disputeForm.error ? <p role="alert" className="text-sm text-destructive sm:col-span-2">{disputeForm.error}</p> : null}
          <div className="sm:col-span-2">
            <Button disabled={!canSubmit} onClick={() => void disputeForm.submit()}>{disputeForm.submitting ? "Submitting…" : "Submit dispute"}</Button>
          </div>
        </div>
      </details>
      {disputeForm.disputes.length > 0 ? (
        <ul className="divide-y divide-border border-t border-border">
          {disputeForm.disputes.map((dispute) => (
            <li key={dispute.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
              <span className="min-w-0">
                <span className="block text-sm font-semibold text-foreground">{money.format(dispute.amount)} disputed</span>
                <span className="block text-xs text-muted-foreground">Opened {formatDayLabel(dispute.createdAt)}{dispute.resolvedAt ? ` · closed ${formatDayLabel(dispute.resolvedAt)}` : ""}</span>
              </span>
              <StatusBadge status={dispute.status} label={formatLabel(dispute.status)} />
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
