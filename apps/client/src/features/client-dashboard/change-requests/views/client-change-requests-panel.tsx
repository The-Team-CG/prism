"use client";

import type { PrismClientChangeRequest } from "@prism/types";
import { clientChangeRequestStatusLabel } from "../model/client-change-request-rules";
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
      {vm.status === "ready" && vm.requests.length === 0 ? <p className="text-sm text-muted-foreground">No change requests have been raised for your event.</p> : null}
      {vm.status === "ready" && vm.requests.length > 0 ? (
        <ul className="divide-y divide-border">
          {vm.requests.map((request) => <ChangeRequestRow key={request.id} request={request} />)}
        </ul>
      ) : null}
    </section>
  );
}

function ChangeRequestRow({ request }: { request: PrismClientChangeRequest }) {
  return (
    <li className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm">
      <span className="font-medium text-foreground">{request.requestedChange}</span>
      <span className="text-muted-foreground">
        {clientChangeRequestStatusLabel(request.status)} · Updated {new Date(request.updatedAt).toLocaleDateString()}
      </span>
    </li>
  );
}
