"use client";

import { useState, type ReactNode } from "react";
import type { PrismEvent, PrismPaymentReceipt } from "@prism/types";
import { Button } from "@prism/ui/components/button";
import { DatePicker } from "@prism/ui/components/date-picker";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@prism/ui/components/dialog";
import { manilaDateKey } from "@prism/ui/format-date";
import { money } from "@/features/pmcm-kit";
import type { PaymentReceiptsViewModel } from "../view-models/use-payment-receipts-view-model";
import type { ReceiptDraft, RefundDraft } from "../use-cases/receipt-commands";
import { EventField, Field, INPUT_CLASS, MethodField, MilestoneField } from "./receipt-form-fields";

function DialogFrame({
  eyebrow,
  title,
  error,
  busy,
  submitLabel,
  tone = "default",
  onClose,
  onSubmit,
  children,
}: {
  eyebrow: string;
  title: string;
  error: string | null;
  busy: boolean;
  submitLabel: string;
  tone?: "default" | "destructive";
  onClose: () => void;
  onSubmit: () => void;
  children: ReactNode;
}) {
  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-w-lg gap-0 p-0">
        <DialogHeader className="gap-1 border-b border-border px-6 py-4 pr-12 text-left">
          <DialogDescription>{eyebrow}</DialogDescription>
          <DialogTitle className="truncate text-base font-semibold">{title}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 px-6 py-5">
          {children}
          {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
        </div>
        <DialogFooter className="border-t border-border px-6 py-4">
          <Button variant="outline" className="rounded-lg font-semibold" onClick={onClose}>Cancel</Button>
          <Button variant={tone === "destructive" ? "destructive" : "default"} disabled={busy} onClick={onSubmit} className="rounded-lg font-semibold">
            {busy ? "Saving…" : submitLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

const blankReceipt = (): ReceiptDraft => ({
  amount: "", receivedDate: manilaDateKey(), method: "Bank Transfer", referenceNumber: "", payerName: "", eventId: "", notes: "", milestoneId: "",
});

function RecordReceiptDialog({ vm, events }: { vm: PaymentReceiptsViewModel; events: PrismEvent[] }) {
  const [draft, setDraft] = useState<ReceiptDraft>(blankReceipt);
  const set = <K extends keyof ReceiptDraft>(key: K, value: ReceiptDraft[K]) => setDraft((current) => ({ ...current, [key]: value }));
  return (
    <DialogFrame eyebrow="Money received outside P.R.I.S.M" title="Record receipt" error={vm.error} busy={vm.busy} submitLabel="Record receipt" onClose={vm.closeDialog} onSubmit={() => void vm.record(draft)}>
      <Field label="Amount received (PHP)">
        <input inputMode="numeric" value={draft.amount} onChange={(event) => set("amount", event.target.value)} className={INPUT_CLASS} placeholder="50,000" />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block text-sm font-semibold text-foreground">
          Date it arrived
          <span className="mt-1.5 block font-normal"><DatePicker value={draft.receivedDate} onValueChange={(value) => set("receivedDate", value)} aria-label="Date it arrived" className="h-10" /></span>
        </label>
        <MethodField label="How it arrived" value={draft.method} onChange={(method) => set("method", method)} />
      </div>
      <Field label="Bank or wallet reference" hint="The same transfer cannot be recorded twice. Leave blank for cash or a cheque without one.">
        <input value={draft.referenceNumber} onChange={(event) => set("referenceNumber", event.target.value)} className={INPUT_CLASS} />
      </Field>
      <Field label="Paid by">
        <input value={draft.payerName} onChange={(event) => set("payerName", event.target.value)} className={INPUT_CLASS} />
      </Field>
      <EventField label="Event it was meant for" hint="Applying it to a milestone decides where the money actually goes." value={draft.eventId} events={events} onChange={(eventId) => setDraft((current) => ({ ...current, eventId, milestoneId: "" }))} />
      <MilestoneField label="Apply it now" eventId={draft.eventId} value={draft.milestoneId} allowNone onChange={(milestoneId) => set("milestoneId", milestoneId)} />
    </DialogFrame>
  );
}

function AllocateDialog({ vm, receipt, events }: { vm: PaymentReceiptsViewModel; receipt: PrismPaymentReceipt; events: PrismEvent[] }) {
  const [eventId, setEventId] = useState(receipt.eventId ?? "");
  const [milestoneId, setMilestoneId] = useState("");
  const [amount, setAmount] = useState(String(receipt.unapplied));
  const choose = (id: string, remaining: number | null) => {
    setMilestoneId(id);
    if (remaining !== null) setAmount(String(Math.min(receipt.unapplied, remaining)));
  };
  return (
    <DialogFrame eyebrow={`${money.format(receipt.unapplied)} unapplied`} title="Apply to a milestone" error={vm.error} busy={vm.busy} submitLabel="Apply money" onClose={vm.closeDialog} onSubmit={() => void vm.allocate({ milestoneId, amount })}>
      <EventField label="Event" hint="Money can go to a different event than the one it was meant for." value={eventId} events={events} onChange={(next) => { setEventId(next); setMilestoneId(""); }} />
      <MilestoneField label="Milestone" eventId={eventId} value={milestoneId} onChange={choose} />
      <Field label="Amount to apply (PHP)" hint="At most what is unapplied and what the milestone still owes.">
        <input inputMode="numeric" value={amount} onChange={(event) => setAmount(event.target.value)} className={INPUT_CLASS} />
      </Field>
    </DialogFrame>
  );
}

type ReasonConfig = { eyebrow: string; title: string; label: string; hint?: string; submitLabel: string; tone?: "destructive" };

const REASON_DIALOGS: Record<"verify" | "reject" | "reverse" | "reverse-allocation", ReasonConfig> = {
  verify: { eyebrow: "Check against the statement", title: "Verify receipt", label: "What did you check?", hint: "For example the bank statement line it matches.", submitLabel: "Mark verified" },
  reject: { eyebrow: "The money never arrived", title: "Reject receipt", label: "Why was it rejected?", submitLabel: "Reject receipt", tone: "destructive" },
  reverse: { eyebrow: "Undo everything applied from it", title: "Reverse receipt", label: "Why is it being reversed?", hint: "For example a bounced cheque. Every payment applied from it is undone.", submitLabel: "Reverse receipt", tone: "destructive" },
  "reverse-allocation": { eyebrow: "The receipt stays; this payment is undone", title: "Undo this payment", label: "Why is it being undone?", hint: "For example it was applied to the wrong milestone. The money goes back to unapplied.", submitLabel: "Undo payment", tone: "destructive" },
};

function ReasonDialog({ vm, kind, onSubmit }: { vm: PaymentReceiptsViewModel; kind: keyof typeof REASON_DIALOGS; onSubmit: (text: string) => void }) {
  const [text, setText] = useState("");
  const config = REASON_DIALOGS[kind];
  return (
    <DialogFrame eyebrow={config.eyebrow} title={config.title} error={vm.error} busy={vm.busy} submitLabel={config.submitLabel} tone={config.tone} onClose={vm.closeDialog} onSubmit={() => onSubmit(text)}>
      <Field label={config.label} hint={config.hint}>
        <textarea rows={3} value={text} onChange={(event) => setText(event.target.value)} className="mt-1.5 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm font-normal" />
      </Field>
    </DialogFrame>
  );
}

function RefundDialog({ vm, receipt }: { vm: PaymentReceiptsViewModel; receipt: PrismPaymentReceipt }) {
  const [draft, setDraft] = useState<RefundDraft>({ amount: String(receipt.unapplied), refundedDate: manilaDateKey(), method: "Bank Transfer", referenceNumber: "", reason: "" });
  const set = <K extends keyof RefundDraft>(key: K, value: RefundDraft[K]) => setDraft((current) => ({ ...current, [key]: value }));
  return (
    <DialogFrame eyebrow={`${money.format(receipt.unapplied)} unapplied`} title="Record refund" error={vm.error} busy={vm.busy} submitLabel="Record refund" onClose={vm.closeDialog} onSubmit={() => void vm.refund(draft)}>
      <p className="text-sm text-muted-foreground">Record money you already paid back outside P.R.I.S.M. Only unapplied money can be refunded; undo a payment first to refund more.</p>
      <Field label="Amount paid back (PHP)">
        <input inputMode="numeric" value={draft.amount} onChange={(event) => set("amount", event.target.value)} className={INPUT_CLASS} />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block text-sm font-semibold text-foreground">
          Date paid back
          <span className="mt-1.5 block font-normal"><DatePicker value={draft.refundedDate} onValueChange={(value) => set("refundedDate", value)} aria-label="Date paid back" className="h-10" /></span>
        </label>
        <MethodField label="How it was paid back" value={draft.method} onChange={(method) => set("method", method)} />
      </div>
      <Field label="Reference">
        <input value={draft.referenceNumber} onChange={(event) => set("referenceNumber", event.target.value)} className={INPUT_CLASS} />
      </Field>
      <Field label="Why is it being paid back?">
        <input value={draft.reason} onChange={(event) => set("reason", event.target.value)} className={INPUT_CLASS} />
      </Field>
    </DialogFrame>
  );
}

/** Renders whichever dialog the desk has open. Each remounts when opened, so its fields start fresh. */
export function ReceiptDialogs({ vm, events }: { vm: PaymentReceiptsViewModel; events: PrismEvent[] }) {
  const { dialog, selected } = vm;
  if (!dialog) return null;
  if (dialog.kind === "record") return <RecordReceiptDialog vm={vm} events={events} />;
  if (!selected) return null;
  if (dialog.kind === "allocate") return <AllocateDialog vm={vm} receipt={selected} events={events} />;
  if (dialog.kind === "refund") return <RefundDialog vm={vm} receipt={selected} />;
  if (dialog.kind === "reverse-allocation") return <ReasonDialog vm={vm} kind="reverse-allocation" onSubmit={(text) => void vm.reverseAllocation(dialog.recordId, text)} />;
  const submit = { verify: vm.verify, reject: vm.reject, reverse: vm.reverse }[dialog.kind];
  return <ReasonDialog vm={vm} kind={dialog.kind} onSubmit={(text) => void submit(text)} />;
}
