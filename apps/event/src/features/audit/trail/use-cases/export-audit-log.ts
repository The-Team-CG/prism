import type { PrismAuditExport } from "@prism/types";
import { csvCell } from "@/features/pmcm-kit";

export function downloadAuditLog(exported: PrismAuditExport, now = new Date()) {
  const header = ["Log ID", "Timestamp", "Actor", "Role", "Category", "Action Type", "Action", "Affected", "IP", "Device", "Hash"];
  const rows = exported.rows.map((log) => [
    log.id,
    log.createdAt,
    log.actor,
    log.actorRole,
    log.category,
    log.actionType,
    log.action,
    log.affectedLabel ?? log.affectedId ?? "",
    log.ipAddress,
    log.device,
    log.immutableHash,
  ]);
  const csv = [header, ...rows].map((row) => row.map(csvCell).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `prism-audit-log-${now.toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
