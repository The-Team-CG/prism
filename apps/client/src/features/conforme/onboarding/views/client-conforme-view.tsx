"use client";

import Link from "next/link";
import type { PrismConformeExecution } from "@prism/types";
import { useClientConformeViewModel } from "../view-models/use-client-conforme-view-model";

export function ClientConformeView() {
  const model = useClientConformeViewModel();
  if (model.busy) return <main className="mx-auto max-w-3xl px-5 py-16 text-sm text-muted-foreground">Loading your conforme…</main>;
  return <main className="mx-auto max-w-3xl px-5 py-10 sm:py-16">
    <header className="mb-8"><p className="text-sm font-semibold text-primary">P.R.I.S.M. client onboarding</p><h1 className="mt-2 text-3xl font-bold tracking-tight text-foreground">Review your conforme</h1><p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">This page records an in-app acknowledgment tied to the displayed document version. The client signs first; PMCM countersigns to activate the event workspace.</p><Link href="/dashboard" className="mt-4 inline-flex min-h-10 items-center text-sm font-semibold text-primary hover:underline">Back to dashboard</Link></header>
    <ConformeContent model={model} />
  </main>;
}

function ConformeContent({ model }: { model: ReturnType<typeof useClientConformeViewModel> }) {
  if (model.error) return <div role="alert" className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">{model.error}</div>;
  if (!model.execution) return <div className="rounded-xl border border-border bg-card p-6 text-sm text-muted-foreground">No conforme is available for this account. Contact PMCM if you expected one.</div>;
  return <ConformeRecord model={model} execution={model.execution} />;
}

function ConformeRecord({ model, execution }: { model: ReturnType<typeof useClientConformeViewModel>; execution: PrismConformeExecution }) {
  const clientSigned = execution.signatures.some((signature) => signature.actorRole === "client");
  return <section className="space-y-5 rounded-2xl border border-border bg-card p-5 sm:p-7">
    <ExecutionSelector executions={model.executions} selectedId={model.selectedExecutionId} onSelect={model.setSelectedExecutionId} />
    <ExecutionSummary execution={execution} />
    <pre className="max-h-[55vh] overflow-auto whitespace-pre-wrap rounded-xl border border-border bg-background p-5 font-sans text-sm leading-6 text-foreground">{execution.documentContent}</pre>
    <ExecutionSignatures execution={execution} />
    <ExecutionAction model={model} execution={execution} clientSigned={clientSigned} />
  </section>;
}

function ExecutionSelector({ executions, selectedId, onSelect }: { executions: PrismConformeExecution[]; selectedId: string | null; onSelect: (id: string) => void }) {
  if (executions.length <= 1) return null;
  return <label className="grid max-w-sm gap-2 text-sm font-medium text-foreground">Conforme to review<select value={selectedId ?? ""} onChange={(event) => onSelect(event.target.value)} className="min-h-10 rounded-lg border border-border bg-background px-3">{executions.map((item) => <option key={item.id} value={item.id}>Version {item.templateVersion} · {item.status.replaceAll("_", " ")}</option>)}</select></label>;
}

function ExecutionSummary({ execution }: { execution: PrismConformeExecution }) {
  const status = execution.status === "completed" ? "Complete" : execution.status === "awaiting_pmcm" ? "Awaiting PMCM countersignature" : execution.status === "superseded" ? "Replaced by a newer version" : "Awaiting your review";
  return <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-4"><div className="min-w-0"><h2 className="text-lg font-semibold text-foreground">Conforme version {execution.templateVersion}</h2><p className="mt-1 break-all text-xs text-muted-foreground">Document SHA-256: {execution.documentSha256}</p></div><span className="text-xs font-semibold text-muted-foreground">{status}</span></div>;
}

function ExecutionSignatures({ execution }: { execution: PrismConformeExecution }) {
  if (!execution.signatures.length) return null;
  return <div className="space-y-2 text-sm text-muted-foreground" aria-label="Signature record">{execution.signatures.map((signature) => <p key={signature.id}>{signature.actorRole === "client" ? "Client" : "PMCM"} acknowledgment recorded for {signature.actorName} at {new Date(signature.signedAt).toLocaleString()}.</p>)}</div>;
}

function ExecutionAction({ model, execution, clientSigned }: { model: ReturnType<typeof useClientConformeViewModel>; execution: PrismConformeExecution; clientSigned: boolean }) {
  if (execution.status === "awaiting_client" && !clientSigned) return <div className="space-y-4 border-t border-border pt-5"><label className="flex items-start gap-3 text-sm leading-6 text-foreground"><input type="checkbox" checked={model.consentAccepted} onChange={(event) => model.setConsentAccepted(event.target.checked)} className="mt-1 size-4 accent-primary" /><span>I have reviewed this conforme version and agree to record my in-app acknowledgment. I understand PMCM must countersign before the event workspace activates.</span></label><button type="button" disabled={!model.consentAccepted || model.signing} onClick={() => void model.sign()} className="inline-flex min-h-11 items-center justify-center rounded-lg bg-primary px-5 text-sm font-semibold text-primary-foreground disabled:cursor-not-allowed disabled:opacity-50">{model.signing ? "Recording acknowledgment…" : "Acknowledge conforme"}</button></div>;
  if (execution.status === "awaiting_pmcm") return <p className="border-t border-border pt-5 text-sm text-muted-foreground">Your acknowledgment is recorded. The workspace will open after PMCM countersigns.</p>;
  if (execution.status === "completed") return <p className="border-t border-border pt-5 text-sm text-muted-foreground">Both acknowledgments are recorded. Your event workspace is ready.</p>;
  return null;
}
