"use client";

import { Download } from "lucide-react";
import type { PrismStatementOfAccount } from "@prism/types";
import { Button } from "@prism/ui/components/button";
import { Card } from "@prism/ui/components/card";
import { formatPortalDate } from "@prism/ui/format-date";
import { formatPeso } from "@prism/ui/payment-track";
import { createStatementOfAccountPdf } from "../model/statement-pdf";
import { statementLineAmount, statementLineLabel } from "../model/statement-of-account-rules";

function downloadStatement(statement: PrismStatementOfAccount) {
  const { blob, fileName } = createStatementOfAccountPdf(statement);
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  URL.revokeObjectURL(url);
}

function HistoryLines({ statement }: { statement: PrismStatementOfAccount }) {
  if (statement.lines.length === 0) return <p className="px-4 py-3 text-sm text-muted-foreground">Nothing has been received yet.</p>;
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

/** Every payment, credit and refund on record, oldest first, folded away until wanted; plus the printable statement of account. */
export function StatementHistory({ statement }: { statement: PrismStatementOfAccount }) {
  return (
    <Card className="gap-0 overflow-hidden py-0">
      <details>
        <summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-2 px-4 py-3">
          <span className="text-sm font-semibold text-foreground">Payment history <span className="font-normal tabular-nums text-muted-foreground">{statement.lines.length}</span></span>
          <span className="flex flex-wrap gap-3 text-xs text-muted-foreground">
            {statement.refunded > 0 ? <span>{formatPeso(statement.refunded)} paid back to you</span> : null}
            {statement.creditHeld > 0 ? <span>{formatPeso(statement.creditHeld)} credit held for you</span> : null}
          </span>
        </summary>
        <div className="border-t border-border">
          <HistoryLines statement={statement} />
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border px-4 py-2.5">
            <p className="text-xs text-muted-foreground">{statement.lines.some((line) => line.reversed) ? "A reversed payment is shown for completeness and is not counted." : "The statement of account lists every figure above."}</p>
            <Button variant="outline" size="sm" onClick={() => downloadStatement(statement)}><Download className="size-3.5" aria-hidden /> Statement of account</Button>
          </div>
        </div>
      </details>
    </Card>
  );
}
