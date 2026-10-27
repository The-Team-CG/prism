"use client";

import { FormEvent } from "react";
import { ClipboardList } from "lucide-react";
import { EmptyState } from "@/app/components/ui/empty-state";
import { formatDate, initialForm } from "../../model/supplier-workspace-rules";
import type { PrismSupplierQuote, PrismSupplierQuoteRequest, PrismSupplierReadinessBoard, QuoteFormState, SupplierWorkspace } from "../../model/supplier-workspace-types";
import { Card, CardBody } from "./shell-ui";
import { RequestQuoteCard } from "./request-quote-card";

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
        const eventName = readinessBoard?.items.find((item) => item.eventId === req.eventId)?.eventName;
        return (
          <details key={req.id} name="supplier-requests" className="rounded-lg border border-border bg-card">
            <summary className="cursor-pointer px-5 py-4 text-sm font-semibold text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
              {req.category} · {eventName || "Event details pending"}
              <span className="mt-1 block text-xs font-normal text-muted-foreground">Request {req.id} · Due {formatDate(req.dueDate)}</span>
            </summary>
            <RequestQuoteCard
              req={req}
              quote={quoteByRequest.get(req.id)}
              form={forms[req.id] ?? initialForm(quoteByRequest.get(req.id))}
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
