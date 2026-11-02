"use client";
import { DateTimePicker } from "@prism/ui/components/date-time-picker";
import { formatPortalDateTime } from "@prism/ui/format-date";

import { useState, type FormEvent } from "react";
import { ChevronRight } from "lucide-react";
import type {
  PrismPmcmOcularVisit,
  ScheduleOcularVisitInput,
  WaiveOcularVisitInput,
} from "@prism/types";
import { Card, CardBody } from "./shell-ui";

function formatScheduledAt(scheduledAt: string | null) {
  return formatPortalDateTime(scheduledAt, "Date pending");
}

function statusLabel(visit: PrismPmcmOcularVisit | null) {
  if (!visit) return "Not requested";
  return visit.status[0].toUpperCase() + visit.status.slice(1);
}

function OcularVisitDetails({
  visit,
}: {
  visit: PrismPmcmOcularVisit | null;
}) {
  return (
    <>
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
    </>
  );
}

function OcularVisitActions({
  busy,
  canSchedule,
  canComplete,
  canWaive,
  formError,
  scheduledAtLocal,
  setScheduledAtLocal,
  waiverReason,
  setWaiverReason,
  onSchedule,
  onComplete,
  onWaive,
}: {
  busy: boolean;
  canSchedule: boolean;
  canComplete: boolean;
  canWaive: boolean;
  formError: string | null;
  scheduledAtLocal: string;
  setScheduledAtLocal: (value: string) => void;
  waiverReason: string;
  setWaiverReason: (value: string) => void;
  onSchedule: (event: FormEvent<HTMLFormElement>) => Promise<void>;
  onComplete: () => Promise<void>;
  onWaive: (event: FormEvent<HTMLFormElement>) => Promise<void>;
}) {
  return (
    <>
      {formError ? <p role="alert" className="text-sm text-destructive">{formError}</p> : null}

      {canSchedule ? (
        <form className="flex flex-wrap items-end gap-3" onSubmit={onSchedule}>
          <div className="min-w-56 flex-1">
            <label htmlFor="ocular-visit-scheduled-at" className="mb-1 block text-sm font-medium text-foreground">
              Scheduled date and time
            </label>
            <DateTimePicker value={scheduledAtLocal} onValueChange={(next) => setScheduledAtLocal(next)} id="ocular-visit-scheduled-at" required disabled={busy} />
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
        <form className="space-y-2 border-t border-border pt-4" onSubmit={onWaive}>
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
    </>
  );
}

/** The status row's one control: it opens the schedule, completion and waiver controls only when PMCM can act. */
function OcularVisitToggle({ expanded, canAct, onToggle }: { expanded: boolean; canAct: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      aria-expanded={expanded}
      aria-controls="ocular-visit-details"
      onClick={onToggle}
      className="inline-flex min-h-11 items-center gap-1 rounded-lg border border-border px-3 text-sm font-semibold text-foreground"
    >
      {expanded ? "Hide" : canAct ? "Manage visit" : "View details"}
      <ChevronRight className={"size-4 transition-transform " + (expanded ? "rotate-90" : "")} aria-hidden />
    </button>
  );
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
  const [expanded, setExpanded] = useState(false);
  const terminal = visit?.status === "completed" || visit?.status === "waived";
  const canSchedule = isAdmin && visit?.status === "requested";
  const canComplete = isAdmin && visit?.status === "scheduled";
  const canWaive = isAdmin && !terminal;
  const canAct = canSchedule || canComplete || canWaive;

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
      <CardBody className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-foreground">
            <span className="font-semibold">Ocular visit</span>
            <span className="mx-2 text-muted-foreground" aria-hidden>·</span>
            <span aria-label="Ocular visit status" className="font-semibold">{statusLabel(visit)}</span>
          </p>
          <OcularVisitToggle expanded={expanded} canAct={canAct} onToggle={() => setExpanded((open) => !open)} />
        </div>
        {expanded ? (
          <div id="ocular-visit-details" className="space-y-4 border-t border-border pt-4">
            <p className="text-xs text-muted-foreground">{eventName}</p>
            <OcularVisitDetails visit={visit} />
            <OcularVisitActions
              busy={busy}
              canSchedule={canSchedule}
              canComplete={canComplete}
              canWaive={canWaive}
              formError={formError}
              scheduledAtLocal={scheduledAtLocal}
              setScheduledAtLocal={setScheduledAtLocal}
              waiverReason={waiverReason}
              setWaiverReason={setWaiverReason}
              onSchedule={schedule}
              onComplete={onComplete}
              onWaive={waive}
            />
          </div>
        ) : null}
      </CardBody>
    </Card>
  );
}
