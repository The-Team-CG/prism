"use client";

import { useId, useState } from "react";
import { ReceiptText } from "lucide-react";
import type { CreateBillingSourceInput, PrismBillingSource, PrismDocument } from "@prism/types";
import { Button } from "@/app/components/ui/button";
import { StatusBadge } from "@/app/components/ui/status-badge";
import { label, money } from "@/features/pmcm-kit";

const fieldClass = "h-10 rounded-md border border-border bg-white px-3 text-sm font-normal text-foreground";
const labelClass = "grid gap-1 text-xs font-semibold text-muted-foreground";

/**
 * PMCM turns an issued proposal into billing: create the source, approve it, then generate the statement.
 * Sending the statement to the client happens in the statements list below this panel.
 */
export function BillingSourcePanel({
  eventName,
  billingSources,
  proposalDocuments,
  busy,
  onCreate,
  onApprove,
  onGenerate,
}: {
  eventName: string;
  billingSources: PrismBillingSource[];
  proposalDocuments: PrismDocument[];
  busy: boolean;
  onCreate: (input: CreateBillingSourceInput) => Promise<void>;
  onApprove: (sourceId: string) => Promise<void>;
  onGenerate: (sourceId: string) => Promise<void>;
}) {
  const [sourceLabel, setSourceLabel] = useState(`${eventName} approved proposal`);
  const [lineLabel, setLineLabel] = useState("Approved event package");
  const [lineAmount, setLineAmount] = useState("");
  const [sourceDocumentId, setSourceDocumentId] = useState("");
  const [evidenceOverrideReason, setEvidenceOverrideReason] = useState("");
  const [totalOverrideReason, setTotalOverrideReason] = useState("");
  const evidenceId = useId();
  const amount = Number(lineAmount);
  const canCreate = !busy && sourceLabel.trim().length > 0 && lineLabel.trim().length > 0 && Number.isFinite(amount) && amount > 0;

  async function create() {
    await onCreate({
      sourceLabel: sourceLabel.trim(),
      lineItems: [{ label: lineLabel.trim(), amount }],
      paymentSchedule: [
        { label: "Downpayment", percentage: 50 },
        { label: "Balance", percentage: 50 },
      ],
      sourceDocumentId: sourceDocumentId || undefined,
      evidenceOverrideReason: evidenceOverrideReason.trim() || undefined,
      totalOverrideReason: totalOverrideReason.trim() || undefined,
    });
    setLineAmount("");
    setEvidenceOverrideReason("");
    setTotalOverrideReason("");
  }

  return (
    <section aria-labelledby="billing-source-title" className="rounded-2xl border border-border bg-card p-5 shadow-sm">
      <div className="flex items-start gap-3">
        <ReceiptText aria-hidden="true" className="mt-1 size-5 text-primary" />
        <div>
          <h2 id="billing-source-title" className="text-lg font-black text-foreground">Billing source</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Bill the issued proposal: create the source, approve it, then generate the statement and send it to the client below.
          </p>
        </div>
      </div>

      <div className="mt-4 grid gap-3">
        <label className={labelClass}>
          Billing source name
          <input value={sourceLabel} onChange={(event) => setSourceLabel(event.target.value)} className={fieldClass} />
        </label>
        <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_180px]">
          <label className={labelClass}>
            Line item
            <input value={lineLabel} onChange={(event) => setLineLabel(event.target.value)} className={fieldClass} />
          </label>
          <label className={labelClass}>
            Amount (PHP)
            <input value={lineAmount} onChange={(event) => setLineAmount(event.target.value)} type="number" inputMode="numeric" min={1} step={1} className={fieldClass} />
          </label>
        </div>
        {/* A select nested in its label would include the chosen option in its name, so it is labelled by id. */}
        <div className={labelClass}>
          <label htmlFor={evidenceId}>Proposal evidence</label>
          <select id={evidenceId} value={sourceDocumentId} onChange={(event) => setSourceDocumentId(event.target.value)} className={fieldClass}>
            <option value="">Select a proposal document</option>
            {proposalDocuments.map((document) => <option key={document.id} value={document.id}>{document.fileName}</option>)}
          </select>
        </div>
        <details className="rounded-md border border-border bg-background px-3 py-2">
          <summary className="cursor-pointer text-sm font-semibold text-foreground">Override reasons</summary>
          <p className="mt-2 text-xs text-muted-foreground">
            Only when PMCM deliberately bills against an older proposal version or a total that differs from the proposal. A different total needs approval by another PMCM admin.
          </p>
          <div className="mt-2 grid gap-3">
            <label className={labelClass}>
              Reason for citing an older proposal version
              <input value={evidenceOverrideReason} onChange={(event) => setEvidenceOverrideReason(event.target.value)} className={fieldClass} />
            </label>
            <label className={labelClass}>
              Reason the total differs from the proposal
              <input value={totalOverrideReason} onChange={(event) => setTotalOverrideReason(event.target.value)} className={fieldClass} />
            </label>
          </div>
        </details>
        <Button type="button" disabled={!canCreate} onClick={() => void create()}>Create billing source</Button>
      </div>

      <ul className="mt-4 grid gap-3" aria-label="Billing sources">
        {billingSources.length === 0 ? (
          <li className="rounded-md border border-dashed border-border bg-muted p-4 text-sm text-muted-foreground">
            No billing source yet. Create one from the issued proposal before generating a statement.
          </li>
        ) : null}
        {billingSources.map((source) => (
          <li key={source.id} aria-label={`Billing source ${source.sourceLabel}`} className="rounded-md border border-border bg-background p-4 text-sm">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="font-black">{source.sourceLabel}</p>
                <p className="mt-1 text-muted-foreground">{money.format(source.totalAmount)} · {source.lineItems.length} line item(s)</p>
              </div>
              <StatusBadge status={source.status} label={label(source.status)} />
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {source.status === "approved" ? (
                <Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => void onGenerate(source.id)}>Generate statement</Button>
              ) : (
                <Button type="button" size="sm" disabled={busy} onClick={() => void onApprove(source.id)}>Approve source</Button>
              )}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
