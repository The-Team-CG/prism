"use client";

import { FileCheck2 } from "lucide-react";
import { StatusBadge } from "@/app/components/ui/status-badge";
import { EmptyState } from "@/app/components/ui/empty-state";
import { buildSupplierContractRequirements } from "../../model/supplier-workspace-rules";
import type { SupplierWorkspace } from "../../model/supplier-workspace-types";

export function SupplierFileRequirementsMatrix({
  workspace,
}: {
  workspace: SupplierWorkspace;
}) {
  const items = buildSupplierContractRequirements(workspace);
  return (
    <div className="rounded-2xl border border-border bg-card shadow-sm">
      <div className="border-b border-border px-6 py-4">
        <div className="flex items-center gap-2">
          <FileCheck2 className="size-4 text-primary" />
          <h2 className="text-sm font-bold text-foreground">File requirements</h2>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          Requirements are limited to your bookings. Upload signed contracts in Bookings; your versions and PMCM review status appear in Files.
        </p>
      </div>
      {items.length === 0 ? (
        <div className="px-6 py-6">
          <EmptyState icon={FileCheck2} title="No supplier file requirements yet" description="Visible items appear after PMCM requests a contract or supporting file for your booking." />
        </div>
      ) : (
        <div className="divide-y divide-border">
          {items.map((item) => (
            <div key={item.key} className="flex items-start justify-between gap-3 px-6 py-3">
              <div className="min-w-0">
                <p className="text-sm font-bold text-foreground">{item.label}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">{item.detail}</p>
              </div>
              <StatusBadge status={item.status} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
