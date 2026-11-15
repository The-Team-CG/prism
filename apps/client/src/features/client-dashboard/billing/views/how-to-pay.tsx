"use client";

import { useState } from "react";
import Link from "next/link";
import { Check, Copy, Download, Landmark, QrCode } from "lucide-react";
import type { PaymentMethod } from "@prism/types";
import { Button } from "@prism/ui/components/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@prism/ui/components/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@prism/ui/components/tabs";
import { formatPeso } from "@prism/ui/payment-track";
import { payToPanels, qrFileName, type PayToPanel } from "../model/how-to-pay";
import { usePaymentQr } from "../view-models/use-payment-qr";

function CopyButton({ text, label }: { text: string; label: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      aria-label={`Copy ${label}`}
      className="inline-flex shrink-0 items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-primary hover:bg-primary-soft"
      onClick={() => {
        void navigator.clipboard?.writeText(text).then(() => {
          setCopied(true);
          window.setTimeout(() => setCopied(false), 1500);
        });
      }}
    >
      {copied ? <Check className="size-3.5" aria-hidden /> : <Copy className="size-3.5" aria-hidden />} {copied ? "Copied" : "Copy"}
    </button>
  );
}

/** One line to read and copy: what it is, its value, and a button that copies the value (or `copy`, when what is shown is formatted). */
function CopyRow({ label, value, copy, strong }: { label: string; value: string; copy?: string; strong?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-md bg-muted/50 px-3 py-2">
      <p className="min-w-0 text-xs text-muted-foreground">
        {label}
        <span className={strong ? "block break-words text-base font-semibold tabular-nums text-foreground" : "block break-words text-sm font-medium text-foreground"}>{value}</span>
      </p>
      <CopyButton text={copy ?? value} label={label.toLowerCase()} />
    </div>
  );
}

function saveBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * The QR for one account. A phone cannot scan its own screen, so it can be saved and opened from the banking or wallet
 * app. It loads only while its tab is showing.
 */
function PaymentQrImage({ eventId, panel, active }: { eventId: string; panel: PayToPanel; active: boolean }) {
  const qr = usePaymentQr(eventId, panel.qrImageId, active);
  if (!panel.qrImageId) return null;
  return (
    <div className="flex flex-wrap items-center gap-4">
      {qr.status === "ready" ? (
        <img src={qr.url} alt={`${panel.label} payment QR`} className="size-60 max-w-full rounded-lg border border-border bg-white object-contain p-2" />
      ) : (
        <span className="grid size-60 max-w-full place-items-center rounded-lg border border-dashed border-border bg-muted/40 px-4 text-center text-sm text-muted-foreground">
          {qr.status === "error" ? "The QR could not be loaded. Use the account number instead." : <QrCode aria-hidden className="size-10" />}
        </span>
      )}
      <div className="min-w-0 flex-1 basis-40 space-y-2">
        <p className="text-sm text-muted-foreground">Scan this from your banking or wallet app. On a phone, save it first, then open it from the app.</p>
        {qr.status === "ready" ? (
          <Button type="button" size="sm" variant="outline" onClick={() => saveBlob(qr.blob, qrFileName(panel.label, qr.blob.type))}><Download className="size-4" aria-hidden /> Save QR</Button>
        ) : null}
      </div>
    </div>
  );
}

function MethodPanel({ eventId, panel, active }: { eventId: string; panel: PayToPanel; active: boolean }) {
  return (
    <div className="space-y-3">
      {panel.fields.map((field) => <CopyRow key={field.label} label={field.label} value={field.value} />)}
      {panel.instructions ? <p className="whitespace-pre-line text-sm text-muted-foreground">{panel.instructions}</p> : null}
      <PaymentQrImage eventId={eventId} panel={panel} active={active} />
    </div>
  );
}

function Methods({ eventId, panels }: { eventId: string; panels: PayToPanel[] }) {
  const [current, setCurrent] = useState(panels[0]?.id ?? "");
  if (panels.length === 1) return <MethodPanel eventId={eventId} panel={panels[0]} active />;
  return (
    <Tabs value={panels.some((panel) => panel.id === current) ? current : panels[0].id} onValueChange={setCurrent}>
      <TabsList className="h-auto flex-wrap justify-start">
        {panels.map((panel) => <TabsTrigger key={panel.id} value={panel.id}>{panel.label}</TabsTrigger>)}
      </TabsList>
      {panels.map((panel) => (
        <TabsContent key={panel.id} value={panel.id} className="mt-3">
          <MethodPanel eventId={eventId} panel={panel} active={panel.id === current} />
        </TabsContent>
      ))}
    </Tabs>
  );
}

function Nothing({ messagesHref }: { messagesHref: string }) {
  return (
    <div className="space-y-3 rounded-md border border-dashed border-border p-4 text-sm text-muted-foreground">
      <p>PMCM has not shared where to send payments yet. Please message PMCM before sending any money.</p>
      <Button asChild size="sm" variant="outline"><Link href={messagesHref}>Message PMCM</Link></Button>
    </div>
  );
}

/**
 * Where to send the money, with everything the client needs to pay: the amount to send, the reference to write, and each
 * account PMCM has turned on with its own copy buttons and QR. A dialog, and a bottom sheet on a phone.
 */
export function HowToPay({ eventId, payTo, changedSinceIssued, statementNumber, amount, messagesHref }: {
  eventId: string;
  payTo: PaymentMethod[];
  changedSinceIssued: boolean;
  statementNumber: string | null;
  amount: number;
  messagesHref: string;
}) {
  const panels = payToPanels(payTo);
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline"><Landmark className="size-4" aria-hidden /> How to pay</Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90dvh] gap-4 overflow-y-auto max-sm:top-auto max-sm:bottom-0 max-sm:max-w-full max-sm:translate-y-0 max-sm:rounded-b-none sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>How to pay</DialogTitle>
          <DialogDescription>Send the payment, then choose I&apos;ve paid and add a screenshot or PDF of the transfer.</DialogDescription>
        </DialogHeader>
        {changedSinceIssued && panels.length > 0 ? (
          <p role="status" className="rounded-md border border-attention/40 bg-attention-soft px-3 py-2 text-sm text-attention">
            PMCM updated its payment details after this statement was issued. Use the details below, not an older copy.
          </p>
        ) : null}
        {amount > 0 ? <CopyRow label="Amount to send" value={formatPeso(amount)} copy={String(amount)} strong /> : null}
        {statementNumber ? <CopyRow label="Reference to write" value={statementNumber} /> : null}
        {panels.length > 0 ? <Methods eventId={eventId} panels={panels} /> : <Nothing messagesHref={messagesHref} />}
      </DialogContent>
    </Dialog>
  );
}
