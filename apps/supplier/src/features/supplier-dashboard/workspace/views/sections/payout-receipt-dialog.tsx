"use client";

import { Button } from "@prism/ui/components/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@prism/ui/components/dialog";
import { Field, FieldDescription, FieldLabel } from "@prism/ui/components/field";
import { Input } from "@prism/ui/components/input";
import { formatPortalDate } from "@prism/ui/format-date";
import { formatPeso } from "@prism/ui/payment-track";
import type { PayoutReceiptViewModel } from "../../view-models/use-payout-receipt";

const RECEIPT_ACCEPT = "application/pdf,image/jpeg,image/png";

/** Confirm a transfer reached the supplier, and attach their official receipt now or later. */
export function PayoutReceiptDialog({ vm }: { vm: PayoutReceiptViewModel }) {
  const target = vm.target;
  const addingReceipt = Boolean(target?.alreadyConfirmed);
  return (
    <Dialog open={target !== null} onOpenChange={(open) => { if (!open) vm.close(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{addingReceipt ? "Send your official receipt" : "I received this payment"}</DialogTitle>
          <DialogDescription>
            {target ? `${formatPeso(target.record.amount)} for ${target.label}, sent ${formatPortalDate(target.record.paymentDate)} by ${target.record.method}${target.record.referenceNumber ? ` (ref ${target.record.referenceNumber})` : ""}.` : null}
            {addingReceipt ? "" : " PMCM is told it reached you."}
          </DialogDescription>
        </DialogHeader>
        <Field>
          <FieldLabel htmlFor="payout-official-receipt">Your official receipt{addingReceipt ? "" : " (optional)"}</FieldLabel>
          <Input id="payout-official-receipt" type="file" accept={RECEIPT_ACCEPT} onChange={(event) => vm.setFile(event.target.files?.[0] ?? null)} />
          <FieldDescription>A PDF or photo of the official receipt you issued PMCM. You can also send it later.</FieldDescription>
        </Field>
        {vm.error ? <p role="alert" className="text-sm text-destructive">{vm.error}</p> : null}
        <DialogFooter>
          <Button type="button" variant="ghost" onClick={vm.close}>Cancel</Button>
          <Button type="button" disabled={vm.busy} onClick={() => void vm.submit()}>{vm.busy ? "Sending…" : addingReceipt ? "Send receipt" : "Confirm received"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
