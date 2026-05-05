import { useState } from "react";
import { AlertTriangle, CalendarDays, CheckCircle2, Clock3, Download, MailCheck, ReceiptText, Send, WalletCards, X } from "lucide-react";

import { apiUrl, type MvpBillingStatement, type MvpEvent, type MvpInquiry, type MvpNotificationLog, type MvpPaymentMilestone } from "@/lib/mvp-api";
import { Button } from "@/app/components/ui/button";
import { StatusBadge } from "@/app/components/ui/status-badge";
import { EmptyState } from "@/app/components/ui/empty-state";
import { label, money } from "./helpers";

type RecordPaymentInput = {
  amountReceived: number;
  paymentDate: string;
  paymentMethod: "Bank Transfer" | "GCash" | "Cheque";
  referenceNumber?: string;
};

function isOverdue(status: string, dueDate: string) {
  return status !== "paid" && new Date(dueDate) < new Date();
}

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
      {sub && <p className="mt-0.5 text-xs text-muted-foreground">{sub}</p>}
    </div>
  );
}

export function FinancialWorkspace({
  event,
  inquiry,
  billingStatements,
  payments,
  notificationLogs = [],
  busy,
  onRecordPayment,
  onSendBilling,
}: {
  event: MvpEvent;
  inquiry?: MvpInquiry;
  billingStatements: MvpBillingStatement[];
  payments: MvpPaymentMilestone[];
  notificationLogs?: MvpNotificationLog[];
  busy: boolean;
  onRecordPayment: (milestoneId: string, input: RecordPaymentInput) => Promise<void>;
  onSendBilling: (billingId: string) => Promise<void>;
}) {
  const statement = billingStatements.find((b) => b.eventId === event.id);
  const [activePayment, setActivePayment] = useState<MvpPaymentMilestone | null>(null);
  const [amountReceived, setAmountReceived] = useState("");
  const [paymentDate, setPaymentDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [paymentMethod, setPaymentMethod] = useState<RecordPaymentInput["paymentMethod"]>("Bank Transfer");
  const [referenceNumber, setReferenceNumber] = useState("");

  const totalDue = payments.reduce((s, p) => s + p.amount, 0);
  const totalPaid = payments.reduce((s, p) => s + p.amountPaid, 0);
  const totalRemaining = payments.reduce((s, p) => s + p.remainingBalance, 0);
  const openMilestones = payments.filter((p) => p.status !== "paid").length;
  const balance = payments.find((p) => p.label.toLowerCase().includes("balance"));
  const paymentAtRisk = Boolean(balance && balance.status === "at_risk");

  function openRecordModal(payment: MvpPaymentMilestone) {
    setActivePayment(payment);
    setAmountReceived(String(payment.remainingBalance || payment.amount));
    setPaymentDate(new Date().toISOString().slice(0, 10));
    setPaymentMethod("Bank Transfer");
    setReferenceNumber("");
  }

  async function submitRecordPayment() {
    if (!activePayment) return;
    await onRecordPayment(activePayment.id, {
      amountReceived: Number(amountReceived),
      paymentDate,
      paymentMethod,
      referenceNumber,
    });
    setActivePayment(null);
  }

  return (
    <div className="space-y-5">
      {/* Summary stats */}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCell
          label="Statement"
          value={statement?.number ?? "Not generated"}
          sub={statement ? label(statement.status) : "Approve billing source first"}
        />
        <StatCell label="Total due" value={money.format(totalDue || statement?.totalAmount || 0)} sub={`${payments.length} milestone${payments.length === 1 ? "" : "s"}`} />
        <StatCell label="Received" value={money.format(totalPaid)} sub={`${openMilestones} open milestone${openMilestones === 1 ? "" : "s"}`} />
        <StatCell label="Remaining" value={money.format(totalRemaining)} sub={paymentAtRisk ? "Payment at risk" : "Manual tracker"} />
      </div>

      {/* At-risk alert */}
      {paymentAtRisk && (
        <div className="flex items-start gap-3 rounded-2xl border border-destructive/20 bg-destructive/5 px-5 py-4">
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-destructive" />
          <div>
            <p className="text-sm font-bold text-foreground">Payment at risk</p>
            <p className="mt-0.5 text-sm text-muted-foreground">
              The balance is unpaid inside the 48-hour event threshold. This is manual PMCM tracking — not a payment-processor integration.
            </p>
          </div>
        </div>
      )}

      {/* Notification evidence */}
      {notificationLogs.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <MailCheck className="size-4 text-(--prism-amber)" />
                <h3 className="text-sm font-bold text-foreground">Queued notification evidence</h3>
              </div>
              <span className="rounded-full bg-muted px-2.5 py-1 text-xs font-bold text-muted-foreground">
                {notificationLogs.length} queued
              </span>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Local in-app queue only — SendGrid/Viber delivery deferred for defense.
            </p>
          </CardHeader>
          <CardBody>
            <div className="grid gap-3 sm:grid-cols-2">
              {notificationLogs.slice(0, 4).map((n) => (
                <div key={n.id} className="rounded-xl border border-border bg-muted/30 p-3.5">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-bold text-foreground">{label(n.channel)} to {n.recipient}</p>
                    <StatusBadge status={n.status} label={label(n.status)} />
                  </div>
                  <p className="mt-1 line-clamp-2 text-xs leading-5 text-muted-foreground">{n.message}</p>
                </div>
              ))}
            </div>
          </CardBody>
        </Card>
      )}

      {/* Billing statement + payment tracker */}
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        {/* Billing statement */}
        <Card>
          <CardHeader>
            <SectionAccent>Billing statement</SectionAccent>
            <h3 className="mt-1 text-base font-bold text-foreground">
              {statement?.number ?? "Awaiting billing source"}
            </h3>
            {statement && (
              <StatusBadge status={statement.status} label={label(statement.status)} className="mt-2" />
            )}
          </CardHeader>
          {statement ? (
            <CardBody className="space-y-4">
              {/* Client details */}
              <div className="grid gap-3 sm:grid-cols-2">
                {[
                  { label: "Client", value: statement.clientName || event.clientName },
                  { label: "Contact", value: statement.clientContact || inquiry?.email || "—" },
                  { label: "Event", value: statement.eventName || event.eventName },
                  { label: "Date", value: statement.eventDate || event.eventDate },
                ].map(({ label: lbl, value }) => (
                  <div key={lbl} className="rounded-xl bg-muted/40 p-3">
                    <p className="text-xs font-semibold text-muted-foreground">{lbl}</p>
                    <p className="mt-0.5 text-sm font-bold text-foreground">{value}</p>
                  </div>
                ))}
              </div>

              {/* Line items */}
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

              {/* Payment schedule */}
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

              {/* Actions */}
              <div className="flex flex-wrap gap-2 pt-1">
                <a
                  href={apiUrl(statement.pdfUrl)}
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

        {/* Payment tracker */}
        <Card>
          <CardHeader>
            <SectionAccent>Payment tracker</SectionAccent>
            <h3 className="mt-1 text-base font-bold text-foreground">Milestone status</h3>
          </CardHeader>
          <CardBody className="space-y-3">
            {payments.length === 0 ? (
              <EmptyState icon={WalletCards} title="No milestones yet" description="Milestones appear after the billing statement is posted." />
            ) : (
              payments.map((payment) => {
                const overdue = isOverdue(payment.status, payment.dueDate);
                return (
                  <div key={payment.id} className="rounded-xl border border-border bg-muted/30 p-4">
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

                    {payment.history.length > 0 && (
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
                    )}

                    <div className="mt-3 flex items-center justify-between gap-3">
                      <p className="text-xs text-muted-foreground">
                        {payment.history.length === 0 ? "No payment history." : `${payment.history.length} record${payment.history.length === 1 ? "" : "s"}`}
                      </p>
                      <Button
                        size="sm"
                        disabled={busy || payment.status === "paid"}
                        onClick={() => openRecordModal(payment)}
                        variant="outline"
                        className="rounded-lg font-bold"
                      >
                        <WalletCards className="size-3" /> Record payment
                      </Button>
                    </div>
                  </div>
                );
              })
            )}
          </CardBody>
        </Card>
      </div>

      {/* Record payment modal */}
      {activePayment && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 px-4">
          <div className="w-full max-w-lg rounded-2xl border border-border bg-card shadow-xl">
            <div className="flex items-start justify-between gap-3 border-b border-border px-6 py-4">
              <div>
                <SectionAccent>Record payment</SectionAccent>
                <h3 className="mt-1 text-base font-bold text-foreground">{activePayment.label}</h3>
              </div>
              <button onClick={() => setActivePayment(null)} className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted">
                <X className="size-4" />
              </button>
            </div>
            <div className="grid gap-4 px-6 py-5">
              {[
                { label: "Amount received", type: "number", value: amountReceived, onChange: setAmountReceived },
                { label: "Payment date", type: "date", value: paymentDate, onChange: setPaymentDate },
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
                  onChange={(e) => setPaymentMethod(e.target.value as RecordPaymentInput["paymentMethod"])}
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
                  onChange={(e) => setReferenceNumber(e.target.value)}
                  className="mt-1.5 h-10 w-full rounded-xl border border-border bg-background px-3 text-sm"
                />
              </label>
            </div>
            <div className="flex justify-end gap-2 border-t border-border px-6 py-4">
              <Button variant="outline" className="rounded-xl font-bold" onClick={() => setActivePayment(null)}>
                Cancel
              </Button>
              <Button
                disabled={busy || Number(amountReceived) <= 0}
                onClick={submitRecordPayment}
                className="rounded-xl font-bold"
              >
                <CheckCircle2 className="size-4" /> Save payment
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
