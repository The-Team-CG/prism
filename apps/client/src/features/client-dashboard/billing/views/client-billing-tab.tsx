"use client";
import { formatPortalDate } from "@prism/ui/format-date";

import {
  Activity,
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  FileCheck2,
  FileText,
  LockKeyhole,
  MapPinned,
  MessageSquareText,
  Presentation,
  ReceiptText,
  ThumbsUp,
  Timer,
  WalletCards,
  type LucideIcon,
} from "lucide-react";
import type { PrismAuditLog, PrismBillingStatement, PrismBriefing, PrismClientBillingDispute, PrismDocument, PrismEvent, PrismFloorPlanDraft, PrismPaymentMilestone } from "@prism/types";
import { Button } from "@/app/components/ui/button";
import { StatusBadge } from "@/app/components/ui/status-badge";
import { EmptyState } from "@/app/components/ui/empty-state";
import {
  Card,
  CardBody,
  CardHeader,
  DataRow,
  InfoGrid,
  SectionLabel,
  actorInitials,
  clientActivityActor,
  clientActivityTitle,
  formatDayLabel,
  formatLabel,
  groupByDay,
  money,
  portalBadgeStatus,
  portalStatusLabel,
} from "../../shared/tab-ui";
import type { DetailTab } from "../../workspace/shared";
import { clientBillingSummary, clientMilestoneFollowUpCopy, clientMilestoneRemaining } from "../model/client-billing-rules";
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
  const nextPayment = activePayments
    .filter((payment) => payment.status !== "paid" && clientMilestoneRemaining(payment) > 0)
    .sort((left, right) => String(left.dueDate).localeCompare(String(right.dueDate)))[0];
  const nextPaymentOverdue = Boolean(nextPayment?.dueDate && nextPayment.dueDate < new Date().toISOString().slice(0, 10));
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

  function renderBillingStatementReference() {
    return <>
      {/* Billing statement ref */}
      {billing && (
        <div className="flex items-center justify-between gap-3 rounded-xl border border-border bg-muted/30 px-5 py-3.5">
          <div>
            <p className="text-xs font-semibold text-muted-foreground">Billing statement</p>
            <p className="mt-0.5 text-sm font-bold text-foreground">{billing.number}</p>
          </div>
          <div className="flex items-center gap-2">
            {billing.storageObjectId ? <Button size="sm" variant="outline" disabled={statementDownload.busy} onClick={() => void statementDownload.download(billing.storageObjectId, `${billing.number}.pdf`)}><FileText className="size-3" /> {statementDownload.busy ? "Preparing…" : "Download statement"}</Button> : null}
            <StatusBadge status={billing.status} label={formatLabel(billing.status)} />
          </div>
        </div>
      )}
      {statementDownload.error ? <p role="alert" className="text-sm text-destructive">{statementDownload.error}</p> : null}

    </>;
  }

  function renderDisputeForm() {
    return <>      {billing && eventId && (
        <Card>
          <CardHeader>
            <h2 className="text-sm font-bold text-foreground">Raise a billing dispute</h2>
            <p className="mt-1 text-xs text-muted-foreground">Tell PMCM which charge you want reviewed. Your reason is shared with the event finance team.</p>
          </CardHeader>
          <CardBody className="grid gap-3 sm:grid-cols-2">
            <label className="grid gap-1 text-xs font-semibold text-muted-foreground">Amount disputed
              <input type="number" min="1" max={billing.totalAmount} value={disputeForm.amount} onChange={(event) => disputeForm.setAmount(event.target.value)} className="h-10 rounded-md border border-border bg-background px-3 text-sm text-foreground" />
            </label>
            <label className="grid gap-1 text-xs font-semibold text-muted-foreground">Related milestone (optional)
              <select value={disputeForm.milestoneId} onChange={(event) => disputeForm.setMilestoneId(event.target.value)} className="h-10 rounded-md border border-border bg-background px-3 text-sm text-foreground">
                <option value="">Whole statement</option>
                {activePayments.map((payment) => <option key={payment.id} value={payment.id}>{payment.label}</option>)}
              </select>
            </label>
            <label className="grid gap-1 text-xs font-semibold text-muted-foreground sm:col-span-2">Reason
              <textarea value={disputeForm.reason} onChange={(event) => disputeForm.setReason(event.target.value)} rows={3} maxLength={1000} className="rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground" />
            </label>
            {disputeForm.error ? <p role="alert" className="text-sm text-destructive sm:col-span-2">{disputeForm.error}</p> : null}
            <div className="sm:col-span-2">
              <Button disabled={disputeForm.submitting || !disputeForm.amount || Number(disputeForm.amount) > billing.totalAmount || !disputeForm.reason.trim()} onClick={() => void disputeForm.submit()}>
                {disputeForm.submitting ? "Submitting…" : "Submit dispute"}
              </Button>
            </div>
          </CardBody>
        </Card>
      )}

</>;
  }

  return (
    <div className="space-y-5">
      {/* Summary: the next payment leads, then the totals as one divided row of figures. */}
      {totalAmount > 0 && (
        <div className="rounded-lg border border-border bg-card">
          {nextPayment ? (
            <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-border px-4 py-4 sm:px-5">
              <div className="min-w-0">
                <p className="text-sm text-muted-foreground">Next payment · {nextPayment.label}</p>
                <p className="mt-1 text-2xl font-semibold tabular-nums text-foreground">{money.format(clientMilestoneRemaining(nextPayment))}</p>
              </div>
              <p className={`text-sm ${nextPaymentOverdue ? "font-medium text-danger" : "text-muted-foreground"}`}>
                {nextPaymentOverdue ? "Overdue since" : "Due"} {formatPortalDate(nextPayment.dueDate)}
              </p>
            </div>
          ) : null}
          <dl className="grid grid-cols-3 divide-x divide-border">
            {[
              { label: billing ? "Statement total" : "Scheduled total", value: money.format(totalAmount) },
              { label: "Paid", value: money.format(totalPaid) },
              { label: "Remaining", value: money.format(balance) },
            ].map((stat) => (
              <div key={stat.label} className="min-w-0 px-3 py-3 sm:px-5">
                <dt className="text-xs text-muted-foreground sm:text-sm">{stat.label}</dt>
                <dd className="mt-1 break-words text-sm font-semibold tabular-nums text-foreground sm:text-lg">{stat.value}</dd>
              </div>
            ))}
          </dl>
        </div>
      )}

      {renderBillingStatementReference()}
      {renderDisputeForm()}
      {/* Dispute status: read-only; PMCM reasons and resolution notes are not shown to the client. */}
      {disputeForm.disputes.length > 0 && (
        <Card>
          <CardHeader>
            <h2 className="text-sm font-bold text-foreground">Billing disputes</h2>
            <p className="mt-1 text-xs text-muted-foreground">Status of disputes raised on your statement. PMCM will follow up on open items.</p>
          </CardHeader>
          <CardBody>
            <div className="space-y-2">
              {disputeForm.disputes.map((dispute) => (
                <div key={dispute.id} className="flex items-center justify-between gap-3 rounded-xl border border-border bg-muted/30 px-4 py-3">
                  <div>
                    <p className="text-sm font-bold text-foreground">{money.format(dispute.amount)} disputed</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">Opened {formatDayLabel(dispute.createdAt)}{dispute.resolvedAt ? `, closed ${formatDayLabel(dispute.resolvedAt)}` : ""}</p>
                  </div>
                  <StatusBadge status={dispute.status} label={formatLabel(dispute.status)} />
                </div>
              ))}
            </div>
          </CardBody>
        </Card>
      )}

      {/* Milestones */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <WalletCards className="size-4 text-primary" />
            <h2 className="text-sm font-bold text-foreground">Payment milestones</h2>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Statements and payment milestones for your event. Internal cost estimates stay with PMCM.
          </p>
        </CardHeader>
        <CardBody>
          {activePayments.length === 0 ? (
            <EmptyState
              icon={ReceiptText}
              title="No payment milestones yet"
              description="Nothing to pay yet. PMCM posts your billing statement once the proposal is approved, and the payment schedule appears here. Questions about billing can go to PMCM in Messages."
            />
          ) : (
            <div className="space-y-3">
              {activePayments.map((payment, index) => {
                const remaining = clientMilestoneRemaining(payment);
                const done = remaining <= 0 || payment.status === "paid";
                return (
                  <div key={payment.id} className="relative grid grid-cols-[2rem_minmax(0,1fr)] gap-3">
                    {index < activePayments.length - 1 && (
                      <span className={`absolute bottom-0 left-4 top-8 w-px ${done ? "bg-success/30" : "bg-border"}`} />
                    )}
                    <span className={`relative z-10 mt-1 grid size-8 place-items-center rounded-full text-sm ${
                      done ? "bg-success text-white" : "bg-muted ring-1 ring-border text-muted-foreground"
                    }`}>
                      {done ? <CheckCircle2 className="size-4" /> : <span className="text-3xs font-black">{index + 1}</span>}
                    </span>
                    <div className={`rounded-xl border p-4 ${done ? "border-success/20 bg-success/5" : "border-border bg-muted/30"}`}>
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-bold text-foreground">{payment.label}</p>
                          <div className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                            <CalendarDays className="size-3" /> {formatPortalDate(payment.dueDate)}
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-base font-black text-foreground">{money.format(payment.amount)}</p>
                          {remaining > 0 ? (
                            <p className="mt-1 text-xs font-semibold text-attention">
                              Remaining {money.format(remaining)}
                            </p>
                          ) : null}
                          <StatusBadge status={payment.status} label={formatLabel(payment.status)} className="mt-1" />
                        </div>
                      </div>
                      <p className="mt-2 text-xs text-muted-foreground">{clientMilestoneFollowUpCopy(remaining)}</p>
                      {payment.history.length > 0 ? (
                        <div className="mt-3 space-y-2 border-t border-border/70 pt-3">
                          {payment.history.map((record) => (
                            <div key={record.id} className="flex flex-wrap items-center justify-between gap-2 text-xs">
                              <span className="text-muted-foreground">{money.format(record.amountReceived)} received on {formatPortalDate(record.paymentDate)}</span>
                              <Button size="sm" variant="outline" onClick={() => downloadReceipt(record, payment.label)}><ReceiptText className="size-3" /> Download receipt</Button>
                            </div>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardBody>
      </Card>
      {historicalPayments.length > 0 ? (
        <Card>
          <CardHeader>
            <h2 className="text-sm font-bold text-foreground">Earlier statement payment history</h2>
            <p className="mt-1 text-xs text-muted-foreground">Original milestones and receipts remain available. Their payments are credited to the current statement totals above.</p>
          </CardHeader>
          <CardBody className="space-y-3">
            {historicalPayments.map((payment) => (
              <div key={payment.id} className="rounded-xl border border-border bg-muted/30 p-4">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm font-bold text-foreground">{payment.label}</span>
                  {payment.supersededAt ? <span className="text-xs text-muted-foreground">Superseded {formatDayLabel(payment.supersededAt)}</span> : null}
                </div>
                {payment.history.map((record) => (
                  <div key={record.id} className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs">
                    <span className="text-muted-foreground">{money.format(record.amountReceived)} received on {formatPortalDate(record.paymentDate)}</span>
                    <Button size="sm" variant="outline" onClick={() => downloadReceipt(record, payment.label)}><ReceiptText className="size-3" /> Download receipt</Button>
                  </div>
                ))}
              </div>
            ))}
          </CardBody>
        </Card>
      ) : null}
    </div>
  );
}
