"use client";

import { ClipboardCheck } from "lucide-react";
import type { PrismPmcmSupplierReadinessItem } from "@prism/types";
import { StatusBadge } from "@/app/components/ui/status-badge";
import { EmptyState } from "@/app/components/ui/empty-state";
import { humanizeToken } from "@/features/pmcm-kit/model/formatters";
import { concernLabel, setupStatusLabel } from "../model/pmcm-supplier-readiness-rules";
import { usePmcmSupplierReadinessViewModel } from "../view-models/use-pmcm-supplier-readiness-view-model";

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

export function PmcmSupplierReadinessBoard({ eventId, refreshKey }: { eventId: string; refreshKey?: string }) {
  const vm = usePmcmSupplierReadinessViewModel(eventId, refreshKey);
  const items = vm.board?.items ?? [];

  return (
    <section aria-labelledby="pmcm-supplier-readiness-heading" className="rounded-2xl border border-border bg-card shadow-sm">
      <div className="border-b border-border px-6 py-4">
        <div className="flex items-center gap-2">
          <ClipboardCheck className="size-4 text-(--prism-signal)" />
          <h2 id="pmcm-supplier-readiness-heading" className="text-sm font-bold text-foreground">Supplier readiness</h2>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          The same readiness the supplier sees: quote lock, assignment, contract, ingress, concerns, and setup. PMCM review notes stay off the supplier portal.
        </p>
        {vm.gapCopy ? (
          <p className="mt-3 rounded-xl border border-(--prism-amber)/30 bg-(--prism-amber)/8 px-3 py-2 text-xs font-semibold text-(--prism-amber)">
            {vm.gapCopy}
          </p>
        ) : null}
      </div>
      {vm.error ? <p role="alert" className="px-6 py-4 text-sm text-destructive">{vm.error}</p> : null}
      {vm.loading && !vm.board ? <p role="status" className="px-6 py-4 text-sm text-muted-foreground">Loading supplier readiness…</p> : null}
      {vm.board && items.length === 0 ? (
        <div className="px-6 py-6">
          <EmptyState icon={ClipboardCheck} title="No supplier requests yet" description="Request quotes to track assignment and readiness for this event." />
        </div>
      ) : null}
      {items.length > 0 ? (
        <ul className="divide-y divide-border">
          {items.map((item) => <ReadinessRow key={item.id} item={item} />)}
        </ul>
      ) : null}
    </section>
  );
}

function ReadinessRow({ item }: { item: PrismPmcmSupplierReadinessItem }) {
  return (
    <li className="space-y-2 px-6 py-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-bold text-foreground">{item.supplierName}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">{item.category}</p>
        </div>
        <ReadinessBadges item={item} />
      </div>
      <ReadinessSchedule item={item} />
      {item.concerns.length > 0 ? (
        <ul aria-label={`${item.supplierName} concerns`} className="space-y-1">
          {item.concerns.map((concern) => (
            <li key={`${concern.kind}:${concern.at ?? ""}`} className="text-xs text-(--prism-amber)">
              <span className="font-semibold">{concernLabel(concern.kind)}:</span> {concern.message}
            </li>
          ))}
        </ul>
      ) : null}
      <ReadinessPmcmReview item={item} />
    </li>
  );
}

function ReadinessBadges({ item }: { item: PrismPmcmSupplierReadinessItem }) {
  return (
    <div className="flex flex-wrap gap-2">
      <StatusBadge status={item.quoteStatus} label={item.quoteLocked ? "Quote locked" : humanizeToken(item.quoteStatus)} />
      <StatusBadge status={item.assignmentStatus ?? "pending"} label={humanizeToken(item.assignmentStatus ?? "pending")} />
      <StatusBadge status={item.readinessStatus ?? "pending"} label={humanizeToken(item.readinessStatus ?? "not confirmed")} />
      <StatusBadge status={item.contractStatus === "accepted" ? "approved" : item.contractStatus} label={`Contract ${humanizeToken(item.contractStatus)}`} />
      <StatusBadge status={item.ingressLate ? "overdue" : item.setupStatus === "ready" || item.setupStatus === "complete" ? "completed" : "pending"} label={setupStatusLabel(item.setupStatus)} />
    </div>
  );
}

function ReadinessSchedule({ item }: { item: PrismPmcmSupplierReadinessItem }) {
  if (!item.schedule) return <p className="text-xs text-muted-foreground">No ingress schedule set.</p>;
  return (
    <p className="text-xs text-muted-foreground">
      Ingress {formatDateTime(item.schedule.ingressAt)} · Egress {formatDateTime(item.schedule.egressAt)}
      {item.schedule.location ? ` · ${item.schedule.location}` : ""} · revision {item.schedule.revision}{" "}
      {item.schedule.acknowledged ? "acknowledged" : "not acknowledged"}
    </p>
  );
}

function ReadinessPmcmReview({ item }: { item: PrismPmcmSupplierReadinessItem }) {
  const { verifiedBy, verificationNotes } = item.pmcmReview;
  if (!verificationNotes && !verifiedBy) return null;
  return (
    <p className="rounded-lg bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
      <span className="font-semibold text-foreground">PMCM review</span>
      {verifiedBy ? ` by ${verifiedBy}` : ""}
      {verificationNotes ? `: ${verificationNotes}` : ""}
    </p>
  );
}
