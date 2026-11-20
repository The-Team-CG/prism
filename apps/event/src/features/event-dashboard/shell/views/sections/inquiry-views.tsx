"use client";

import { useState, type ReactNode } from "react";
import { cx } from "@/features/pmcm-kit";
import type { InquiryFunnel } from "@/features/inquiries/intake/model/inquiry-intake-rules";

type InquiryView = "intake" | "onboarding" | "follow-up";

/**
 * The inquiry funnel in the order work moves through it, each step with its count and opening its list: new
 * inquiries to decide, accepted ones waiting for a signed conforme, and the conforme drafts to follow up. It replaces
 * three unlabelled tabs that hid how much sat at each step.
 */
export function InquiryViews({ funnel, intake, onboarding, followUp }: { funnel: InquiryFunnel; intake: ReactNode; onboarding: ReactNode; followUp: ReactNode }) {
  const [view, setView] = useState<InquiryView>("intake");
  const steps: Array<{ id: InquiryView; label: string; value?: number; detail: string }> = [
    { id: "intake", label: "To review", value: funnel.toReview, detail: "New inquiries waiting for a decision" },
    { id: "onboarding", label: "Waiting for conforme", value: funnel.waitingForConforme, detail: "Accepted, not signed yet" },
    { id: "follow-up", label: "Signed this month", value: funnel.signedThisMonth, detail: "Conformes and their follow-up drafts" },
  ];
  return (
    <div className="grid gap-4">
      <div role="tablist" aria-label="Inquiry steps" className="grid gap-2 sm:grid-cols-3">
        {steps.map((step) => {
          const on = view === step.id;
          return (
            <button
              key={step.id}
              type="button"
              role="tab"
              aria-selected={on}
              aria-controls={`inquiry-panel-${step.id}`}
              onClick={() => setView(step.id)}
              className={cx("grid min-h-20 content-start rounded-lg border px-4 py-3 text-left transition-colors", on ? "border-primary bg-primary/5" : "border-border bg-card hover:bg-surface-raised")}
            >
              <span className="flex items-baseline justify-between gap-2">
                <span className="text-sm font-medium text-foreground">{step.label}</span>
                {step.value !== undefined ? <span className={cx("text-xl font-semibold tabular-nums", step.value > 0 && step.id === "intake" ? "text-primary" : "text-foreground")}>{step.value}</span> : null}
              </span>
              <span className="mt-0.5 block text-xs text-muted-foreground">{step.detail}</span>
            </button>
          );
        })}
      </div>
      <section id={`inquiry-panel-${view}`} role="tabpanel">
        {view === "intake" ? intake : view === "onboarding" ? onboarding : followUp}
      </section>
    </div>
  );
}
