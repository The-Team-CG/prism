"use client";

import { FormEvent } from "react";
import { ClipboardList } from "lucide-react";
import { EmptyState } from "@/app/components/ui/empty-state";
import { initialForm } from "../../model/supplier-workspace-rules";
import type { PrismSupplierQuote, PrismSupplierQuoteRequest, QuoteFormState, SupplierWorkspace } from "../../model/supplier-workspace-types";
import { Card, CardBody } from "./shell-ui";
import { RequestQuoteCard } from "./request-quote-card";

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
      {workspace.quoteRequests.map((req) => (
        <RequestQuoteCard
          key={req.id}
          req={req}
          quote={quoteByRequest.get(req.id)}
          form={forms[req.id] ?? initialForm(quoteByRequest.get(req.id))}
          busy={busy}
          onUpdateForm={onUpdateForm}
          onSubmitQuote={onSubmitQuote}
        />
      ))}
    </div>
  );
}
