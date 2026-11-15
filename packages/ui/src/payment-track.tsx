"use client";

import type { ReactNode } from "react";
import { AlertTriangle, CalendarClock, CheckCircle2, CircleDashed, Hourglass, Scale, type LucideIcon } from "lucide-react";
import { cn } from "./utils";

/**
 * Where one scheduled payment stands. The same states read the same way in every portal: what the client owes PMCM,
 * and what PMCM owes a supplier.
 */
export type PaymentStepState = "paid" | "checking" | "overdue" | "due-soon" | "partly" | "upcoming" | "disputed";

export interface PaymentStep {
  id: string;
  label: string;
  amount: number;
  /** Counted toward this payment so far, including money still being checked. */
  paid: number;
  /** Part of `paid` not yet confirmed. */
  checking?: number;
  state: PaymentStepState;
  /** When it is or was due, in words: "Due Nov 18 · in 4 days", "Paid Oct 13". */
  when: string;
  /** Short facts worth seeing at a glance: "₱30,000 under review". */
  notes?: string[];
}

const pesoFormat = new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP", maximumFractionDigits: 0 });

/** Whole pesos, written the same way everywhere: ₱125,000. */
export function formatPeso(amount: number): string {
  return pesoFormat.format(amount);
}

type StateLook = { icon: LucideIcon; label: string; dot: string; text: string; rest: string };

const LOOK: Record<PaymentStepState, StateLook> = {
  paid: { icon: CheckCircle2, label: "Paid", dot: "bg-success text-white", text: "text-success", rest: "bg-success-soft" },
  checking: { icon: Hourglass, label: "Being checked", dot: "bg-info text-white", text: "text-info", rest: "bg-info-soft" },
  overdue: { icon: AlertTriangle, label: "Overdue", dot: "bg-danger text-white", text: "text-danger", rest: "bg-danger-soft" },
  "due-soon": { icon: CalendarClock, label: "Due soon", dot: "bg-attention text-white", text: "text-attention", rest: "bg-attention-soft" },
  partly: { icon: CalendarClock, label: "Part paid", dot: "bg-primary text-primary-foreground", text: "text-primary", rest: "bg-primary-soft" },
  upcoming: { icon: CircleDashed, label: "Later", dot: "bg-muted text-muted-foreground", text: "text-muted-foreground", rest: "bg-muted" },
  disputed: { icon: Scale, label: "Under review", dot: "bg-attention text-white", text: "text-attention", rest: "bg-attention-soft" },
};

export function paymentStateLabel(state: PaymentStepState): string {
  return LOOK[state].label;
}

const STRIPES = "bg-[repeating-linear-gradient(135deg,var(--color-info)_0_6px,color-mix(in_oklab,var(--color-info)_55%,white)_6px_12px)]";

function percent(part: number, whole: number) {
  return whole <= 0 ? 0 : Math.max(0, Math.min(100, (part / whole) * 100));
}

function Segment({ step }: { step: PaymentStep }) {
  const confirmed = Math.max(0, step.paid - (step.checking ?? 0));
  return (
    <div className={cn("relative h-full overflow-hidden", LOOK[step.state].rest)}>
      <div className="absolute inset-y-0 left-0 bg-success" style={{ width: `${percent(confirmed, step.amount)}%` }} />
      {step.checking ? (
        <div className={cn("absolute inset-y-0", STRIPES)} style={{ left: `${percent(confirmed, step.amount)}%`, width: `${percent(step.checking, step.amount)}%` }} />
      ) : null}
    </div>
  );
}

/**
 * The whole schedule as one bar: each payment takes room in proportion to its amount, filled as far as it is paid.
 * Striped fill is money still being checked; the unpaid rest takes the payment's state colour.
 */
export function PaymentProgressBar({ steps, className, showLabels = true }: { steps: PaymentStep[]; className?: string; showLabels?: boolean }) {
  const total = steps.reduce((sum, step) => sum + step.amount, 0);
  const paid = steps.reduce((sum, step) => sum + step.paid, 0);
  if (total <= 0) return null;
  const columns = steps.map((step) => `${Math.max(step.amount, total * 0.06)}fr`).join(" ");
  return (
    <div className={cn("space-y-1.5", className)}>
      <div role="img" aria-label={`${formatPeso(paid)} of ${formatPeso(total)} paid across ${steps.length} payments`} className="grid h-3 gap-0.5 overflow-hidden rounded-full" style={{ gridTemplateColumns: columns }}>
        {steps.map((step) => <Segment key={step.id} step={step} />)}
      </div>
      {showLabels ? (
        <div aria-hidden className="grid gap-0.5 text-[11px] leading-tight" style={{ gridTemplateColumns: columns }}>
          {steps.map((step) => (
            <span key={step.id} className="min-w-0 truncate">
              <span className={cn("font-medium", LOOK[step.state].text)}>{step.label}</span>
              <span className="hidden text-muted-foreground sm:inline"> · {formatPeso(step.amount)}</span>
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
}

/** A ring that fills as the total is paid, with the share in the middle. */
export function PaymentRing({ paid, total, size = 88, label }: { paid: number; total: number; size?: number; label?: string }) {
  const share = percent(paid, total);
  const radius = 15.5;
  const circumference = 2 * Math.PI * radius;
  const settled = total > 0 && paid >= total;
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }} role="img" aria-label={label ?? `${Math.round(share)}% paid`}>
      <svg viewBox="0 0 36 36" className="size-full -rotate-90">
        <circle cx="18" cy="18" r={radius} fill="none" className="stroke-muted" strokeWidth="3.5" />
        <circle
          cx="18" cy="18" r={radius} fill="none" strokeWidth="3.5" strokeLinecap="round"
          className={settled ? "stroke-success" : "stroke-primary"}
          strokeDasharray={`${(share / 100) * circumference} ${circumference}`}
        />
      </svg>
      <span className="absolute inset-0 grid place-items-center text-center">
        {settled ? <CheckCircle2 aria-hidden className="size-7 text-success" /> : <span className="text-base font-semibold tabular-nums text-foreground">{Math.round(share)}%</span>}
      </span>
    </div>
  );
}

function StepAmount({ step }: { step: PaymentStep }) {
  const partly = step.paid > 0 && step.paid < step.amount;
  return (
    <p className="shrink-0 text-right text-sm font-semibold tabular-nums text-foreground">
      {formatPeso(step.amount)}
      {partly ? <span className="block text-xs font-normal text-muted-foreground">{formatPeso(step.paid)} paid</span> : null}
    </p>
  );
}

function StepNotes({ notes }: { notes?: string[] }) {
  if (!notes?.length) return null;
  return (
    <ul className="mt-1.5 flex flex-wrap gap-1.5">
      {notes.map((note) => <li key={note} className="rounded-md bg-muted px-2 py-0.5 text-xs text-foreground">{note}</li>)}
    </ul>
  );
}

/**
 * The schedule as a timeline: one stop per payment with an icon for where it stands, connected top to bottom.
 * `detail` renders under a payment (receipts, actions); `heading` is an optional line above each label, such as the event.
 */
export function PaymentTimeline({
  steps,
  detail,
  heading,
  label = "Payment schedule",
}: {
  steps: PaymentStep[];
  detail?: (step: PaymentStep) => ReactNode;
  heading?: (step: PaymentStep) => ReactNode;
  label?: string;
}) {
  return (
    <ol aria-label={label} className="relative">
      {steps.map((step, index) => {
        const look = LOOK[step.state];
        const Icon = look.icon;
        const last = index === steps.length - 1;
        return (
          <li key={step.id} className="relative grid grid-cols-[2rem_minmax(0,1fr)] gap-x-3 pb-5 last:pb-0">
            {!last ? <span aria-hidden className={cn("absolute left-4 top-8 bottom-0 w-0.5 -translate-x-1/2", step.state === "paid" ? "bg-success/40" : "bg-border")} /> : null}
            <span aria-hidden className={cn("relative z-10 grid size-8 place-items-center rounded-full ring-4 ring-card", look.dot)}>
              <Icon className="size-4" />
            </span>
            <div className="min-w-0 pt-0.5">
              {heading ? <div className="text-xs text-muted-foreground">{heading(step)}</div> : null}
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-foreground">{step.label}</p>
                  <p className={cn("text-xs", look.text)}>
                    <span className="font-medium">{look.label}</span>
                    <span className="text-muted-foreground"> · {step.when}</span>
                  </p>
                </div>
                <StepAmount step={step} />
              </div>
              <StepNotes notes={step.notes} />
              {detail ? <div className="mt-2">{detail(step)}</div> : null}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
