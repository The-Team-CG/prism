"use client";

import type { PrismAddendum } from "@prism/types";
import { addendaAwaitingClientAcknowledgment, addendumConformeStatusLabel } from "../model/client-addenda-rules";
import { useClientAddendaViewModel } from "../view-models/use-client-addenda-view-model";

export function ClientAddendaStatus({ eventId }: { eventId: string }) {
  const vm = useClientAddendaViewModel(eventId);
  const awaiting = addendaAwaitingClientAcknowledgment(vm.addenda);

  return (
    <section aria-labelledby="client-addenda-status" className="space-y-3 rounded-xl border border-border bg-card p-5">
      <div>
        <h2 id="client-addenda-status" className="text-lg font-semibold">Addendum status</h2>
        <p className="text-sm text-muted-foreground">Review the scope changes issued for your event. Acknowledge each addendum conforme once you have read the version PMCM issued.</p>
      </div>
      {vm.status === "loading" ? <p role="status" className="text-sm text-muted-foreground">Loading addenda…</p> : null}
      {vm.status === "error" || vm.error ? <p role="alert" className="text-sm text-destructive">{vm.error}</p> : null}
      {vm.status === "ready" && vm.addenda.length === 0 ? <p className="text-sm text-muted-foreground">No addenda have been issued.</p> : null}
      {vm.status === "ready" && vm.addenda.length > 0 ? (
        <ul className="space-y-3">
          {vm.addenda.map((addendum) => (
            <AddendumRow
              key={addendum.id}
              addendum={addendum}
              awaiting={awaiting.some((item) => item.id === addendum.id)}
              consentAccepted={vm.consentAccepted(addendum.id)}
              signing={vm.signingAddendumId === addendum.id}
              onConsentChange={(accepted) => vm.setConsentAccepted(addendum.id, accepted)}
              onAcknowledge={() => vm.acknowledge(addendum)}
            />
          ))}
        </ul>
      ) : null}
    </section>
  );
}

function AddendumRow({
  addendum,
  awaiting,
  consentAccepted,
  signing,
  onConsentChange,
  onAcknowledge,
}: {
  addendum: PrismAddendum;
  awaiting: boolean;
  consentAccepted: boolean;
  signing: boolean;
  onConsentChange: (accepted: boolean) => void;
  onAcknowledge: () => void;
}) {
  return (
    <li className="space-y-2 border-b border-border pb-3 text-sm">
      <strong>Version {addendum.versionNumber}: {addendum.title}</strong>
      <p className="text-muted-foreground">{addendum.summary || "Scope change recorded"}</p>
      <p className="text-xs text-muted-foreground">
        {addendum.documentState === "pending" ? "Document pending" : "Document available"} · Issued {new Date(addendum.issuedAt).toLocaleDateString()}
      </p>
      <p className="text-xs text-muted-foreground">{addendumConformeStatusLabel(addendum.conforme)}</p>
      {awaiting && addendum.conforme ? (
        <div className="space-y-2">
          <pre className="max-h-64 overflow-auto whitespace-pre-wrap rounded-md border border-border bg-background p-3 text-xs">{addendum.conforme.documentContent}</pre>
          <label className="flex items-start gap-2 text-sm">
            <input type="checkbox" checked={consentAccepted} onChange={(event) => onConsentChange(event.target.checked)} className="mt-1" />
            <span>I have reviewed this addendum conforme and acknowledge the scope and financial changes it describes.</span>
          </label>
          <button
            type="button"
            disabled={!consentAccepted || signing}
            onClick={onAcknowledge}
            className="rounded-md bg-primary px-3 py-1.5 text-sm font-semibold text-primary-foreground disabled:opacity-50"
          >
            {signing ? "Recording…" : "Acknowledge addendum"}
          </button>
        </div>
      ) : null}
    </li>
  );
}
