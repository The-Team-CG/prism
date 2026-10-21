import type {
  AssignPrivacyRequestInput,
  CreatePrivacyLegalHoldInput,
  CreatePrivacyRequestInput,
  ListPrivacyRequestsQueryInput,
  PrismEvent,
  PrismPrivacyExecutionResult,
  PrismPrivacyLegalHold,
  PrismPrivacyRequest,
  PrismPrivacyRequestPage,
  PrismUser,
  PrivacyCorrectionPatch,
  ReleasePrivacyLegalHoldInput,
  ReviewPrivacyRequestInput,
} from "@prism/types";
import { eventApi, eventApiRequest } from "@/lib/prism-api";
import { privacyQueueSearch } from "../model/privacy-console-rules";

export type PrivacyConsoleCommands = {
  pmcmState(): Promise<{ events: PrismEvent[]; users: PrismUser[] }>;
  requestQueue(query: ListPrivacyRequestsQueryInput): Promise<PrismPrivacyRequestPage>;
  createRequest(input: CreatePrivacyRequestInput): Promise<PrismPrivacyRequest>;
  assignRequest(requestId: string, input: AssignPrivacyRequestInput): Promise<PrismPrivacyRequest>;
  reviewRequest(requestId: string, input: ReviewPrivacyRequestInput): Promise<PrismPrivacyRequest>;
  executeRequest(requestId: string, notes: string, correction?: PrivacyCorrectionPatch): Promise<PrismPrivacyExecutionResult>;
  legalHolds(eventId?: string): Promise<PrismPrivacyLegalHold[]>;
  createLegalHold(input: CreatePrivacyLegalHoldInput): Promise<PrismPrivacyLegalHold>;
  releaseLegalHold(holdId: string, input: ReleasePrivacyLegalHoldInput): Promise<PrismPrivacyLegalHold>;
};

function eventQuery(eventId?: string) {
  return eventId && eventId !== "all" ? `?eventId=${encodeURIComponent(eventId)}` : "";
}

const privacyConsoleCommands = {
  pmcmState: () => eventApi.pmcmDashboard.detail().then(({ events, users }) => ({ events, users })),
  requestQueue: (query: ListPrivacyRequestsQueryInput) =>
    eventApiRequest<PrismPrivacyRequestPage>(`/api/privacy/requests${privacyQueueSearch(query)}`),
  createRequest: (input: CreatePrivacyRequestInput) =>
    eventApiRequest<PrismPrivacyRequest>("/api/privacy/requests", { method: "POST", body: input }),
  assignRequest: (requestId: string, input: AssignPrivacyRequestInput) =>
    eventApiRequest<PrismPrivacyRequest>(`/api/privacy/requests/${requestId}/assignment`, { method: "PATCH", body: input }),
  reviewRequest: (requestId: string, input: ReviewPrivacyRequestInput) =>
    eventApiRequest<PrismPrivacyRequest>(`/api/privacy/requests/${requestId}/review`, { method: "PATCH", body: input }),
  executeRequest: (requestId: string, notes: string, correction?: PrivacyCorrectionPatch) =>
    eventApiRequest<PrismPrivacyExecutionResult>(`/api/privacy/requests/${requestId}/execute`, {
      method: "POST", body: { executionNotes: notes, ...(correction ? { correction } : {}) },
    }),
  legalHolds: (eventId?: string) => eventApiRequest<PrismPrivacyLegalHold[]>(`/api/privacy/legal-holds${eventQuery(eventId)}`),
  createLegalHold: (input: CreatePrivacyLegalHoldInput) =>
    eventApiRequest<PrismPrivacyLegalHold>("/api/privacy/legal-holds", { method: "POST", body: input }),
  releaseLegalHold: (holdId: string, input: ReleasePrivacyLegalHoldInput) =>
    eventApiRequest<PrismPrivacyLegalHold>(`/api/privacy/legal-holds/${holdId}/release`, { method: "POST", body: input }),
} satisfies PrivacyConsoleCommands;

export function createPrivacyConsoleRepository(commands: PrivacyConsoleCommands = privacyConsoleCommands) {
  return {
    loadContext: () => commands.pmcmState(),
    queue: (query: ListPrivacyRequestsQueryInput) => commands.requestQueue(query),
    loadLegalHolds: (eventId?: string) => commands.legalHolds(eventId),
    createRequest: (input: CreatePrivacyRequestInput) => commands.createRequest(input),
    assignRequest: (requestId: string, input: AssignPrivacyRequestInput) => commands.assignRequest(requestId, input),
    reviewRequest: (requestId: string, input: ReviewPrivacyRequestInput) => commands.reviewRequest(requestId, input),
    executeRequest: (requestId: string, notes: string, correction?: PrivacyCorrectionPatch) =>
      commands.executeRequest(requestId, notes, correction),
    createLegalHold: (input: CreatePrivacyLegalHoldInput) => commands.createLegalHold(input),
    releaseLegalHold: (holdId: string, input: ReleasePrivacyLegalHoldInput) => commands.releaseLegalHold(holdId, input),
  };
}

export const privacyConsoleRepository = createPrivacyConsoleRepository();
export type PrivacyConsoleRepository = ReturnType<typeof createPrivacyConsoleRepository>;
