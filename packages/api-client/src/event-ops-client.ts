import type {
  PrismBillingWorkspace,
  PrismClientWorkspace,
  PrismEvent,
  PrismInquiry,
  PrismSampleState,
  PrismSupplierWorkspace,
} from "@prism/types";
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
  sample: {
    state(): Promise<PrismSampleState>;
    reset(): Promise<PrismSampleState>;
    seed(): Promise<PrismSampleState>;
  };
  inquiries: {
    list(actor?: EventOpsActorQuery): Promise<PrismInquiry[]>;
    create(input: CreatePrismInquiryInput): Promise<PrismInquiry>;
  };
  events: {
    list(actor?: EventOpsActorQuery): Promise<PrismEvent[]>;
    detail(eventId: string, actor?: EventOpsActorQuery): Promise<PrismEvent>;
  };
  clientWorkspace: {
    detail(actor?: EventOpsActorQuery): Promise<PrismClientWorkspace>;
  };
  supplierWorkspace: {
    detail(actor?: EventOpsActorQuery): Promise<PrismSupplierWorkspace>;
  };
  billing: {
    list(actor?: EventOpsActorQuery): Promise<PrismBillingWorkspace>;
  };
}

export function createEventOpsClient(options: EventOpsClientOptions = {}): EventOpsClient {
  return {
    sample: {
      state: () => prismRequest<PrismSampleState>("/sample/state", withBase(options)),
      reset: () => prismRequest<PrismSampleState>("/sample/reset", withBase(options, { method: "POST" })),
      seed: () => prismRequest<PrismSampleState>("/sample/seed", withBase(options, { method: "POST" })),
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
    clientWorkspace: {
      detail: (actor = {}) => prismRequest<PrismClientWorkspace>(actorPath("/client/workspace", actor), withBase(options)),
    },
    supplierWorkspace: {
      detail: (actor = {}) =>
        prismRequest<PrismSupplierWorkspace>(actorPath("/supplier/workspace", actor), withBase(options)),
    },
    billing: {
      list: (actor = {}) => prismRequest<PrismBillingWorkspace>(actorPath("/billing", actor), withBase(options)),
    },
  };
}
