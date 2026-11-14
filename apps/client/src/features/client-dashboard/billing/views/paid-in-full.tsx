"use client";

import { CheckCircle2, Download, ReceiptText } from "lucide-react";
import type { PrismStatementOfAccount } from "@prism/types";
import { Button } from "@prism/ui/components/button";
import { Card } from "@prism/ui/components/card";
import { formatPortalDate } from "@prism/ui/format-date";
import { formatPeso } from "@prism/ui/payment-track";
import { billingDocumentsRepository } from "../data/billing-documents-repository";
import { keptReceipts } from "../model/client-money-rules";
import type { BillingDocumentDownload } from "../view-models/use-billing-document-download";

/** Once everything is paid: every receipt in one place, and the statement of account that closes the account. */
export function PaidInFull({ statement, settled, documents }: { statement: PrismStatementOfAccount; settled: boolean; documents: BillingDocumentDownload }) {
  const receipts = keptReceipts(statement);
  if (!settled || receipts.length === 0) return null;
  const total = receipts.reduce((sum, line) => sum + line.amount, 0);
  return (
    <Card role="region" aria-labelledby="client-paid-in-full" className="gap-0 overflow-hidden border-success/30 py-0">
      <header className="flex flex-wrap items-center gap-3 bg-success-soft/60 px-4 py-3">
        <span aria-hidden className="grid size-9 place-items-center rounded-full bg-success text-white"><CheckCircle2 className="size-5" /></span>
        <div className="min-w-0 flex-1">
          <h2 id="client-paid-in-full" className="text-sm font-semibold text-foreground">Your receipts</h2>
          <p className="text-xs text-muted-foreground">{formatPeso(total)} across {receipts.length === 1 ? "1 payment" : `${receipts.length} payments`}. Keep these for your records.</p>
        </div>
        <Button size="sm" variant="outline" disabled={documents.busyKey === "statement"} onClick={() => void documents.download("statement", () => billingDocumentsRepository.statementOfAccount(statement.eventId))}>
          <Download className="size-3.5" aria-hidden /> {documents.busyKey === "statement" ? "Preparing…" : "Statement of account"}
        </Button>
      </header>
      <ul className="divide-y divide-border">
        {receipts.map((line) => (
          <li key={line.id} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 px-4 py-2.5 text-sm">
            <span className="min-w-0">
              <span className="font-medium tabular-nums text-foreground">{formatPeso(line.amount)}</span>
              <span className="ml-2 text-xs text-muted-foreground">{formatPortalDate(line.date)}{line.method ? ` · ${line.method}` : ""}{line.reference ? ` · Ref ${line.reference}` : ""}</span>
            </span>
            <Button size="sm" variant="ghost" disabled={documents.busyKey === line.id} onClick={() => void documents.download(line.id, () => billingDocumentsRepository.paymentReceipt(statement.eventId, line.id))}>
              <ReceiptText className="size-3.5" aria-hidden /> {documents.busyKey === line.id ? "Preparing…" : "Receipt"}
            </Button>
          </li>
        ))}
      </ul>
    </Card>
  );
}
