"use client";

import { useId, useState, type FormEvent } from "react";
import { formatPortalDate } from "@prism/ui/format-date";
import { Button } from "@prism/ui/components/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@prism/ui/components/card";
import { Field, FieldLabel } from "@prism/ui/components/field";
import { Input } from "@prism/ui/components/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@prism/ui/components/select";
import { Textarea } from "@prism/ui/components/textarea";
import type { PrismClientChangeRequest, ScopeChangeCategory, SubmitScopeChangeRequestInput } from "@prism/types";
import { canWithdrawClientChangeRequest, clientChangeRequestStatusLabel, scopeChangeCategoryOptions } from "../model/client-change-request-rules";
import { useClientChangeRequestsViewModel } from "../view-models/use-client-change-requests-view-model";

export function ClientChangeRequestsPanel({ eventId }: { eventId: string }) {
  const vm = useClientChangeRequestsViewModel(eventId);
  const [formOpen, setFormOpen] = useState(false);

  return (
    <section aria-labelledby="client-change-requests-heading">
      <Card>
        <CardHeader>
          <CardTitle id="client-change-requests-heading" className="text-base">Change requests</CardTitle>
          <CardDescription>Scope changes that affect your event and where each one stands.</CardDescription>
          {vm.status === "ready" && !formOpen ? (
            <CardAction>
              <Button type="button" variant="outline" onClick={() => setFormOpen(true)} aria-expanded={false}>
                Request a change
              </Button>
            </CardAction>
          ) : null}
        </CardHeader>
        <CardContent className="space-y-3">
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
        </CardContent>
      </Card>
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
        <Button type="button" variant="ghost" size="sm" disabled={busy} onClick={() => void onWithdraw()} className="px-0">
          Withdraw request
        </Button>
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
      <Field>
        <FieldLabel htmlFor={`${ids}-title-input`}>What would you like to change?</FieldLabel>
        <Input id={`${ids}-title-input`} required value={title} onChange={(event) => setTitle(event.target.value)} />
      </Field>
      <Field>
        <FieldLabel htmlFor={`${ids}-details`}>Details</FieldLabel>
        <Textarea id={`${ids}-details`} required value={description} onChange={(event) => setDescription(event.target.value)} rows={3} />
      </Field>
      <Field>
        <FieldLabel htmlFor={`${ids}-area`}>Area</FieldLabel>
        <Select
          value={category}
          onValueChange={(value) => {
            const option = scopeChangeCategoryOptions.find((candidate) => candidate.value === value);
            if (option) setCategory(option.value);
          }}
        >
          <SelectTrigger id={`${ids}-area`} className="w-full min-w-0 sm:w-auto">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {scopeChangeCategoryOptions.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </Field>
      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={busy || !title.trim() || !description.trim()}>
          Send request
        </Button>
        <Button type="button" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
