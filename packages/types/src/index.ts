export * from "./lifecycle";

export type PrismRole = "pmcm" | "client" | "supplier" | "guest" | "coordinator";

export type PrismReadinessStatus = "ready" | "attention" | "blocked" | "done";

export interface PrismActionItem {
  id: string;
  label: string;
  description: string;
  status: PrismReadinessStatus;
  target?: string;
}

export interface PrismLifecycleSummary {
  eventId: string;
  eventName: string;
  stage: string;
  readinessScore: number;
  actions: PrismActionItem[];
}
