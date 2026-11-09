"use client";
import { formatPortalDate, formatPortalDateTime } from "@prism/ui/format-date";

import type { PrismArchiveComparisonRow } from "@prism/types";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@prism/ui/components/table";

type ComparisonAttribute = { label: string; value: (row: PrismArchiveComparisonRow) => string };

const attributes: ComparisonAttribute[] = [
  { label: "Client", value: (row) => row.clientName },
  { label: "Event date", value: (row) => formatPortalDate(row.eventDate) },
  { label: "Venue", value: (row) => row.venue || "Venue pending" },
  { label: "Event type", value: (row) => row.eventType || "Type pending" },
  { label: "Attendees", value: (row) => `${row.attendeeCount} checked in${row.plannedGuestCount ? ` of ${row.plannedGuestCount} planned` : ""}` },
  { label: "Total cost", value: (row) => `PHP ${row.totalCost.toLocaleString("en-PH")}` },
  { label: "Guest satisfaction", value: (row) => (row.averageGuestRating === null ? "No approved feedback" : `${row.averageGuestRating} of 5`) },
  { label: "Urgent issues", value: (row) => String(row.urgentIssueCount) },
  { label: "Top supplier per category", value: (row) => (row.topSuppliers.length ? row.topSuppliers.map((item) => `${item.category}: ${item.supplierName} (${item.rating}/5)`).join("; ") : "No supplier assessments") },
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
      <Table className="min-w-[40rem] text-xs">
        <TableHeader>
          <TableRow>
            <TableHead scope="col" className="font-semibold text-muted-foreground">Attribute</TableHead>
            {rows.map((row) => (
              <TableHead key={row.id} scope="col" className="font-bold text-foreground">{row.eventName}</TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {attributes.map((attribute) => (
            <TableRow key={attribute.label}>
              <TableHead scope="row" className="h-auto whitespace-normal font-semibold text-muted-foreground">{attribute.label}</TableHead>
              {rows.map((row) => (
                <TableCell key={row.id} className="whitespace-normal text-foreground">{attribute.value(row)}</TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </section>
  );
}
