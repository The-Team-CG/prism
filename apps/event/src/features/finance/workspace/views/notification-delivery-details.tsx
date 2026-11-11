"use client";

import { useNotificationDeliveryDetails } from "../view-models/use-notification-delivery-details";
import { useState } from "react";

export function NotificationDeliveryDetails({ notificationId, status, channel }: { notificationId: string; status: string; channel: string }) {
  const vm = useNotificationDeliveryDetails(notificationId);
  const [reason, setReason] = useState("");
  const [deadlineRecipient, setDeadlineRecipient] = useState<string | null>(null);
  const [dueAt, setDueAt] = useState('');
  const [deadlineReason, setDeadlineReason] = useState('');
  return <div className="mt-2 text-xs">
    <button type="button" onClick={() => void vm.load()} disabled={vm.busy} className="font-semibold text-primary">
      {vm.busy ? "Loading…" : "View recipient delivery"}
    </button>
    {vm.error ? <p role="alert" className="mt-1 text-destructive">{vm.error}</p> : null}
    {vm.rows?.length === 0 ? <p className="mt-1 text-muted-foreground">No recipient delivery records yet.</p> : null}
    {vm.rows?.length ? <ul className="mt-1 space-y-1">{vm.rows.map((row) => <li key={row.id}>
      {row.recipient}: {row.status === "accepted" ? "Accepted by provider" : row.status} · {row.attempts} attempt(s)
      {row.failureReason ? ` · ${row.failureReason}` : ""}
      {row.providerOutcome ? ` · Provider outcome: ${row.providerOutcome}` : ''}
      {row.channelReadiness ? ` · Channel: ${row.channelReadiness}` : ''}
      {row.acknowledgedAt ? ' · Receipt acknowledged' : row.acknowledgmentDueAt ? ` · Acknowledgment due ${new Date(row.acknowledgmentDueAt).toLocaleString()}` : ''}
      {row.escalatedAt ? ' · Escalated to PMCM' : ''}
      {channel === 'email' && row.status === 'accepted' ? <button type="button" className="ml-2 text-primary" disabled={vm.busy} onClick={() => void vm.refresh(row.id)}>Refresh email outcome</button> : null}
      {!row.acknowledgedAt && row.status !== 'skipped' ? <button type="button" className="ml-2 text-primary" disabled={vm.busy} onClick={() => setDeadlineRecipient(row.id)}>Set acknowledgment deadline</button> : null}
      {deadlineRecipient === row.id ? <form className="mt-2 flex flex-wrap gap-2" onSubmit={(event) => { event.preventDefault(); void vm.requestAcknowledgment(row.id, dueAt, deadlineReason); }}>
        <input aria-label="Acknowledgment deadline" type="datetime-local" required value={dueAt} onChange={(event) => setDueAt(event.target.value)} className="rounded border border-border bg-background p-1" />
        <input aria-label="Reason for acknowledgment deadline" required maxLength={500} value={deadlineReason} onChange={(event) => setDeadlineReason(event.target.value)} className="rounded border border-border bg-background p-1" />
        <button type="submit" disabled={vm.busy} className="text-primary">Save deadline</button>
        <button type="button" onClick={() => setDeadlineRecipient(null)}>Close</button>
      </form> : null}
    </li>)}</ul> : null}
    {status === "failed" && !vm.queued ? <div className="mt-2 flex flex-wrap gap-2">
      <input aria-label="Reason for retry" value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Reason for retry" className="rounded border border-border bg-background px-2 py-1" />
      <button type="button" disabled={vm.busy || !reason.trim()} onClick={() => void vm.retry(reason)} className="rounded border border-border px-2 py-1">Retry failed deliveries</button>
    </div> : null}
    {vm.queued ? <p className="mt-1">Retry queued.</p> : null}
  </div>;
}
