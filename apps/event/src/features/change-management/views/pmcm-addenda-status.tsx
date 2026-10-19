"use client";

import { useState, type FormEvent } from "react";
import type { PrismAddendum, PrismAddendumConformeExecution, PrismEventFreezeException } from "@prism/types";
import {
  addendumConformeStatusLabel,
  canCountersignAddendumConforme,
  canIssueAddendumConforme,
  latestAddendumConformes,
  nextAddendumConformeVersion,
} from "../register/model/change-register-rules";

type AddendumConformeActions = {
  busy: boolean;
  onIssueConforme: (addendumId: string, draft: { documentVersion: number; documentContent: string }) => Promise<boolean>;
  onCountersign: (conforme: PrismAddendumConformeExecution) => Promise<boolean>;
};

export function PmcmAddendaStatus({
  addenda,
  exceptions = [],
  conformes = [],
  actions,
}: {
  addenda: readonly PrismAddendum[];
  exceptions?: readonly PrismEventFreezeException[];
  conformes?: readonly PrismAddendumConformeExecution[];
  actions?: AddendumConformeActions;
}) {
  const latest = latestAddendumConformes(conformes);
  return (
    <section aria-labelledby="pmcm-addenda-status" className="space-y-4 rounded-xl border border-border bg-card p-5">
      <div>
        <h2 id="pmcm-addenda-status" className="text-lg font-semibold">Scope freeze and addenda</h2>
        <p className="text-sm text-muted-foreground">Issued versions remain immutable. Billing changes apply only after the client acknowledges the addendum conforme and PMCM countersigns it.</p>
      </div>
      {addenda.length === 0 ? <p className="text-sm text-muted-foreground">No addenda issued.</p> : (
        <ul className="space-y-3">
          {addenda.map((addendum) => (
            <AddendumRow key={addendum.id} addendum={addendum} latest={latest.get(addendum.id)} actions={actions} />
          ))}
        </ul>
      )}
      {exceptions.length > 0 ? <div className="border-t border-border pt-3"><h3 className="text-sm font-semibold">Freeze exceptions</h3><ul className="mt-2 space-y-2 text-sm">{exceptions.map((exception) => <li key={exception.id} className="flex justify-between"><span>{exception.requestedChange}</span><span className="text-muted-foreground">{exception.status}</span></li>)}</ul></div> : null}
    </section>
  );
}

function AddendumRow({ addendum, latest, actions }: { addendum: PrismAddendum; latest?: PrismAddendumConformeExecution; actions?: AddendumConformeActions }) {
  const activeConforme = latest && latest.status !== "superseded" ? latest : undefined;
  return (
    <li className="space-y-2 border-b border-border pb-3 text-sm" aria-label={`Addendum version ${addendum.versionNumber}`}>
      <div className="flex items-start justify-between gap-3">
        <span><strong>Version {addendum.versionNumber}: {addendum.title}</strong><br /><span className="text-muted-foreground">{addendum.summary || "Scope change recorded"}</span></span>
        <span className="text-right text-xs text-muted-foreground">
          {addendum.signatureMethod === "in_app_conforme" ? "In-app conforme" : "Scanned document"}<br />
          {addendum.documentState === "pending" ? "Document pending" : "Document available"}
        </span>
      </div>
      <p className="text-xs font-semibold text-foreground">{addendumConformeStatusLabel(addendum, activeConforme)}</p>
      {activeConforme ? <p className="text-xs text-muted-foreground">Document hash {activeConforme.documentSha256.slice(0, 12)}…</p> : null}
      {actions && canCountersignAddendumConforme(activeConforme) && activeConforme ? (
        <button type="button" disabled={actions.busy} onClick={() => void actions.onCountersign(activeConforme)} className="rounded-md bg-primary px-3 py-1.5 text-sm font-semibold text-primary-foreground disabled:opacity-50">
          Countersign version {activeConforme.documentVersion}
        </button>
      ) : null}
      {actions && canIssueAddendumConforme(addendum, latest) ? (
        <IssueConformeForm addendum={addendum} documentVersion={nextAddendumConformeVersion(latest)} replacing={Boolean(activeConforme)} actions={actions} />
      ) : null}
    </li>
  );
}

function IssueConformeForm({ addendum, documentVersion, replacing, actions }: { addendum: PrismAddendum; documentVersion: number; replacing: boolean; actions: AddendumConformeActions }) {
  const [documentContent, setDocumentContent] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const saved = await actions.onIssueConforme(addendum.id, { documentVersion, documentContent });
    if (saved) setDocumentContent("");
  }
  return (
    <form onSubmit={submit} className="space-y-2" aria-label={`Issue addendum conforme for version ${addendum.versionNumber}`}>
      <label className="block">
        <span className="text-muted-foreground">{replacing ? `Replace unsigned conforme with version ${documentVersion}` : `Addendum conforme text (version ${documentVersion})`}</span>
        <textarea required value={documentContent} onChange={(event) => setDocumentContent(event.target.value)} rows={4} className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm" />
      </label>
      <button type="submit" disabled={actions.busy || documentContent.trim().length < 20} className="rounded-md border border-border px-3 py-1.5 text-sm font-semibold disabled:opacity-50">
        Issue for client acknowledgement
      </button>
    </form>
  );
}
