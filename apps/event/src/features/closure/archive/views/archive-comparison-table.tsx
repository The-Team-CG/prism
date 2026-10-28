"use client";
import { formatPortalDate, formatPortalDateTime } from "@prism/ui/format-date";

import type { PrismArchiveComparisonRow } from "@prism/types";

type ComparisonAttribute = { label: string; value: (row: PrismArchiveComparisonRow) => string };

const attributes: ComparisonAttribute[] = [
  { label: "Client", value: (row) => row.clientName },
  { label: "Event date", value: (row) => row.eventDate },
  { label: "Venue", value: (row) => row.venue || "Venue pending" },
  { label: "Event type", value: (row) => row.eventType || "Type pending" },
  { label: "Actual end", value: (row) => (row.actualEndedAt ? formatPortalDateTime(row.actualEndedAt) : "Not recorded") },
  { label: "Close gates", value: (row) => (row.closeGatesReady ? "Passed" : `Missing: ${row.missingCloseGates.join(", ") || "unknown"}`) },
  { label: "Archive override", value: (row) => (row.archiveOverridden ? row.archiveOverrideReason ?? "Override recorded" : "None") },
  { label: "Logistics completion", value: (row) => (row.logisticsRecorded && row.logisticsRecordedAt ? `Recorded ${formatPortalDate(row.logisticsRecordedAt)}` : "Not recorded") },
];

export function ArchiveComparisonTable({ rows, onClose }: { rows: PrismArchiveComparisonRow[]; onClose: () => void }) {
  return (
    <section className="space-y-3 rounded-xl border border-border p-4">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-sm font-bold text-foreground">Side-by-side comparison</h3>
        <button type="button" onClick={onClose} className="text-xs font-semibold text-muted-foreground hover:text-foreground">
          Close comparison
        </button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[40rem] border-collapse text-left text-xs">
          <thead>
            <tr className="border-b border-border">
              <th scope="col" className="py-2 pr-4 font-semibold text-muted-foreground">Attribute</th>
              {rows.map((row) => (
                <th key={row.id} scope="col" className="py-2 pr-4 font-bold text-foreground">{row.eventName}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {attributes.map((attribute) => (
              <tr key={attribute.label} className="border-b border-border last:border-0">
                <th scope="row" className="py-2 pr-4 font-semibold text-muted-foreground">{attribute.label}</th>
                {rows.map((row) => (
                  <td key={row.id} className="py-2 pr-4 text-foreground">{attribute.value(row)}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
