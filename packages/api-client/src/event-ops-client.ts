import type {
  ConfirmSupplierReadinessInput,
  CreateEventDayTaskInput,
  CreateGuestCheckInInput,
  CreateGuestFeedbackInput,
  CreatePrismInquiryInput,
  CreateUrgentIssueInput,
  PrismBillingWorkspace,
  PrismClientActionCenter,
  PrismClientWorkspace,
  PrismEvent,
  PrismFileRequirementsMatrix,
  PrismGuestCheckIn,
  PrismGuestEventPass,
  PrismGuestFeedback,
  PrismInquiry,
  PrismPmcmCommandInbox,
  PrismPmcmDashboardWorkspace,
  PrismPmcmEventWorkspace,
  PrismSampleState,
  PrismEventOpsActorContext,
  PrismSupplierQuoteRequest,
  PrismSupplierReadinessBoard,
  PrismSupplierWorkspace,
  PrismCoordinatorWorkspace,
  PrismLiveOps,
  PrismEventDayTask,
  PrismUrgentIssue,
  PrismCoordinatorAssignment,
  PrismSupplierApplication,
  UpdateCoordinatorAttendanceInput,
  UpdateEventDayTaskInput,
  UpdateSupplierEventStatusInput,
  UploadContractInput,
} from "@prism/types";
import { prismRequest, toQueryString, type PrismRequestInit } from "./http";

export type EventOpsActorQuery = PrismEventOpsActorContext;

/**
 * Re-export write DTOs from `@prism/types` (Zod schemas + `z.infer`).
 * Prefer importing schemas/types from `@prism/types` directly in new code.
 */
export type {
  ConfirmSupplierReadinessInput,
  CreateEventDayTaskInput,
  CreateFloorPlanPreferenceInput,
  CreateGuestCheckInInput,
  CreateGuestFeedbackInput,
  CreatePrismInquiryInput,
  CreateUrgentIssueInput,
  SubmitSupplierQuoteInput,
  UpdateCoordinatorAttendanceInput,
  UpdateEventDayTaskInput,
  UpdateInquiryStatusInput,
  UpdateSupplierEventStatusInput,
  UploadConformeInput,
  UploadContractInput,
} from "@prism/types";

export interface CreateSupplierApplicationInput {
  companyName: string;
  contactName: string;
  email: string;
  phone?: string;
  categoryId?: string;
  pastEvents?: string;
  serviceInclusions?: string;
  certifications?: string;
  priceRange?: string;
  bniMember?: boolean;
  portfolioUrl?: string;
  additionalNotes?: string;
  privacyConsentAccepted?: boolean;
  privacyNoticeVersion?: string;
}

export interface EventOpsClientOptions {
  baseUrl?: string;
  getAuthToken?: () => string | null | undefined;
}

function withBase(options: EventOpsClientOptions, init: PrismRequestInit = {}): PrismRequestInit {
  return {
    ...init,
    authToken: init.authToken ?? options.getAuthToken?.() ?? null,
    baseUrl: init.baseUrl ?? options.baseUrl,
  };
}

function actorPath(path: string, actor: EventOpsActorQuery = {}): string {
  const query = toQueryString(actor);
  return query ? `${path}?${query}` : path;
}

export interface EventOpsClient {
  /**
   * @deprecated Compatibility-only seed/demo aggregate. New role app work must
   * use scoped clients such as clientWorkspace, supplierWorkspace,
   * pmcmDashboard, events, billing, and inquiries.
   */
  sample: {
    state(): Promise<PrismSampleState>;
    reset(): Promise<PrismSampleState>;
  };
  inquiries: {
    list(actor?: EventOpsActorQuery): Promise<PrismInquiry[]>;
    create(input: CreatePrismInquiryInput): Promise<PrismInquiry>;
  };
  events: {
    list(actor?: EventOpsActorQuery): Promise<PrismEvent[]>;
    detail(eventId: string, actor?: EventOpsActorQuery): Promise<PrismEvent>;
    fileRequirements(eventId: string, actor?: EventOpsActorQuery): Promise<PrismFileRequirementsMatrix>;
  };
  clientWorkspace: {
    detail(actor?: EventOpsActorQuery): Promise<PrismClientWorkspace>;
    actionCenter(actor?: EventOpsActorQuery): Promise<PrismClientActionCenter>;
  };
  billing: {
    list(actor?: EventOpsActorQuery): Promise<PrismBillingWorkspace>;
  };
  pmcmDashboard: {
    detail(actor?: EventOpsActorQuery): Promise<PrismPmcmDashboardWorkspace>;
  };
  pmcm: {
    commandInbox(actor?: EventOpsActorQuery): Promise<PrismPmcmCommandInbox>;
    eventWorkspace(eventId: string, actor?: EventOpsActorQuery): Promise<PrismPmcmEventWorkspace>;
  };
  guest: {
    eventPass(accessCode: string): Promise<PrismGuestEventPass>;
    checkIn(accessCode: string, input: CreateGuestCheckInInput): Promise<PrismGuestCheckIn>;
    feedback(accessCode: string, input: CreateGuestFeedbackInput): Promise<PrismGuestFeedback>;
  };
  supplierWorkspace: {
    /** Identity comes from the session bearer token (PA-284); no actor query. */
    detail(): Promise<PrismSupplierWorkspace>;
    /** Identity comes from the session bearer token (PA-284); no actor query. */
    readinessBoard(): Promise<PrismSupplierReadinessBoard>;
    confirmAssignment(requestId: string, actor?: EventOpsActorQuery): Promise<PrismSupplierQuoteRequest>;
    confirmReadiness(requestId: string, input: ConfirmSupplierReadinessInput, actor?: EventOpsActorQuery): Promise<PrismSupplierQuoteRequest>;
    uploadContract(requestId: string, input: UploadContractInput, actor?: EventOpsActorQuery): Promise<PrismSupplierQuoteRequest>;
    updateEventStatus(requestId: string, input: UpdateSupplierEventStatusInput, actor?: EventOpsActorQuery): Promise<PrismSupplierQuoteRequest>;
  };
  coordinator: {
    workspace(actor?: EventOpsActorQuery): Promise<PrismCoordinatorWorkspace>;
  };
  liveOps: {
    eventDayWorkspace(eventId: string, actor?: EventOpsActorQuery): Promise<PrismLiveOps>;
    createTask(eventId: string, input: CreateEventDayTaskInput, actor?: EventOpsActorQuery): Promise<PrismEventDayTask>;
    updateTask(eventId: string, taskId: string, input: UpdateEventDayTaskInput, actor?: EventOpsActorQuery): Promise<PrismEventDayTask>;
    updateCoordinatorAttendance(eventId: string, assignmentId: string, input: UpdateCoordinatorAttendanceInput, actor?: EventOpsActorQuery): Promise<PrismCoordinatorAssignment>;
    createUrgentIssue(eventId: string, input: CreateUrgentIssueInput, actor?: EventOpsActorQuery): Promise<PrismUrgentIssue>;
  };
  supplierApplications: {
    create(input: CreateSupplierApplicationInput): Promise<PrismSupplierApplication>;
    listCategories(): Promise<{ id: string; name: string }[]>;
  };
}

export function createEventOpsClient(options: EventOpsClientOptions = {}): EventOpsClient {
  return {
    sample: {
      state: () => prismRequest<PrismSampleState>("/sample/state", withBase(options)),
      reset: () => prismRequest<PrismSampleState>("/sample/reset", withBase(options, { method: "POST" })),
    },
    inquiries: {
      list: (actor = {}) => prismRequest<PrismInquiry[]>(actorPath("/inquiries", actor), withBase(options)),
      create: (input) => prismRequest<PrismInquiry>("/inquiries", withBase(options, { method: "POST", body: input })),
    },
    events: {
      list: (actor = {}) => prismRequest<PrismEvent[]>(actorPath("/events", actor), withBase(options)),
      detail: (eventId, actor = {}) =>
        prismRequest<PrismEvent>(actorPath(`/events/${eventId}`, actor), withBase(options)),
      fileRequirements: (eventId, actor = {}) =>
        prismRequest<PrismFileRequirementsMatrix>(
          actorPath(`/events/${eventId}/file-requirements`, actor),
          withBase(options),
        ),
    },
    clientWorkspace: {
      detail: (actor = {}) => prismRequest<PrismClientWorkspace>(actorPath("/client/workspace", actor), withBase(options)),
      actionCenter: (actor = {}) =>
        prismRequest<PrismClientActionCenter>(actorPath("/client/action-center", actor), withBase(options)),
    },
    supplierWorkspace: {
      detail: () => prismRequest<PrismSupplierWorkspace>("/supplier/workspace", withBase(options)),
      readinessBoard: () =>
        prismRequest<PrismSupplierReadinessBoard>("/supplier/readiness-board", withBase(options)),
      confirmAssignment: (requestId, actor = {}) =>
        prismRequest<PrismSupplierQuoteRequest>(
          actorPath(`/supplier/quote-requests/${requestId}/assignment/confirm`, actor),
          withBase(options, { method: "PATCH" }),
        ),
      confirmReadiness: (requestId, input, actor = {}) =>
        prismRequest<PrismSupplierQuoteRequest>(
          actorPath(`/supplier/quote-requests/${requestId}/readiness/confirm`, actor),
          withBase(options, { method: "PATCH", body: input }),
        ),
      uploadContract: (requestId, input, actor = {}) =>
        prismRequest<PrismSupplierQuoteRequest>(
          actorPath(`/supplier/quote-requests/${requestId}/contract`, actor),
          withBase(options, { method: "POST", body: input }),
        ),
      updateEventStatus: (requestId, input, actor = {}) =>
        prismRequest<PrismSupplierQuoteRequest>(
          actorPath(`/supplier/quote-requests/${requestId}/event-status`, actor),
          withBase(options, { method: "PATCH", body: input }),
        ),
    },
    billing: {
      list: (actor = {}) => prismRequest<PrismBillingWorkspace>(actorPath("/billing", actor), withBase(options)),
    },
    pmcmDashboard: {
      detail: (actor = {}) =>
        prismRequest<PrismPmcmDashboardWorkspace>(actorPath("/pmcm/dashboard", actor), withBase(options)),
    },
    pmcm: {
      commandInbox: (actor = {}) =>
        prismRequest<PrismPmcmCommandInbox>(actorPath("/pmcm/command-inbox", actor), withBase(options)),
      eventWorkspace: (eventId, actor = {}) =>
        prismRequest<PrismPmcmEventWorkspace>(actorPath(`/pmcm/events/${eventId}/workspace`, actor), withBase(options)),
    },
    guest: {
      eventPass: (accessCode) =>
        prismRequest<PrismGuestEventPass>(`/guest/events/${encodeURIComponent(accessCode)}`, withBase(options)),
      checkIn: (accessCode, input) =>
        prismRequest<PrismGuestCheckIn>(
          `/guest/events/${encodeURIComponent(accessCode)}/check-ins`,
          withBase(options, { method: "POST", body: input }),
        ),
      feedback: (accessCode, input) =>
        prismRequest<PrismGuestFeedback>(
          `/guest/events/${encodeURIComponent(accessCode)}/feedback`,
          withBase(options, { method: "POST", body: input }),
        ),
    },
    coordinator: {
      workspace: (actor = {}) =>
        prismRequest<PrismCoordinatorWorkspace>(actorPath("/coordinator/workspace", actor), withBase(options)),
    },
    liveOps: {
      eventDayWorkspace: (eventId, actor = {}) =>
        prismRequest<PrismLiveOps>(actorPath(`/events/${eventId}/live-ops`, actor), withBase(options)),
      createTask: (eventId, input, actor = {}) =>
        prismRequest<PrismEventDayTask>(
          actorPath(`/events/${eventId}/event-day/tasks`, actor),
          withBase(options, { method: "POST", body: input }),
        ),
      updateTask: (eventId, taskId, input, actor = {}) =>
        prismRequest<PrismEventDayTask>(
          actorPath(`/events/${eventId}/event-day/tasks/${taskId}`, actor),
          withBase(options, { method: "PATCH", body: input }),
        ),
      updateCoordinatorAttendance: (eventId, assignmentId, input, actor = {}) =>
        prismRequest<PrismCoordinatorAssignment>(
          actorPath(`/events/${eventId}/coordinators/${assignmentId}/status`, actor),
          withBase(options, { method: "PATCH", body: input }),
        ),
      createUrgentIssue: (eventId, input, actor = {}) =>
        prismRequest<PrismUrgentIssue>(
          actorPath(`/events/${eventId}/urgent-issues`, actor),
          withBase(options, { method: "POST", body: input }),
        ),
    },
    supplierApplications: {
      create: (input) =>
        prismRequest<PrismSupplierApplication>(
          "/supplier-applications",
          withBase(options, { method: "POST", body: input }),
        ),
      listCategories: () =>
        prismRequest<{ id: string; name: string }[]>(
          "/supplier-applications/categories",
          withBase(options),
        ),
    },
  };
}
