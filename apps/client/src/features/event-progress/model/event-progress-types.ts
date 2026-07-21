import type { PrismReadinessStatus } from "@prism/types";

export type ProgressCheckpoint = {
  id: string;
  label: string;
  detail: string;
  done: boolean;
  status: PrismReadinessStatus;
};

export type EventTimelineStep = {
  id: string;
  title: string;
  description?: string;
  status: string;
  meta?: string;
};

export type PaymentMilestoneRow = {
  id: string;
  label: string;
  amount: string;
  status: string;
  due?: string;
};

export type EventProgressSnapshot = {
  lifecycleStage: string;
  lifecycleIndex: number;
  checkpoints: ProgressCheckpoint[];
  timeline: EventTimelineStep[];
  paymentMilestones: PaymentMilestoneRow[];
  score: number;
};
