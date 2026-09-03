"use client";

import { ClipboardCheck } from "lucide-react";
import { StatusBadge } from "@/app/components/ui/status-badge";
import { EmptyState } from "@/app/components/ui/empty-state";
import { humanizeToken } from "@/features/pmcm-kit/model/formatters";
import type { SupplierQuoteRequestRow, SupplierQuoteRow } from "@/features/pmcm-kit";
import { pmcmSupplierReadinessRows } from "../model/pmcm-supplier-readiness-rules";

export function PmcmSupplierReadinessBoard({
  requests,
  quotes,
}: {
  requests: SupplierQuoteRequestRow[];
  quotes: SupplierQuoteRow[];
}) {
  const rows = pmcmSupplierReadinessRows(requests, quotes);

  return (
    <section className="rounded-2xl border border-border bg-card shadow-sm">
      <div className="border-b border-border px-6 py-4">
        <div className="flex items-center gap-2">
          <ClipboardCheck className="size-4 text-(--prism-signal)" />
          <h2 className="text-sm font-bold text-foreground">Supplier readiness</h2>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          PMCM review of quote lock, assignment, and readiness. Private reviews stay off the supplier portal.
        </p>
      </div>
      {rows.length === 0 ? (
        <div className="px-6 py-6">
          <EmptyState icon={ClipboardCheck} title="No supplier requests yet" description="Request quotes to track assignment and readiness for this event." />
        </div>
      ) : (
        <div className="divide-y divide-border">
          {rows.map((row) => (
            <div key={row.id} className="flex flex-wrap items-start justify-between gap-3 px-6 py-3">
              <div className="min-w-0">
                <p className="text-sm font-bold text-foreground">{row.supplierName}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">{row.category}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <StatusBadge status={row.quoteStatus} label={row.locked ? "Quote locked" : humanizeToken(row.quoteStatus)} />
                <StatusBadge status={row.assignmentStatus} label={humanizeToken(row.assignmentStatus)} />
                <StatusBadge status={row.readinessStatus} label={humanizeToken(row.readinessStatus)} />
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
