"use client";

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


export function ClientBillingTab({
  payments,
  billing,
  disputes = [],
}: {
  payments: PrismPaymentMilestone[];
  billing?: PrismBillingStatement;
  disputes?: PrismClientBillingDispute[];
}) {
  const { totalAmount, totalPaid, balance } = clientBillingSummary(payments, billing);

  return (
    <div className="space-y-5">
      {/* Summary stats */}
      {totalAmount > 0 && (
        <div className="grid gap-3 sm:grid-cols-3">
          {[
            { label: "Total contract", value: money.format(totalAmount), color: "text-foreground" },
            { label: "Paid to date", value: money.format(totalPaid), color: "text-(--prism-success)" },
            { label: "Balance due", value: money.format(balance), color: balance > 0 ? "text-(--prism-amber)" : "text-(--prism-success)" },
          ].map((stat) => (
            <div key={stat.label} className="rounded-2xl border border-border bg-card px-5 py-4 shadow-sm">
              <p className="text-xs font-semibold text-muted-foreground">{stat.label}</p>
              <p className={`mt-1.5 text-2xl font-black ${stat.color}`}>{stat.value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Billing statement ref */}
      {billing && (
        <div className="flex items-center justify-between gap-3 rounded-xl border border-border bg-muted/30 px-5 py-3.5">
          <div>
            <p className="text-xs font-semibold text-muted-foreground">Billing statement</p>
            <p className="mt-0.5 text-sm font-bold text-foreground">{billing.number}</p>
          </div>
          <StatusBadge status={billing.status} label={formatLabel(billing.status)} />
        </div>
      )}

      {/* Dispute status: read-only; PMCM reasons and resolution notes are not shown to the client. */}
      {disputes.length > 0 && (
        <Card>
          <CardHeader>
            <h2 className="text-sm font-bold text-foreground">Billing disputes</h2>
            <p className="mt-1 text-xs text-muted-foreground">Status of disputes raised on your statement. PMCM will follow up on open items.</p>
          </CardHeader>
          <CardBody>
            <div className="space-y-2">
              {disputes.map((dispute) => (
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
            <WalletCards className="size-4 text-(--prism-signal)" />
            <h2 className="text-sm font-bold text-foreground">Payment milestones</h2>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Statements and payment milestones for your event. Internal cost estimates stay with PMCM.
          </p>
        </CardHeader>
        <CardBody>
          {payments.length === 0 ? (
            <EmptyState
              icon={ReceiptText}
              title="No payment milestones yet"
              description="Milestones appear after the billing statement linked to the approved proposal is posted."
            />
          ) : (
            <div className="space-y-3">
              {payments.map((payment, index) => {
                const remaining = clientMilestoneRemaining(payment);
                const done = remaining <= 0 || payment.status === "paid";
                return (
                  <div key={payment.id} className="relative grid grid-cols-[2rem_minmax(0,1fr)] gap-3">
                    {index < payments.length - 1 && (
                      <span className={`absolute bottom-0 left-4 top-8 w-px ${done ? "bg-(--prism-success)/30" : "bg-border"}`} />
                    )}
                    <span className={`relative z-10 mt-1 grid size-8 place-items-center rounded-full text-sm ${
                      done ? "bg-(--prism-success) text-white" : "bg-muted ring-1 ring-border text-muted-foreground"
                    }`}>
                      {done ? <CheckCircle2 className="size-4" /> : <span className="text-[10px] font-black">{index + 1}</span>}
                    </span>
                    <div className={`rounded-xl border p-4 ${done ? "border-(--prism-success)/20 bg-(--prism-success)/5" : "border-border bg-muted/30"}`}>
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-bold text-foreground">{payment.label}</p>
                          <div className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                            <CalendarDays className="size-3" /> {payment.dueDate}
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-base font-black text-foreground">{money.format(payment.amount)}</p>
                          {remaining > 0 ? (
                            <p className="mt-1 text-xs font-semibold text-(--prism-amber)">
                              Remaining {money.format(remaining)}
                            </p>
                          ) : null}
                          <StatusBadge status={payment.status} label={formatLabel(payment.status)} className="mt-1" />
                        </div>
                      </div>
                      <p className="mt-2 text-xs text-muted-foreground">{clientMilestoneFollowUpCopy(remaining)}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
