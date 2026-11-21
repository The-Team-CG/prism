"use client";

import { useState } from "react";
import Link from "next/link";
import {
  AlertTriangle, ArrowDownToLine, BadgeCheck, BellRing, ChevronDown, ChevronRight, FilePen, Hourglass, Inbox, Scale, Search, Send, Truck, type LucideIcon,
} from "lucide-react";
import type { PrismFinanceDeskItem, PrismFinanceDeskItemKind } from "@prism/types";
import { Button } from "@prism/ui/components/button";
import { Checkbox } from "@prism/ui/components/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@prism/ui/components/dialog";
import { Field, FieldDescription, FieldLabel } from "@prism/ui/components/field";
import { Input } from "@prism/ui/components/input";
import { Textarea } from "@prism/ui/components/textarea";
import { PrismEmptyLine, PrismSection } from "@prism/ui/page-blocks";
import { formatPeso } from "@prism/ui/payment-track";
import { cn } from "@/app/components/ui/utils";
import { QUEUE_GROUPS } from "../model/finance-desk-analysis";
import { canRemind, canVerify, type FinanceDeskViewModel } from "../view-models/use-finance-desk-view-model";

const KIND_LOOK: Record<PrismFinanceDeskItemKind, { icon: LucideIcon; tone: string }> = {
  client_overdue: { icon: AlertTriangle, tone: "bg-danger-soft text-danger" },
  supplier_overdue: { icon: Truck, tone: "bg-danger-soft text-danger" },
  verify_payment: { icon: Hourglass, tone: "bg-info-soft text-info" },
  apply_money: { icon: ArrowDownToLine, tone: "bg-info-soft text-info" },
  dispute: { icon: Scale, tone: "bg-attention-soft text-attention" },
  correction: { icon: FilePen, tone: "bg-attention-soft text-attention" },
  supplier_due_soon: { icon: Truck, tone: "bg-attention-soft text-attention" },
  approve_source: { icon: BadgeCheck, tone: "bg-muted text-muted-foreground" },
  send_statement: { icon: Send, tone: "bg-muted text-muted-foreground" },
};

function RowAction({ item, vm }: { item: PrismFinanceDeskItem; vm: FinanceDeskViewModel }) {
  if (canVerify(item)) {
    return <Button type="button" size="sm" variant="outline" className="relative z-10" onClick={() => vm.verify.open([item])}>Verify</Button>;
  }
  if (canRemind(item)) {
    const busy = vm.reminders.busyId === item.id;
    return (
      <Button type="button" size="sm" variant="outline" className="relative z-10" disabled={busy} onClick={() => void vm.reminders.remind(item)}>
        <BellRing aria-hidden className="size-4" />{busy ? "Sending…" : "Remind"}
      </Button>
    );
  }
  return <ChevronRight aria-hidden className="size-4 text-muted-foreground" />;
}

function QueueRow({ item, vm }: { item: PrismFinanceDeskItem; vm: FinanceDeskViewModel }) {
  const look = KIND_LOOK[item.kind];
  const Icon = look.icon;
  const selectable = canVerify(item);
  return (
    <li className={cn("relative grid grid-cols-[1.25rem_2.25rem_minmax(0,1fr)_auto] items-center gap-3 px-5 py-3 hover:bg-muted/40", vm.selected.has(item.id) && "bg-primary-soft/40")}>
      {selectable
        ? <Checkbox className="relative z-10" checked={vm.selected.has(item.id)} onCheckedChange={() => vm.toggle(item.id)} aria-label={`Select ${item.title}`} />
        : <span aria-hidden />}
      <span aria-hidden className={cn("grid size-9 place-items-center rounded-full", look.tone)}><Icon className="size-4" /></span>
      <span className="min-w-0">
        <span className="flex min-w-0 items-center gap-2">
          <Link href={item.href} className="truncate text-sm font-semibold text-foreground outline-none after:absolute after:inset-0">{item.title}</Link>
          {vm.isNew(item) ? <span className="shrink-0 rounded-md bg-primary-soft px-1.5 py-0.5 text-[11px] font-medium text-primary">New</span> : null}
        </span>
        <span className="block truncate text-xs text-muted-foreground">{item.eventName ? `${item.eventName} · ` : ""}{item.detail}</span>
      </span>
      <RowAction item={item} vm={vm} />
    </li>
  );
}

function Filters({ vm }: { vm: FinanceDeskViewModel }) {
  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-border px-5 pb-3">
      <div className="relative w-full sm:w-64">
        <Search aria-hidden className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input type="search" value={vm.query} onChange={(event) => vm.setQuery(event.target.value)} placeholder="Search events, clients, amounts" aria-label="Search the queue" className="pl-8" />
      </div>
      <div role="group" aria-label="Kind of work" className="flex flex-wrap gap-1">
        {QUEUE_GROUPS.map((group) => (
          <button
            key={group.id} type="button" aria-pressed={vm.group === group.id} onClick={() => vm.setGroup(group.id)}
            disabled={group.id !== "all" && vm.counts[group.id] === 0}
            className={cn("rounded-md px-2.5 py-1 text-sm transition-colors disabled:opacity-40", vm.group === group.id ? "bg-foreground text-background" : "text-muted-foreground hover:bg-muted hover:text-foreground")}
          >
            {group.label} <span className="tabular-nums opacity-70">{vm.counts[group.id]}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function SelectionBar({ vm }: { vm: FinanceDeskViewModel }) {
  const verifiable = vm.items.filter(canVerify);
  if (verifiable.length < 2 && vm.selectedItems.length === 0) return null;
  const total = vm.selectedItems.reduce((sum, item) => sum + (item.amount ?? 0), 0);
  return (
    <div className="flex flex-wrap items-center gap-3 border-b border-border bg-surface-raised px-5 py-2 text-sm">
      <label className="flex items-center gap-2 text-muted-foreground">
        <Checkbox checked={vm.allSelected} onCheckedChange={(value) => vm.selectAll(value === true)} />
        Select every payment to verify
      </label>
      {vm.selectedItems.length > 0 ? (
        <>
          <span className="tabular-nums text-foreground">{vm.selectedItems.length} selected · {formatPeso(total)}</span>
          <Button type="button" size="sm" className="ml-auto" onClick={() => vm.verify.open(vm.selectedItems)}>Verify {vm.selectedItems.length}</Button>
          <Button type="button" size="sm" variant="ghost" onClick={vm.clearSelection}>Clear</Button>
        </>
      ) : null}
    </div>
  );
}

function VerifyDialog({ vm }: { vm: FinanceDeskViewModel }) {
  const { verify } = vm;
  const many = verify.targets.length > 1;
  const total = verify.targets.reduce((sum, item) => sum + (item.amount ?? 0), 0);
  return (
    <Dialog open={verify.targets.length > 0} onOpenChange={(open) => { if (!open) verify.close(); }}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{many ? `Verify ${verify.targets.length} payments` : "Verify this payment"}</DialogTitle>
          <DialogDescription>Confirm {many ? "these transfers" : "the transfer"} reached PMCM&apos;s account. {many ? "Each client is" : "The client is"} told once it is verified.</DialogDescription>
        </DialogHeader>
        <ul className="max-h-48 divide-y divide-border overflow-y-auto rounded-md border border-border text-sm">
          {verify.targets.map((item) => (
            <li key={item.id} className="flex justify-between gap-3 px-3 py-2"><span className="min-w-0 truncate">{item.eventName ?? item.title}</span><span className="shrink-0 tabular-nums">{item.amount ? formatPeso(item.amount) : ""}</span></li>
          ))}
        </ul>
        {many ? <p className="text-sm tabular-nums text-muted-foreground">Total {formatPeso(total)}</p> : null}
        <Field>
          <FieldLabel htmlFor="desk-verify-note">What you checked</FieldLabel>
          <Textarea id="desk-verify-note" rows={2} maxLength={1000} value={verify.note} onChange={(event) => verify.setNote(event.target.value)} placeholder="Matched against the BPI statement for 14 Nov" />
          <FieldDescription>{many ? "The same note is saved on every payment." : "Saved with the payment for the audit trail."}</FieldDescription>
        </Field>
        {verify.error ? <p role="alert" className="text-sm text-destructive">{verify.error}</p> : null}
        <DialogFooter>
          <Button type="button" variant="ghost" onClick={verify.close}>Cancel</Button>
          <Button type="button" disabled={verify.busy} onClick={() => void verify.submit()}>{verify.busy ? "Verifying…" : many ? `Verify ${verify.targets.length}` : "Verify"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Rows shown before "Show more"; filtering or searching shows every match. */
const QUEUE_SHOWN = 5;

/** The work waiting on PMCM, most urgent first, with the quick jobs done in place. */
export function FinanceQueue({ total, vm }: { total: number; vm: FinanceDeskViewModel }) {
  const [expanded, setExpanded] = useState(false);
  const narrowed = vm.group !== "all" || vm.query.trim() !== "";
  const shown = expanded || narrowed ? vm.items : vm.items.slice(0, QUEUE_SHOWN);
  const hidden = vm.items.length - shown.length;
  return (
    <PrismSection id="finance-queue" title="Needs you" count={total} flush>
      {total === 0 ? (
        <div className="px-5 pb-4"><PrismEmptyLine icon={Inbox}>Nothing waiting. Payments, receipts, disputes and supplier payouts that need you appear here.</PrismEmptyLine></div>
      ) : (
        <>
          <Filters vm={vm} />
          <SelectionBar vm={vm} />
          {vm.items.length === 0
            ? <div className="px-5 py-4"><PrismEmptyLine icon={Search}>Nothing matches. Try another word or kind of work.</PrismEmptyLine></div>
            : <ul className="divide-y divide-border">{shown.map((item) => <QueueRow key={item.id} item={item} vm={vm} />)}</ul>}
          {hidden > 0 ? (
            <button type="button" onClick={() => setExpanded(true)} className="flex min-h-11 w-full items-center gap-1 border-t border-border px-5 text-sm font-medium text-primary hover:bg-surface-raised">
              Show {hidden} more<ChevronDown aria-hidden className="size-4" />
            </button>
          ) : null}
        </>
      )}
      <VerifyDialog vm={vm} />
    </PrismSection>
  );
}
