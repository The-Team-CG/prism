"use client";

import { Button } from "@prism/ui/components/button";
import { Card, CardBody } from "../../workspace/views/sections/shell-ui";
import type { PrismOwnPrivacyRequest } from "@prism/types";
import {
  PRIVACY_REQUEST_EXPLANATION,
  PRIVACY_REQUEST_TYPES,
  privacyRequestDateLabel,
  privacyRequestStatusLabel,
  privacyRequestTypeLabel,
} from "../model/supplier-privacy-rules";
import { useSupplierPrivacyRequestsViewModel, type SupplierPrivacyRequestsViewModel } from "../view-models/use-supplier-privacy-requests-view-model";

export function SupplierPrivacyRequestsView() {
  const vm = useSupplierPrivacyRequestsViewModel();
  return (
    <div className="space-y-6">
      <PrivacyRequestForm vm={vm} />
      <PrivacyRequestList vm={vm} />
    </div>
  );
}

function PrivacyRequestForm({ vm }: { vm: SupplierPrivacyRequestsViewModel }) {
  const selected = PRIVACY_REQUEST_TYPES.find((option) => option.value === vm.requestType);
  return (
    <Card>
      <CardBody>
        <h2 className="mb-3 text-base font-semibold text-foreground">Submit a privacy request</h2>
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            void vm.submit();
          }}
        >
          <p className="text-sm text-muted-foreground">{PRIVACY_REQUEST_EXPLANATION}</p>
          <label className="block space-y-1.5 text-xs font-semibold text-muted-foreground">
            Request type
            <select
              value={vm.requestType}
              onChange={(event) => vm.setRequestType(event.target.value as typeof vm.requestType)}
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm font-normal text-foreground"
            >
              {PRIVACY_REQUEST_TYPES.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
            <span className="block font-normal">{selected?.description}</span>
          </label>
          <label className="block space-y-1.5 text-xs font-semibold text-muted-foreground">
            Details{vm.requestType === "correction" ? " (required)" : " (optional)"}
            <textarea
              value={vm.details}
              onChange={(event) => vm.setDetails(event.target.value)}
              maxLength={1000}
              rows={3}
              className="min-h-20 w-full rounded-md border border-border bg-background px-3 py-2 text-sm font-normal text-foreground"
            />
          </label>
          {vm.error ? <p role="alert" className="text-sm text-destructive">{vm.error}</p> : null}
          <Button type="submit" disabled={vm.busy} className="rounded-xl font-bold">
            {vm.busy ? "Submitting…" : "Submit request"}
          </Button>
        </form>
      </CardBody>
    </Card>
  );
}

function PrivacyRequestList({ vm }: { vm: SupplierPrivacyRequestsViewModel }) {
  if (vm.status === "loading") return <p className="text-sm text-muted-foreground">Loading your privacy requests…</p>;
  if (vm.loadError) return <p role="alert" className="text-sm text-destructive">{vm.loadError}</p>;
  if (vm.requests.length === 0) return <p className="text-sm text-muted-foreground">No privacy requests yet. Requests you submit appear here with their status and due date.</p>;
  return (
    <Card>
      <CardBody>
        <h2 className="mb-3 text-base font-semibold text-foreground">Your requests</h2>
        <ul className="divide-y divide-border">
          {vm.requests.map((request) => <PrivacyRequestRow key={request.id} request={request} />)}
        </ul>
      </CardBody>
    </Card>
  );
}

function PrivacyRequestRow({ request }: { request: PrismOwnPrivacyRequest }) {
  const closed = request.completedAt !== null;
  return (
    <li className="space-y-1 py-3 text-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="font-semibold text-foreground">{privacyRequestTypeLabel(request.type)} request</p>
        <p className="font-semibold text-foreground">{privacyRequestStatusLabel(request.status)}</p>
      </div>
      <p className="text-xs text-muted-foreground">
        Submitted {privacyRequestDateLabel(request.submittedAt)}
        {closed ? ` · Closed ${privacyRequestDateLabel(request.completedAt ?? request.dueAt)}` : ` · Due ${privacyRequestDateLabel(request.dueAt)}`}
      </p>
      <p className="text-xs text-muted-foreground">{request.outcomeMessage}</p>
    </li>
  );
}
