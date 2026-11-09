"use client";

import { Progress } from "@prism/ui/components/progress";
import { cn } from "@/app/components/ui/utils";

export type ClientStepperState = "done" | "current" | "upcoming";

export type ClientStepperStep = { key: string; label: string; state: ClientStepperState };

/** One completed colour for the whole client portal: done is success, the current stage is primary, the rest stay grey. */
const TEXT: Record<ClientStepperState, string> = {
  done: "text-success",
  current: "font-semibold text-primary",
  upcoming: "text-muted-foreground",
};

const DOT: Record<ClientStepperState, string> = {
  done: "bg-success",
  current: "bg-primary",
  upcoming: "bg-muted-foreground/30",
};

const SR_STATE: Record<ClientStepperState, string> = {
  done: "done",
  current: "current stage",
  upcoming: "not started",
};

/**
 * The event's stage stepper, shared by the overview and planning pages. A progress bar gives the overall
 * position; each stage is a labelled row beneath it, so long stage names wrap or truncate instead of
 * squeezing into boxes.
 */
export function ClientEventStepper({ steps, label }: { steps: ClientStepperStep[]; label: string }) {
  const currentIndex = steps.findIndex((step) => step.state === "current");
  const completed = steps.filter((step) => step.state === "done").length;
  const position = currentIndex === -1 ? completed : currentIndex + 0.5;
  const percent = steps.length ? Math.round((position / steps.length) * 100) : 0;
  const stageNumber = currentIndex === -1 ? steps.length : currentIndex + 1;

  return (
    <div className="space-y-3">
      <Progress value={percent} aria-label={`${label}: stage ${stageNumber} of ${steps.length}`} />
      <ol aria-label={label} className="grid gap-x-4 gap-y-2 sm:grid-cols-2 xl:grid-cols-3">
        {steps.map((step) => (
          <li
            key={step.key}
            aria-current={step.state === "current" ? "step" : undefined}
            className={cn("flex min-w-0 items-center gap-2 text-sm", TEXT[step.state])}
          >
            <span aria-hidden className={cn("size-2 shrink-0 rounded-full", DOT[step.state])} />
            <span className="min-w-0 truncate" title={step.label}>{step.label}</span>
            <span className="sr-only">: {SR_STATE[step.state]}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}
