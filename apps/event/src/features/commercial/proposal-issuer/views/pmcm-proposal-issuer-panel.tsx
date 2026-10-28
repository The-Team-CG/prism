"use client";

import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/app/components/ui/button";
import { Input } from "@/app/components/ui/input";
import { ESTIMATE_CATEGORY_SUGGESTIONS, estimateLineTotal, formatPeso } from "../model/proposal-issuer-rules";
import { useProposalIssuerViewModel } from "../view-models/use-proposal-issuer-view-model";

const fieldLabel = "grid gap-1.5 text-sm font-medium";

export function PmcmProposalIssuerPanel({ eventId }: { eventId: string }) {
  const vm = useProposalIssuerViewModel(eventId);
  const budget = Number(vm.budgetAmount);
  const overBudget = Number.isFinite(budget) && budget > 0 && vm.total > budget;
  const approved = vm.latest?.clientStatus === "approved";

  return (
    <section className="rounded-lg border border-border bg-card p-5">
      <h2 className="text-lg font-bold">Commercial proposal</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Build the cost estimate, then issue it as a numbered version. The client reviews the issued version and sees its title, summary and total, not the estimate lines. A new version replaces the previous one and keeps its history.
      </p>

      <IssuedProposal proposal={vm.latest} />

      {vm.error ? <p role="alert" className="mt-3 text-sm text-destructive">{vm.error}</p> : null}
      {vm.notice ? <p role="status" className="mt-3 text-sm font-medium text-success">{vm.notice}</p> : null}

      {approved ? (
        <p className="mt-5 text-sm text-muted-foreground">
          The client approved version {vm.latest?.versionNumber}, so it can't be replaced. To change scope or price now, record a scope change in the change register.
        </p>
      ) : (
      <form onSubmit={vm.issue} className="mt-5 grid gap-4">
        <h3 className="text-sm font-bold">{vm.latest ? "Issue a new version" : "Issue the first version"}</h3>

        <label className={`${fieldLabel} max-w-xs`}>
          Client budget (PHP)
          <Input required type="number" inputMode="numeric" min={1} step={1} value={vm.budgetAmount} onChange={(event) => vm.setBudgetAmount(event.target.value)} placeholder="500000" />
        </label>

        <fieldset className="grid gap-2">
          <legend className="text-sm font-medium">Estimate lines</legend>
          <datalist id="proposal-estimate-categories">
            {ESTIMATE_CATEGORY_SUGGESTIONS.map((category) => <option key={category} value={category} />)}
          </datalist>
          {vm.lines.map((line, index) => (
            <div key={line.key} className="grid gap-2 sm:grid-cols-[9rem_minmax(0,1fr)_5rem_8rem_7rem_2.25rem] sm:items-center">
              <Input required list="proposal-estimate-categories" aria-label={`Line ${index + 1} category`} placeholder="Category" value={line.category} onChange={(event) => vm.updateLine(line.key, { category: event.target.value })} />
              <Input required aria-label={`Line ${index + 1} description`} placeholder="Description" value={line.description} onChange={(event) => vm.updateLine(line.key, { description: event.target.value })} />
              <Input required type="number" inputMode="decimal" min={0.01} step="any" aria-label={`Line ${index + 1} quantity`} placeholder="Qty" value={line.quantity} onChange={(event) => vm.updateLine(line.key, { quantity: event.target.value })} />
              <Input required type="number" inputMode="numeric" min={0} step={1} aria-label={`Line ${index + 1} unit amount in PHP`} placeholder="Unit PHP" value={line.unitAmount} onChange={(event) => vm.updateLine(line.key, { unitAmount: event.target.value })} />
              <p className="text-sm tabular-nums sm:text-right">{formatPeso(estimateLineTotal(line))}</p>
              <Button type="button" variant="ghost" size="icon" aria-label={`Remove line ${index + 1}`} disabled={vm.lines.length === 1} onClick={() => vm.removeLine(line.key)}>
                <Trash2 className="size-4" />
              </Button>
            </div>
          ))}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Button type="button" variant="outline" size="sm" onClick={vm.addLine}>
              <Plus className="size-4" /> Add line
            </Button>
            <p className="text-sm">
              Total <span className="font-bold tabular-nums">{formatPeso(vm.total)}</span>
              {overBudget ? <span className="ml-2 font-medium text-attention">{formatPeso(vm.total - budget)} over budget</span> : null}
            </p>
          </div>
        </fieldset>

        <label className={fieldLabel}>
          Internal estimate notes <span className="font-normal text-muted-foreground">(PMCM only, optional)</span>
          <textarea rows={2} value={vm.notes} onChange={(event) => vm.setNotes(event.target.value)} className="rounded-md border border-border bg-input px-3 py-2 text-sm" />
        </label>

        <div className="grid gap-4 md:grid-cols-2">
          <label className={`${fieldLabel} md:col-span-2`}>
            Proposal title
            <Input required value={vm.title} onChange={(event) => vm.setTitle(event.target.value)} placeholder="Annual forum proposal" />
          </label>
          <label className={`${fieldLabel} md:col-span-2`}>
            What the client sees <span className="font-normal text-muted-foreground">(optional)</span>
            <textarea rows={3} value={vm.summary} onChange={(event) => vm.setSummary(event.target.value)} className="rounded-md border border-border bg-input px-3 py-2 text-sm" />
          </label>
          {vm.latest ? (
            <label className={`${fieldLabel} md:col-span-2`}>
              What changed since version {vm.latest.versionNumber} <span className="font-normal text-muted-foreground">(optional)</span>
              <Input value={vm.revisionNote} onChange={(event) => vm.setRevisionNote(event.target.value)} />
            </label>
          ) : null}
        </div>

        <div>
          <Button type="submit" disabled={vm.busy}>{vm.busy ? "Issuing…" : "Issue to client"}</Button>
        </div>
      </form>
      )}
    </section>
  );
}

function IssuedProposal({ proposal }: { proposal: ReturnType<typeof useProposalIssuerViewModel>["latest"] }) {
  return <>
      {proposal ? (
        <article className="mt-4 rounded-md border border-border p-3">
          <p className="text-xs font-semibold text-muted-foreground">
            Issued · version {proposal.versionNumber} · client {proposal.clientStatus.replaceAll("_", " ")}
          </p>
          <h3 className="mt-1 font-semibold">{proposal.title}</h3>
          {proposal.summary ? <p className="mt-1 whitespace-pre-wrap text-sm">{proposal.summary}</p> : null}
          <p className="mt-2 text-sm font-semibold tabular-nums">{formatPeso(proposal.totalAmount)}</p>
        </article>
      ) : (
        <p className="mt-4 text-sm text-muted-foreground">No proposal has been issued for this event yet.</p>
      )}

  </>;
}
