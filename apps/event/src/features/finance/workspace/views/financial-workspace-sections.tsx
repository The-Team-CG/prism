import { AlertTriangle, CalendarDays, CheckCircle2, Clock3, Download, MailCheck, ReceiptText, Send, WalletCards, X } from "lucide-react";

import type { PrismBillingStatement, PrismEvent, PrismInquiry, PrismNotificationLog, PrismPaymentMilestone } from "@prism/types";
import { Button } from "@/app/components/ui/button";
import { StatusBadge } from "@/app/components/ui/status-badge";
import { EmptyState } from "@/app/components/ui/empty-state";
import { label, money } from "@/features/pmcm-kit";
import { countNoun, isPaymentOverdue, paymentHistoryLabel } from "../model/finance-workspace-rules";
import type { RecordPaymentInput } from "../model/finance-workspace-types";

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`rounded-2xl border border-border bg-card shadow-sm ${className}`}>{children}</div>;
}
function CardHeader({ children }: { children: React.ReactNode }) {
  return <div className="border-b border-border px-6 py-4">{children}</div>;
}
function CardBody({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`px-6 py-5 ${className}`}>{children}</div>;
}
function SectionAccent({ children }: { children: React.ReactNode }) {
  return <p className="text-xs font-bold uppercase tracking-widest text-(--prism-signal)">{children}</p>;
}
function StatCell({ label: lbl, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-xl bg-muted/40 p-4">
      <p className="text-xs font-semibold text-muted-foreground">{lbl}</p>
      <p className="mt-1.5 text-lg font-black text-foreground">{value}</p>
      {sub ? <p className="mt-0.5 text-xs text-muted-foreground">{sub}</p> : null}
    </div>
  );
}

export function FinancialSummaryStats({
  statement,
  totalDue,
  totalPaid,
  totalRemaining,
  paymentsCount,
  openMilestones,
  remainingSub,
}: {
  statement?: PrismBillingStatement;
  totalDue: number;
  totalPaid: number;
  totalRemaining: number;
  paymentsCount: number;
  openMilestones: number;
  remainingSub: string;
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <StatCell
        label="Statement"
        value={statement?.number ?? "Not generated"}
        sub={statement ? label(statement.status) : "Approve billing source first"}
      />
      <StatCell label="Total due" value={money.format(totalDue || statement?.totalAmount || 0)} sub={countNoun(paymentsCount, "milestone")} />
      <StatCell label="Received" value={money.format(totalPaid)} sub={countNoun(openMilestones, "open milestone")} />
      <StatCell label="Remaining" value={money.format(totalRemaining)} sub={remainingSub} />
    </div>
  );
}

export function PaymentAtRiskAlert() {
  return (
    <div className="flex items-start gap-3 rounded-2xl border border-destructive/20 bg-destructive/5 px-5 py-4">
      <AlertTriangle className="mt-0.5 size-4 shrink-0 text-destructive" />
      <div>
        <p className="text-sm font-bold text-foreground">Payment at risk</p>
        <p className="mt-0.5 text-sm text-muted-foreground">
          The balance is unpaid inside the 48-hour event threshold. This is manual PMCM tracking — not a payment-processor integration.
        </p>
      </div>
    </div>
  );
}

export function NotificationEvidence({ logs }: { logs: PrismNotificationLog[] }) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <MailCheck className="size-4 text-(--prism-amber)" />
            <h3 className="text-sm font-bold text-foreground">Notification activity</h3>
          </div>
          <span className="rounded-full bg-muted px-2.5 py-1 text-xs font-bold text-muted-foreground">
            {logs.filter((entry) => entry.status === "queued").length} queued
          </span>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          Sent means provider acceptance, not recipient delivery. Historical payment statuses do not confirm delivery.
        </p>
      </CardHeader>
      <CardBody>
        <div className="grid gap-3 sm:grid-cols-2">
          {logs.slice(0, 4).map((n) => (
            <div key={n.id} className="rounded-xl border border-border bg-muted/30 p-3.5">
              <div className="flex items-start justify-between gap-2">
                <p className="text-sm font-bold text-foreground">{label(n.channel)} to {n.recipient}</p>
                <StatusBadge status={n.status} label={n.status === "sent" ? "Sent to provider" : label(n.status)} />
              </div>
              <p className="mt-1 line-clamp-2 text-xs leading-5 text-muted-foreground">{n.message}</p>
              {n.failureReason ? <p className="mt-1 text-xs text-muted-foreground">{n.failureReason}</p> : null}
            </div>
          ))}
        </div>
      </CardBody>
    </Card>
  );
}

export function BillingStatementCard({
  event,
  inquiry,
  statement,
  billingStatementHref,
  busy,
  onSendBilling,
}: {
  event: PrismEvent;
  inquiry?: PrismInquiry;
  statement?: PrismBillingStatement;
  billingStatementHref: string | undefined;
  busy: boolean;
  onSendBilling: (billingId: string) => Promise<void>;
}) {
  return (
    <Card>
      <CardHeader>
        <SectionAccent>Billing statement</SectionAccent>
        <h3 className="mt-1 text-base font-bold text-foreground">
          {statement?.number ?? "Awaiting billing source"}
        </h3>
        {statement ? <StatusBadge status={statement.status} label={label(statement.status)} className="mt-2" /> : null}
        {statement && statement.storageState !== "stored" ? <p className="mt-2 text-xs text-amber-700">PDF storage is pending W10 provider configuration; the statement metadata remains available.</p> : null}
      </CardHeader>
      {statement ? (
        <BillingStatementBody
          event={event}
          inquiry={inquiry}
          statement={statement}
          billingStatementHref={billingStatementHref}
          busy={busy}
          onSendBilling={onSendBilling}
        />
      ) : (
        <CardBody>
          <EmptyState
            icon={ReceiptText}
            title="No billing statement yet"
            description="Approve a billing source in Closure, then generate the statement for this event."
          />
        </CardBody>
      )}
    </Card>
  );
}

function BillingStatementBody({
  event,
  inquiry,
  statement,
  billingStatementHref,
  busy,
  onSendBilling,
}: {
  event: PrismEvent;
  inquiry?: PrismInquiry;
  statement: PrismBillingStatement;
  billingStatementHref: string | undefined;
  busy: boolean;
  onSendBilling: (billingId: string) => Promise<void>;
}) {
  const details = [
    { label: "Client", value: statement.clientName || event.clientName },
    { label: "Contact", value: statement.clientContact || inquiry?.email || "—" },
    { label: "Event", value: statement.eventName || event.eventName },
    { label: "Date", value: statement.eventDate || event.eventDate },
  ];
  return (
    <CardBody className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        {details.map(({ label: lbl, value }) => (
          <div key={lbl} className="rounded-xl bg-muted/40 p-3">
            <p className="text-xs font-semibold text-muted-foreground">{lbl}</p>
            <p className="mt-0.5 text-sm font-bold text-foreground">{value}</p>
          </div>
        ))}
      </div>
      <div className="rounded-xl border border-border p-4">
        <p className="text-sm font-bold text-foreground">Package line items</p>
        <div className="mt-3 space-y-2">
          {statement.lineItems.map((item) => (
            <div key={item.label} className="flex items-center justify-between gap-3 text-sm">
              <span className="text-muted-foreground">{item.label}</span>
              <span className="font-bold text-foreground">{money.format(item.amount)}</span>
            </div>
          ))}
          <div className="flex items-center justify-between border-t border-border pt-2 text-sm font-bold">
            <span className="text-foreground">Total</span>
            <span className="text-lg text-foreground">{money.format(statement.totalAmount)}</span>
          </div>
        </div>
      </div>
      <div className="rounded-xl border border-border p-4">
        <p className="text-sm font-bold text-foreground">Payment schedule</p>
        <div className="mt-3 space-y-2 text-sm">
          {statement.paymentSchedule.map((item) => (
            <div key={item.label} className="flex items-center justify-between gap-3">
              <span className="text-muted-foreground">{item.label} ({item.percentage}%)</span>
              <span className="font-bold text-foreground">{money.format(item.amount)}</span>
            </div>
          ))}
        </div>
      </div>
      <div className="flex flex-wrap gap-2 pt-1">
        <a
          href={billingStatementHref}
          aria-disabled={!billingStatementHref}
          tabIndex={billingStatementHref ? 0 : -1}
          target="_blank"
          className="inline-flex h-9 items-center gap-2 rounded-xl border border-border bg-background px-4 text-sm font-bold text-foreground transition hover:bg-muted"
        >
          <Download className="size-4" /> Download PDF
        </a>
        <Button
          disabled={busy}
          onClick={() => onSendBilling(statement.id)}
          className="rounded-xl font-bold"
        >
          <Send className="size-4" /> Send to client
        </Button>
      </div>
    </CardBody>
  );
}

export function PaymentTracker({
  payments,
  busy,
  onRecord,
}: {
  payments: PrismPaymentMilestone[];
  busy: boolean;
  onRecord: (payment: PrismPaymentMilestone) => void;
}) {
  return (
    <Card>
      <CardHeader>
        <SectionAccent>Payment tracker</SectionAccent>
        <h3 className="mt-1 text-base font-bold text-foreground">Milestone status</h3>
      </CardHeader>
      <CardBody className="space-y-3">
        {payments.length === 0 ? (
          <EmptyState icon={WalletCards} title="No milestones yet" description="Milestones appear after the billing statement is posted." />
        ) : (
          payments.map((payment) => (
            <PaymentMilestoneCard key={payment.id} payment={payment} busy={busy} onRecord={onRecord} />
          ))
        )}
      </CardBody>
    </Card>
  );
}

function PaymentMilestoneCard({
  payment,
  busy,
  onRecord,
}: {
  payment: PrismPaymentMilestone;
  busy: boolean;
  onRecord: (payment: PrismPaymentMilestone) => void;
}) {
  const overdue = isPaymentOverdue(payment.status, payment.dueDate);
  return (
    <div className="rounded-xl border border-border bg-muted/30 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-bold text-foreground">{payment.label} ({payment.percentage}%)</p>
          <div className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
            <CalendarDays className="size-3" /> Due {payment.dueDate}
          </div>
        </div>
        <StatusBadge
          status={overdue ? "open" : payment.status}
          label={overdue ? "Overdue" : label(payment.status)}
        />
      </div>
      <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
        {[
          { label: "Due", value: money.format(payment.amount) },
          { label: "Received", value: money.format(payment.amountPaid) },
          { label: "Remaining", value: money.format(payment.remainingBalance) },
        ].map(({ label: lbl, value }) => (
          <div key={lbl} className="rounded-lg bg-background px-2.5 py-2">
            <p className="text-[10px] font-semibold text-muted-foreground">{lbl}</p>
            <p className="mt-0.5 font-bold text-foreground">{value}</p>
          </div>
        ))}
      </div>
      {payment.history.length > 0 ? (
        <div className="mt-3 space-y-1.5 rounded-lg bg-background p-2.5">
          {payment.history.map((rec) => (
            <div key={rec.id} className="flex flex-wrap items-center justify-between gap-2 text-xs">
              <span className="font-bold text-foreground">{money.format(rec.amountReceived)}</span>
              <span className="flex items-center gap-1 text-muted-foreground">
                <Clock3 className="size-3" /> {rec.paymentDate} — {rec.paymentMethod}
                {rec.referenceNumber ? ` — ${rec.referenceNumber}` : ""}
              </span>
            </div>
          ))}
        </div>
      ) : null}
      <div className="mt-3 flex items-center justify-between gap-3">
        <p className="text-xs text-muted-foreground">{paymentHistoryLabel(payment.history.length)}</p>
        <Button
          size="sm"
          disabled={busy || payment.status === "paid"}
          onClick={() => onRecord(payment)}
          variant="outline"
          className="rounded-lg font-bold"
        >
          <WalletCards className="size-3" /> Record payment
        </Button>
      </div>
    </div>
  );
}

export function RecordPaymentModal({
  activePayment,
  amountReceived,
  paymentDate,
  paymentMethod,
  referenceNumber,
  busy,
  onAmount,
  onDate,
  onMethod,
  onReference,
  onClose,
  onSubmit,
}: {
  activePayment: PrismPaymentMilestone;
  amountReceived: string;
  paymentDate: string;
  paymentMethod: RecordPaymentInput["paymentMethod"];
  referenceNumber: string;
  busy: boolean;
  onAmount: (value: string) => void;
  onDate: (value: string) => void;
  onMethod: (value: RecordPaymentInput["paymentMethod"]) => void;
  onReference: (value: string) => void;
  onClose: () => void;
  onSubmit: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 px-4">
      <div className="w-full max-w-lg rounded-2xl border border-border bg-card shadow-xl">
        <div className="flex items-start justify-between gap-3 border-b border-border px-6 py-4">
          <div>
            <SectionAccent>Record payment</SectionAccent>
            <h3 className="mt-1 text-base font-bold text-foreground">{activePayment.label}</h3>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted">
            <X className="size-4" />
          </button>
        </div>
        <div className="grid gap-4 px-6 py-5">
          {[
            { label: "Amount received", type: "number", value: amountReceived, onChange: onAmount },
            { label: "Payment date", type: "date", value: paymentDate, onChange: onDate },
          ].map((field) => (
            <label key={field.label} className="block text-sm font-bold text-foreground">
              {field.label}
              <input
                type={field.type}
                value={field.value}
                onChange={(e) => field.onChange(e.target.value)}
                className="mt-1.5 h-10 w-full rounded-xl border border-border bg-background px-3 text-sm font-normal"
              />
            </label>
          ))}
          <label className="block text-sm font-bold text-foreground">
            Payment method
            <select
              value={paymentMethod}
              onChange={(e) => onMethod(e.target.value as RecordPaymentInput["paymentMethod"])}
              className="mt-1.5 h-10 w-full rounded-xl border border-border bg-background px-3 text-sm"
            >
              <option>Bank Transfer</option>
              <option>GCash</option>
              <option>Cheque</option>
            </select>
          </label>
          <label className="block text-sm font-bold text-foreground">
            Reference number
            <input
              value={referenceNumber}
              onChange={(e) => onReference(e.target.value)}
              className="mt-1.5 h-10 w-full rounded-xl border border-border bg-background px-3 text-sm"
            />
          </label>
        </div>
        <div className="flex justify-end gap-2 border-t border-border px-6 py-4">
          <Button variant="outline" className="rounded-xl font-bold" onClick={onClose}>
            Cancel
          </Button>
          <Button
            disabled={busy || Number(amountReceived) <= 0}
            onClick={onSubmit}
            className="rounded-xl font-bold"
          >
            <CheckCircle2 className="size-4" /> Save payment
          </Button>
        </div>
      </div>
    </div>
  );
}
