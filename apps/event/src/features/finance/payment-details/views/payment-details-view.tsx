"use client";

import { Plus, WalletCards } from "lucide-react";
import { Button } from "@prism/ui/components/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@prism/ui/components/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@prism/ui/components/dropdown-menu";
import { PrismEmptyLine } from "@prism/ui/page-blocks";
import { KIND_LABEL } from "../model/payment-details-draft";
import { usePaymentDetailsViewModel, type PaymentDetailsViewModel } from "../view-models/use-payment-details-view-model";
import { ClientPreview } from "./client-preview";
import { MethodCard } from "./method-card";

const KINDS = ["bank", "ewallet", "cheque"] as const;

function AddMenu({ vm, label = "Add payment method" }: { vm: PaymentDetailsViewModel; label?: string }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild><Button type="button" size="sm"><Plus className="size-4" aria-hidden /> {label}</Button></DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {KINDS.map((kind) => <DropdownMenuItem key={kind} onSelect={() => vm.add(kind)}>{KIND_LABEL[kind]}</DropdownMenuItem>)}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function SaveBar({ vm }: { vm: PaymentDetailsViewModel }) {
  if (!vm.dirty && !vm.error) return null;
  return (
    <div className="sticky bottom-4 z-10 space-y-2 rounded-xl border border-border bg-card p-3 shadow-md">
      {vm.error ? (
        <p role="alert" className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-destructive">
          {vm.error}
          {vm.conflict ? <Button type="button" size="sm" variant="outline" onClick={() => void vm.reload()}>Reload and lose my changes</Button> : null}
        </p>
      ) : null}
      {vm.dirty ? (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm text-muted-foreground">Unsaved changes. Clients see nothing new until you save.</p>
          <div className="flex gap-2">
            <Button type="button" variant="ghost" disabled={vm.busy} onClick={vm.discard}>Discard</Button>
            <Button type="button" disabled={vm.busy} onClick={() => void vm.save()}>{vm.busy ? "Saving…" : "Save"}</Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

/** Changing an account number takes effect for every client at once, so it is confirmed first. */
function ConfirmNumberChange({ vm }: { vm: PaymentDetailsViewModel }) {
  const names = vm.confirmNumbers ?? [];
  return (
    <Dialog open={names.length > 0} onOpenChange={(open) => { if (!open) vm.cancelConfirm(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Change the account number?</DialogTitle>
          <DialogDescription>
            Clients will be told to pay the new {names.length === 1 ? `${names[0]} account number` : `account numbers for ${names.join(", ")}`} as soon as you save,
            including clients who already have a statement. Check it is right before you continue.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button type="button" variant="ghost" onClick={vm.cancelConfirm}>Keep editing</Button>
          <Button type="button" onClick={() => void vm.save(true)}>Save the change</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Methods({ vm }: { vm: PaymentDetailsViewModel }) {
  if (vm.draft.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border p-5">
        <PrismEmptyLine icon={WalletCards} action={<AddMenu vm={vm} label="Add the first one" />}>
          No payment details yet. Statements cannot be issued until at least one account is added, and clients are told to message PMCM before sending money.
        </PrismEmptyLine>
      </div>
    );
  }
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="min-w-0 flex-1 basis-56 text-sm text-muted-foreground">Clients see these in the order shown. Turn one off to hide it without deleting it.</p>
        <AddMenu vm={vm} />
      </div>
      {vm.draft.map((method, index) => <MethodCard key={method.id} method={method} index={index} count={vm.draft.length} vm={vm} />)}
    </div>
  );
}

/**
 * PMCM's one set of payment details: bank accounts, e-wallets and a cheque payee, each with the QR clients scan. What is
 * saved here is what every client is told to pay to, so edits are explicit and the preview shows them as the client sees them.
 */
export function PaymentDetailsView() {
  const vm = usePaymentDetailsViewModel();
  if (vm.loadError) return <p role="alert" className="text-sm text-destructive">{vm.loadError}</p>;
  if (!vm.ready) return <p className="text-sm text-muted-foreground">Loading payment details…</p>;
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <Methods vm={vm} />
        <div className="lg:sticky lg:top-4"><ClientPreview methods={vm.draft} /></div>
      </div>
      <SaveBar vm={vm} />
      <ConfirmNumberChange vm={vm} />
    </div>
  );
}
