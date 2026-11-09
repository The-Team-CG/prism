"use client";

import { useId, useState } from "react";
import { ReceiptText } from "lucide-react";
import { createBillingSourceSchema, type CreateBillingSourceInput, type PrismBillingSource, type PrismBillingStatement, type PrismDocument } from "@prism/types";
import { Button } from "@prism/ui/components/button";
import { StatusBadge } from "@prism/ui/components/status-badge";
import { label, money } from "@/features/pmcm-kit";
import { DEFAULT_MILESTONES, MAX_PAYMENT_MILESTONES, MIN_DOWNPAYMENT_PERCENT, checkPaymentTerms, type MilestoneDraft, type PaymentTermsCheck } from "../model/payment-terms-form";

const fieldClass = "h-10 rounded-md border border-border bg-white px-3 text-sm font-normal text-foreground";
const labelClass = "grid gap-1 text-xs font-semibold text-muted-foreground";

/** With no source, say whether statements were already issued without one rather than asking PMCM to create one. */
function NoBillingSource({ statements }: { statements: PrismBillingStatement[] }) {
  const message = statements.length === 0
    ? "No billing source yet. Create one from the issued proposal before generating a statement."
    : `${statements.map((statement) => statement.number).join(", ")} ${statements.length === 1 ? "was" : "were"} issued without a linked billing source. The statement amounts stand as issued. Create and approve a source for any future statement.`;
  return <li className="rounded-md border border-dashed border-border bg-muted p-4 text-sm text-muted-foreground">{message}</li>;
}

/**
 * PMCM turns an issued proposal into billing: create the source, approve it, then generate the statement.
 * Sending the statement to the client happens in the statements list below this panel.
 */
function CreateHint({ canCreate, busy }: { canCreate: boolean; busy: boolean }) {
  if (canCreate || busy) return null;
  return <p className="text-xs text-muted-foreground">Add a source name, a line item, an amount and a proposal to continue.</p>;
}

interface BillingSourceDraft {
  sourceLabel: string;
  lineLabel: string;
  lineAmount: string;
  sourceDocumentId: string;
  evidenceOverrideReason: string;
  totalOverrideReason: string;
  termsOverrideReason: string;
}

/** Blank optional fields are left out; an empty amount is sent as NaN so the schema reports it as missing. */
function parseBillingSourceDraft(draft: BillingSourceDraft, terms: PaymentTermsCheck) {
  return createBillingSourceSchema.safeParse({
    sourceLabel: draft.sourceLabel.trim(),
    lineItems: [{ label: draft.lineLabel.trim(), amount: draft.lineAmount.trim() === "" ? Number.NaN : Number(draft.lineAmount) }],
    paymentSchedule: terms.schedule,
    paymentTermsPolicy: terms.needsOverride ? "repeat_client_override" : undefined,
    paymentTermsOverrideReason: terms.needsOverride ? draft.termsOverrideReason.trim() || undefined : undefined,
    sourceDocumentId: draft.sourceDocumentId || undefined,
    evidenceOverrideReason: draft.evidenceOverrideReason.trim() || undefined,
    totalOverrideReason: draft.totalOverrideReason.trim() || undefined,
  });
}

function PaymentTermsFields({
  milestones,
  onChange,
  terms,
  overrideReason,
  onOverrideReasonChange,
}: {
  milestones: MilestoneDraft[];
  onChange: (update: (current: MilestoneDraft[]) => MilestoneDraft[]) => void;
  terms: PaymentTermsCheck;
  overrideReason: string;
  onOverrideReasonChange: (value: string) => void;
}) {
  function updateMilestone(index: number, patch: Partial<MilestoneDraft>) {
    onChange((current) => current.map((row, position) => (position === index ? { ...row, ...patch } : row)));
  }

  return (
    <fieldset className="grid gap-2 rounded-md border border-border bg-background px-3 py-2">
      <legend className="px-1 text-sm font-semibold text-foreground">Payment terms</legend>
      <p className="text-xs text-muted-foreground">Up to {MAX_PAYMENT_MILESTONES} milestones totalling 100%. The first is at least {MIN_DOWNPAYMENT_PERCENT}% unless this is a repeat client.</p>
      {milestones.map((row, index) => (
        <div key={index} className="grid grid-cols-[minmax(0,1fr)_110px_auto] items-end gap-2">
          <label className={labelClass}>
            {"Milestone " + (index + 1) + " name"}
            <input value={row.label} onChange={(event) => updateMilestone(index, { label: event.target.value })} className={fieldClass} />
          </label>
          <label className={labelClass}>
            {"Milestone " + (index + 1) + " percent"}
            <input value={row.percentage} onChange={(event) => updateMilestone(index, { percentage: event.target.value })} inputMode="decimal" className={fieldClass} />
          </label>
          <Button type="button" variant="outline" size="sm" disabled={milestones.length <= 1} onClick={() => onChange((current) => current.filter((_, position) => position !== index))} aria-label={"Remove milestone " + (index + 1)}>Remove</Button>
        </div>
      ))}
      <div className="flex flex-wrap items-center gap-3">
        <Button type="button" variant="outline" size="sm" disabled={milestones.length >= MAX_PAYMENT_MILESTONES} onClick={() => onChange((current) => [...current, { label: "", percentage: "" }])}>Add milestone</Button>
        <p role="status" className={"text-xs " + (terms.problem ? "text-danger" : "text-muted-foreground")}>{terms.problem ?? "Terms total 100%."}</p>
      </div>
      {terms.needsOverride ? (
        <label className={labelClass}>
          Repeat-client reason for a downpayment under {MIN_DOWNPAYMENT_PERCENT}%
          <input value={overrideReason} onChange={(event) => onOverrideReasonChange(event.target.value)} className={fieldClass} />
        </label>
      ) : null}
    </fieldset>
  );
}

function BillingSourceItem({
  source,
  busy,
  onApprove,
  onGenerate,
}: {
  source: PrismBillingSource;
  busy: boolean;
  onApprove: (sourceId: string) => Promise<void>;
  onGenerate: (sourceId: string) => Promise<void>;
}) {
  return (
    <li aria-label={`Billing source ${source.sourceLabel}`} className="rounded-md border border-border bg-background p-4 text-sm">
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
  );
}

export function BillingSourcePanel({
  eventName,
  billingSources,
  statements = [],
  proposalDocuments,
  busy,
  onCreate,
  onApprove,
  onGenerate,
}: {
  eventName: string;
  billingSources: PrismBillingSource[];
  /** Issued statements; a statement with no source is reported as such instead of telling PMCM to create one. */
  statements?: PrismBillingStatement[];
  proposalDocuments: PrismDocument[];
  busy: boolean;
  /** Resolves true when the source was created; on failure the entered values stay for correction. */
  onCreate: (input: CreateBillingSourceInput) => Promise<boolean>;
  onApprove: (sourceId: string) => Promise<void>;
  onGenerate: (sourceId: string) => Promise<void>;
}) {
  const [sourceLabel, setSourceLabel] = useState(`${eventName} approved proposal`);
  const [lineLabel, setLineLabel] = useState("Approved event package");
  const [lineAmount, setLineAmount] = useState("");
  const [sourceDocumentId, setSourceDocumentId] = useState("");
  const [evidenceOverrideReason, setEvidenceOverrideReason] = useState("");
  const [totalOverrideReason, setTotalOverrideReason] = useState("");
  const [milestones, setMilestones] = useState<MilestoneDraft[]>(DEFAULT_MILESTONES);
  const [termsOverrideReason, setTermsOverrideReason] = useState("");
  const terms = checkPaymentTerms(milestones);
  const evidenceId = useId();
  const parsed = parseBillingSourceDraft(
    { sourceLabel, lineLabel, lineAmount, sourceDocumentId, evidenceOverrideReason, totalOverrideReason, termsOverrideReason },
    terms,
  );
  const canCreate = !busy && parsed.success && terms.problem === null;
  const amountInvalid = lineAmount.trim() !== "" && !parsed.success && parsed.error.issues.some((issue) => issue.path.at(-1) === "amount");

  async function create() {
    if (!parsed.success || !(await onCreate(parsed.data))) return;
    setLineAmount("");
    setEvidenceOverrideReason("");
    setTotalOverrideReason("");
    setMilestones(DEFAULT_MILESTONES);
    setTermsOverrideReason("");
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
            <input value={lineAmount} onChange={(event) => setLineAmount(event.target.value)} type="number" inputMode="numeric" min={1} step={1} aria-invalid={amountInvalid} className={fieldClass} />
          </label>
        </div>
        {amountInvalid ? <p role="alert" className="text-xs text-danger">Enter a whole peso amount from 1 to 2,147,483,647.</p> : null}
        {/* A select nested in its label would include the chosen option in its name, so it is labelled by id. */}
        <div className={labelClass}>
          <label htmlFor={evidenceId}>Proposal evidence</label>
          <select id={evidenceId} value={sourceDocumentId} onChange={(event) => setSourceDocumentId(event.target.value)} className={fieldClass}>
            <option value="">Select a proposal document</option>
            {proposalDocuments.map((document) => <option key={document.id} value={document.id}>{document.fileName}</option>)}
          </select>
        </div>
        <PaymentTermsFields
          milestones={milestones}
          onChange={setMilestones}
          terms={terms}
          overrideReason={termsOverrideReason}
          onOverrideReasonChange={setTermsOverrideReason}
        />
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
        <CreateHint canCreate={canCreate} busy={busy} />
      </div>

      <ul className="mt-4 grid gap-3" aria-label="Billing sources">
        {billingSources.length === 0 ? <NoBillingSource statements={statements} /> : null}
        {billingSources.map((source) => (
          <BillingSourceItem key={source.id} source={source} busy={busy} onApprove={onApprove} onGenerate={onGenerate} />
        ))}
      </ul>
    </section>
  );
}
