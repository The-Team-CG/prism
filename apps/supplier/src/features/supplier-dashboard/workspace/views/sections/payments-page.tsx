"use client";
import { formatPortalDate } from "@prism/ui/format-date";

import { FormEvent, useMemo } from "react";
import {
  BadgeCheck,
  CalendarClock,
  CalendarDays,
  CheckCircle2,
  Circle,
  ClipboardList,
  Clock3,
  FileCheck2,
  FileText,
  HelpCircle,
  LockKeyhole,
  LogOut,
  MessageSquare,
  PackageCheck,
  RefreshCcw,
  Send,
  ShieldCheck,
  Sparkles,
  Truck,
  User,
  Wallet,
  Warehouse,
  type LucideIcon,
} from "lucide-react";
import { Badge } from "@/app/components/ui/badge";
import { Button } from "@/app/components/ui/button";
import { Input } from "@/app/components/ui/input";
import { StatusBadge } from "@/app/components/ui/status-badge";
import { EmptyState } from "@/app/components/ui/empty-state";
import type { PrismSupplierWorkflowWorkspace } from "@prism/types";
import { PrismDashboardShell } from "@prism/ui";
import {
  EVENT_STATUS_ACTIONS,
  buildBookingSteps,
  buildCalendarEvents,
  closedRequestReason,
  firstNameFrom,
  formatDate,
  formatMoney,
  fmt,
  greetingForHour,
  initialForm,
  isPastDate,
  isRequestClosed,
  readinessTone,
} from "../../model/supplier-workspace-rules";
import type { PrismSupplier, PrismSupplierQuote, PrismSupplierQuoteRequest, PrismSupplierReadinessBoard, QuoteFormState, SupplierDashboardSection, SupplierWorkspace } from "../../model/supplier-workspace-types";
import { useSupplierWorkspaceViewModel } from "../../view-models/use-supplier-workspace-view-model";


import { Card, CardBody, CardHeader, SectionAccent, StatCell } from "./shell-ui";

export function PaymentsPage({ workflowWorkspace }: { workspace: SupplierWorkspace; workflowWorkspace: PrismSupplierWorkflowWorkspace | null }) {
  const payables = workflowWorkspace?.payables ?? [];
  return (
    <div className="space-y-4">
      {payables.length === 0 ? (
        <Card><CardBody>
          <EmptyState icon={Wallet} title="No supplier payables recorded yet." description="PMCM will publish payment milestones after selecting your quote." />
        </CardBody></Card>
      ) : payables.map((milestone) => (
        <Card key={milestone.id}>
          <CardHeader>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <SectionAccent>{milestone.label}</SectionAccent>
                <p className="mt-1 text-xl font-black text-foreground">{formatMoney(milestone.amount)}</p>
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
                  <p className="mt-2 text-lg font-black text-foreground">{value}</p>
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

