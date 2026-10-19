"use client";

import { useState } from "react";
import type { PrismClientAddendumConforme } from "@prism/types";
import { addendumConformeNeedsAcknowledgement, clientAddendumConformeStatusLabel } from "../model/client-addendum-conforme-rules";
import { useClientAddendumConformesViewModel } from "../view-models/use-client-addendum-conformes-view-model";

/**
 * Addendum acknowledgement for the primary client. With `onlyWhenPending`, the panel stays hidden unless an
 * addendum is waiting on the client (used on the dashboard home next to the action center).
 */
export function ClientAddendumConformePanel({ eventId, onlyWhenPending = false }: { eventId: string; onlyWhenPending?: boolean }) {
  const vm = useClientAddendumConformesViewModel(eventId);
  const pending = vm.conformes.filter(addendumConformeNeedsAcknowledgement);
  if (onlyWhenPending && pending.length === 0) return null;
  const visible = onlyWhenPending ? pending : vm.conformes;

  return (
    <section id="addendum-conformes" aria-labelledby={`client-addendum-conformes-${eventId}`} className="space-y-3 rounded-xl border border-border bg-card p-5">
      <div>
        <h2 id={`client-addendum-conformes-${eventId}`} className="text-lg font-semibold">Addendum acknowledgements</h2>
        <p className="text-sm text-muted-foreground">Scope changes take effect, including billing, once you acknowledge the addendum and PMCM countersigns it.</p>
      </div>
      {vm.status === "loading" ? <p role="status" className="text-sm text-muted-foreground">Loading addenda…</p> : null}
      {vm.status === "error" ? <p role="alert" className="text-sm text-destructive">{vm.error}</p> : null}
      {vm.status === "ready" && vm.error ? <p role="alert" className="text-sm text-destructive">{vm.error}</p> : null}
      {vm.status === "ready" && visible.length === 0 ? <p className="text-sm text-muted-foreground">No addenda need your acknowledgement.</p> : null}
      {vm.status === "ready" && visible.length > 0 ? (
        <ul className="divide-y divide-border">
          {visible.map((conforme) => (
            <AddendumConformeRow key={conforme.id} conforme={conforme} busy={vm.busyId === conforme.id} onAcknowledge={(consent) => vm.acknowledge(conforme, consent)} />
          ))}
        </ul>
      ) : null}
    </section>
  );
}

function AddendumConformeRow({ conforme, busy, onAcknowledge }: { conforme: PrismClientAddendumConforme; busy: boolean; onAcknowledge: (consent: boolean) => Promise<boolean> }) {
  const [consent, setConsent] = useState(false);
  const needsAcknowledgement = addendumConformeNeedsAcknowledgement(conforme);
  return (
    <li className="space-y-2 py-3 text-sm" aria-label={`Addendum ${conforme.addendumVersionNumber}: ${conforme.addendumTitle}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <span>
          <strong>Addendum {conforme.addendumVersionNumber}: {conforme.addendumTitle}</strong>
          {conforme.addendumSummary ? <span className="block text-muted-foreground">{conforme.addendumSummary}</span> : null}
        </span>
        <span className="text-xs text-muted-foreground">{clientAddendumConformeStatusLabel(conforme.status)} · Document version {conforme.documentVersion}</span>
      </div>
      {needsAcknowledgement ? (
        <>
          <p className="whitespace-pre-wrap rounded-md border border-border bg-background p-3 text-foreground">{conforme.documentContent}</p>
          <label className="flex items-start gap-2">
            <input type="checkbox" checked={consent} onChange={(event) => setConsent(event.target.checked)} className="mt-0.5" />
            <span>I have reviewed this addendum and acknowledge the scope and billing changes it describes.</span>
          </label>
          <button type="button" disabled={busy || !consent} onClick={() => void onAcknowledge(consent)} className="rounded-md bg-primary px-3 py-1.5 text-sm font-semibold text-primary-foreground disabled:opacity-50">
            Acknowledge addendum
          </button>
        </>
      ) : null}
    </li>
  );
}
