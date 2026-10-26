import type { AiGatewayStreamEvent, CommsDraftResult } from "@prism/types";
import {
  aiAuditEvidenceSchema,
  aiGatewayStreamEventSchema,
  commsDraftResultSchema,
} from "@prism/types";
import { toQueryString, type PrismRequestInit } from "../http";
import type { EventOpsActorQuery, EventOpsClientOptions } from "./contracts";

export function parseCommsDraftStreamEvent(
  value: unknown,
): AiGatewayStreamEvent<CommsDraftResult> {
  const event = aiGatewayStreamEventSchema.parse(value);
  if (event.type !== "complete") return event;
  return {
    ...event,
    result: {
      ...event.result,
      output: commsDraftResultSchema.parse(event.result.output),
      evidence: aiAuditEvidenceSchema.parse(event.result.evidence),
    },
  };
}

export function withBase(
  options: EventOpsClientOptions,
  init: PrismRequestInit = {},
): PrismRequestInit {
  return {
    ...init,
    authToken: init.authToken ?? options.getAuthToken?.() ?? null,
    baseUrl: init.baseUrl ?? options.baseUrl,
    onUnauthorized: init.onUnauthorized ?? options.onUnauthorized,
    onPrivacyNoticeRequired: init.onPrivacyNoticeRequired ?? options.onPrivacyNoticeRequired,
  };
}

export function actorPath(
  path: string,
  actor: EventOpsActorQuery = {},
): string {
  const query = toQueryString(actor);
  return query ? `${path}?${query}` : path;
}
