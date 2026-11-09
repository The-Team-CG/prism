"use client";

import { ShieldCheck } from "lucide-react";
import { Button } from "@prism/ui/components/button";
import { Card, CardContent, CardHeader, CardTitle } from "@prism/ui/components/card";
import { Field, FieldDescription, FieldLabel } from "@prism/ui/components/field";
import { Item, ItemContent, ItemDescription, ItemGroup, ItemTitle } from "@prism/ui/components/item";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@prism/ui/components/select";
import { Textarea } from "@prism/ui/components/textarea";
import { ClientListEmpty } from "../../shared/client-list-ui";
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
      <CardHeader>
        <CardTitle className="text-base">Submit a privacy request</CardTitle>
      </CardHeader>
      <CardContent>
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
            <Select
              value={vm.requestType}
              onValueChange={(value) => {
                const option = PRIVACY_REQUEST_TYPES.find((candidate) => candidate.value === value);
                if (option) vm.setRequestType(option.value);
              }}
            >
              <SelectTrigger id="privacy-request-type" className="w-full min-w-0">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PRIVACY_REQUEST_TYPES.map((option) => (
                  <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selected?.description ? <FieldDescription>{selected.description}</FieldDescription> : null}
          </Field>
          <Field>
            <FieldLabel htmlFor="privacy-request-details">{vm.requestType === "correction" ? "Details (required)" : "Details (optional)"}</FieldLabel>
            <Textarea
              id="privacy-request-details"
              value={vm.details}
              onChange={(event) => vm.setDetails(event.target.value)}
              maxLength={1000}
              rows={3}
            />
          </Field>
          {vm.error ? <p role="alert" className="text-sm text-destructive">{vm.error}</p> : null}
          <Button type="submit" disabled={vm.busy}>
            {vm.busy ? "Submitting…" : "Submit request"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

function PrivacyRequestList({ vm }: { vm: ClientPrivacyRequestsViewModel }) {
  if (vm.status === "loading") return <p className="text-sm text-muted-foreground">Loading your privacy requests…</p>;
  if (vm.loadError) return <p role="alert" className="text-sm text-destructive">{vm.loadError}</p>;
  if (vm.requests.length === 0) {
    return (
      <ClientListEmpty
        icon={ShieldCheck}
        title="No privacy requests yet"
        description="Requests you submit appear here with their status and due date."
      />
    );
  }
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Your requests</CardTitle>
      </CardHeader>
      <CardContent>
        <ItemGroup>
          {vm.requests.map((request) => <PrivacyRequestRow key={request.id} request={request} />)}
        </ItemGroup>
      </CardContent>
    </Card>
  );
}

function PrivacyRequestRow({ request }: { request: PrismOwnPrivacyRequest }) {
  const closed = request.completedAt !== null;
  return (
    <Item variant="outline" size="sm">
      <ItemContent>
        <ItemTitle>{privacyRequestTypeLabel(request.type)} request · {privacyRequestStatusLabel(request.status)}</ItemTitle>
        <ItemDescription>
          Submitted {privacyRequestDateLabel(request.submittedAt)}
          {closed ? ` · Closed ${privacyRequestDateLabel(request.completedAt ?? request.dueAt)}` : ` · Due ${privacyRequestDateLabel(request.dueAt)}`}
        </ItemDescription>
        {request.outcomeMessage ? <ItemDescription>{request.outcomeMessage}</ItemDescription> : null}
      </ItemContent>
    </Item>
  );
}
