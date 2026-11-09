"use client";

import { Wallet } from "lucide-react";
import type { PrismSupplierWorkflowWorkspace } from "@prism/types";
import { formatPortalDate } from "@prism/ui/format-date";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@prism/ui/components/card";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@prism/ui/components/empty";
import { StatusBadge } from "@prism/ui/components/status-badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@prism/ui/components/table";
import { formatMoney } from "../../model/supplier-workspace-rules";
import type { PrismSupplierQuote, PrismSupplierReadinessBoard, SupplierWorkspace } from "../../model/supplier-workspace-types";

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
      {awaitingSchedule.length > 0 ? (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="px-4">Event</TableHead>
                <TableHead className="px-4">Agreed amount</TableHead>
                <TableHead className="px-4">Your terms</TableHead>
                <TableHead className="px-4">Schedule</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {awaitingSchedule.map((quote) => {
                const request = workspace.quoteRequests.find((item) => item.id === quote.requestId);
                const eventName = readinessBoard?.items.find((item) => item.requestId === quote.requestId)?.eventName ?? request?.category ?? "Selected quote";
                return (
                  <TableRow key={quote.id}>
                    <TableCell className="max-w-[18rem] px-4 whitespace-normal">
                      <span className="block break-words font-semibold text-foreground">{eventName}</span>
                      {request?.category ? <span className="block text-xs text-muted-foreground">{request.category}</span> : null}
                    </TableCell>
                    <TableCell className="px-4 font-semibold tabular-nums">{formatMoney(quote.amount)}</TableCell>
                    <TableCell className="max-w-[16rem] px-4 whitespace-normal break-words text-muted-foreground">{quote.paymentTerms || "—"}</TableCell>
                    <TableCell className="px-4 text-muted-foreground">Pending from PMCM</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Card>
      ) : null}
      {payables.length === 0 && awaitingSchedule.length === 0 ? (
        <Card>
          <CardContent>
            <Empty className="border-0 p-6 md:p-8">
              <EmptyHeader>
                <EmptyMedia variant="icon"><Wallet /></EmptyMedia>
                <EmptyTitle>No supplier payables recorded yet.</EmptyTitle>
                <EmptyDescription>PMCM publishes payment milestones once a quote is selected.</EmptyDescription>
              </EmptyHeader>
            </Empty>
          </CardContent>
        </Card>
      ) : null}
      {payables.map((milestone) => (
        <Card key={milestone.id}>
          <CardHeader>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <CardDescription>{milestone.label}</CardDescription>
                <CardTitle className="mt-1 text-xl font-semibold tabular-nums text-foreground">{formatMoney(milestone.amount)}</CardTitle>
              </div>
              <StatusBadge status={milestone.status} />
            </div>
          </CardHeader>
          <CardContent>
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
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
