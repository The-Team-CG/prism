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
import type { PrismSupplier, PrismSupplierQuote, PrismSupplierQuoteRequest, PrismSupplierReadinessBoard, QuoteFormState, SupplierDashboardSection, SupplierWorkspace } from "../../model/supplier-workspace-types";
import { useSupplierWorkspaceViewModel } from "../../view-models/use-supplier-workspace-view-model";


import { Card, CardBody, CardHeader, SectionAccent, StatCell } from "./shell-ui";

export function QuotationsPage({ workspace, quoteByRequest }: { workspace: SupplierWorkspace; quoteByRequest: Map<string, PrismSupplierQuote> }) {
  if (!workspace.supplierQuotes.length) {
    return (
      <Card><CardBody>
        <EmptyState icon={FileText} title="No quotations on file." description="Submitted quotes will appear here with their full history." />
      </CardBody></Card>
    );
  }

  return (
    <div className="space-y-4">
      {workspace.supplierQuotes.map((q) => {
        const req = workspace.quoteRequests.find((r) => r.id === q.requestId);
        return (
          <Card key={q.id}>
            <CardHeader>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <SectionAccent>{q.category}</SectionAccent>
                  <p className="mt-1 text-xs text-muted-foreground">{req?.message ?? "Quote request"}</p>
                </div>
                <StatusBadge status={q.status} />
              </div>
            </CardHeader>
            <div className="grid grid-cols-2 divide-x divide-border border-b border-border sm:grid-cols-4">
              {[
                { label: "Amount", value: formatMoney(q.amount) },
                { label: "Revision", value: `#${q.revisionNumber ?? 1}` },
                { label: "Submitted", value: formatDate(q.createdAt) },
                { label: "Last revised", value: q.revisedAt ? formatDate(q.revisedAt) : "—" },
              ].map(({ label, value }) => (
                <div key={label} className="px-5 py-3">
                  <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">{label}</p>
                  <p className="mt-1 text-sm font-bold text-foreground">{value}</p>
                </div>
              ))}
            </div>
            <CardBody>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Payment terms</p>
                  <p className="mt-1.5 text-sm text-foreground">{q.paymentTerms || "—"}</p>
                </div>
                <div>
                  <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Inclusions</p>
                  {q.inclusions.length ? (
                    <ul className="mt-1.5 space-y-0.5">
                      {q.inclusions.map((inc, i) => (
                        <li key={i} className="flex items-center gap-1.5 text-sm text-foreground">
                          <span className="size-1.5 shrink-0 rounded-full bg-(--prism-signal)" /> {inc}
                        </li>
                      ))}
                    </ul>
                  ) : <p className="mt-1.5 text-sm text-muted-foreground">—</p>}
                </div>
              </div>
              {q.notes && (
                <div className="mt-4 rounded-xl bg-muted/40 px-4 py-3 text-xs leading-5 text-muted-foreground">{q.notes}</div>
              )}
            </CardBody>
          </Card>
        );
      })}
    </div>
  );
}

