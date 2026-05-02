import { useState } from "react";
import { AlertTriangle, CheckCircle2, Clock3, Download, MailCheck, ReceiptText, Send, WalletCards, X } from "lucide-react";

import { apiUrl, type MvpBillingStatement, type MvpEvent, type MvpInquiry, type MvpNotificationLog, type MvpPaymentMilestone } from "@/lib/mvp-api";
import { PrismBillingMilestoneList, PrismSectionPanel } from "@prism/ui";
import { cx, label, money } from "./helpers";

type RecordPaymentInput = {
  amountReceived: number;
  paymentDate: string;
  paymentMethod: "Bank Transfer" | "GCash" | "Cheque";
  referenceNumber?: string;
};

function paymentTone(status: string, dueDate: string) {
  const overdue = status !== "paid" && new Date(dueDate) < new Date();
  if (status === "paid") return "bg-emerald-50 text-emerald-700 ring-emerald-100";
  if (status === "at_risk" || overdue) return "bg-rose-50 text-rose-700 ring-rose-100";
  if (status === "partially_paid") return "bg-amber-50 text-amber-800 ring-amber-100";
  return "bg-muted text-muted-foreground ring-border";
}

function notificationTone(status: string) {
  if (["sent", "delivered"].includes(status)) return "bg-emerald-50 text-emerald-700 ring-emerald-100";
  if (["failed", "blocked"].includes(status)) return "bg-rose-50 text-rose-700 ring-rose-100";
  return "bg-amber-50 text-amber-800 ring-amber-100";
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
  const statement = billingStatements.find((billing) => billing.eventId === event.id);
  const [activePayment, setActivePayment] = useState<MvpPaymentMilestone | null>(null);
  const [amountReceived, setAmountReceived] = useState("");
  const [paymentDate, setPaymentDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [paymentMethod, setPaymentMethod] = useState<RecordPaymentInput["paymentMethod"]>("Bank Transfer");
  const [referenceNumber, setReferenceNumber] = useState("");
  const balance = payments.find((payment) => payment.label.toLowerCase().includes("balance"));
  const paymentAtRisk = Boolean(balance && balance.status !== "paid" && balance.status === "at_risk");
  const totalDue = payments.reduce((sum, payment) => sum + payment.amount, 0);
  const totalPaid = payments.reduce((sum, payment) => sum + payment.amountPaid, 0);
  const totalRemaining = payments.reduce((sum, payment) => sum + payment.remainingBalance, 0);
  const openMilestones = payments.filter((payment) => payment.status !== "paid").length;
  const billingMilestonesForUi = payments.map((payment) => ({
    id: payment.id,
    label: `${payment.label} (${payment.percentage}%)`,
    amount: money.format(payment.amount),
    due: payment.dueDate,
    status: payment.status,
  }));

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
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { label: "Statement", value: statement?.number ?? "Not generated", detail: statement ? label(statement.status) : "Create from approved billing source" },
          { label: "Total due", value: money.format(totalDue || statement?.totalAmount || 0), detail: `${payments.length} milestone(s)` },
          { label: "Received", value: money.format(totalPaid), detail: `${openMilestones} open milestone(s)` },
          { label: "Remaining", value: money.format(totalRemaining), detail: paymentAtRisk ? "Payment at risk" : "Manual tracker" },
        ].map((item) => (
          <div key={item.label} className="rounded-lg border border-border bg-card px-4 py-3 shadow-sm">
            <p className="text-[10px] font-black uppercase tracking-[0.14em] text-muted-foreground">{item.label}</p>
            <p className="mt-1 truncate text-base font-black text-foreground">{item.value}</p>
            <p className="mt-1 text-xs text-muted-foreground">{item.detail}</p>
          </div>
        ))}
      </div>

      {paymentAtRisk && (
        <div className="flex items-start gap-3 rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
          <AlertTriangle className="mt-0.5 size-4" />
          <div>
            <p className="font-black">Payment At Risk</p>
            <p className="mt-1">The balance is still unpaid inside the 48-hour event threshold. This is manual PMCM tracking, not a payment-processor integration.</p>
          </div>
        </div>
      )}

      {notificationLogs.length > 0 && (
        <div className="rounded-lg border border-(--prism-amber)/25 bg-(--prism-amber)/8 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-start gap-3">
              <MailCheck className="mt-0.5 size-4 text-(--prism-amber)" />
              <div>
                <p className="text-sm font-black text-foreground">Queued notification evidence</p>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">Local in-app queue only; SendGrid/Viber delivery remains deferred for defense.</p>
              </div>
            </div>
            <span className="rounded-full bg-card px-3 py-1 text-xs font-black text-foreground">{notificationLogs.length} queued</span>
          </div>
          <div className="mt-3 grid gap-2 md:grid-cols-2">
            {notificationLogs.slice(0, 4).map((notification) => (
              <div key={notification.id} className="rounded-md border border-border bg-card p-3 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-black text-foreground">{label(notification.channel)} to {notification.recipient}</p>
                  <span className={cx("rounded-full px-2.5 py-1 text-xs font-black capitalize ring-1", notificationTone(notification.status))}>{label(notification.status)}</span>
                </div>
                <p className="mt-1 line-clamp-2 text-xs leading-5 text-muted-foreground">{notification.message}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)]">
        <section className="rounded-lg border border-border bg-card p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.16em] text-(--prism-amber)">Billing Statement</p>
              <h3 className="mt-2 text-2xl font-black">{statement?.number ?? "Awaiting conforme"}</h3>
            </div>
            <span className="rounded-full bg-secondary px-3 py-1 text-xs font-black capitalize text-foreground">
              {statement ? label(statement.status) : "Not generated"}
            </span>
          </div>

          {statement ? (
            <div className="mt-5 space-y-5">
              <div className="rounded-md border border-border bg-background p-4">
                <p className="text-xl font-black tracking-wide">PMCM</p>
                <p className="mt-1 text-xs font-black uppercase tracking-[0.14em] text-muted-foreground">Billing Statement</p>
                <div className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
                  <div><span className="font-black">Client:</span> {statement.clientName || event.clientName}</div>
                  <div><span className="font-black">Contact:</span> {statement.clientContact || inquiry?.email || "No contact"}</div>
                  <div><span className="font-black">Event:</span> {statement.eventName || event.eventName}</div>
                  <div><span className="font-black">Date:</span> {statement.eventDate || event.eventDate}</div>
                </div>
              </div>

              <div className="rounded-md border border-border bg-background p-4">
                <p className="text-sm font-black">Package line items</p>
                <div className="mt-3 space-y-2">
                  {statement.lineItems.map((item) => (
                    <div key={item.label} className="flex items-center justify-between gap-3 text-sm">
                      <span>{item.label}</span>
                      <span className="font-black">{money.format(item.amount)}</span>
                    </div>
                  ))}
                </div>
                <div className="mt-4 flex items-center justify-between border-t border-border pt-3">
                  <span className="font-black">Total Amount</span>
                  <span className="text-xl font-black">{money.format(statement.totalAmount)}</span>
                </div>
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <div className="rounded-md border border-border bg-background p-4">
                  <p className="text-sm font-black">Payment schedule</p>
                  <div className="mt-3 space-y-2 text-sm">
                    {statement.paymentSchedule.map((item) => (
                      <div key={item.label} className="flex items-center justify-between gap-3">
                        <span>{item.label} ({item.percentage}%)</span>
                        <span className="font-black">{money.format(item.amount)}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="rounded-md border border-border bg-background p-4">
                  <p className="text-sm font-black">Payment methods</p>
                  <div className="mt-3 space-y-2 text-sm text-muted-foreground">
                    {statement.paymentMethods.map((item) => <p key={item.label}><span className="font-black text-foreground">{item.label}:</span> {item.details}</p>)}
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-end justify-between gap-3">
                <div className="min-w-[220px] border-t border-foreground pt-2 text-sm font-black">PMCM Signature</div>
                <div className="flex flex-wrap gap-2">
                  <a
                    href={apiUrl(statement.pdfUrl)}
                    target="_blank"
                    className="inline-flex h-10 items-center gap-2 rounded-md border border-border bg-white px-3 text-sm font-black text-foreground"
                  >
                    <Download className="size-4" /> Download PDF
                  </a>
                  <button
                    disabled={busy}
                    onClick={() => onSendBilling(statement.id)}
                    className="inline-flex h-10 items-center gap-2 rounded-md bg-(--prism-ink) px-3 text-sm font-black text-sidebar-foreground disabled:opacity-60"
                  >
                    <Send className="size-4" /> Send to Client
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="mt-5 rounded-lg border border-dashed border-border bg-secondary/40 p-5 text-sm">
              <div className="flex items-start gap-3">
                <ReceiptText className="mt-0.5 size-4 text-primary" />
                <div>
                  <p className="font-black text-foreground">No billing statement yet</p>
                  <p className="mt-1 leading-6 text-muted-foreground">
                    Approve a billing source in Closure, then generate the statement for this selected event. The send action appears here after generation.
                  </p>
                </div>
              </div>
            </div>
          )}
        </section>

        <PrismSectionPanel
          title="Payment tracker"
          description="Milestone status, received amounts, remaining balance, and manual payment recording"
          icon={ReceiptText}
        >
          <PrismBillingMilestoneList milestones={billingMilestonesForUi} />
          <div className="mt-5 space-y-3">
            {payments.length === 0 && <p className="text-sm text-muted-foreground">No payment milestones yet.</p>}
            {payments.map((payment) => (
              <div key={payment.id} className="rounded-lg border border-border bg-background p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-black">{payment.label} ({payment.percentage}%)</p>
                    <p className="mt-1 text-sm text-muted-foreground">Due {payment.dueDate}</p>
                  </div>
                  <span className={cx("rounded-full px-2.5 py-1 text-xs font-black capitalize ring-1", paymentTone(payment.status, payment.dueDate))}>
                    {new Date(payment.dueDate) < new Date() && payment.status !== "paid" ? "Overdue" : label(payment.status)}
                  </span>
                </div>
                <div className="mt-3 grid gap-2 text-sm sm:grid-cols-3">
                  <div><span className="block text-xs font-black uppercase tracking-wide text-muted-foreground">Amount Due</span>{money.format(payment.amount)}</div>
                  <div><span className="block text-xs font-black uppercase tracking-wide text-muted-foreground">Received</span>{money.format(payment.amountPaid)}</div>
                  <div><span className="block text-xs font-black uppercase tracking-wide text-muted-foreground">Remaining</span>{money.format(payment.remainingBalance)}</div>
                </div>
                <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                  <div className="text-xs text-muted-foreground">
                    {payment.history.length === 0 ? "No payment history yet." : `${payment.history.length} payment record${payment.history.length === 1 ? "" : "s"}`}
                  </div>
                  <button
                    disabled={busy || payment.status === "paid"}
                    onClick={() => openRecordModal(payment)}
                    className="inline-flex h-9 items-center gap-2 rounded-md bg-(--prism-ink) px-3 text-xs font-black text-sidebar-foreground disabled:opacity-60"
                  >
                    <WalletCards className="size-4" /> Record Payment
                  </button>
                </div>
                {payment.history.length > 0 && (
                  <div className="mt-3 space-y-2 rounded-md bg-white p-3">
                    {payment.history.map((record) => (
                      <div key={record.id} className="flex flex-wrap items-center justify-between gap-2 text-xs">
                        <span className="font-black">{money.format(record.amountReceived)}</span>
                        <span className="inline-flex items-center gap-1 text-muted-foreground">
                          <Clock3 className="size-3" /> {record.paymentDate} - {record.paymentMethod} - {record.referenceNumber || "No reference"}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </PrismSectionPanel>
      </div>

      {activePayment && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/35 p-4">
          <div className="w-full max-w-lg rounded-lg border border-border bg-card shadow-xl">
            <div className="flex items-start justify-between gap-3 border-b border-border p-5">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.16em] text-(--prism-amber)">Record Payment</p>
                <h3 className="mt-1 text-xl font-black">{activePayment.label}</h3>
              </div>
              <button onClick={() => setActivePayment(null)} className="rounded-md p-1.5 text-muted-foreground hover:bg-muted">
                <X className="size-4" />
              </button>
            </div>
            <div className="grid gap-3 p-5">
              <label className="text-sm font-black">
                Amount Received
                <input value={amountReceived} onChange={(event) => setAmountReceived(event.target.value)} type="number" min="1" className="mt-2 h-10 w-full rounded-md border border-border bg-white px-3 font-normal" />
              </label>
              <label className="text-sm font-black">
                Payment Date
                <input value={paymentDate} onChange={(event) => setPaymentDate(event.target.value)} type="date" className="mt-2 h-10 w-full rounded-md border border-border bg-white px-3 font-normal" />
              </label>
              <label className="text-sm font-black">
                Payment Method
                <select value={paymentMethod} onChange={(event) => setPaymentMethod(event.target.value as RecordPaymentInput["paymentMethod"])} className="mt-2 h-10 w-full rounded-md border border-border bg-white px-3 font-normal">
                  <option>Bank Transfer</option>
                  <option>GCash</option>
                  <option>Cheque</option>
                </select>
              </label>
              <label className="text-sm font-black">
                Reference Number
                <input value={referenceNumber} onChange={(event) => setReferenceNumber(event.target.value)} className="mt-2 h-10 w-full rounded-md border border-border bg-white px-3 font-normal" />
              </label>
            </div>
            <div className="flex flex-wrap justify-end gap-2 border-t border-border p-5">
              <button onClick={() => setActivePayment(null)} className="h-10 rounded-md border border-border bg-white px-3 text-sm font-black">Cancel</button>
              <button
                disabled={busy || Number(amountReceived) <= 0}
                onClick={submitRecordPayment}
                className="inline-flex h-10 items-center gap-2 rounded-md bg-(--prism-ink) px-3 text-sm font-black text-sidebar-foreground disabled:opacity-60"
              >
                <CheckCircle2 className="size-4" /> Save Payment
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
