import type { PrismEventOpsActorContext } from "@prism/types";

export type EventOpsActorQuery = PrismEventOpsActorContext;

export interface EventOpsClientOptions {
  baseUrl?: string;
  getAuthToken?: () => string | null | undefined;
  /** Called when a request that carried a bearer token is answered 401. */
  onUnauthorized?: () => void;
  /** Called when a request that carried a bearer token is refused 403 privacy_notice_required. */
  onPrivacyNoticeRequired?: () => void;
}
