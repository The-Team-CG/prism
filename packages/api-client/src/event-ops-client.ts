import type { PrismDemoState, PrismEvent, PrismInquiry } from "@prism/types";
import { prismRequest, toQueryString, type PrismRequestInit } from "./http";

export interface EventOpsActorQuery {
  actorName?: string;
  actorRole?: string;
  actorEmail?: string;
  clientName?: string;
}

export interface CreatePrismInquiryInput {
  clientName: string;
  companyName?: string;
  email: string;
  eventName: string;
  eventType?: string;
  eventDate: string;
  clientType: string;
  source?: string;
  referralDetails?: string;
  message: string;
  privacyConsentAccepted?: boolean;
  privacyNoticeVersion?: string;
  marketingConsentAccepted?: boolean;
}

export interface EventOpsClientOptions {
  baseUrl?: string;
}

function withBase(options: EventOpsClientOptions, init: PrismRequestInit = {}): PrismRequestInit {
  return {
    ...init,
    baseUrl: init.baseUrl ?? options.baseUrl,
  };
}

function actorPath(path: string, actor: EventOpsActorQuery = {}): string {
  const query = toQueryString(actor);
  return query ? `${path}?${query}` : path;
}

export interface EventOpsClient {
  demo: {
    state(): Promise<PrismDemoState>;
    reset(): Promise<PrismDemoState>;
    seed(): Promise<PrismDemoState>;
  };
  inquiries: {
    list(actor?: EventOpsActorQuery): Promise<PrismInquiry[]>;
    create(input: CreatePrismInquiryInput): Promise<PrismInquiry>;
  };
  events: {
    list(actor?: EventOpsActorQuery): Promise<PrismEvent[]>;
    detail(eventId: string, actor?: EventOpsActorQuery): Promise<PrismEvent>;
  };
}

export function createEventOpsClient(options: EventOpsClientOptions = {}): EventOpsClient {
  return {
    demo: {
      state: () => prismRequest<PrismDemoState>("/demo/state", withBase(options)),
      reset: () => prismRequest<PrismDemoState>("/demo/reset", withBase(options, { method: "POST" })),
      seed: () => prismRequest<PrismDemoState>("/demo/seed", withBase(options, { method: "POST" })),
    },
    inquiries: {
      list: (actor = {}) => prismRequest<PrismInquiry[]>(actorPath("/inquiries", actor), withBase(options)),
      create: (input) => prismRequest<PrismInquiry>("/inquiries", withBase(options, { method: "POST", body: input })),
    },
    events: {
      list: (actor = {}) => prismRequest<PrismEvent[]>(actorPath("/events", actor), withBase(options)),
      detail: (eventId, actor = {}) =>
        prismRequest<PrismEvent>(actorPath(`/events/${eventId}`, actor), withBase(options)),
    },
  };
}
