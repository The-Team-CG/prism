"use client";

import { useState, type FormEvent } from "react";
import type { PrismEventFreezeException } from "@prism/types";
import { useChangeRegisterViewModel } from "../view-models/use-change-register-view-model";
import { freezeExceptionStatusLabel, pendingFreezeExceptions } from "../model/change-register-rules";
import { PmcmAddendaStatus } from "../../views/pmcm-addenda-status";
import { RecordDecisionForm } from "./record-decision-form";

export function ChangeRegisterPanel({ eventId, frozen }: { eventId: string; frozen: boolean }) {
  const vm = useChangeRegisterViewModel(eventId, { frozen });

  return (
    <section aria-labelledby="change-register-heading" className="space-y-5 rounded-xl border border-border bg-card p-5">
      <header>
        <h2 id="change-register-heading" className="text-base font-bold text-foreground">Risk and change register</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {frozen
            ? "Scope is frozen. Scope changes need an approved freeze exception with a reason before a decision or addendum is recorded."
            : "Freeze scope once the brief is agreed. Changes after the freeze go through an exception request."}
        </p>
      </header>

      {vm.status === "loading" ? <p role="status" className="text-sm text-muted-foreground">Loading register…</p> : null}
      {vm.status === "error" ? (
        <div className="flex flex-wrap items-center gap-3">
          <p role="alert" className="text-sm text-destructive">{vm.error}</p>
          <button type="button" onClick={() => void vm.reload()} className="rounded-md border border-border px-3 py-1.5 text-sm font-semibold">Retry</button>
        </div>
      ) : null}
      {vm.status === "ready" && vm.error ? <p role="alert" className="text-sm text-destructive">{vm.error}</p> : null}

      {vm.status === "ready" ? (
        <>
          {!frozen ? <FreezeScopeForm busy={vm.busy} onSubmit={(reason, deadline) => vm.freezeScope(reason, deadline)} /> : null}
          {frozen ? <RequestExceptionForm busy={vm.busy} onSubmit={(draft) => vm.requestException(draft)} /> : null}
          <ExceptionRegister
            exceptions={vm.exceptions}
            busy={vm.busy}
            onApprove={(id) => vm.approveException(id)}
            onReject={(id, note) => vm.rejectException(id, note)}
          />
          <RecordDecisionForm frozen={frozen} approvedExceptions={vm.approvedExceptions} busy={vm.busy} onSubmit={(draft) => vm.recordDecision(draft)} />
          <PmcmAddendaStatus addenda={vm.addenda} />
        </>
      ) : null}
    </section>
  );
}

function FreezeScopeForm({ busy, onSubmit }: { busy: boolean; onSubmit: (reason: string, deadline?: string) => Promise<boolean> }) {
  const [reason, setReason] = useState("");
  const [deadline, setDeadline] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const saved = await onSubmit(reason, deadline || undefined);
    if (saved) { setReason(""); setDeadline(""); }
  }
  return (
    <form onSubmit={submit} className="space-y-3 border-t border-border pt-4" aria-label="Freeze scope">
      <h3 className="text-sm font-semibold text-foreground">Freeze scope</h3>
      <label className="block text-sm">
        <span className="text-muted-foreground">Reason for freezing</span>
        <input required value={reason} onChange={(event) => setReason(event.target.value)} className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm" />
      </label>
      <label className="block text-sm">
        <span className="text-muted-foreground">Freeze deadline (optional)</span>
        <input type="date" value={deadline} onChange={(event) => setDeadline(event.target.value)} className="mt-1 rounded-md border border-border bg-background px-3 py-2 text-sm" />
      </label>
      <button type="submit" disabled={busy || !reason.trim()} className="rounded-md bg-primary px-3 py-1.5 text-sm font-semibold text-primary-foreground disabled:opacity-50">Freeze scope</button>
    </form>
  );
}

function RequestExceptionForm({ busy, onSubmit }: { busy: boolean; onSubmit: (draft: { requestedChange: string; reason: string }) => Promise<boolean> }) {
  const [requestedChange, setRequestedChange] = useState("");
  const [reason, setReason] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const saved = await onSubmit({ requestedChange, reason });
    if (saved) { setRequestedChange(""); setReason(""); }
  }
  return (
    <form onSubmit={submit} className="space-y-3 border-t border-border pt-4" aria-label="Request freeze exception">
      <h3 className="text-sm font-semibold text-foreground">Request a freeze exception</h3>
      <label className="block text-sm">
        <span className="text-muted-foreground">Requested change</span>
        <input required value={requestedChange} onChange={(event) => setRequestedChange(event.target.value)} className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm" />
      </label>
      <label className="block text-sm">
        <span className="text-muted-foreground">Reason</span>
        <input required value={reason} onChange={(event) => setReason(event.target.value)} className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm" />
      </label>
      <button type="submit" disabled={busy || !requestedChange.trim() || !reason.trim()} className="rounded-md border border-border px-3 py-1.5 text-sm font-semibold disabled:opacity-50">Request exception</button>
    </form>
  );
}

function ExceptionRegister({
  exceptions,
  busy,
  onApprove,
  onReject,
}: {
  exceptions: readonly PrismEventFreezeException[];
  busy: boolean;
  onApprove: (id: string) => Promise<boolean>;
  onReject: (id: string, note: string) => Promise<boolean>;
}) {
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const pending = pendingFreezeExceptions(exceptions);

  async function reject(id: string) {
    const saved = await onReject(id, note);
    if (saved) { setRejectingId(null); setNote(""); }
  }

  if (exceptions.length === 0) return <p className="border-t border-border pt-4 text-sm text-muted-foreground">No freeze exception requests recorded.</p>;

  return (
    <div className="border-t border-border pt-4">
      <h3 className="text-sm font-semibold text-foreground">Freeze exceptions ({pending.length} awaiting decision)</h3>
      <ul className="mt-3 divide-y divide-border rounded-lg border border-border">
        {exceptions.map((exception) => (
          <li key={exception.id} className="space-y-2 p-3 text-sm">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="font-semibold text-foreground">{exception.requestedChange}</p>
                <p className="text-muted-foreground">Reason: {exception.reason}</p>
                {exception.decisionNote ? <p className="text-muted-foreground">Decision note: {exception.decisionNote}</p> : null}
              </div>
              <span className="text-xs font-semibold text-muted-foreground">{freezeExceptionStatusLabel(exception)}</span>
            </div>
            {exception.status === "pending" ? (
              rejectingId === exception.id ? (
                <div className="space-y-2">
                  <label className="block">
                    <span className="text-muted-foreground">Reason for rejecting</span>
                    <input required value={note} onChange={(event) => setNote(event.target.value)} className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm" />
                  </label>
                  <div className="flex gap-2">
                    <button type="button" disabled={busy || !note.trim()} onClick={() => void reject(exception.id)} className="rounded-md border border-border px-3 py-1.5 text-sm font-semibold disabled:opacity-50">Confirm rejection</button>
                    <button type="button" onClick={() => { setRejectingId(null); setNote(""); }} className="rounded-md px-3 py-1.5 text-sm text-muted-foreground">Cancel</button>
                  </div>
                </div>
              ) : (
                <div className="flex gap-2">
                  <button type="button" disabled={busy} onClick={() => void onApprove(exception.id)} className="rounded-md bg-primary px-3 py-1.5 text-sm font-semibold text-primary-foreground disabled:opacity-50">Approve</button>
                  <button type="button" disabled={busy} onClick={() => setRejectingId(exception.id)} className="rounded-md border border-border px-3 py-1.5 text-sm font-semibold disabled:opacity-50">Reject</button>
                </div>
              )
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}
