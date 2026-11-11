"use client";

import { ReceiptText } from "lucide-react";
import type { PrismPaymentReceipt } from "@prism/types";
import { Button } from "@prism/ui/components/button";
import { StatusBadge } from "@prism/ui/components/status-badge";
import { formatPortalDate } from "@prism/ui/format-date";
import { PrismEmptyLine } from "@prism/ui/page-blocks";
import { money } from "@/features/pmcm-kit";
import { RECEIPT_STATUS_LABELS, fileSizeLabel, receiptActions, receiptNotes, receiptOutcomes, receiptTitle } from "../model/receipt-rules";
import type { PaymentReceiptsViewModel, ReceiptDialog } from "../view-models/use-payment-receipts-view-model";

function Heading({ children }: { children: string }) {
  return <h3 className="text-xs font-semibold text-muted-foreground">{children}</h3>;
}

function DetailHeader({ receipt }: { receipt: PrismPaymentReceipt }) {
  return (
    <header className="space-y-1">
      <div className="flex items-start justify-between gap-3">
        <h2 className="min-w-0 break-words text-base font-semibold text-foreground">{receiptTitle(receipt)}</h2>
        <StatusBadge status={receipt.status} label={RECEIPT_STATUS_LABELS[receipt.status]} />
      </div>
      <p className="text-2xl font-semibold tabular-nums text-foreground">{money.format(receipt.amount)}</p>
      <p className="text-xs text-muted-foreground">
        Arrived {formatPortalDate(receipt.receivedDate)} by {receipt.method}
        {receipt.payerName ? ` from ${receipt.payerName}` : ""}. Recorded by {receipt.recordedBy}.
      </p>
    </header>
  );
}

function Balances({ receipt }: { receipt: PrismPaymentReceipt }) {
  const figures = [
    { label: "Applied", value: receipt.applied },
    { label: "Paid back", value: receipt.refunded },
    { label: "Unapplied", value: receipt.unapplied },
  ];
  return (
    <dl className="grid grid-cols-3 gap-2 rounded-lg bg-muted/40 p-3 text-center">
      {figures.map((figure) => (
        <div key={figure.label}>
          <dt className="text-xs text-muted-foreground">{figure.label}</dt>
          <dd className="mt-0.5 text-sm font-semibold tabular-nums text-foreground">{money.format(figure.value)}</dd>
        </div>
      ))}
    </dl>
  );
}

function Notes({ receipt }: { receipt: PrismPaymentReceipt }) {
  const notes = receiptNotes(receipt);
  const outcomes = receiptOutcomes(receipt);
  if (notes.length === 0 && outcomes.length === 0) return null;
  return (
    <ul className="space-y-1.5 text-xs text-muted-foreground">
      {notes.map((note) => <li key={note}>{note}</li>)}
      {outcomes.map((outcome) => <li key={outcome} className="text-foreground">{outcome}</li>)}
    </ul>
  );
}

/** Proof of payment: the file that shows the money arrived. Only PMCM can open it; clients never see it. */
function Evidence({ receipt, onView }: { receipt: PrismPaymentReceipt; onView: () => void }) {
  const { evidence } = receipt;
  const actions = receiptActions(receipt);
  if (!evidence && !actions.attachEvidence && !actions.earmark) return null;
  return (
    <section className="space-y-2">
      <Heading>Proof of payment</Heading>
      {evidence ? (
        <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
          <span className="min-w-0 break-words text-foreground">
            {evidence.fileName}
            <span className="block text-xs text-muted-foreground">{fileSizeLabel(evidence.byteSize)}</span>
          </span>
          <Button variant="outline" size="sm" onClick={onView}>Open</Button>
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">
          {actions.earmark ? "Set the event this money was meant for, then attach proof of payment." : "No proof is attached yet. Attach the bank statement line or wallet screenshot."}
        </p>
      )}
    </section>
  );
}

function Allocations({ receipt, onUndo }: { receipt: PrismPaymentReceipt; onUndo: (recordId: string) => void }) {
  if (receipt.allocations.length === 0) return <p className="text-xs text-muted-foreground">Nothing has been applied to a milestone yet.</p>;
  return (
    <section className="space-y-2">
      <Heading>Where the money went</Heading>
      <ul className="divide-y divide-border text-sm">
        {receipt.allocations.map((slice) => (
          <li key={slice.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
            <span className={slice.reversed ? "text-muted-foreground line-through" : "text-foreground"}>
              {slice.milestoneLabel ?? "Milestone"} · {money.format(slice.amount)}
            </span>
            {slice.reversed
              ? <span className="text-xs text-muted-foreground">Undone{slice.reversalReason ? `: ${slice.reversalReason}` : ""}</span>
              : <Button variant="ghost" size="sm" onClick={() => onUndo(slice.id)}>Undo</Button>}
          </li>
        ))}
      </ul>
    </section>
  );
}

function Refunds({ receipt }: { receipt: PrismPaymentReceipt }) {
  if (receipt.refunds.length === 0) return null;
  return (
    <section className="space-y-2">
      <Heading>Paid back</Heading>
      <ul className="divide-y divide-border text-sm">
        {receipt.refunds.map((refund) => (
          <li key={refund.id} className="py-2 text-foreground">
            {money.format(refund.amount)} on {formatPortalDate(refund.refundedDate)} by {refund.method}
            <span className="block text-xs text-muted-foreground">{refund.reason}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function Actions({ receipt, onOpen }: { receipt: PrismPaymentReceipt; onOpen: (dialog: ReceiptDialog) => void }) {
  const actions = receiptActions(receipt);
  const buttons: Array<{ show: boolean; kind: ReceiptDialog["kind"]; label: string; primary?: boolean }> = [
    { show: actions.allocate, kind: "allocate", label: "Apply to a milestone", primary: true },
    { show: actions.earmark, kind: "earmark", label: "Set event" },
    { show: actions.attachEvidence, kind: "evidence", label: receipt.evidence ? "Replace proof" : "Attach proof" },
    { show: actions.verify, kind: "verify", label: "Verify" },
    { show: actions.refund, kind: "refund", label: "Record refund" },
    { show: actions.reject, kind: "reject", label: "Reject" },
    { show: actions.reverse, kind: "reverse", label: "Reverse" },
  ];
  return (
    <div className="flex flex-wrap gap-2">
      {buttons.filter((button) => button.show).map((button) => (
        <Button key={button.kind} size="sm" variant={button.primary ? "default" : "outline"} onClick={() => onOpen({ kind: button.kind } as ReceiptDialog)}>{button.label}</Button>
      ))}
    </div>
  );
}

export function ReceiptDetailPanel({ vm }: { vm: PaymentReceiptsViewModel }) {
  const receipt = vm.selected;
  if (!receipt) return <PrismEmptyLine icon={ReceiptText}>Select a receipt to see where its money went.</PrismEmptyLine>;
  return (
    <aside aria-label="Receipt details" className="space-y-5 rounded-lg border border-border bg-card p-5">
      <DetailHeader receipt={receipt} />
      <Balances receipt={receipt} />
      <Notes receipt={receipt} />
      <Evidence receipt={receipt} onView={() => void vm.openEvidence()} />
      <Allocations receipt={receipt} onUndo={(recordId) => vm.openDialog({ kind: "reverse-allocation", recordId })} />
      <Refunds receipt={receipt} />
      <Actions receipt={receipt} onOpen={vm.openDialog} />
    </aside>
  );
}
