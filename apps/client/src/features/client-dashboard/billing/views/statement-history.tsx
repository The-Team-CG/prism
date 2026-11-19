"use client";

import { Download } from "lucide-react";
import type { PrismStatementOfAccount } from "@prism/types";
import { Button } from "@prism/ui/components/button";
import { PrismSection } from "@prism/ui/page-blocks";
import { formatPortalDate } from "@prism/ui/format-date";
import { formatPeso } from "@prism/ui/payment-track";
import { billingDocumentsRepository } from "../data/billing-documents-repository";
import { statementLineAmount, statementLineLabel } from "../model/statement-of-account-rules";
import type { BillingDocumentDownload } from "../view-models/use-billing-document-download";

function HistoryLines({ statement }: { statement: PrismStatementOfAccount }) {
  return (
    <ul className="divide-y divide-border">
      {statement.lines.map((line) => (
        <li key={line.id} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 px-4 py-2.5 text-sm">
          <span className="min-w-0">
            <span className={line.reversed ? "text-muted-foreground line-through" : "font-medium text-foreground"}>{statementLineLabel(line)}</span>
            <span className="ml-2 text-xs text-muted-foreground">{formatPortalDate(line.date)}{line.method ? ` · ${line.method}` : ""}{line.reference ? ` · Ref ${line.reference}` : ""}</span>
          </span>
          <span className={line.reversed ? "tabular-nums text-muted-foreground line-through" : "tabular-nums text-foreground"}>{statementLineAmount(line, formatPeso)}</span>
        </li>
      ))}
    </ul>
  );
}

/**
 * Every payment, credit and refund on record, oldest first, with the printable statement of account. Before anything
 * is received there is nothing to list, so the section stays away.
 */
export function StatementHistory({ statement, documents }: { statement: PrismStatementOfAccount; documents: BillingDocumentDownload }) {
  if (statement.lines.length === 0) return null;
  const held = [
    statement.refunded > 0 ? `${formatPeso(statement.refunded)} paid back to you` : null,
    statement.creditHeld > 0 ? `${formatPeso(statement.creditHeld)} credit held for you` : null,
    statement.lines.some((line) => line.reversed) ? "A reversed payment is shown for completeness and is not counted." : null,
  ].filter(Boolean).join(" · ");
  return (
    <PrismSection
      id="client-payment-history"
      title="Payment history"
      count={statement.lines.length}
      description={held || undefined}
      headerOutside
      flush
      action={(
        <Button variant="outline" size="sm" disabled={documents.busyKey === "statement"} onClick={() => void documents.download("statement", () => billingDocumentsRepository.statementOfAccount(statement.eventId))}>
          <Download className="size-3.5" aria-hidden /> {documents.busyKey === "statement" ? "Preparing…" : "Statement of account"}
        </Button>
      )}
    >
      <HistoryLines statement={statement} />
    </PrismSection>
  );
}
