"use client";

import { PrismStatusTimeline } from "@prism/ui/blocks";
import { PrismBillingMilestoneList } from "@prism/ui/blocks";
import { StatusBadge } from "@prism/ui/components/status-badge";
import { PrismSection } from "@prism/ui/page-blocks";
import { PRISM_LIFECYCLE_STAGES, PRISM_LIFECYCLE_STAGE_LABELS } from "@prism/types";
import Link from "next/link";
import { ClientEventStepper, type ClientStepperStep } from "@/features/client-dashboard/shared/client-event-stepper";
import { useEventProgressView } from "../view-models/use-event-progress-view";

export function EventProgressView() {
  const progress = useEventProgressView();

  if (!progress.hasEvent) {
    return null;
  }

  const doneCheckpoints = progress.checkpoints.filter((c) => c.done).length;
  const lifecycleSteps: ClientStepperStep[] = PRISM_LIFECYCLE_STAGES.map((stage, index) => ({
    key: stage,
    label: PRISM_LIFECYCLE_STAGE_LABELS[stage],
    state: index < progress.lifecycleIndex ? "done" : index === progress.lifecycleIndex ? "current" : "upcoming",
  }));

  return (
    <div className="space-y-6">
      <PrismSection
        id="progress-stage"
        title={`Current stage: ${progress.lifecycleStage}`}
        description={`Stage ${progress.lifecycleIndex + 1} of ${PRISM_LIFECYCLE_STAGES.length}`}
        action={progress.actionsHref ? (
          <Link href={progress.actionsHref} className="text-sm font-medium text-primary hover:text-primary/80">
            {progress.needsYouCount === 0 ? "Nothing needs you" : progress.needsYouCount === 1 ? "1 thing needs you" : `${progress.needsYouCount} things need you`}
          </Link>
        ) : undefined}
      >
        <ClientEventStepper steps={lifecycleSteps} label="Event lifecycle" />
      </PrismSection>

      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-6">
          <PrismSection
            id="progress-checkpoints"
            title="Planning checkpoints"
            description={`${doneCheckpoints} of ${progress.checkpoints.length} done`}
            flush={progress.checkpoints.length > 0}
          >
            <ul className="divide-y divide-border">
              {progress.checkpoints.map((cp) => (
                <li key={cp.id} className="flex items-start gap-3 px-5 py-4">
                  <span aria-hidden className={`mt-1.5 size-2.5 shrink-0 rounded-full ${cp.done ? "bg-success" : "bg-muted-foreground/30"}`} />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-foreground">{cp.label}</p>
                    <p className="text-sm text-muted-foreground">{cp.detail}</p>
                  </div>
                  <StatusBadge status={cp.status} />
                </li>
              ))}
            </ul>
          </PrismSection>

          {progress.paymentMilestones.length > 0 && (
            <PrismSection id="progress-payments" title="Payment milestones" count={progress.paymentMilestones.length}>
              <PrismBillingMilestoneList milestones={progress.paymentMilestones} />
            </PrismSection>
          )}
        </div>

        <PrismSection id="progress-key-dates" title="Key dates">
          {progress.clientEventDayStatus && (
            <p role="status" className="mb-4 rounded-md bg-muted px-3 py-2 text-sm text-muted-foreground">
              {progress.clientEventDayStatus}
            </p>
          )}
          <PrismStatusTimeline items={progress.timeline} />
        </PrismSection>
      </div>

    </div>
  );
}
