"use client";

import { useState } from "react";
import type { PrismAddendum, PrismEventFreezeException } from "@prism/types";
import { addendumConformeAction } from "../register/model/change-register-rules";

export function PmcmAddendaStatus({
  addenda,
  exceptions = [],
  busy = false,
  onRequestConforme,
  onCountersign,
  onWithdraw,
}: {
  addenda: readonly PrismAddendum[];
  exceptions?: readonly PrismEventFreezeException[];
  busy?: boolean;
  onRequestConforme?: (addendumId: string) => Promise<boolean>;
  onCountersign?: (addendum: PrismAddendum) => Promise<boolean>;
  onWithdraw?: (addendum: PrismAddendum, reason: string) => Promise<boolean>;
}) {
  return (
    <section aria-labelledby="pmcm-addenda-status" className="space-y-4 rounded-lg border border-border bg-card p-5">
      <div>
        <h2 id="pmcm-addenda-status" className="text-lg font-semibold">Scope freeze and addenda</h2>
        <p className="text-sm text-muted-foreground">An issued version can't be edited. Billing and quote amounts change only when the addendum is countersigned.</p>
      </div>
      {addenda.length === 0 ? <p className="text-sm text-muted-foreground">No addenda issued.</p> : (
        <ul className="space-y-3">
          {addenda.map((addendum) => (
            <AddendumRow key={addendum.id} addendum={addendum} busy={busy} onRequestConforme={onRequestConforme} onCountersign={onCountersign} onWithdraw={onWithdraw} />
          ))}
        </ul>
      )}
      {exceptions.length > 0 ? <div className="border-t border-border pt-3"><h3 className="text-sm font-semibold">Freeze exceptions</h3><ul className="mt-2 space-y-2 text-sm">{exceptions.map((exception) => <li key={exception.id} className="flex justify-between"><span>{exception.requestedChange}</span><span className="text-muted-foreground">{exception.status}</span></li>)}</ul></div> : null}
    </section>
  );
}

function AddendumRow({
  addendum,
  busy,
  onRequestConforme,
  onCountersign,
  onWithdraw,
}: {
  addendum: PrismAddendum;
  busy: boolean;
  onRequestConforme?: (addendumId: string) => Promise<boolean>;
  onCountersign?: (addendum: PrismAddendum) => Promise<boolean>;
  onWithdraw?: (addendum: PrismAddendum, reason: string) => Promise<boolean>;
}) {
  return (
    <li className="space-y-2 border-b border-border pb-3 text-sm">
      <div className="flex items-center justify-between gap-3">
        <span>
          <strong>Version {addendum.versionNumber}: {addendum.title}</strong>
          <br />
          <span className="text-muted-foreground">{addendum.summary || "Scope change recorded"}</span>
        </span>
        <span className="text-right text-xs text-muted-foreground">
          {addendum.signatureMethod === "scanned_document" ? "Scanned document" : addendum.signatureMethod}
          <br />
          {addendum.documentState === "pending" ? "Document pending" : "Document available"}
        </span>
      </div>
      <p className="text-xs font-medium">{addendumStateText(addendum)}</p>
      {addendum.status !== "withdrawn" ? <p className="text-xs text-muted-foreground">{addendumConformeStatusText(addendum)}</p> : null}
      <ConformeAction addendum={addendum} busy={busy} onRequestConforme={onRequestConforme} onCountersign={onCountersign} />
      {addendum.status === "pending" && onWithdraw ? <WithdrawAddendumForm addendum={addendum} busy={busy} onWithdraw={onWithdraw} /> : null}
    </li>
  );
}

/** The one conforme step PMCM can take next: request it, or countersign once the client has acknowledged. */
function ConformeAction({
  addendum,
  busy,
  onRequestConforme,
  onCountersign,
}: {
  addendum: PrismAddendum;
  busy: boolean;
  onRequestConforme?: (addendumId: string) => Promise<boolean>;
  onCountersign?: (addendum: PrismAddendum) => Promise<boolean>;
}) {
  const action = addendumConformeAction(addendum);
  if (action === "request" && onRequestConforme) {
    return (
      <button type="button" disabled={busy} onClick={() => void onRequestConforme(addendum.id)} className="rounded-md border border-border px-3 py-1.5 text-sm font-semibold disabled:opacity-50">
        Request client conforme
      </button>
    );
  }
  if (action === "countersign" && onCountersign) {
    return (
      <button type="button" disabled={busy} onClick={() => void onCountersign(addendum)} className="rounded-md bg-primary px-3 py-1.5 text-sm font-semibold text-primary-foreground disabled:opacity-50">
        Countersign addendum conforme
      </button>
    );
  }
  return null;
}

function WithdrawAddendumForm({
  addendum,
  busy,
  onWithdraw,
}: {
  addendum: PrismAddendum;
  busy: boolean;
  onWithdraw: (addendum: PrismAddendum, reason: string) => Promise<boolean>;
}) {
  const [reason, setReason] = useState("");
  return (
    <form
      className="space-y-2 border-t border-border pt-2"
      onSubmit={(event) => {
        event.preventDefault();
        void onWithdraw(addendum, reason.trim()).then((done) => {
          if (done) setReason("");
        });
      }}
    >
      <label className="block text-xs text-muted-foreground" htmlFor={`withdraw-reason-${addendum.id}`}>
        Withdraw this addendum. The reason is shared with the client. Billing and quotes are not changed.
      </label>
      <textarea
        id={`withdraw-reason-${addendum.id}`}
        value={reason}
        onChange={(event) => setReason(event.target.value)}
        rows={2}
        className="w-full rounded-md border border-border bg-background p-2 text-sm"
      />
      <button type="submit" disabled={busy || reason.trim().length === 0} className="rounded-md border border-border px-3 py-1.5 text-sm font-semibold disabled:opacity-50">
        Withdraw addendum
      </button>
    </form>
  );
}

function addendumStateText(addendum: PrismAddendum): string {
  if (addendum.status === "effective") return "Effective. Billing and quote amounts reflect this change.";
  if (addendum.status === "withdrawn") return `Withdrawn${addendum.withdrawalReason ? `: ${addendum.withdrawalReason}` : ""}`;
  return "Pending countersignature. Billing and quote amounts change when you countersign.";
}

function addendumConformeStatusText(addendum: PrismAddendum): string {
  if (!addendum.conforme) return "Conforme not requested";
  if (addendum.conforme.status === "awaiting_client") return "Awaiting client acknowledgment";
  if (addendum.conforme.status === "awaiting_pmcm") return "Client acknowledged. PMCM countersignature needed";
  return "Executed by client and PMCM";
}
