"use client";

import { ShieldCheck } from "lucide-react";
import { Button } from "@/app/components/ui/button";
import { EmptyState } from "@/app/components/ui/empty-state";
import { Card, CardBody, CardHeader } from "../../shared/tab-ui";
import {
  PRIVACY_REQUEST_EXPLANATION,
  PRIVACY_REQUEST_TYPES,
  privacyRequestDateLabel,
  privacyRequestStatusLabel,
  privacyRequestTypeLabel,
} from "../model/client-privacy-rules";
import { useClientPrivacyRequestsViewModel, type ClientPrivacyRequestsViewModel } from "../view-models/use-client-privacy-requests-view-model";
import type { PrismOwnPrivacyRequest } from "@prism/types";

export function ClientPrivacyRequestsView() {
  const vm = useClientPrivacyRequestsViewModel();
  return (
    <div className="space-y-6">
      <PrivacyRequestForm vm={vm} />
      <PrivacyRequestList vm={vm} />
    </div>
  );
}

function PrivacyRequestForm({ vm }: { vm: ClientPrivacyRequestsViewModel }) {
  const selected = PRIVACY_REQUEST_TYPES.find((option) => option.value === vm.requestType);
  return (
    <Card>
      <CardHeader>Submit a privacy request</CardHeader>
      <CardBody>
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

function PrivacyRequestList({ vm }: { vm: ClientPrivacyRequestsViewModel }) {
  if (vm.status === "loading") return <p className="text-sm text-muted-foreground">Loading your privacy requests…</p>;
  if (vm.loadError) return <p role="alert" className="text-sm text-destructive">{vm.loadError}</p>;
  if (vm.requests.length === 0) {
    return (
      <EmptyState
        icon={ShieldCheck}
        title="No privacy requests yet"
        description="Requests you submit appear here with their status and due date."
      />
    );
  }
  return (
    <Card>
      <CardHeader>Your requests</CardHeader>
      <CardBody>
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
