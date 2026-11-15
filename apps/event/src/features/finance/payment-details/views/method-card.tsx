"use client";

import { ChevronDown, ChevronUp, Landmark, ReceiptText, Smartphone, Trash2, type LucideIcon } from "lucide-react";
import type { PaymentMethod, PaymentMethodKind } from "@prism/types";
import { Button } from "@prism/ui/components/button";
import { Card } from "@prism/ui/components/card";
import { Field, FieldLabel } from "@prism/ui/components/field";
import { Input } from "@prism/ui/components/input";
import { Switch } from "@prism/ui/components/switch";
import { Textarea } from "@prism/ui/components/textarea";
import { cn } from "@/app/components/ui/utils";
import { KIND_LABEL, lastDigits, methodProblems } from "../model/payment-details-draft";
import type { PaymentDetailsViewModel } from "../view-models/use-payment-details-view-model";
import { QrField, QrPicture } from "./qr-field";

const KIND_ICON: Record<PaymentMethodKind, LucideIcon> = { bank: Landmark, ewallet: Smartphone, cheque: ReceiptText };

function subtitle(method: PaymentMethod): string {
  const digits = lastDigits(method);
  const parts = [KIND_LABEL[method.kind], digits ? `ends ${digits}` : null, "qrImageId" in method && method.qrImageId ? "QR attached" : null];
  return parts.filter(Boolean).join(" · ");
}

function MethodHeader({ method, index, count, open, vm }: { method: PaymentMethod; index: number; count: number; open: boolean; vm: PaymentDetailsViewModel }) {
  const Icon = KIND_ICON[method.kind];
  return (
    <div className="flex items-center gap-3 p-3 sm:p-4">
      <button type="button" aria-expanded={open} onClick={() => vm.setOpenId(open ? null : method.id)} className="flex min-w-0 flex-1 items-center gap-3 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring">
        <span aria-hidden className="grid size-9 shrink-0 place-items-center rounded-full bg-muted text-muted-foreground"><Icon className="size-4" /></span>
        <span className="min-w-0">
          <span className="flex items-center gap-2">
            <span className={cn("truncate text-sm font-semibold", method.enabled ? "text-foreground" : "text-muted-foreground")}>{method.label || KIND_LABEL[method.kind]}</span>
            {method.enabled ? null : <span className="text-xs text-muted-foreground">Off</span>}
          </span>
          <span className="block truncate text-xs text-muted-foreground">{subtitle(method)}</span>
        </span>
      </button>
      {"qrImageId" in method && method.qrImageId ? <span className="hidden sm:block"><QrPicture imageId={method.qrImageId} size={36} /></span> : null}
      <Switch checked={method.enabled} onCheckedChange={(value) => vm.set(method.id, "enabled", value)} aria-label={`${method.label || KIND_LABEL[method.kind]} shown to clients`} />
      <div className="flex">
        <Button type="button" size="icon" variant="ghost" className="size-8" disabled={index === 0} aria-label={`Move ${method.label} up`} onClick={() => vm.move(method.id, -1)}><ChevronUp className="size-4" /></Button>
        <Button type="button" size="icon" variant="ghost" className="size-8" disabled={index === count - 1} aria-label={`Move ${method.label} down`} onClick={() => vm.move(method.id, 1)}><ChevronDown className="size-4" /></Button>
      </div>
    </div>
  );
}

function MethodForm({ method, vm }: { method: PaymentMethod; vm: PaymentDetailsViewModel }) {
  const cheque = method.kind === "cheque";
  const id = (name: string) => `${method.id}-${name}`;
  const problems = methodProblems(method);
  return (
    <div className="grid gap-3 border-t border-border p-3 sm:grid-cols-2 sm:p-4">
      <Field>
        <FieldLabel htmlFor={id("label")}>Name clients see</FieldLabel>
        <Input id={id("label")} value={method.label} maxLength={60} onChange={(event) => vm.set(method.id, "label", event.target.value)} />
      </Field>
      <Field>
        <FieldLabel htmlFor={id("name")}>{cheque ? "Payable to" : "Account name"}</FieldLabel>
        <Input id={id("name")} value={method.accountName} maxLength={120} onChange={(event) => vm.set(method.id, "accountName", event.target.value)} />
      </Field>
      {method.kind !== "cheque" ? (
        <Field>
          <FieldLabel htmlFor={id("number")}>Account number</FieldLabel>
          <Input id={id("number")} inputMode="numeric" value={method.accountNumber} maxLength={60} onChange={(event) => vm.set(method.id, "accountNumber", event.target.value)} />
        </Field>
      ) : null}
      <Field className="sm:col-span-2">
        <FieldLabel htmlFor={id("instructions")}>Instructions (optional)</FieldLabel>
        <Textarea id={id("instructions")} rows={2} maxLength={500} value={method.instructions} onChange={(event) => vm.set(method.id, "instructions", event.target.value)} />
      </Field>
      {method.kind !== "cheque" ? (
        <div className="sm:col-span-2">
          <QrField imageId={method.qrImageId} uploading={vm.uploadingId === method.id} onUpload={(file) => void vm.uploadQr(method.id, file)} onRemove={() => vm.set(method.id, "qrImageId", null)} />
        </div>
      ) : null}
      {problems.length > 0 ? <p role="alert" className="text-sm text-destructive sm:col-span-2">{problems.join(" ")}</p> : null}
      <div className="sm:col-span-2">
        <Button type="button" size="sm" variant="ghost" className="text-destructive hover:text-destructive" onClick={() => vm.remove(method.id)}><Trash2 className="size-4" aria-hidden /> Remove</Button>
      </div>
    </div>
  );
}

/** One payment method: a row to read, switch, reorder, and a form that opens under it. */
export function MethodCard({ method, index, count, vm }: { method: PaymentMethod; index: number; count: number; vm: PaymentDetailsViewModel }) {
  const open = vm.openId === method.id;
  return (
    <Card className="gap-0 overflow-hidden py-0">
      <MethodHeader method={method} index={index} count={count} open={open} vm={vm} />
      {open ? <MethodForm method={method} vm={vm} /> : null}
    </Card>
  );
}
