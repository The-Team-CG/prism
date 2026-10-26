export * from "./event-ops.js";
export * from "./event-games.js";
export * from "./floorplan-table-eligibility.js";
export * from "./client-review.js";
export * from "./conforme-signing.js";
export * from "./inquiry-link.js";
export * from "./lifecycle.js";
export * from "./portal-urls.js";
export * from "./privacy.js";
export * from "./privacy-notice.js";
export * from "./session.js";
export * from "./schemas/index.js";
export * from "./storage.js";

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
