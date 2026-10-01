"use client";

import { useState, type FormEvent } from "react";
import type {
  PrismPmcmOcularVisit,
  ScheduleOcularVisitInput,
  WaiveOcularVisitInput,
} from "@prism/types";
import { Card, CardBody, CardHeader } from "./shell-ui";

function formatScheduledAt(scheduledAt: string | null) {
  if (!scheduledAt) return "Date pending";
  const date = new Date(scheduledAt);
  if (Number.isNaN(date.getTime())) return "Date pending";
  return new Intl.DateTimeFormat("en-PH", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function statusLabel(visit: PrismPmcmOcularVisit | null) {
  if (!visit) return "Not requested";
  return visit.status[0].toUpperCase() + visit.status.slice(1);
}

export function EventOcularVisitTask({
  eventName,
  visit,
  isAdmin,
  busy,
  onSchedule,
  onComplete,
  onWaive,
}: {
  eventName: string;
  visit: PrismPmcmOcularVisit | null;
  isAdmin: boolean;
  busy: boolean;
  onSchedule: (input: ScheduleOcularVisitInput) => Promise<void>;
  onComplete: () => Promise<void>;
  onWaive: (input: WaiveOcularVisitInput) => Promise<void>;
}) {
  const [scheduledAtLocal, setScheduledAtLocal] = useState("");
  const [waiverReason, setWaiverReason] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const terminal = visit?.status === "completed" || visit?.status === "waived";
  const canSchedule = isAdmin && visit?.status === "requested";
  const canComplete = isAdmin && visit?.status === "scheduled";
  const canWaive = isAdmin && !terminal;

  async function schedule(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const date = new Date(scheduledAtLocal);
    if (!scheduledAtLocal || Number.isNaN(date.getTime())) {
      setFormError("Choose a valid date and time.");
      return;
    }
    setFormError(null);
    await onSchedule({ scheduledAt: date.toISOString() });
  }

  async function waive(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const reason = waiverReason.trim();
    if (!reason) {
      setFormError("Enter a reason before waiving the visit.");
      return;
    }
    setFormError(null);
    await onWaive({ reason });
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-black text-foreground">Ocular visit task</h2>
            <p className="mt-1 text-xs text-muted-foreground">{eventName}</p>
          </div>
          <span className="rounded-full bg-muted px-3 py-1 text-xs font-semibold text-foreground" aria-label="Ocular visit status">
            {statusLabel(visit)}
          </span>
        </div>
      </CardHeader>
      <CardBody className="space-y-4">
        {visit?.clientNote ? (
          <div>
            <p className="text-xs font-semibold text-muted-foreground">Client note</p>
            <p className="mt-1 whitespace-pre-wrap text-sm text-foreground">{visit.clientNote}</p>
          </div>
        ) : null}

        {visit?.status === "scheduled" ? (
          <p className="text-sm text-muted-foreground">
            Scheduled for {formatScheduledAt(visit.scheduledAt)}.
          </p>
        ) : null}
        {visit?.status === "completed" ? (
          <p className="text-sm text-muted-foreground">
            Completed {visit.completedAt ? formatScheduledAt(visit.completedAt) : "with no timestamp"}.
          </p>
        ) : null}
        {visit?.status === "waived" ? (
          <div>
            <p className="text-xs font-semibold text-muted-foreground">Waiver reason</p>
            <p className="mt-1 whitespace-pre-wrap text-sm text-foreground">{visit.waiverReason}</p>
          </div>
        ) : null}
        {!visit ? (
          <p className="text-sm text-muted-foreground">
            No client request is on file. An Admin may record a waiver if the venue does not require a visit.
          </p>
        ) : null}

        {formError ? <p role="alert" className="text-sm text-destructive">{formError}</p> : null}

        {canSchedule ? (
          <form className="flex flex-wrap items-end gap-3" onSubmit={schedule}>
            <div className="min-w-56 flex-1">
              <label htmlFor="ocular-visit-scheduled-at" className="mb-1 block text-sm font-medium text-foreground">
                Scheduled date and time
              </label>
              <input
                id="ocular-visit-scheduled-at"
                type="datetime-local"
                value={scheduledAtLocal}
                onChange={(event) => setScheduledAtLocal(event.target.value)}
                required
                disabled={busy}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
              />
            </div>
            <button
              type="submit"
              disabled={busy || !scheduledAtLocal}
              className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:cursor-not-allowed disabled:opacity-60"
            >
              {busy ? "Saving…" : "Schedule visit"}
            </button>
          </form>
        ) : null}

        {canComplete ? (
          <button
            type="button"
            onClick={() => void onComplete()}
            disabled={busy}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:cursor-not-allowed disabled:opacity-60"
          >
            {busy ? "Saving…" : "Mark ocular visit complete"}
          </button>
        ) : null}

        {canWaive ? (
          <form className="space-y-2 border-t border-border pt-4" onSubmit={waive}>
            <label htmlFor="ocular-visit-waiver-reason" className="block text-sm font-medium text-foreground">
              Waiver reason
            </label>
            <textarea
              id="ocular-visit-waiver-reason"
              value={waiverReason}
              onChange={(event) => setWaiverReason(event.target.value)}
              rows={2}
              required
              disabled={busy}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
            />
            <button
              type="submit"
              disabled={busy || !waiverReason.trim()}
              className="rounded-lg border border-border px-4 py-2 text-sm font-semibold text-foreground disabled:cursor-not-allowed disabled:opacity-60"
            >
              {busy ? "Saving…" : "Waive ocular visit"}
            </button>
          </form>
        ) : null}
      </CardBody>
    </Card>
  );
}
