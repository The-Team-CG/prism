"use client";

import type { CSSProperties } from "react";
import { cn } from "@/app/components/ui/utils";

export type ClientStepperState = "done" | "current" | "upcoming";

export type ClientStepperStep = { key: string; label: string; state: ClientStepperState };

/** One completed colour for the whole client portal: done is success, the current stage is primary, the rest stay grey. */
const TEXT: Record<ClientStepperState, string> = {
  done: "text-success",
  current: "font-semibold text-primary",
  upcoming: "text-muted-foreground",
};

const MARK: Record<ClientStepperState, string> = {
  done: "bg-success",
  current: "bg-primary",
  upcoming: "bg-muted-foreground/25",
};

const SR_STATE: Record<ClientStepperState, string> = {
  done: "done",
  current: "current stage",
  upcoming: "not started",
};

/**
 * The event's stage stepper, shared by the overview and planning pages. From `sm` up each stage is one segment of
 * the bar with its name directly beneath it, so a label always sits under its own part of the bar; on a phone the
 * stages read as a list with a dot each.
 */
export function ClientEventStepper({ steps, label }: { steps: ClientStepperStep[]; label: string }) {
  const currentIndex = steps.findIndex((step) => step.state === "current");
  const stageNumber = currentIndex === -1 ? steps.length : currentIndex + 1;

  return (
    <ol
      aria-label={`${label}: stage ${stageNumber} of ${steps.length}`}
      style={{ "--steps": steps.length } as CSSProperties}
      className="grid gap-y-2 sm:grid-cols-[repeat(var(--steps),minmax(0,1fr))] sm:gap-x-1.5"
    >
      {steps.map((step) => (
        <li
          key={step.key}
          aria-current={step.state === "current" ? "step" : undefined}
          className={cn("flex min-w-0 items-center gap-2 text-sm sm:flex-col sm:items-stretch sm:gap-2", TEXT[step.state])}
        >
          <span aria-hidden className={cn("size-2 shrink-0 rounded-full sm:h-1.5 sm:w-full", MARK[step.state])} />
          <span className="min-w-0 truncate sm:text-xs" title={step.label}>{step.label}</span>
          <span className="sr-only">: {SR_STATE[step.state]}</span>
        </li>
      ))}
    </ol>
  );
}
