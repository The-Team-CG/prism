"use client";

import { FormEvent } from "react";
import { ChevronRight, ClipboardList } from "lucide-react";
import { daysUntil, dueLabel, formatPortalDate, manilaDateKey } from "@prism/ui/format-date";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@prism/ui/components/empty";
import { formatDate, formatMoney, initialForm, isPastDate, isRequestClosed, requestsForQuoting, statusLabel } from "../../model/supplier-workspace-rules";
import type { PrismSupplierQuote, PrismSupplierQuoteRequest, PrismSupplierReadinessBoard, QuoteFormState, SupplierWorkspace } from "../../model/supplier-workspace-types";
import { Card, CardBody } from "./shell-ui";
import { RequestQuoteCard } from "./request-quote-card";
import { useSupplierWorkTarget } from "../../view-models/use-supplier-work-target";
import { supplierNextStep } from "../../model/supplier-next-step";

function requestDueText(dueDate: string | null | undefined, closed: boolean) {
  if (!dueDate) return "No deadline";
  if (closed) return `Due ${formatDate(dueDate)}`;
  if (isPastDate(dueDate)) return `Past deadline · ${formatDate(dueDate)}`;
  return `${dueLabel(daysUntil(dueDate, manilaDateKey()) ?? 0)} · ${formatDate(dueDate)}`;
}

export function RequestsPage({
  workspace, quoteByRequest, readinessBoard, forms, busy,
  onUpdateForm, onSubmitQuote,
}: {
  workspace: SupplierWorkspace;
  quoteByRequest: Map<string, PrismSupplierQuote>;
  readinessBoard: PrismSupplierReadinessBoard | null;
  forms: Record<string, QuoteFormState>;
  busy: string | null;
  onUpdateForm: (id: string, patch: Partial<QuoteFormState>) => void;
  onSubmitQuote: (ev: FormEvent<HTMLFormElement>, req: PrismSupplierQuoteRequest) => void;
}) {
  useSupplierWorkTarget();
  const requests = requestsForQuoting(workspace.quoteRequests, quoteByRequest);
  if (!requests.length) {
    return (
      <Card><CardBody>
        <Empty className="border-0 p-6 md:p-8">
          <EmptyHeader>
            <EmptyMedia variant="icon"><ClipboardList /></EmptyMedia>
            <EmptyTitle>{workspace.quoteRequests.length ? "No open quote requests." : "No quote requests yet."}</EmptyTitle>
            <EmptyDescription>{workspace.quoteRequests.length ? "Selected quotes are in Bookings. New requests from PMCM will appear here." : "PMCM will send scoped quote requests when events are ready."}</EmptyDescription>
          </EmptyHeader>
        </Empty>
      </CardBody></Card>
    );
  }

  return (
    <div className="space-y-4">
      {requests.map((req) => {
        const readiness = readinessBoard?.items.find((item) => item.requestId === req.id);
        const quote = quoteByRequest.get(req.id);
        const next = readiness ? supplierNextStep(readiness, Boolean(quote)) : null;
        const closed = isRequestClosed(req, quote);
        const eventLine = [req.category, readiness?.eventName ?? "Event details pending", readiness?.eventDate ? `Event ${formatPortalDate(readiness.eventDate)}` : null].filter(Boolean).join(" · ");
        return (
          <details key={req.id} id={`supplier-work-${encodeURIComponent(req.id)}`} className="group scroll-mt-6 rounded-lg border border-border bg-card" open={requests.length === 1 ? true : undefined}>
            <summary className="flex cursor-pointer list-none items-start gap-3 px-4 py-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary sm:px-5 [&::-webkit-details-marker]:hidden">
              <ChevronRight className="mt-0.5 size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-90" aria-hidden="true" />
              <span className="grid min-w-0 flex-1 gap-1 sm:grid-cols-[minmax(0,1fr)_auto] sm:gap-x-6">
                <span className="min-w-0">
                  <span className="block text-sm font-semibold text-foreground">{next?.title ?? "Review request"}</span>
                  <span className="block break-words text-sm text-muted-foreground">{eventLine}</span>
                </span>
                <span className="grid gap-0.5 text-sm sm:justify-items-end sm:text-right">
                  <span className={isPastDate(req.dueDate) && !closed ? "font-medium text-danger" : "text-muted-foreground"}>{requestDueText(req.dueDate, closed)}</span>
                  <span className="text-foreground tabular-nums">
                    {quote ? `${formatMoney(quote.amount)} · Revision ${quote.revisionNumber ?? 1} · ${statusLabel(quote.status)}` : <span className="text-muted-foreground">No quote yet</span>}
                  </span>
                </span>
              </span>
            </summary>
            <RequestQuoteCard
              req={req}
              quote={quote}
              form={forms[req.id] ?? initialForm(quote)}
              busy={busy}
              onUpdateForm={onUpdateForm}
              onSubmitQuote={onSubmitQuote}
            />
          </details>
        );
      })}
    </div>
  );
}
