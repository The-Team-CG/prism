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

export function RequestsPage({
  workspace, quoteByRequest, forms, busy,
  onUpdateForm, onSubmitQuote,
}: {
  workspace: SupplierWorkspace;
  quoteByRequest: Map<string, PrismSupplierQuote>;
  forms: Record<string, QuoteFormState>;
  busy: string | null;
  onUpdateForm: (id: string, patch: Partial<QuoteFormState>) => void;
  onSubmitQuote: (ev: FormEvent<HTMLFormElement>, req: PrismSupplierQuoteRequest) => void;
}) {
  if (!workspace.quoteRequests.length) {
    return (
      <Card><CardBody>
        <EmptyState icon={ClipboardList} title="No quote requests yet." description="PMCM will send scoped quote requests when events are ready." />
      </CardBody></Card>
    );
  }

  return (
    <div className="space-y-4">
      {workspace.quoteRequests.map((req) => {
        const quote = quoteByRequest.get(req.id);
        const form = forms[req.id] ?? initialForm(quote);
        const closed = isRequestClosed(req, quote);
        const deadlinePast = isPastDate(req.dueDate) && !closed;
        const quoteStatus = quote?.status ?? req.status;
        const closedReason = closedRequestReason(req, quote);

        return (
          <Card key={req.id}>
            <CardHeader>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-sm font-bold text-foreground">{req.category}</h3>
                    {closed && <Badge variant="outline" className="rounded-full text-[10px]"><LockKeyhole className="size-3" /> Locked</Badge>}
                    {req.confidentialBid && <Badge variant="outline" className="rounded-full text-[10px]">Confidential</Badge>}
                  </div>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">{req.message}</p>
                </div>
                <div className="flex shrink-0 flex-wrap items-center gap-2">
                  <span className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-bold ${deadlinePast ? "bg-(--prism-danger)/10 text-(--prism-danger)" : "bg-muted text-muted-foreground"}`}>
                    <Clock3 className="size-3.5" />
                    {deadlinePast ? "Past deadline" : "Due"}: {formatDate(req.dueDate)}
                  </span>
                  <StatusBadge status={quoteStatus} />
                </div>
              </div>
            </CardHeader>

            {quote && (
              <div className="grid grid-cols-3 divide-x divide-border border-b border-border">
                {[{ label: "Amount", value: formatMoney(quote.amount) }, { label: "Revision", value: `#${quote.revisionNumber ?? 1}` }, { label: "Status", value: fmt(quote.status) }].map(({ label, value }) => (
                  <div key={label} className="px-5 py-3">
                    <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">{label}</p>
                    <p className="mt-1 text-sm font-bold capitalize text-foreground">{value}</p>
                  </div>
                ))}
              </div>
            )}

            {closed && (
              <div className="border-b border-border bg-muted/30 px-6 py-3">
                <p className="text-xs leading-5 text-muted-foreground">{closedReason}</p>
              </div>
            )}

            <CardBody>
              <form onSubmit={(ev) => onSubmitQuote(ev, req)} className="space-y-4">
                <div>
                  <p className="text-sm font-bold text-foreground">{closed ? "Quote on file (read-only)" : quote ? "Revise your quote" : "Submit your quote"}</p>
                  <p className="mt-0.5 text-xs leading-5 text-muted-foreground">
                    {closed ? "Locked after selection or closure." : quote ? "Revise while this request is open." : "Fill in all fields before the deadline."}
                  </p>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="grid gap-1.5 text-sm font-bold text-foreground">
                    Quote amount (PHP)
                    <Input disabled={closed} value={form.amount} onChange={(e) => onUpdateForm(req.id, { amount: e.target.value })} type="number" min="1" className="h-10 rounded-xl" placeholder="75000" />
                  </label>
                  <label className="grid gap-1.5 text-sm font-bold text-foreground">
                    Payment terms
                    <Input disabled={closed} value={form.paymentTerms} onChange={(e) => onUpdateForm(req.id, { paymentTerms: e.target.value })} className="h-10 rounded-xl" placeholder="50% down, balance after event" />
                  </label>
                </div>
                <label className="grid gap-1.5 text-sm font-bold text-foreground">
                  Inclusions (one per line)
                  <textarea disabled={closed} value={form.inclusions} onChange={(e) => onUpdateForm(req.id, { inclusions: e.target.value })} rows={3}
                    className="rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-(--prism-signal)/30"
                    placeholder="Ingress crew, lights, operator…" />
                </label>
                <label className="grid gap-1.5 text-sm font-bold text-foreground">
                  Notes
                  <textarea disabled={closed} value={form.notes} onChange={(e) => onUpdateForm(req.id, { notes: e.target.value })} rows={2}
                    className="rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-(--prism-signal)/30"
                    placeholder="Availability notes, exclusions, setup assumptions…" />
                </label>
                {!closed && (
                  <Button type="submit" disabled={busy === req.id} className="rounded-xl font-bold">
                    <Send className="size-4" />{quote ? "Save revision" : "Submit quote"}
                  </Button>
                )}
              </form>
            </CardBody>
          </Card>
        );
      })}
    </div>
  );
}

