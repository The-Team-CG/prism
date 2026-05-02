import { useState } from "react";
import { AlertTriangle, CheckCircle2, Download, ReceiptText, Send, WalletCards, X } from "lucide-react";

import { apiUrl, type MvpBillingStatement, type MvpEvent, type MvpInquiry, type MvpPaymentMilestone } from "@/lib/mvp-api";
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

export function FinancialWorkspace({
  event,
  inquiry,
  billingStatements,
  payments,
  busy,
  onRecordPayment,
  onSendBilling,
}: {
  event: MvpEvent;
  inquiry?: MvpInquiry;
  billingStatements: MvpBillingStatement[];
  payments: MvpPaymentMilestone[];
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
      {paymentAtRisk && (
        <div className="flex items-start gap-3 rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
          <AlertTriangle className="mt-0.5 size-4" />
          <div>
            <p className="font-black">Payment At Risk</p>
            <p className="mt-1">The balance is still unpaid inside the 48-hour event threshold.</p>
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
            <p className="mt-5 text-sm text-muted-foreground">A billing statement is generated automatically after signed conforme upload.</p>
          )}
        </section>

        <section className="rounded-lg border border-border bg-card p-5">
          <div className="flex items-center gap-2">
            <ReceiptText className="size-5 text-(--prism-amber)" />
            <div>
              <p className="text-xs font-black uppercase tracking-[0.16em] text-(--prism-amber)">Payment Tracker</p>
              <h3 className="mt-1 text-xl font-black">Milestones</h3>
            </div>
          </div>
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
                        <span className="text-muted-foreground">{record.paymentDate} - {record.paymentMethod} - {record.referenceNumber || "No reference"}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>
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
