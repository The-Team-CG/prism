"use client";

import { useState, type FormEvent } from "react";
import type { PrismAddendum, PrismEventFreezeException, PrismScopeChangeRequest } from "@prism/types";
import { impactLabels, isOpenScopeChange, scopeChangeCategoryLabels, scopeChangeStatusLabel } from "../model/scope-review-rules";
import { useScopeReviewViewModel, type ApprovalDraft } from "../view-models/use-scope-review-view-model";

/** PMCM decides scope changes. Clients see only the status and the client response written here. */
export function ScopeChangeReviewPanel({ eventId, frozen }: { eventId: string; frozen: boolean }) {
  const vm = useScopeReviewViewModel(eventId, { frozen });

  return (
    <section aria-labelledby="scope-review-heading" className="space-y-4 border-t border-border pt-4">
      <div>
        <h3 id="scope-review-heading" className="text-sm font-semibold text-foreground">Scope change requests</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Approval requires the impact review{frozen ? " and an approved freeze exception, because the scope is frozen" : ""}. A rejection needs a reason, which stays internal.
        </p>
      </div>
      {vm.status === "loading" ? <p role="status" className="text-sm text-muted-foreground">Loading scope change requests…</p> : null}
      {vm.error ? <p role="alert" className="text-sm text-destructive">{vm.error}</p> : null}
      {vm.status === "ready" && vm.requests.length === 0 ? <p className="text-sm text-muted-foreground">No scope change requests for this event.</p> : null}
      {vm.status === "ready" && vm.requests.length > 0 ? (
        <ul className="divide-y divide-border rounded-lg border border-border">
          {vm.requests.map((request) => (
            <ScopeChangeItem
              key={request.id}
              request={request}
              frozen={frozen}
              busy={vm.busy}
              approvedExceptions={vm.approvedExceptions}
              addenda={vm.addenda}
              onStartReview={() => vm.startReview(request.id)}
              onApprove={(draft: ApprovalDraft) => vm.approve(request.id, draft)}
              onReject={(reason, response) => vm.reject(request.id, reason, response)}
            />
          ))}
        </ul>
      ) : null}
    </section>
  );
}

function ScopeChangeItem({
  request,
  frozen,
  busy,
  approvedExceptions,
  addenda,
  onStartReview,
  onApprove,
  onReject,
}: {
  request: PrismScopeChangeRequest;
  frozen: boolean;
  busy: boolean;
  approvedExceptions: readonly PrismEventFreezeException[];
  addenda: readonly PrismAddendum[];
  onStartReview: () => Promise<boolean>;
  onApprove: (draft: ApprovalDraft) => Promise<boolean>;
  onReject: (reason: string, response?: string) => Promise<boolean>;
}) {
  const [mode, setMode] = useState<"idle" | "approve" | "reject">("idle");
  const open = isOpenScopeChange(request);
  const impacts = impactLabels(request.impacts);

  return (
    <li className="space-y-2 p-3 text-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-semibold text-foreground">{request.title}</p>
          <p className="text-muted-foreground">{scopeChangeCategoryLabels[request.category]} · {request.requestedByRole === "client" ? "Raised by client" : "Logged by PMCM"} · {new Date(request.submittedAt).toLocaleDateString()}</p>
          <p className="mt-1 text-foreground">{request.description}</p>
          {request.decisionReason ? <p className="text-muted-foreground">Internal reason: {request.decisionReason}</p> : null}
          {request.clientResponse ? <p className="text-muted-foreground">Client response: {request.clientResponse}</p> : null}
          {impacts.length > 0 ? <p className="text-muted-foreground">Impact: {impacts.join(", ")}</p> : null}
          {request.freezeExceptionId ? <p className="text-muted-foreground">Freeze exception used for this approval</p> : null}
        </div>
        <span className="text-xs font-semibold text-muted-foreground">{scopeChangeStatusLabel(request.status)}</span>
      </div>
      {open && mode === "idle" ? (
        <div className="flex flex-wrap gap-2">
          {request.status === "submitted" ? (
            <button type="button" disabled={busy} onClick={() => void onStartReview()} className="rounded-md border border-border px-3 py-1.5 text-sm font-semibold disabled:opacity-50">Start review</button>
          ) : null}
          <button type="button" disabled={busy} onClick={() => setMode("approve")} className="rounded-md bg-primary px-3 py-1.5 text-sm font-semibold text-primary-foreground disabled:opacity-50">Approve</button>
          <button type="button" disabled={busy} onClick={() => setMode("reject")} className="rounded-md border border-border px-3 py-1.5 text-sm font-semibold disabled:opacity-50">Reject</button>
        </div>
      ) : null}
      {open && mode === "approve" ? (
        <ApproveForm
          frozen={frozen}
          busy={busy}
          approvedExceptions={approvedExceptions}
          addenda={addenda}
          onCancel={() => setMode("idle")}
          onSubmit={async (draft) => { const saved = await onApprove(draft); if (saved) setMode("idle"); return saved; }}
        />
      ) : null}
      {open && mode === "reject" ? (
        <RejectForm
          busy={busy}
          onCancel={() => setMode("idle")}
          onSubmit={async (reason, response) => { const saved = await onReject(reason, response); if (saved) setMode("idle"); return saved; }}
        />
      ) : null}
    </li>
  );
}

function ApproveForm({
  frozen,
  busy,
  approvedExceptions,
  addenda,
  onCancel,
  onSubmit,
}: {
  frozen: boolean;
  busy: boolean;
  approvedExceptions: readonly PrismEventFreezeException[];
  addenda: readonly PrismAddendum[];
  onCancel: () => void;
  onSubmit: (draft: ApprovalDraft) => Promise<boolean>;
}) {
  const [impacts, setImpacts] = useState({ billing: false, supplier: false, coordinator: false, floorplan: false });
  const [confirmed, setConfirmed] = useState(false);
  const [freezeExceptionId, setFreezeExceptionId] = useState("");
  const [addendumId, setAddendumId] = useState("");
  const [clientResponse, setClientResponse] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await onSubmit({ impacts, impactReviewConfirmed: confirmed, freezeExceptionId, addendumId, clientResponse });
  }

  return (
    <form onSubmit={submit} aria-label="Approve scope change" className="space-y-3 border-t border-border pt-3">
      <fieldset className="space-y-2">
        <legend className="text-sm font-semibold text-foreground">Impact review</legend>
        {(["billing", "supplier", "coordinator", "floorplan"] as const).map((key) => (
          <label key={key} className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={impacts[key]} onChange={(event) => setImpacts({ ...impacts, [key]: event.target.checked })} />
            <span className="capitalize text-foreground">{key} affected</span>
          </label>
        ))}
        <label className="flex items-start gap-2 text-sm">
          <input type="checkbox" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} className="mt-1" />
          <span className="text-foreground">I have reviewed billing, supplier, coordinator, and floorplan impact for this change.</span>
        </label>
      </fieldset>
      {frozen ? (
        <label className="block text-sm">
          <span className="text-muted-foreground">Approved freeze exception</span>
          <select required value={freezeExceptionId} onChange={(event) => setFreezeExceptionId(event.target.value)} className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm">
            <option value="">Choose an exception</option>
            {approvedExceptions.map((exception) => <option key={exception.id} value={exception.id}>{exception.requestedChange}</option>)}
          </select>
        </label>
      ) : null}
      {impacts.billing ? (
        <label className="block text-sm">
          <span className="text-muted-foreground">Linked addendum (optional)</span>
          <select value={addendumId} onChange={(event) => setAddendumId(event.target.value)} className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm">
            <option value="">No addendum yet</option>
            {addenda.map((addendum) => <option key={addendum.id} value={addendum.id}>Addendum v{addendum.versionNumber}: {addendum.title}</option>)}
          </select>
        </label>
      ) : null}
      <label className="block text-sm">
        <span className="text-muted-foreground">Response for the client (optional)</span>
        <input value={clientResponse} onChange={(event) => setClientResponse(event.target.value)} className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm" />
      </label>
      <div className="flex gap-2">
        <button type="submit" disabled={busy || !confirmed || (frozen && !freezeExceptionId)} className="rounded-md bg-primary px-3 py-1.5 text-sm font-semibold text-primary-foreground disabled:opacity-50">Confirm approval</button>
        <button type="button" onClick={onCancel} className="rounded-md px-3 py-1.5 text-sm text-muted-foreground">Cancel</button>
      </div>
    </form>
  );
}

function RejectForm({ busy, onCancel, onSubmit }: { busy: boolean; onCancel: () => void; onSubmit: (reason: string, response?: string) => Promise<boolean> }) {
  const [reason, setReason] = useState("");
  const [clientResponse, setClientResponse] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await onSubmit(reason, clientResponse || undefined);
  }

  return (
    <form onSubmit={submit} aria-label="Reject scope change" className="space-y-3 border-t border-border pt-3">
      <label className="block text-sm">
        <span className="text-muted-foreground">Reason for rejecting (internal)</span>
        <input required value={reason} onChange={(event) => setReason(event.target.value)} className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm" />
      </label>
      <label className="block text-sm">
        <span className="text-muted-foreground">Response for the client (optional)</span>
        <input value={clientResponse} onChange={(event) => setClientResponse(event.target.value)} className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm" />
      </label>
      <div className="flex gap-2">
        <button type="submit" disabled={busy || !reason.trim()} className="rounded-md border border-border px-3 py-1.5 text-sm font-semibold disabled:opacity-50">Confirm rejection</button>
        <button type="button" onClick={onCancel} className="rounded-md px-3 py-1.5 text-sm text-muted-foreground">Cancel</button>
      </div>
    </form>
  );
}
