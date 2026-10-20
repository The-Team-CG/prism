"use client";

import { useState, type FormEvent } from "react";
import type { PrismClientChangeRequest, ScopeChangeCategory, SubmitScopeChangeRequestInput } from "@prism/types";
import { canWithdrawClientChangeRequest, clientChangeRequestStatusLabel, scopeChangeCategoryOptions } from "../model/client-change-request-rules";
import { useClientChangeRequestsViewModel } from "../view-models/use-client-change-requests-view-model";

export function ClientChangeRequestsPanel({ eventId }: { eventId: string }) {
  const vm = useClientChangeRequestsViewModel(eventId);

  return (
    <section aria-labelledby="client-change-requests-heading" className="space-y-3 rounded-xl border border-border bg-card p-5">
      <div>
        <h2 id="client-change-requests-heading" className="text-lg font-semibold">Change requests</h2>
        <p className="text-sm text-muted-foreground">Scope changes that affect your event and where each one stands.</p>
      </div>
      {vm.status === "loading" ? <p role="status" className="text-sm text-muted-foreground">Loading change requests…</p> : null}
      {vm.status === "error" ? <p role="alert" className="text-sm text-destructive">{vm.error}</p> : null}
      {vm.status === "ready" && vm.error ? <p role="alert" className="text-sm text-destructive">{vm.error}</p> : null}
      {vm.status === "ready" && vm.requests.length === 0 ? <p className="text-sm text-muted-foreground">No change requests have been raised for your event.</p> : null}
      {vm.status === "ready" && vm.requests.length > 0 ? (
        <ul className="divide-y divide-border">
          {vm.requests.map((request) => (
            <ChangeRequestRow key={request.id} request={request} busy={vm.busy} onWithdraw={() => vm.withdrawScopeChange(request.id)} />
          ))}
        </ul>
      ) : null}
      {vm.status === "ready" ? <ScopeChangeForm busy={vm.busy} onSubmit={(draft) => vm.submitScopeChange(draft)} /> : null}
    </section>
  );
}

function ChangeRequestRow({ request, busy, onWithdraw }: { request: PrismClientChangeRequest; busy: boolean; onWithdraw: () => Promise<boolean> }) {
  return (
    <li className="space-y-1 py-3 text-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="font-medium text-foreground">{request.requestedChange}</span>
        <span className="text-muted-foreground">
          {clientChangeRequestStatusLabel(request.status)} · Updated {new Date(request.updatedAt).toLocaleDateString()}
        </span>
      </div>
      {request.clientResponse ? <p className="text-muted-foreground">{request.clientResponse}</p> : null}
      {canWithdrawClientChangeRequest(request) ? (
        <button type="button" disabled={busy} onClick={() => void onWithdraw()} className="text-sm font-semibold text-foreground disabled:opacity-50">
          Withdraw request
        </button>
      ) : null}
    </li>
  );
}

function ScopeChangeForm({ busy, onSubmit }: { busy: boolean; onSubmit: (draft: SubmitScopeChangeRequestInput) => Promise<boolean> }) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<ScopeChangeCategory>("other");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const saved = await onSubmit({ title, description, category });
    if (saved) { setTitle(""); setDescription(""); setCategory("other"); }
  }

  return (
    <form onSubmit={submit} aria-label="Request a scope change" className="space-y-3 border-t border-border pt-4">
      <h3 className="text-sm font-semibold text-foreground">Request a scope change</h3>
      <label className="block text-sm">
        <span className="text-muted-foreground">What would you like to change?</span>
        <input required value={title} onChange={(event) => setTitle(event.target.value)} className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm" />
      </label>
      <label className="block text-sm">
        <span className="text-muted-foreground">Details</span>
        <textarea required value={description} onChange={(event) => setDescription(event.target.value)} rows={3} className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm" />
      </label>
      <label className="block text-sm">
        <span className="text-muted-foreground">Area</span>
        <select value={category} onChange={(event) => setCategory(event.target.value as ScopeChangeCategory)} className="mt-1 rounded-md border border-border bg-background px-3 py-2 text-sm">
          {scopeChangeCategoryOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
        </select>
      </label>
      <button type="submit" disabled={busy || !title.trim() || !description.trim()} className="rounded-md bg-primary px-3 py-1.5 text-sm font-semibold text-primary-foreground disabled:opacity-50">
        Send request
      </button>
    </form>
  );
}
