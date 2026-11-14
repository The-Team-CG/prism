import { DatePicker } from "@prism/ui/components/date-picker";
import { formatPortalDate } from "@prism/ui/format-date";
import { AlertTriangle, CheckCircle2, MailCheck } from "lucide-react";

import type { PrismBillingStatement, PrismEvent, PrismInquiry, PrismNotificationLog, PrismPaymentMilestone } from "@prism/types";
import { Button } from "@prism/ui/components/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@prism/ui/components/dialog";
import { FieldDescription } from "@prism/ui/components/field";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@prism/ui/components/select";
import { StatusBadge } from "@prism/ui/components/status-badge";
import { label, money } from "@/features/pmcm-kit";
import type { RecordPaymentInput } from "../model/finance-workspace-types";
import { NotificationDeliveryDetails } from "./notification-delivery-details";

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`rounded-lg border border-border bg-card ${className}`}>{children}</div>;
}
function CardHeader({ children }: { children: React.ReactNode }) {
  return <div className="border-b border-border px-6 py-4">{children}</div>;
}
function CardBody({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`px-6 py-5 ${className}`}>{children}</div>;
}

export function PaymentAtRiskAlert() {
  return (
    <div className="flex items-start gap-3 rounded-lg border border-destructive/20 bg-destructive/5 px-5 py-4">
      <AlertTriangle className="mt-0.5 size-4 shrink-0 text-destructive" />
      <div>
        <p className="text-sm font-semibold text-foreground">Payment at risk</p>
        <p className="mt-0.5 text-sm text-muted-foreground">
          The balance is unpaid inside the 48-hour event threshold. This is manual PMCM tracking — not a payment-processor integration.
        </p>
      </div>
    </div>
  );
}

export function NotificationEvidence({ logs }: { logs: PrismNotificationLog[] }) {
  return (
    <details className="rounded-xl border border-border bg-card">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-5 py-4">
        <span className="flex items-center gap-2 text-base font-semibold text-foreground"><MailCheck className="size-4 text-muted-foreground" /> Delivery log</span>
        <span className="text-sm text-muted-foreground">{logs.length} notices sent about billing</span>
      </summary>
    <Card className="rounded-none border-x-0 border-b-0">
      <CardHeader>
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <MailCheck className="size-4 text-attention" />
            <h3 className="text-sm font-semibold text-foreground">Notification activity</h3>
          </div>
          <span className="rounded-full bg-muted px-2.5 py-1 text-xs font-semibold text-muted-foreground">
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
            <div key={n.id} className="rounded-lg border border-border bg-muted/30 p-3.5">
              <div className="flex items-start justify-between gap-2">
                <p className="text-sm font-semibold text-foreground">{label(n.channel)} to {n.recipient}</p>
                <StatusBadge status={n.status} label={n.status === "sent" ? "Sent to provider" : label(n.status)} />
              </div>
              <p className="mt-1 line-clamp-2 text-xs leading-5 text-muted-foreground">{n.message}</p>
              {n.failureReason ? <p className="mt-1 text-xs text-muted-foreground">{n.failureReason}</p> : null}
              {n.channel === "email" || n.channel === "viber" ? <NotificationDeliveryDetails notificationId={n.id} status={n.status} channel={n.channel} /> : null}
            </div>
          ))}
        </div>
      </CardBody>
    </Card>
    </details>
  );
}

/** The statement as issued, folded away: who it is for and its line items. */
export function BillingStatementDetails({ event, inquiry, statement }: { event: PrismEvent; inquiry?: PrismInquiry; statement: PrismBillingStatement }) {
  const details = [
    { label: "Client", value: statement.clientName || event.clientName },
    { label: "Contact", value: statement.clientContact || inquiry?.email || "—" },
    { label: "Event", value: statement.eventName || event.eventName },
    { label: "Date", value: formatPortalDate(statement.eventDate || event.eventDate) },
  ];
  return (
    <details className="rounded-xl border border-border bg-card">
      <summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-2 px-5 py-4">
        <span className="text-base font-semibold text-foreground">Statement {statement.number}</span>
        <span className="text-sm text-muted-foreground">{statement.sentAt ? `Sent ${formatPortalDate(statement.sentAt)}` : "Not sent yet"} · {statement.lineItems.length} line items · {money.format(statement.totalAmount)}</span>
      </summary>
      <div className="grid gap-4 border-t border-border px-5 py-5 lg:grid-cols-2">
        <dl className="grid grid-cols-2 gap-3">
          {details.map(({ label: lbl, value }) => (
            <div key={lbl} className="rounded-lg bg-muted/40 p-3">
              <dt className="text-xs font-semibold text-muted-foreground">{lbl}</dt>
              <dd className="mt-0.5 text-sm font-semibold text-foreground">{value}</dd>
            </div>
          ))}
        </dl>
        <div className="rounded-lg border border-border p-4">
          <p className="text-sm font-semibold text-foreground">Line items</p>
          <ul className="mt-3 space-y-2 text-sm">
            {statement.lineItems.map((item) => (
              <li key={item.label} className="flex items-center justify-between gap-3">
                <span className="text-muted-foreground">{item.label}</span>
                <span className="font-semibold tabular-nums text-foreground">{money.format(item.amount)}</span>
              </li>
            ))}
            <li className="flex items-center justify-between border-t border-border pt-2 font-semibold">
              <span className="text-foreground">Total</span>
              <span className="tabular-nums text-foreground">{money.format(statement.totalAmount)}</span>
            </li>
          </ul>
        </div>
      </div>
    </details>
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
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-w-lg gap-0 p-0">
        <DialogHeader className="gap-1 border-b border-border px-6 py-4 pr-12 text-left">
          <DialogDescription>Record payment</DialogDescription>
          <DialogTitle className="truncate text-base font-semibold">{activePayment.label}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 px-6 py-5">
          <label className="block text-sm font-semibold text-foreground">
            Amount received
            <input
              type="number"
              value={amountReceived}
              onChange={(e) => onAmount(e.target.value)}
              className="mt-1.5 h-10 w-full rounded-lg border border-border bg-background px-3 text-sm font-normal"
            />
          </label>
          <label className="block text-sm font-semibold text-foreground">
            Payment date
            <span className="mt-1.5 block font-normal">
              <DatePicker value={paymentDate} onValueChange={onDate} aria-label="Payment date" className="h-10" />
            </span>
          </label>
          <div className="grid gap-1.5 text-sm font-semibold text-foreground">
            <span id="payment-method-label">Payment method</span>
            <Select value={paymentMethod} onValueChange={(value) => onMethod(value as RecordPaymentInput["paymentMethod"])}>
              <SelectTrigger aria-labelledby="payment-method-label" className="h-10 w-full rounded-lg text-sm font-normal">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Bank Transfer">Bank Transfer</SelectItem>
                <SelectItem value="GCash">GCash</SelectItem>
                <SelectItem value="Cheque">Cheque</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <label className="block text-sm font-semibold text-foreground">
            Reference number
            <input
              value={referenceNumber}
              onChange={(e) => onReference(e.target.value)}
              className="mt-1.5 h-10 w-full rounded-lg border border-border bg-background px-3 text-sm"
            />
          </label>
        </div>
        <DialogFooter className="border-t border-border px-6 py-4 sm:justify-between">
          {Number(amountReceived) <= 0 ? <FieldDescription className="mr-auto">Enter an amount above zero to save.</FieldDescription> : null}
          <Button variant="outline" className="rounded-lg font-semibold" onClick={onClose}>
            Cancel
          </Button>
          <Button
            disabled={busy || Number(amountReceived) <= 0}
            onClick={onSubmit}
            className="rounded-lg font-semibold"
          >
            <CheckCircle2 className="size-4" /> Save payment
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
