"use client";

import { StatusBadge } from "@/app/components/ui/status-badge";
import { formatStatusLabel } from "../../workspace/model/client-dashboard-view-rules";
import { useClientWorkspace } from "../../workspace/client-workspace-context";

export function ClientFinalSummaryPage() {
  const { selectedEvent, officialDraft, billing, documents } = useClientWorkspace();

  return (
  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
    {[
      { label: "Event", value: formatStatusLabel(selectedEvent?.status), status: selectedEvent?.status ?? "pending" },
      { label: "Layout", value: officialDraft ? formatStatusLabel(officialDraft.status) : "Pending", status: officialDraft?.status ?? "pending" },
      { label: "Billing", value: billing ? formatStatusLabel(billing.status) : "Pending", status: billing?.status ?? "pending" },
      { label: "Files", value: `${documents.length} file${documents.length === 1 ? "" : "s"}`, status: documents.length ? "approved" : "pending" },
    ].map((item) => (
      <div key={item.label} className="rounded-xl border border-border bg-card px-4 py-4 shadow-sm">
        <p className="text-xs font-semibold text-muted-foreground">{item.label}</p>
        <p className="mt-2 text-lg font-black text-foreground">{item.value}</p>
        <div className="mt-3"><StatusBadge status={item.status} label={formatStatusLabel(item.status)} /></div>
      </div>
    ))}
  </div>
  );
}
