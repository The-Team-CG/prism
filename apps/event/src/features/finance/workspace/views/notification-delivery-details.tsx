"use client";

import { useNotificationDeliveryDetails } from "../view-models/use-notification-delivery-details";
import { useState } from "react";

type DeliveryDetails = ReturnType<typeof useNotificationDeliveryDetails>;
type DeliveryRow = NonNullable<DeliveryDetails["rows"]>[number];

function acknowledgmentCopy(row: DeliveryRow) {
  if (row.acknowledgedAt) return " · Receipt acknowledged";
  return row.acknowledgmentDueAt ? ` · Acknowledgment due ${new Date(row.acknowledgmentDueAt).toLocaleString()}` : "";
}

/** One line per recipient: what the provider reported, the channel's readiness, and where acknowledgment stands. */
function deliverySummary(row: DeliveryRow) {
  const status = row.status === "accepted" ? "Accepted by provider" : row.status;
  return [
    `${row.recipient}: ${status} · ${row.attempts} attempt(s)`,
    row.failureReason ? ` · ${row.failureReason}` : "",
    row.providerOutcome ? ` · Provider outcome: ${row.providerOutcome}` : "",
    row.channelReadiness ? ` · Channel: ${row.channelReadiness}` : "",
    acknowledgmentCopy(row),
    row.escalatedAt ? " · Escalated to PMCM" : "",
  ].join("");
}

function RecipientDelivery({ row, channel, vm }: { row: DeliveryRow; channel: string; vm: DeliveryDetails }) {
  const [deadlineOpen, setDeadlineOpen] = useState(false);
  const [dueAt, setDueAt] = useState("");
  const [deadlineReason, setDeadlineReason] = useState("");
  return <li>
    {deliverySummary(row)}
    {channel === "email" && row.status === "accepted" ? <button type="button" className="ml-2 text-primary" disabled={vm.busy} onClick={() => void vm.refresh(row.id)}>Refresh email outcome</button> : null}
    {!row.acknowledgedAt && row.status !== "skipped" ? <button type="button" className="ml-2 text-primary" disabled={vm.busy} onClick={() => setDeadlineOpen(true)}>Set acknowledgment deadline</button> : null}
    {deadlineOpen ? <form className="mt-2 flex flex-wrap gap-2" onSubmit={(event) => { event.preventDefault(); void vm.requestAcknowledgment(row.id, dueAt, deadlineReason); }}>
      <input aria-label="Acknowledgment deadline" type="datetime-local" required value={dueAt} onChange={(event) => setDueAt(event.target.value)} className="rounded border border-border bg-background p-1" />
      <input aria-label="Reason for acknowledgment deadline" required maxLength={500} value={deadlineReason} onChange={(event) => setDeadlineReason(event.target.value)} className="rounded border border-border bg-background p-1" />
      <button type="submit" disabled={vm.busy} className="text-primary">Save deadline</button>
      <button type="button" onClick={() => setDeadlineOpen(false)}>Close</button>
    </form> : null}
  </li>;
}

export function NotificationDeliveryDetails({ notificationId, status, channel }: { notificationId: string; status: string; channel: string }) {
  const vm = useNotificationDeliveryDetails(notificationId);
  const [reason, setReason] = useState("");
  return <div className="mt-2 text-xs">
    <button type="button" onClick={() => void vm.load()} disabled={vm.busy} className="font-semibold text-primary">
      {vm.busy ? "Loading…" : "View recipient delivery"}
    </button>
    {vm.error ? <p role="alert" className="mt-1 text-destructive">{vm.error}</p> : null}
    {vm.rows?.length === 0 ? <p className="mt-1 text-muted-foreground">No recipient delivery records yet.</p> : null}
    {vm.rows?.length ? <ul className="mt-1 space-y-1">{vm.rows.map((row) => <RecipientDelivery key={row.id} row={row} channel={channel} vm={vm} />)}</ul> : null}
    {status === "failed" && !vm.queued ? <div className="mt-2 flex flex-wrap gap-2">
      <input aria-label="Reason for retry" value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Reason for retry" className="rounded border border-border bg-background px-2 py-1" />
      <button type="button" disabled={vm.busy || !reason.trim()} onClick={() => void vm.retry(reason)} className="rounded border border-border px-2 py-1">Retry failed deliveries</button>
    </div> : null}
    {vm.queued ? <p className="mt-1">Retry queued.</p> : null}
  </div>;
}
