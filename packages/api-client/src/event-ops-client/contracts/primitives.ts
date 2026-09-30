import type { PrismEventOpsActorContext } from "@prism/types";

export type EventOpsActorQuery = PrismEventOpsActorContext;

export interface EventOpsClientOptions {
  baseUrl?: string;
  getAuthToken?: () => string | null | undefined;
}
