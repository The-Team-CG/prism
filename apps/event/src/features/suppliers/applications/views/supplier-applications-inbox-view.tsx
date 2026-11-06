"use client";

import { useId } from "react";
import { Inbox } from "lucide-react";
import { Button } from "@/app/components/ui/button";
import { EmptyState } from "@/app/components/ui/empty-state";
import { Input } from "@/app/components/ui/input";
import { StatusBadge } from "@/app/components/ui/status-badge";
import { applicationActionLabel, applicationReviewActions } from "../model/supplier-applications-rules";
import { useSupplierApplicationsInboxViewModel } from "../view-models/use-supplier-applications-inbox-view-model";

export function SupplierApplicationsInboxView() {
  const { items, busy, error, decliningId, declineReason, setDeclineReason, review, startDecline, cancelDecline } =
    useSupplierApplicationsInboxViewModel();

  return (
    <section className="rounded-2xl border border-border bg-card shadow-sm">
      <div className="border-b border-border px-6 py-4">
        <div className="flex items-center gap-2">
          <Inbox className="size-4 text-primary" />
          <h2 className="text-sm font-bold text-foreground">Supplier applications</h2>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          Request a proposal, schedule a meeting, or decline. Applicants never see your review notes.
        </p>
      </div>
      <div className="space-y-3 px-6 py-5">
        {error ? <p className="text-sm font-semibold text-attention">{error}</p> : null}
        {items.length === 0 ? (
          <EmptyState icon={Inbox} title="No applications yet" description="Public supplier applications appear here for PMCM review." />
        ) : (
          items.map((item) => (
            <div key={item.id} className="rounded-xl border border-border bg-muted/30 p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-bold text-foreground">{item.companyName}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {item.contactName} · {item.email}
                  </p>
                </div>
                <StatusBadge status={item.status} />
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {applicationReviewActions()
                  .filter((action) => action !== "decline")
                  .map((action) => (
                    <Button
                      key={action}
                      size="sm"
                      disabled={busy || item.status === "declined"}
                      className="rounded-lg font-bold"
                      onClick={() => void review(item.id, action)}
                    >
                      {applicationActionLabel(action)}
                    </Button>
                  ))}
                <Button
                  size="sm"
                  variant="outline"
                  disabled={busy || item.status === "declined" || decliningId === item.id}
                  className="rounded-lg font-bold"
                  onClick={() => startDecline(item.id)}
                >
                  {applicationActionLabel("decline")}
                </Button>
              </div>
              {decliningId === item.id ? (
                <DeclineForm
                  companyName={item.companyName}
                  busy={busy}
                  reason={declineReason}
                  onReason={setDeclineReason}
                  onCancel={cancelDecline}
                  onConfirm={() => void review(item.id, "decline")}
                />
              ) : null}
            </div>
          ))
        )}
      </div>
    </section>
  );
}

function DeclineForm({
  companyName,
  busy,
  reason,
  onReason,
  onCancel,
  onConfirm,
}: {
  companyName: string;
  busy: boolean;
  reason: string;
  onReason: (value: string) => void;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const reasonId = useId();
  return (
    <div className="mt-3 space-y-2 rounded-lg border border-border bg-background p-3">
      <label htmlFor={reasonId} className="block text-xs font-semibold text-muted-foreground">
        Decline reason for {companyName}
      </label>
      <Input id={reasonId} value={reason} onChange={(event) => onReason(event.target.value)} className="h-9 text-sm" />
      <div className="flex flex-wrap justify-end gap-2">
        <Button size="sm" variant="outline" disabled={busy} onClick={onCancel}>
          Keep application
        </Button>
        <Button size="sm" disabled={busy || !reason.trim()} onClick={onConfirm}>
          Confirm decline
        </Button>
      </div>
    </div>
  );
}
