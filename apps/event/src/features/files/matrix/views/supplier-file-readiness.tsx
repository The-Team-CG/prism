"use client";

import { useFileRequirementsMatrixViewModel } from "../view-models/use-file-requirements-matrix-view-model";

export function SupplierFileReadiness({ eventId }: { eventId: string }) {
  const { matrix, status } = useFileRequirementsMatrixViewModel(eventId);
  const entries = (matrix?.items ?? []).flatMap((item) => (item.supplierFulfilments ?? []).map((supplier) => ({ item, supplier })));

  return (
    <section aria-labelledby="supplier-file-readiness" className="rounded-lg border border-border bg-card p-6">
      <h2 id="supplier-file-readiness" className="text-sm font-semibold">Supplier file requirements</h2>
      {status === "loading" || status === "idle" ? <p role="status" className="mt-2 text-sm">Loading file requirements…</p> : null}
      {status === "error" ? <p role="alert" className="mt-2 text-sm text-destructive">Unable to load supplier file requirements.</p> : null}
      {status === "success" && entries.length === 0 ? <p className="mt-2 text-sm text-muted-foreground">No supplier file requirements are assigned.</p> : null}
      {entries.length ? <ul className="mt-2 space-y-1 text-sm">{entries.map(({ item, supplier }) => (
        <li key={`${item.key}:${supplier.supplierId}`}>
          {supplier.supplierName} · {item.label}: {supplier.reviewReason ? "Replacement requested" : supplier.status}{supplier.overdue ? " · Overdue" : ""}
        </li>
      ))}</ul> : null}
    </section>
  );
}
