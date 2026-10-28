"use client";

import { useId, useState, type FormEvent } from "react";
import { formatPortalDate } from "@prism/ui/format-date";
import type { PrismClientChangeRequest, ScopeChangeCategory, SubmitScopeChangeRequestInput } from "@prism/types";
import { canWithdrawClientChangeRequest, clientChangeRequestStatusLabel, scopeChangeCategoryOptions } from "../model/client-change-request-rules";
import { useClientChangeRequestsViewModel } from "../view-models/use-client-change-requests-view-model";

export function ClientChangeRequestsPanel({ eventId }: { eventId: string }) {
  const vm = useClientChangeRequestsViewModel(eventId);
  const [formOpen, setFormOpen] = useState(false);

  return (
    <section aria-labelledby="client-change-requests-heading" className="space-y-3 rounded-lg border border-border bg-card p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id="client-change-requests-heading" className="text-base font-semibold">Change requests</h2>
          <p className="text-sm text-muted-foreground">Scope changes that affect your event and where each one stands.</p>
        </div>
        {vm.status === "ready" && !formOpen ? (
          <button type="button" onClick={() => setFormOpen(true)} aria-expanded={false} className="min-h-11 rounded-md border border-border px-3 text-sm font-medium text-foreground hover:bg-muted/40">
            Request a change
          </button>
        ) : null}
      </div>
      <ChangeRequestList vm={vm} />
      {vm.status === "ready" && formOpen ? (
        <ScopeChangeForm
          busy={vm.busy}
          onCancel={() => setFormOpen(false)}
          onSubmit={async (draft) => {
            const saved = await vm.submitScopeChange(draft);
            if (saved) setFormOpen(false);
            return saved;
          }}
        />
      ) : null}
    </section>
  );
}

type ChangeRequestsVm = ReturnType<typeof useClientChangeRequestsViewModel>;

function ChangeRequestList({ vm }: { vm: ChangeRequestsVm }) {
  if (vm.status === "loading") return <p role="status" className="text-sm text-muted-foreground">Loading change requests…</p>;
  if (vm.status === "error") return <p role="alert" className="text-sm text-destructive">{vm.error}</p>;
  if (vm.status !== "ready") return null;
  return (
    <>
      {vm.error ? <p role="alert" className="text-sm text-destructive">{vm.error}</p> : null}
      {vm.requests.length === 0 ? (
        <p className="text-sm text-muted-foreground">No change requests have been raised for your event.</p>
      ) : (
        <ul className="divide-y divide-border">
          {vm.requests.map((request) => (
            <ChangeRequestRow key={request.id} request={request} busy={vm.busy} onWithdraw={() => vm.withdrawScopeChange(request.id)} />
          ))}
        </ul>
      )}
    </>
  );
}

function ChangeRequestRow({ request, busy, onWithdraw }: { request: PrismClientChangeRequest; busy: boolean; onWithdraw: () => Promise<boolean> }) {
  return (
    <li className="space-y-1 py-3 text-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="min-w-0 break-words font-medium text-foreground">{request.requestedChange}</span>
        <span className="text-muted-foreground">
          {clientChangeRequestStatusLabel(request.status)} · Updated {formatPortalDate(request.updatedAt)}
        </span>
      </div>
      {request.clientResponse ? <p className="text-muted-foreground">{request.clientResponse}</p> : null}
      {canWithdrawClientChangeRequest(request) ? (
        <button type="button" disabled={busy} onClick={() => void onWithdraw()} className="min-h-11 text-sm font-medium text-foreground hover:text-primary disabled:opacity-50">
          Withdraw request
        </button>
      ) : null}
    </li>
  );
}

function ScopeChangeForm({ busy, onSubmit, onCancel }: { busy: boolean; onSubmit: (draft: SubmitScopeChangeRequestInput) => Promise<boolean>; onCancel: () => void }) {
  const ids = useId();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<ScopeChangeCategory>("other");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const saved = await onSubmit({ title, description, category });
    if (saved) { setTitle(""); setDescription(""); setCategory("other"); }
  }

  return (
    <form onSubmit={submit} aria-labelledby={`${ids}-title`} className="space-y-3 border-t border-border pt-4">
      <h3 id={`${ids}-title`} className="text-sm font-semibold text-foreground">Request a scope change</h3>
      <label className="block text-sm">
        <span className="text-muted-foreground">What would you like to change?</span>
        <input required value={title} onChange={(event) => setTitle(event.target.value)} className="mt-1 h-11 w-full rounded-md border border-border bg-card px-3 text-sm" />
      </label>
      <label className="block text-sm">
        <span className="text-muted-foreground">Details</span>
        <textarea required value={description} onChange={(event) => setDescription(event.target.value)} rows={3} className="mt-1 w-full rounded-md border border-border bg-card px-3 py-2 text-sm" />
      </label>
      <label className="block text-sm">
        <span className="text-muted-foreground">Area</span>
        <select value={category} onChange={(event) => setCategory(event.target.value as ScopeChangeCategory)} className="mt-1 h-11 w-full rounded-md border border-border bg-card px-3 text-sm sm:w-auto">
          {scopeChangeCategoryOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
        </select>
      </label>
      <div className="flex flex-wrap gap-2">
        <button type="submit" disabled={busy || !title.trim() || !description.trim()} className="h-11 rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:opacity-50">
          Send request
        </button>
        <button type="button" onClick={onCancel} className="h-11 rounded-md px-4 text-sm text-muted-foreground hover:text-foreground">
          Cancel
        </button>
      </div>
    </form>
  );
}
