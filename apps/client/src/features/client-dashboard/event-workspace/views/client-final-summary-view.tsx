"use client";

import { Card } from "@prism/ui/components/card";
import { StatusBadge } from "@prism/ui/components/status-badge";
import { formatStatusLabel } from "../../workspace/shared";
import { useClientWorkspace } from "../../workspace/shared";

export function ClientFinalSummaryView() {
  const { selectedEvent, officialDraft, billing, documents } = useClientWorkspace();

  return (
  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
    {[
      { label: "Event", value: formatStatusLabel(selectedEvent?.status), status: selectedEvent?.status ?? "pending" },
      { label: "Layout", value: officialDraft ? formatStatusLabel(officialDraft.status) : "Pending", status: officialDraft?.status ?? "pending" },
      { label: "Billing", value: billing ? formatStatusLabel(billing.status) : "Pending", status: billing?.status ?? "pending" },
      { label: "Files", value: `${documents.length} file${documents.length === 1 ? "" : "s"}`, status: documents.length ? "approved" : "pending" },
    ].map((item) => (
      <Card key={item.label} className="gap-1 px-4 py-4">
        <p className="text-xs font-semibold text-muted-foreground">{item.label}</p>
        <p className="mt-2 text-lg font-black text-foreground">{item.value}</p>
        <div className="mt-3"><StatusBadge status={item.status} label={formatStatusLabel(item.status)} /></div>
      </Card>
    ))}
  </div>
  );
}
