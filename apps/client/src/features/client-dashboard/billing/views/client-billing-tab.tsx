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
import type {
  PrismAuditLog,
  PrismBillingStatement,
  PrismBriefing,
  PrismDocument,
  PrismEvent,
  PrismFloorPlanDraft,
  PrismPaymentMilestone,
} from "@/lib/prism-api";
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
import type { DetailTab } from "../../workspace/model/client-dashboard.types";


export function ClientBillingTab({
  payments,
  billing,
}: {
  payments: PrismPaymentMilestone[];
  billing?: PrismBillingStatement;
}) {
  const totalPaid = payments.filter((p) => p.status === "paid").reduce((s, p) => s + p.amount, 0);
  const totalAmount = billing?.totalAmount ?? payments.reduce((s, p) => s + p.amount, 0);
  const balance = totalAmount - totalPaid;

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

      {/* Milestones */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <WalletCards className="size-4 text-(--prism-signal)" />
            <h2 className="text-sm font-bold text-foreground">Payment milestones</h2>
          </div>
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
                const done = payment.status === "paid";
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
                          <StatusBadge status={payment.status} label={formatLabel(payment.status)} className="mt-1" />
                        </div>
                      </div>
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
