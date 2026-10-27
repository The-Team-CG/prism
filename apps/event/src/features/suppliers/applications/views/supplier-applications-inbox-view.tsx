"use client";

import { Inbox } from "lucide-react";
import { Button } from "@/app/components/ui/button";
import { EmptyState } from "@/app/components/ui/empty-state";
import { StatusBadge } from "@/app/components/ui/status-badge";
import { applicationActionLabel, applicationReviewActions } from "../model/supplier-applications-rules";
import { useSupplierApplicationsInboxViewModel } from "../view-models/use-supplier-applications-inbox-view-model";

export function SupplierApplicationsInboxView() {
  const { items, busy, error, declineReason, setDeclineReason, review } =
    useSupplierApplicationsInboxViewModel();

  return (
    <section className="rounded-2xl border border-border bg-card shadow-sm">
      <div className="border-b border-border px-6 py-4">
        <div className="flex items-center gap-2">
          <Inbox className="size-4 text-primary" />
          <h2 className="text-sm font-bold text-foreground">Supplier applications</h2>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          Request a proposal, schedule a meeting, or decline. Applicant-facing status stays without PMCM review notes.
        </p>
      </div>
      <div className="space-y-3 px-6 py-5">
        {error ? <p className="text-sm font-semibold text-attention">{error}</p> : null}
        <label className="block text-xs font-semibold text-muted-foreground">
          Decline reason
          <input
            value={declineReason}
            onChange={(event) => setDeclineReason(event.target.value)}
            className="mt-1 h-9 w-full rounded-xl border border-border bg-background px-3 text-sm text-foreground"
          />
        </label>
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
                {applicationReviewActions().map((action) => (
                  <Button
                    key={action}
                    size="sm"
                    variant={action === "decline" ? "outline" : "default"}
                    disabled={busy || item.status === "declined"}
                    className="rounded-lg font-bold"
                    onClick={() => review(item.id, action)}
                  >
                    {applicationActionLabel(action)}
                  </Button>
                ))}
              </div>
            </div>
          ))
        )}
      </div>
    </section>
  );
}
