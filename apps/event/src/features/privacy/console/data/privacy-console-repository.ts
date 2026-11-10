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
import { eventApi } from "@/lib/prism-api";

export type PrivacyConsoleCommands = {
  pmcmReference(): Promise<{ events: PrismEvent[]; users: PrismUser[] }>;
  requestQueue(query: ListPrivacyRequestsQueryInput): Promise<PrismPrivacyRequestPage>;
  createRequest(input: CreatePrivacyRequestInput): Promise<PrismPrivacyRequest>;
  assignRequest(requestId: string, input: AssignPrivacyRequestInput): Promise<PrismPrivacyRequest>;
  reviewRequest(requestId: string, input: ReviewPrivacyRequestInput): Promise<PrismPrivacyRequest>;
  executeRequest(requestId: string, notes: string, correction?: PrivacyCorrectionPatch): Promise<PrismPrivacyExecutionResult>;
  legalHolds(eventId?: string): Promise<PrismPrivacyLegalHold[]>;
  createLegalHold(input: CreatePrivacyLegalHoldInput): Promise<PrismPrivacyLegalHold>;
  releaseLegalHold(holdId: string, input: ReleasePrivacyLegalHoldInput): Promise<PrismPrivacyLegalHold>;
};

const privacyConsoleCommands = {
  pmcmReference: () => eventApi.pmcm.reference().then(({ events, users }) => ({ events, users })),
  requestQueue: (query: ListPrivacyRequestsQueryInput) => eventApi.privacyAdmin.requests(query),
  createRequest: (input: CreatePrivacyRequestInput) => eventApi.privacyAdmin.createRequest(input),
  assignRequest: (requestId: string, input: AssignPrivacyRequestInput) => eventApi.privacyAdmin.assignRequest(requestId, input),
  reviewRequest: (requestId: string, input: ReviewPrivacyRequestInput) => eventApi.privacyAdmin.reviewRequest(requestId, input),
  executeRequest: (requestId: string, notes: string, correction?: PrivacyCorrectionPatch) =>
    eventApi.privacyAdmin.executeRequest(requestId, notes, correction),
  legalHolds: (eventId?: string) => eventApi.privacyAdmin.legalHolds(eventId),
  createLegalHold: (input: CreatePrivacyLegalHoldInput) => eventApi.privacyAdmin.createLegalHold(input),
  releaseLegalHold: (holdId: string, input: ReleasePrivacyLegalHoldInput) => eventApi.privacyAdmin.releaseLegalHold(holdId, input),
} satisfies PrivacyConsoleCommands;

export function createPrivacyConsoleRepository(commands: PrivacyConsoleCommands = privacyConsoleCommands) {
  return {
    loadContext: () => commands.pmcmReference(),
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
