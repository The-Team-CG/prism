import type { MvpDemoState, MvpEvent, MvpInquiry } from "@prism/types";
import { prismRequest, toQueryString, type PrismRequestInit } from "./http";

export interface EventOpsActorQuery {
  actorName?: string;
  actorRole?: string;
  actorEmail?: string;
  clientName?: string;
}

export interface CreateMvpInquiryInput {
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
    state(): Promise<MvpDemoState>;
    reset(): Promise<MvpDemoState>;
    seed(): Promise<MvpDemoState>;
  };
  inquiries: {
    list(actor?: EventOpsActorQuery): Promise<MvpInquiry[]>;
    create(input: CreateMvpInquiryInput): Promise<MvpInquiry>;
  };
  events: {
    list(actor?: EventOpsActorQuery): Promise<MvpEvent[]>;
    detail(eventId: string, actor?: EventOpsActorQuery): Promise<MvpEvent>;
  };
}

export function createEventOpsClient(options: EventOpsClientOptions = {}): EventOpsClient {
  return {
    demo: {
      state: () => prismRequest<MvpDemoState>("/demo/state", withBase(options)),
      reset: () => prismRequest<MvpDemoState>("/demo/reset", withBase(options, { method: "POST" })),
      seed: () => prismRequest<MvpDemoState>("/demo/seed", withBase(options, { method: "POST" })),
    },
    inquiries: {
      list: (actor = {}) => prismRequest<MvpInquiry[]>(actorPath("/inquiries", actor), withBase(options)),
      create: (input) => prismRequest<MvpInquiry>("/inquiries", withBase(options, { method: "POST", body: input })),
    },
    events: {
      list: (actor = {}) => prismRequest<MvpEvent[]>(actorPath("/events", actor), withBase(options)),
      detail: (eventId, actor = {}) =>
        prismRequest<MvpEvent>(actorPath(`/events/${eventId}`, actor), withBase(options)),
    },
  };
}
