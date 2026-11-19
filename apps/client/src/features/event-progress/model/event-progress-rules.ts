import {
  PRISM_LIFECYCLE_STAGES,
  PRISM_LIFECYCLE_STAGE_LABELS,
  derivePrismLifecycleStage,
  type PrismClientTimelineMilestoneKey,
  type PrismClientWorkspace,
  type PrismEvent,
} from "@prism/types";
import { manilaCalendarKey } from "@prism/ui/format-date";
import type { EventProgressSnapshot, ProgressMilestone } from "./event-progress-types";

/** Index into PRISM_LIFECYCLE_STAGES, from the stage every portal shares. */
export function deriveLifecycleIndex(event: PrismEvent): number {
  return PRISM_LIFECYCLE_STAGES.indexOf(derivePrismLifecycleStage(event));
}

type Draft = Omit<ProgressMilestone, "state"> & { done: boolean };

const plural = (count: number, singular: string, many: string) => `${count} ${count === 1 ? singular : many}`;

/**
 * The client's one list of milestones, in the order an event moves through them. The persisted timeline gives the
 * dated milestones (conforme, proposal, floor plan, balance, event day); the briefing and suppliers fill the gaps.
 * The first unfinished milestone is "next", and an unfinished one whose date has passed is "late".
 */
export function deriveMilestones(event: PrismEvent, workspace: PrismClientWorkspace, todayKey: string): ProgressMilestone[] {
  const timeline = workspace.clientEventTimelines.find((item) => item.eventId === event.id);
  const fact = (key: PrismClientTimelineMilestoneKey) => timeline?.milestones.find((milestone) => milestone.key === key);
  const timed = (key: PrismClientTimelineMilestoneKey) => ({ done: fact(key)?.status === "completed", date: fact(key)?.date ?? null, dated: true });

  const briefing = workspace.briefings.find((item) => item.eventId === event.id);
  const suppliers = workspace.supplierQuotes.filter((quote) => quote.eventId === event.id).length;

  const drafts: Draft[] = [
    { kind: "conforme", title: "Conforme signed", ...timed("conforme_signed") },
    {
      kind: "briefing", title: "Briefing sent", done: Boolean(briefing), date: briefing?.submittedAt ?? null, dated: false, route: "briefing",
      detail: briefing ? undefined : "Tell PMCM about your venue, guests and budget",
    },
    { kind: "proposal", title: "Proposal approved", ...timed("proposal_accepted"), route: "proposal" },
    { kind: "floorplan", title: "Floor plan approved", ...timed("floor_plan_approved"), route: "floorplan" },
    {
      kind: "suppliers", title: "Suppliers confirmed", done: suppliers > 0, date: null, dated: false,
      detail: suppliers > 0 ? `${plural(suppliers, "supplier", "suppliers")} booked` : "PMCM books them during planning",
    },
    { kind: "payment", title: "Balance paid", ...timed("balance_payment_due"), route: "billing" },
    { kind: "event", title: "Event day", ...timed("event_date") },
  ];

  const nextIndex = drafts.findIndex((draft) => !draft.done);
  return drafts.map(({ done, ...milestone }, index) => {
    const late = !done && milestone.date !== null && milestone.kind !== "event" && manilaCalendarKey(milestone.date) < todayKey;
    const state = done ? "done" : late ? "late" : index === nextIndex ? "next" : "upcoming";
    return { ...milestone, state };
  });
}

export function computeEventProgress(event: PrismEvent, workspace: PrismClientWorkspace, todayKey: string): EventProgressSnapshot {
  const lifecycleIndex = deriveLifecycleIndex(event);
  return {
    lifecycleStage: PRISM_LIFECYCLE_STAGE_LABELS[PRISM_LIFECYCLE_STAGES[lifecycleIndex]],
    lifecycleIndex,
    milestones: deriveMilestones(event, workspace, todayKey),
    clientEventDayStatus: event.clientEventDayViewEnabled === true && event.status === "event_day"
      ? "Event day is in progress."
      : null,
  };
}
