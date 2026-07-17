"use client";

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
import type { PrismSupplier, PrismSupplierQuote, PrismSupplierQuoteRequest, PrismSupplierReadinessBoard, QuoteFormState, SupplierDashboardSection, SupplierSession, SupplierWorkspace } from "../../model/supplier-workspace-types";
import { useSupplierWorkspaceViewModel } from "../../view-models/use-supplier-workspace-view-model";


import { Card, CardBody, CardHeader, SectionAccent, StatCell } from "./shell-ui";

export function PaymentsPage({ workspace }: { workspace: SupplierWorkspace }) {
  const selected = workspace.supplierQuotes.filter((q) => ["selected", "locked"].includes(q.status));

  return (
    <div className="space-y-4">
      {selected.length === 0 ? (
        <Card><CardBody>
          <EmptyState icon={Wallet} title="No payment milestones yet." description="Payment tracking becomes available once PMCM selects and locks your quote." />
        </CardBody></Card>
      ) : selected.map((q) => (
        <Card key={q.id}>
          <CardHeader>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <SectionAccent>Payment — {q.category}</SectionAccent>
                <p className="mt-1 text-xl font-black text-foreground">{formatMoney(q.amount)}</p>
              </div>
              <StatusBadge status={q.status} />
            </div>
          </CardHeader>
          <CardBody>
            <div className="grid gap-3 sm:grid-cols-3">
              {[
                { label: "Downpayment (50%)", value: formatMoney(q.amount * 0.5), status: q.lockedAt ? "paid" : "pending" },
                { label: "Balance (50%)", value: formatMoney(q.amount * 0.5), status: "pending" },
                { label: "Total locked", value: formatMoney(q.amount), status: q.lockedAt ? "locked" : "selected" },
              ].map(({ label, value, status }) => (
                <div key={label} className="rounded-xl border border-border bg-muted/30 p-4">
                  <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">{label}</p>
                  <p className="mt-2 text-lg font-black text-foreground">{value}</p>
                  <div className="mt-2"><StatusBadge status={status} /></div>
                </div>
              ))}
            </div>
            <p className="mt-4 text-xs leading-5 text-muted-foreground">
              Payment terms: {q.paymentTerms || "As agreed with PMCM."} Actual payment schedule and release is managed by PMCM billing.
            </p>
          </CardBody>
        </Card>
      ))}
    </div>
  );
}

