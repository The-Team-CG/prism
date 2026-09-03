"use client";

import { FileCheck2 } from "lucide-react";
import { StatusBadge } from "@/app/components/ui/status-badge";
import { EmptyState } from "@/app/components/ui/empty-state";
import { humanizeToken } from "@/features/pmcm-kit/model/formatters";
import { useFileRequirementsMatrixViewModel } from "../view-models/use-file-requirements-matrix-view-model";
import { STORAGE_GATE_COPY, fileRequirementCounts, sortFileRequirementItems } from "../model/file-requirements-matrix-rules";

export function FileRequirementsMatrixPanel({ eventId }: { eventId?: string }) {
  const { matrix, status, error } = useFileRequirementsMatrixViewModel(eventId);
  const counts = fileRequirementCounts(matrix);
  const items = sortFileRequirementItems(matrix?.items ?? []);

  return (
    <section className="rounded-2xl border border-border bg-card shadow-sm">
      <div className="border-b border-border px-6 py-4">
        <div className="flex items-center gap-2">
          <FileCheck2 className="size-4 text-(--prism-signal)" />
          <h2 className="text-sm font-bold text-foreground">File requirements matrix</h2>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">{STORAGE_GATE_COPY}</p>
        {counts.total > 0 ? (
          <p className="mt-2 text-xs font-semibold text-muted-foreground">
            {counts.open} open of {counts.total} required files
          </p>
        ) : null}
      </div>
      {status === "error" ? (
        <div className="px-6 py-6">
          <EmptyState icon={FileCheck2} title="Unable to load file requirements" description={error ?? "Try again after selecting an event."} />
        </div>
      ) : status === "loading" || status === "idle" ? (
        <p className="px-6 py-6 text-sm text-muted-foreground">Loading file requirements…</p>
      ) : items.length === 0 ? (
        <div className="px-6 py-6">
          <EmptyState icon={FileCheck2} title="No visible file requirements" description="Requirements appear after conforme, briefing, or supplier records exist." />
        </div>
      ) : (
        <div className="divide-y divide-border">
          {items.map((item) => (
            <div key={item.key} className="flex flex-wrap items-start justify-between gap-3 px-6 py-3">
              <div className="min-w-0">
                <p className="text-sm font-bold text-foreground">{item.label}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">{item.detail}</p>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  Owner {humanizeToken(item.ownerRole)} · {item.sourceWorkflow}
                </p>
              </div>
              <StatusBadge status={item.status} label={humanizeToken(item.status)} />
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
