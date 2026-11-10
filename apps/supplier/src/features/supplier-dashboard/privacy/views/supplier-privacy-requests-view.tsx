"use client";

import { Button } from "@prism/ui/components/button";
import { Field, FieldDescription, FieldLabel } from "@prism/ui/components/field";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@prism/ui/components/select";
import { Textarea } from "@prism/ui/components/textarea";
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
import { LoadingState } from "@prism/ui/components/loading-state";

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
          <Field>
            <FieldLabel htmlFor="privacy-request-type">Request type</FieldLabel>
            <Select value={vm.requestType} onValueChange={(value) => vm.setRequestType(value as typeof vm.requestType)}>
              <SelectTrigger id="privacy-request-type" className="w-full min-w-0">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PRIVACY_REQUEST_TYPES.map((option) => (
                  <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <FieldDescription>{selected?.description}</FieldDescription>
          </Field>
          <Field>
            <FieldLabel htmlFor="privacy-request-details">Details{vm.requestType === "correction" ? " (required)" : " (optional)"}</FieldLabel>
            <Textarea
              id="privacy-request-details"
              value={vm.details}
              onChange={(event) => vm.setDetails(event.target.value)}
              maxLength={1000}
              rows={3}
              className="min-h-20"
            />
          </Field>
          {vm.error ? <p role="alert" className="text-sm text-destructive">{vm.error}</p> : null}
          <Button type="submit" disabled={vm.busy} className="rounded-lg font-semibold">
            {vm.busy ? "Submitting…" : "Submit request"}
          </Button>
        </form>
      </CardBody>
    </Card>
  );
}

function PrivacyRequestList({ vm }: { vm: SupplierPrivacyRequestsViewModel }) {
  if (vm.status === "loading") return <LoadingState label="Loading your privacy requests…" />;
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
