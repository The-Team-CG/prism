"use client";

import type { PrismZoneNode } from "@prism/types";
import { usePrismFloorplan } from "../editor-context";

/** The suppliers working in a zone, picked from those booked on the event. */
export function ZoneSuppliersField({ node, onUpdate }: { node: PrismZoneNode; onUpdate: (patch: Partial<PrismZoneNode>) => void }) {
  const { suppliers, readOnly } = usePrismFloorplan();
  if (suppliers.length === 0) return <p className="text-xs text-muted-foreground">No suppliers are booked on this event yet.</p>;
  const toggle = (id: string, on: boolean) =>
    onUpdate({ supplierIds: on ? [...node.supplierIds, id] : node.supplierIds.filter((supplierId) => supplierId !== id) });
  return (
    <fieldset className="space-y-1" disabled={readOnly}>
      <legend className="mb-1 text-xs text-muted-foreground">Suppliers</legend>
      {suppliers.map((supplier) => (
        <label key={supplier.id} className="flex items-center gap-2 text-sm text-foreground">
          <input type="checkbox" checked={node.supplierIds.includes(supplier.id)} onChange={(event) => toggle(supplier.id, event.target.checked)} />
          <span>{supplier.name}</span>
          <span className="text-xs text-muted-foreground">{supplier.kind}</span>
        </label>
      ))}
    </fieldset>
  );
}
