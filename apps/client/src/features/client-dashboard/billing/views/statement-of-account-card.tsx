"use client";

import { Download, FileText } from "lucide-react";
import { useResource } from "@prism/portal-query";
import type { PrismStatementOfAccount } from "@prism/types";
import { Button } from "@prism/ui/components/button";
import { Card } from "@prism/ui/components/card";
import { formatPortalDate } from "@prism/ui/format-date";
import { ClientFigureStrip, ClientListEmpty } from "../../shared/client-list-ui";
import { money } from "../../shared/tab-ui";
import { clientStatementOfAccount } from "../data/statement-of-account-resource";
import { createStatementOfAccountPdf } from "../model/statement-pdf";
import { statementHighlights, statementLineAmount, statementLineLabel } from "../model/statement-of-account-rules";

const fmt = (amount: number) => money.format(amount);

function downloadStatement(statement: PrismStatementOfAccount) {
  const { blob, fileName } = createStatementOfAccountPdf(statement);
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  URL.revokeObjectURL(url);
}

function StatementLines({ statement }: { statement: PrismStatementOfAccount }) {
  if (statement.lines.length === 0) return <p className="px-4 py-3 text-sm text-muted-foreground">Nothing has been received yet.</p>;
  return (
    <ul className="divide-y divide-border border-t border-border">
      {statement.lines.map((line) => (
        <li key={line.id} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 px-4 py-2.5 text-sm">
          <span className="min-w-0">
            <span className={line.reversed ? "text-muted-foreground line-through" : "font-medium text-foreground"}>{statementLineLabel(line)}</span>
            <span className="ml-2 text-xs text-muted-foreground">
              {formatPortalDate(line.date)}{line.method ? ` · ${line.method}` : ""}{line.reference ? ` · Ref ${line.reference}` : ""}
            </span>
          </span>
          <span className={line.reversed ? "tabular-nums text-muted-foreground line-through" : "tabular-nums text-foreground"}>{statementLineAmount(line, fmt)}</span>
        </li>
      ))}
    </ul>
  );
}

function StatementBody({ statement }: { statement: PrismStatementOfAccount }) {
  return (
    <>
      <ClientFigureStrip label="Money paid back and held for you" figures={statementHighlights(statement, fmt)} />
      <Card className="gap-0 overflow-hidden py-0">
        <header className="flex items-center justify-between gap-2 px-4 py-3">
          <h2 className="text-sm font-semibold text-foreground">Payments and refunds</h2>
          <Button variant="outline" size="sm" onClick={() => downloadStatement(statement)}>
            <Download className="size-3.5" aria-hidden /> Download statement
          </Button>
        </header>
        <StatementLines statement={statement} />
        {statement.lines.some((line) => line.reversed) ? (
          <p className="border-t border-border px-4 py-2 text-xs text-muted-foreground">A reversed payment is shown for completeness and is not counted in the totals.</p>
        ) : null}
      </Card>
    </>
  );
}

/** What was billed, what you have paid and been paid back, any credit held for you, and what is still due. */
export function StatementOfAccountCard({ eventId }: { eventId: string }) {
  const statement = useResource(clientStatementOfAccount, eventId);
  if (statement.status === "error" && !statement.data) return null;
  if (!statement.data) return null;
  if (!statement.data.available) {
    return <ClientListEmpty icon={FileText} title="Your statement of account is not ready yet" description="It appears here once PMCM sends your billing statement." />;
  }
  return <StatementBody statement={statement.data} />;
}
