"use client";

import Link from "next/link";
import { CalendarDays, ClipboardList, FileSignature, FileText, MapPinned, Store, WalletCards, type LucideIcon } from "lucide-react";
import { formatPortalDate } from "@prism/ui/format-date";
import { PrismSection } from "@prism/ui/page-blocks";
import { PRISM_LIFECYCLE_STAGES, PRISM_LIFECYCLE_STAGE_LABELS } from "@prism/types";
import { ClientEventStepper, type ClientStepperStep } from "@/features/client-dashboard/shared/client-event-stepper";
import { ClientListRow, type ClientRowTone } from "@/features/client-dashboard/shared/client-list-ui";
import type { ProgressMilestoneKind, ProgressMilestoneState } from "../model/event-progress-types";
import { useEventProgressView, type EventProgressViewModel } from "../view-models/use-event-progress-view";

const ICON: Record<ProgressMilestoneKind, LucideIcon> = {
  conforme: FileSignature,
  briefing: ClipboardList,
  proposal: FileText,
  floorplan: MapPinned,
  suppliers: Store,
  payment: WalletCards,
  event: CalendarDays,
};

const TONE: Record<ProgressMilestoneState, ClientRowTone> = { done: "done", late: "urgent", next: "neutral", upcoming: "neutral" };

const ACTION: Partial<Record<ProgressMilestoneKind, string>> = {
  briefing: "Open briefing",
  proposal: "Open proposal",
  floorplan: "Open floor plan",
  payment: "Open billing",
};

/** The status column: what state the milestone is in and, under it, its date. */
function milestoneStatus(milestone: EventProgressViewModel["milestones"][number]) {
  const date = milestone.date ? formatPortalDate(milestone.date) : milestone.dated ? "Date to be set" : undefined;
  if (milestone.state === "done") return { status: "Done", statusDetail: date === "Date to be set" ? undefined : date };
  if (milestone.state === "late") return { status: "Overdue", statusDetail: date };
  if (milestone.kind === "payment" && milestone.date) return { status: `Due ${formatPortalDate(milestone.date)}` };
  if (milestone.state === "next") return { status: "Up next", statusDetail: date };
  return { status: date ?? "Later" };
}

export function EventProgressView() {
  const progress = useEventProgressView();
  if (!progress.hasEvent) return null;

  const lifecycleSteps: ClientStepperStep[] = PRISM_LIFECYCLE_STAGES.map((stage, index) => ({
    key: stage,
    label: PRISM_LIFECYCLE_STAGE_LABELS[stage],
    state: index < progress.lifecycleIndex ? "done" : index === progress.lifecycleIndex ? "current" : "upcoming",
  }));
  const done = progress.milestones.filter((milestone) => milestone.state === "done").length;

  return (
    <div className="space-y-6">
      <PrismSection
        id="progress-stage"
        title={`Current stage: ${progress.lifecycleStage}`}
        description={`Stage ${progress.lifecycleIndex + 1} of ${PRISM_LIFECYCLE_STAGES.length}`}
        headerOutside
        action={progress.actionsHref ? (
          <Link href={progress.actionsHref} className="text-sm font-medium text-primary hover:text-primary/80">
            {progress.needsYouCount === 0 ? "Nothing needs you" : progress.needsYouCount === 1 ? "1 thing needs you" : `${progress.needsYouCount} things need you`}
          </Link>
        ) : undefined}
      >
        <ClientEventStepper steps={lifecycleSteps} label="Event lifecycle" />
        {progress.clientEventDayStatus ? (
          <p role="status" className="mt-4 text-sm font-medium text-primary">{progress.clientEventDayStatus}</p>
        ) : null}
      </PrismSection>

      <PrismSection id="progress-milestones" title="Milestones" description={`${done} of ${progress.milestones.length} done`} headerOutside flush>
        <ul className="divide-y divide-border">
          {progress.milestones.map((milestone) => {
            const open = milestone.state === "next" || milestone.state === "late";
            return (
              <ClientListRow
                key={milestone.kind}
                icon={ICON[milestone.kind]}
                tone={TONE[milestone.state]}
                title={milestone.title}
                meta={milestone.detail}
                {...milestoneStatus(milestone)}
                href={milestone.href}
                action={open ? ACTION[milestone.kind] : undefined}
              />
            );
          })}
        </ul>
      </PrismSection>
    </div>
  );
}
