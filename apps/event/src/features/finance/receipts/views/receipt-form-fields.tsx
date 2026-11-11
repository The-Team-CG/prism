"use client";

import type { ReactNode } from "react";
import { useResource } from "@prism/portal-query";
import { PAYMENT_RECEIPT_METHODS, type PrismEvent } from "@prism/types";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@prism/ui/components/select";
import { money } from "@/features/pmcm-kit";
import { paymentAllocationTargets } from "../data/receipts-repository";
import type { ReceiptMethod } from "../use-cases/receipt-commands";

/** Radix selects cannot hold an empty value, so "nothing chosen" is this stand-in. */
export const NONE = "__none__";

export const INPUT_CLASS = "mt-1.5 h-10 w-full rounded-lg border border-border bg-background px-3 text-sm font-normal";

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="block text-sm font-semibold text-foreground">
      {label}
      {children}
      {hint ? <span className="mt-1 block text-xs font-normal text-muted-foreground">{hint}</span> : null}
    </label>
  );
}

function SelectField({ label, hint, value, onChange, children }: { label: string; hint?: string; value: string; onChange: (value: string) => void; children: ReactNode }) {
  const labelId = `field-${label.toLowerCase().replace(/[^a-z]+/g, "-")}`;
  return (
    <div className="grid gap-1.5 text-sm font-semibold text-foreground">
      <span id={labelId}>{label}</span>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger aria-labelledby={labelId} className="h-10 w-full rounded-lg text-sm font-normal">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>{children}</SelectContent>
      </Select>
      {hint ? <span className="text-xs font-normal text-muted-foreground">{hint}</span> : null}
    </div>
  );
}

export function MethodField({ label, value, onChange }: { label: string; value: ReceiptMethod; onChange: (value: ReceiptMethod) => void }) {
  return (
    <SelectField label={label} value={value} onChange={(next) => onChange(next as ReceiptMethod)}>
      {PAYMENT_RECEIPT_METHODS.map((method) => <SelectItem key={method} value={method}>{method}</SelectItem>)}
    </SelectField>
  );
}

export function EventField({ label, hint, value, events, onChange }: { label: string; hint?: string; value: string; events: PrismEvent[]; onChange: (value: string) => void }) {
  return (
    <SelectField label={label} hint={hint} value={value || NONE} onChange={(next) => onChange(next === NONE ? "" : next)}>
      <SelectItem value={NONE}>No event yet</SelectItem>
      {events.map((event) => <SelectItem key={event.id} value={event.id}>{event.eventName}</SelectItem>)}
    </SelectField>
  );
}

/** The milestones of the chosen event that are still owed. Without an event there is nothing to choose from. */
export function MilestoneField({
  label,
  eventId,
  value,
  allowNone,
  onChange,
}: {
  label: string;
  eventId: string;
  value: string;
  allowNone?: boolean;
  onChange: (milestoneId: string, remaining: number | null) => void;
}) {
  const targets = useResource(paymentAllocationTargets, eventId || null);
  const options = targets.data ?? [];
  const hint = hintFor(eventId, targets.status, options.length);
  return (
    <SelectField label={label} hint={hint} value={value || NONE} onChange={(next) => onChange(next === NONE ? "" : next, options.find((option) => option.milestoneId === next)?.remainingBalance ?? null)}>
      {allowNone ? <SelectItem value={NONE}>Keep the money unapplied for now</SelectItem> : <SelectItem value={NONE} disabled>Choose a milestone</SelectItem>}
      {options.map((option) => (
        <SelectItem key={option.milestoneId} value={option.milestoneId}>{option.label} · {money.format(option.remainingBalance)} left</SelectItem>
      ))}
    </SelectField>
  );
}

function hintFor(eventId: string, status: "pending" | "ready" | "error", count: number): string | undefined {
  if (!eventId) return "Choose an event first.";
  if (status === "pending") return "Loading the event's open milestones…";
  if (status === "error") return "Could not load this event's milestones.";
  return count === 0 ? "This event has no milestone with a balance left." : undefined;
}
