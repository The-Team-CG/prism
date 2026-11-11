"use client";

import { ReceiptText } from "lucide-react";
import type { PrismPaymentReceipt } from "@prism/types";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@prism/ui/components/select";
import { StatusBadge } from "@prism/ui/components/status-badge";
import { formatPortalDate } from "@prism/ui/format-date";
import { PrismEmptyLine, PrismSection } from "@prism/ui/page-blocks";
import { cn } from "@/app/components/ui/utils";
import { money } from "@/features/pmcm-kit";
import { RECEIPT_FILTERS, RECEIPT_STATUS_LABELS, receiptTitle, type ReceiptFilter } from "../model/receipt-rules";
import type { PaymentReceiptsViewModel } from "../view-models/use-payment-receipts-view-model";

function ReceiptRow({ receipt, selected, onSelect }: { receipt: PrismPaymentReceipt; selected: boolean; onSelect: () => void }) {
  return (
    <li>
      <button
        type="button"
        aria-pressed={selected}
        onClick={onSelect}
        className={cn("flex w-full items-start justify-between gap-3 px-5 py-3 text-left hover:bg-muted/40", selected && "bg-muted/60")}
      >
        <span className="min-w-0">
          <span className="block truncate text-sm font-semibold text-foreground">{receiptTitle(receipt)}</span>
          <span className="block truncate text-xs text-muted-foreground">
            {receipt.payerName || "Payer not recorded"} · {receipt.method} · {formatPortalDate(receipt.receivedDate)}
          </span>
        </span>
        <span className="shrink-0 text-right">
          <span className="block text-sm font-semibold tabular-nums text-foreground">{money.format(receipt.amount)}</span>
          <span className="mt-0.5 flex items-center justify-end gap-2 text-xs text-muted-foreground">
            {receipt.unapplied > 0 && receipt.status !== "rejected" && receipt.status !== "reversed" ? `${money.format(receipt.unapplied)} unapplied` : null}
            <StatusBadge status={receipt.status} label={RECEIPT_STATUS_LABELS[receipt.status]} />
          </span>
        </span>
      </button>
    </li>
  );
}

function ListBody({ vm }: { vm: PaymentReceiptsViewModel }) {
  if (vm.loadError) return <p role="alert" className="px-5 py-4 text-sm text-destructive">{vm.loadError}</p>;
  if (vm.status === "pending") return <p className="px-5 py-4 text-sm text-muted-foreground">Loading receipts…</p>;
  if (vm.receipts.length === 0) {
    return <div className="px-5 py-4"><PrismEmptyLine icon={ReceiptText}>No receipts match this filter. Record money as it arrives, then apply it to a milestone.</PrismEmptyLine></div>;
  }
  return (
    <ul className="divide-y divide-border">
      {vm.receipts.map((receipt) => (
        <ReceiptRow key={receipt.id} receipt={receipt} selected={receipt.id === vm.selected?.id} onSelect={() => vm.select(receipt.id)} />
      ))}
    </ul>
  );
}

function FilterSelect({ value, onChange }: { value: ReceiptFilter; onChange: (value: ReceiptFilter) => void }) {
  return (
    <Select value={value} onValueChange={(next) => onChange(next as ReceiptFilter)}>
      <SelectTrigger aria-label="Filter receipts" className="h-9 w-44 rounded-lg text-sm">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {RECEIPT_FILTERS.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}
      </SelectContent>
    </Select>
  );
}

export function ReceiptList({ vm }: { vm: PaymentReceiptsViewModel }) {
  return (
    <PrismSection id="payment-receipts" title="Receipts" count={vm.receipts.length} flush action={<FilterSelect value={vm.filter} onChange={vm.setFilter} />}>
      <ListBody vm={vm} />
    </PrismSection>
  );
}
