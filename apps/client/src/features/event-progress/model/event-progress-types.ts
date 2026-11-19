import type { ClientDashboardRoute } from "@/features/client-dashboard/workspace/model/client-dashboard-types";

export type ProgressMilestoneKind = "conforme" | "briefing" | "proposal" | "floorplan" | "suppliers" | "payment" | "event";

/** done: finished. next: the first unfinished milestone. late: unfinished and its date has passed. upcoming: the rest. */
export type ProgressMilestoneState = "done" | "next" | "late" | "upcoming";

/** One milestone in the client's single dated list: the stage facts, key dates and the balance payment, in order. */
export type ProgressMilestone = {
  kind: ProgressMilestoneKind;
  title: string;
  state: ProgressMilestoneState;
  /** A calendar key (YYYY-MM-DD) or ISO time when the milestone has one: when it happened, or when it is due. */
  date: string | null;
  /** The milestone keeps a date that PMCM has not set yet ("Date to be set") rather than having none at all. */
  dated: boolean;
  detail?: string;
  /** The event page where the milestone is worked on. */
  route?: ClientDashboardRoute;
};

export type EventProgressSnapshot = {
  lifecycleStage: string;
  lifecycleIndex: number;
  milestones: ProgressMilestone[];
  clientEventDayStatus: string | null;
};
