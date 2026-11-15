"use client";

import { CheckCircle2, Hourglass, Paperclip, RotateCcw, XCircle, type LucideIcon } from "lucide-react";
import { PAYMENT_RECEIPT_EVIDENCE_ACCEPT, type PrismPaymentSubmission, type PrismPaymentSubmissionState } from "@prism/types";
import { Button } from "@prism/ui/components/button";
import { Card } from "@prism/ui/components/card";
import { formatPortalDate } from "@prism/ui/format-date";
import { formatPeso } from "@prism/ui/payment-track";
import { cn } from "@/app/components/ui/utils";

const STATE: Record<PrismPaymentSubmissionState, { icon: LucideIcon; label: string; tone: string }> = {
  checking: { icon: Hourglass, label: "Being checked", tone: "bg-info-soft text-info" },
  accepted: { icon: CheckCircle2, label: "Accepted", tone: "bg-success-soft text-success" },
  not_accepted: { icon: XCircle, label: "Not accepted", tone: "bg-danger-soft text-danger" },
};

function detailLine(submission: PrismPaymentSubmission) {
  const parts = [formatPortalDate(submission.paidDate), submission.method];
  if (submission.reference) parts.push(`Ref ${submission.reference}`);
  if (submission.forPayment) parts.push(`for ${submission.forPayment}`);
  return parts.join(" · ");
}

function AddProof({ submission, busy, onAdd }: { submission: PrismPaymentSubmission; busy: boolean; onAdd: (file: File) => void }) {
  const inputId = `add-proof-${submission.id}`;
  return (
    <label htmlFor={inputId} className={cn("inline-flex cursor-pointer items-center gap-1 text-xs font-medium text-primary hover:text-primary/80", busy && "pointer-events-none opacity-60")}>
      <Paperclip className="size-3" aria-hidden /> {busy ? "Uploading…" : "Add proof"}
      <input id={inputId} type="file" className="sr-only" accept={PAYMENT_RECEIPT_EVIDENCE_ACCEPT} onChange={(event) => { const file = event.target.files?.[0]; if (file) onAdd(file); }} />
    </label>
  );
}

/**
 * Payments the client should hear about: ones PMCM is still checking, ones PMCM did not accept (with the reason and a
 * way to send them again), and ones the client reported that PMCM accepted.
 */
export function PaymentsYouSent({
  submissions,
  proofBusyId,
  onAddProof,
  onSendAgain,
}: {
  submissions: PrismPaymentSubmission[];
  proofBusyId: string | null;
  onAddProof: (receiptId: string, file: File) => void;
  onSendAgain: () => void;
}) {
  if (submissions.length === 0) return null;
  return (
    <Card role="region" aria-labelledby="client-payments-sent" className="gap-0 overflow-hidden py-0">
      <header className="border-b border-border px-4 py-3">
        <h2 id="client-payments-sent" className="text-sm font-semibold text-foreground">Payments you sent</h2>
        <p className="text-xs text-muted-foreground">PMCM matches each one against their bank or wallet statement before it counts.</p>
      </header>
      <ul className="divide-y divide-border">
        {submissions.map((submission) => {
          const look = STATE[submission.state];
          const Icon = look.icon;
          const needsProof = submission.fromClient && submission.state === "checking" && !submission.hasProof;
          return (
            <li key={submission.id} className="grid grid-cols-[2rem_minmax(0,1fr)_auto] items-start gap-x-3 px-4 py-3">
              <span aria-hidden className={cn("grid size-8 place-items-center rounded-full", look.tone)}><Icon className="size-4" /></span>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-foreground">{look.label}</p>
                <p className="truncate text-xs text-muted-foreground">{detailLine(submission)}</p>
                {submission.reason ? <p className="mt-1 rounded-md bg-danger-soft px-2 py-1 text-xs text-danger">PMCM: {submission.reason}</p> : null}
                <div className="mt-1 flex flex-wrap items-center gap-3">
                  {needsProof ? <AddProof submission={submission} busy={proofBusyId === submission.id} onAdd={(file) => onAddProof(submission.id, file)} /> : null}
                  {submission.state === "not_accepted" ? (
                    <Button size="sm" variant="link" className="h-auto p-0 text-xs" onClick={onSendAgain}><RotateCcw className="size-3" aria-hidden /> Send again</Button>
                  ) : null}
                </div>
              </div>
              <p className={cn("text-sm font-semibold tabular-nums", submission.state === "not_accepted" ? "text-muted-foreground line-through" : "text-foreground")}>{formatPeso(submission.amount)}</p>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
