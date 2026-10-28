"use client";
import { formatPortalDate } from "@prism/ui/format-date";

import { StatusBadge } from "@/app/components/ui/status-badge";
import { formatStatusLabel } from "../../workspace/shared";
import { useClientWorkspace } from "../../workspace/shared";

export function ClientScheduleView() {
  const { selectedEvent, payments } = useClientWorkspace();

  return (
  <div className="space-y-3">
    <div className="rounded-xl border border-border bg-card px-5 py-4 shadow-sm">
      <p className="text-sm font-bold text-foreground">Event date</p>
      <p className="mt-1 text-sm text-muted-foreground">{selectedEvent?.eventDate ?? "Pending"}</p>
    </div>
    {payments.map((payment) => (
      <div key={payment.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card px-5 py-4 shadow-sm">
        <div>
          <p className="text-sm font-bold text-foreground">{payment.label}</p>
          <p className="mt-1 text-xs text-muted-foreground">Payment due date</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm font-semibold text-foreground">{formatPortalDate(payment.dueDate)}</span>
          <StatusBadge status={payment.status} label={formatStatusLabel(payment.status)} />
        </div>
      </div>
    ))}
  </div>
  );
}
