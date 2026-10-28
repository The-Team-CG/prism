"use client";

import { FormEvent } from "react";
import { ChevronRight, ClipboardList } from "lucide-react";
import { EmptyState } from "@/app/components/ui/empty-state";
import { fmt, formatDate, formatMoney, initialForm, isPastDate, isRequestClosed } from "../../model/supplier-workspace-rules";
import type { PrismSupplierQuote, PrismSupplierQuoteRequest, PrismSupplierReadinessBoard, QuoteFormState, SupplierWorkspace } from "../../model/supplier-workspace-types";
import { Card, CardBody } from "./shell-ui";
import { RequestQuoteCard } from "./request-quote-card";
import { useSupplierWorkTarget } from "../../view-models/use-supplier-work-target";
import { supplierNextStep } from "../../model/supplier-next-step";

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
        const readiness = readinessBoard?.items.find((item) => item.requestId === req.id);
        const eventName = readiness?.eventName;
        const quote = quoteByRequest.get(req.id);
        const next = readiness ? supplierNextStep(readiness, Boolean(quote)) : null;
        const deadlinePast = isPastDate(req.dueDate) && !isRequestClosed(req, quote);
        return (
          <details key={req.id} id={`supplier-work-${encodeURIComponent(req.id)}`} className="group scroll-mt-6 rounded-lg border border-border bg-card" open={workspace.quoteRequests.length === 1 ? true : undefined}>
            <summary className="flex cursor-pointer list-none items-start gap-3 px-4 py-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary sm:px-5 [&::-webkit-details-marker]:hidden">
              <ChevronRight className="mt-0.5 size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-90" aria-hidden="true" />
              <span className="grid min-w-0 flex-1 gap-1 sm:grid-cols-[minmax(0,1fr)_auto] sm:gap-x-6">
                <span className="min-w-0">
                  <span className="block text-sm font-semibold text-foreground">{next?.title ?? "Review request"}</span>
                  <span className="block break-words text-sm text-muted-foreground" title={eventName ?? undefined}>
                    {req.category} · {eventName || "Event details pending"}
                  </span>
                </span>
                <span className="flex flex-wrap gap-x-4 gap-y-1 text-sm sm:justify-end sm:text-right">
                  <span className={deadlinePast ? "font-medium text-danger" : "text-muted-foreground"}>
                    {deadlinePast ? "Past deadline" : "Due"} {req.dueDate ? formatDate(req.dueDate) : "—"}
                  </span>
                  <span className="text-foreground tabular-nums">
                    {quote ? `${formatMoney(quote.amount)} · rev ${quote.revisionNumber ?? 1} · ${fmt(quote.status)}` : <span className="text-muted-foreground">No quote yet</span>}
                  </span>
                </span>
              </span>
            </summary>
            <RequestQuoteCard
              embedded
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
