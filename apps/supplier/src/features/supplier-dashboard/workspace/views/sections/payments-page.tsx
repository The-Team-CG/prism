"use client";

import { Wallet } from "lucide-react";
import type { PrismSupplierWorkflowWorkspace } from "@prism/types";
import { formatPortalDate } from "@prism/ui/format-date";
import { EmptyState } from "@/app/components/ui/empty-state";
import { StatusBadge } from "@/app/components/ui/status-badge";
import { formatMoney } from "../../model/supplier-workspace-rules";
import type { PrismSupplierQuote, PrismSupplierReadinessBoard, SupplierWorkspace } from "../../model/supplier-workspace-types";
import { Card, CardBody, CardHeader, SectionAccent } from "./shell-ui";

export function PaymentsPage({ workspace, workflowWorkspace, selectedQuotes, readinessBoard }: {
  workspace: SupplierWorkspace;
  workflowWorkspace: PrismSupplierWorkflowWorkspace | null;
  selectedQuotes: PrismSupplierQuote[];
  readinessBoard: PrismSupplierReadinessBoard | null;
}) {
  const payables = workflowWorkspace?.payables ?? [];
  // A won quote without milestones still has an agreed amount: show it rather than an empty page.
  const awaitingSchedule = selectedQuotes.filter((quote) => !payables.some((payable) => payable.quoteId === quote.id));
  return (
    <div className="space-y-4">
      {awaitingSchedule.map((quote) => {
        const request = workspace.quoteRequests.find((item) => item.id === quote.requestId);
        const eventName = readinessBoard?.items.find((item) => item.requestId === quote.requestId)?.eventName;
        return (
          <Card key={quote.id}>
            <CardBody className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <SectionAccent>{[request?.category, eventName].filter(Boolean).join(" · ") || "Selected quote"}</SectionAccent>
                <p className="mt-1 text-xl font-semibold tabular-nums text-foreground">{formatMoney(quote.amount)}</p>
                {quote.paymentTerms ? <p className="mt-1 break-words text-sm text-muted-foreground">Your terms: {quote.paymentTerms}</p> : null}
              </div>
              <p className="text-sm text-muted-foreground">Payment schedule pending from PMCM</p>
            </CardBody>
          </Card>
        );
      })}
      {payables.length === 0 && awaitingSchedule.length === 0 ? (
        <Card><CardBody>
          <EmptyState icon={Wallet} title="No supplier payables recorded yet." description="PMCM publishes payment milestones once a quote is selected." />
        </CardBody></Card>
      ) : null}
      {payables.map((milestone) => (
        <Card key={milestone.id}>
          <CardHeader>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <SectionAccent>{milestone.label}</SectionAccent>
                <p className="mt-1 text-xl font-semibold tabular-nums text-foreground">{formatMoney(milestone.amount)}</p>
              </div>
              <StatusBadge status={milestone.status} />
            </div>
          </CardHeader>
          <CardBody>
            <div className="grid gap-3 sm:grid-cols-3">
              {[
                { label: "Scheduled", value: formatMoney(milestone.amount), status: "scheduled" },
                { label: "Released", value: formatMoney(milestone.amountReleased), status: milestone.amountReleased > 0 ? "released" : "pending" },
                { label: "Remaining", value: formatMoney(milestone.remainingBalance), status: milestone.remainingBalance === 0 ? "released" : "pending" },
              ].map(({ label, value, status }) => (
                <div key={label} className="rounded-xl border border-border bg-muted/30 p-4">
                  <p className="text-xs font-medium text-muted-foreground">{label}</p>
                  <p className="mt-2 text-lg font-semibold tabular-nums text-foreground">{value}</p>
                  <div className="mt-2"><StatusBadge status={status} /></div>
                </div>
              ))}
            </div>
            {milestone.dueDate ? <p className="mt-3 text-xs text-muted-foreground">Due {formatPortalDate(milestone.dueDate)}</p> : null}
            <div className="mt-4 divide-y divide-border rounded-xl border border-border">
              {milestone.history.length ? milestone.history.map((record) => <div key={record.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-xs">
                <span className="font-semibold">{record.kind === "reversal" ? "Reversal" : "Payment release"} · {formatMoney(record.amount)}</span>
                <span className="text-muted-foreground">{record.paymentDate ? formatPortalDate(record.paymentDate) : formatPortalDate(record.recordedAt)} · {record.method}{record.referenceNumber ? ` · ${record.referenceNumber}` : ""}{record.notes ? ` · ${record.notes}` : ""}</span>
              </div>) : <p className="px-3 py-2 text-xs text-muted-foreground">No payment releases recorded yet.</p>}
            </div>
          </CardBody>
        </Card>
      ))}
    </div>
  );
}
