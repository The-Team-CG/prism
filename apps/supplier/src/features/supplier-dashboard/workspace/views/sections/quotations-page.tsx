"use client";

import { useState } from "react";
import { FileText } from "lucide-react";
import { Button } from "@prism/ui/components/button";
import { Card, CardContent } from "@prism/ui/components/card";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@prism/ui/components/empty";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@prism/ui/components/sheet";
import { StatusBadge } from "@prism/ui/components/status-badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@prism/ui/components/table";
import { formatDate, formatMoney } from "../../model/supplier-workspace-rules";
import type { PrismSupplierReadinessBoard, SupplierWorkspace } from "../../model/supplier-workspace-types";

export function QuotationsPage({ workspace, readinessBoard }: { workspace: SupplierWorkspace; readinessBoard: PrismSupplierReadinessBoard | null }) {
  const [openQuoteId, setOpenQuoteId] = useState<string | null>(null);

  if (!workspace.supplierQuotes.length) {
    return (
      <Card>
        <CardContent>
          <Empty className="border-0 p-6 md:p-8">
            <EmptyHeader>
              <EmptyMedia variant="icon"><FileText /></EmptyMedia>
              <EmptyTitle>No quotations on file.</EmptyTitle>
              <EmptyDescription>Submitted quotes will appear here with their full history.</EmptyDescription>
            </EmptyHeader>
          </Empty>
        </CardContent>
      </Card>
    );
  }

  const rows = workspace.supplierQuotes.map((quote) => {
    const request = workspace.quoteRequests.find((item) => item.id === quote.requestId);
    const eventName = readinessBoard?.items.find((item) => item.requestId === quote.requestId)?.eventName ?? request?.category ?? "Quote request";
    return { quote, request, eventName };
  });
  const openRow = rows.find((row) => row.quote.id === openQuoteId) ?? null;

  return (
    <>
      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="px-4">Event</TableHead>
              <TableHead className="px-4">Amount</TableHead>
              <TableHead className="px-4">Terms</TableHead>
              <TableHead className="px-4">Status</TableHead>
              <TableHead className="px-4">Last revised</TableHead>
              <TableHead className="px-4"><span className="sr-only">Details</span></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map(({ quote, eventName }) => (
              <TableRow key={quote.id}>
                <TableCell className="max-w-[16rem] px-4 whitespace-normal">
                  <span className="block break-words font-semibold text-foreground">{eventName}</span>
                  <span className="block text-xs text-muted-foreground">{quote.category} · Revision #{quote.revisionNumber ?? 1}</span>
                </TableCell>
                <TableCell className="px-4 font-semibold tabular-nums">{formatMoney(quote.amount)}</TableCell>
                <TableCell className="max-w-[14rem] px-4 whitespace-normal break-words text-muted-foreground">{quote.paymentTerms || "—"}</TableCell>
                <TableCell className="px-4"><StatusBadge status={quote.status} /></TableCell>
                <TableCell className="px-4 text-muted-foreground">{quote.revisedAt ? formatDate(quote.revisedAt) : "—"}</TableCell>
                <TableCell className="px-4 text-right">
                  <Button type="button" variant="ghost" size="sm" onClick={() => setOpenQuoteId(quote.id)} aria-label={`View quote details for ${eventName}`}>
                    Details
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      <Sheet open={openRow !== null} onOpenChange={(open) => { if (!open) setOpenQuoteId(null); }}>
        <SheetContent className="overflow-y-auto">
          {openRow ? (
            <>
              <SheetHeader>
                <SheetTitle className="break-words">{openRow.eventName}</SheetTitle>
                <SheetDescription>{openRow.quote.category} · {openRow.request?.message ?? "Quote request"}</SheetDescription>
              </SheetHeader>
              <dl className="grid gap-4 px-4 pb-6 text-sm">
                <div>
                  <dt className="text-muted-foreground">Submitted</dt>
                  <dd className="font-medium text-foreground">{formatDate(openRow.quote.createdAt)}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Payment terms</dt>
                  <dd className="break-words text-foreground">{openRow.quote.paymentTerms || "—"}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Inclusions</dt>
                  <dd className="text-foreground">
                    {openRow.quote.inclusions.length ? (
                      <ul className="mt-1 space-y-1">
                        {openRow.quote.inclusions.map((inclusion, index) => <li key={index} className="break-words">{inclusion}</li>)}
                      </ul>
                    ) : "—"}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Notes</dt>
                  <dd className="break-words text-foreground">{openRow.quote.notes || "—"}</dd>
                </div>
              </dl>
            </>
          ) : null}
        </SheetContent>
      </Sheet>
    </>
  );
}
