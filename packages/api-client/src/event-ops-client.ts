import type {
  ConfirmSupplierReadinessInput,
  CreateEventDayTaskInput,
  CreateGuestCheckInInput,
  CreateGuestFeedbackInput,
  CreatePrismInquiryInput,
  CreateRegistrationPlatformInput,
  CreateSupplierApplicationInput,
  CreateCommunicationThreadInput,
  SendCommunicationMessageInput,
  CreateUrgentIssueInput,
  ArchiveSearchFilters,
  ReviewEventProposalInput,
  ReviewSupplierApplicationInput,
  PrismArchivedEventSearchHit,
  PrismBillingWorkspace,
  PrismClientActionCenter,
  PrismClientWorkspace,
  PrismEvent,
  PrismFileRequirementsMatrix,
  PrismGuestCheckIn,
  PrismGuestRosterEntry,
  PrismGuestEventPass,
  PrismGuestFeedback,
  PrismInquiry,
  PrismPmcmCommandInbox,
  PrismPmcmDashboardWorkspace,
  PrismPmcmEventWorkspace,
  PrismRegistrationPlatform,
  PrismSampleState,
  PrismEventOpsActorContext,
  PrismSupplierQuoteRequest,
  PrismSupplierReadinessBoard,
  PrismSupplierWorkspace,
  PrismCommunicationThread,
  PrismCommunicationParticipantChoice,
  PrismCoordinatorWorkspace,
  PrismLiveOps,
  PrismEventDayTask,
  PrismUrgentIssue,
  PrismCoordinatorAssignment,
  PrismSupplierApplication,
  ImportHeadcountInput,
  ImportGuestRosterInput,
  GuestRosterSearchInput,
  UpdateCoordinatorAttendanceInput,
  UpdateEventDayTaskInput,
  UpdateRegistrationPlatformInput,
  UpdateWalkInPolicyInput,
  UpdateSupplierEventStatusInput,
  UploadContractInput,
  UpdateGuestVerificationInput,
  CreateEventScheduleDayInput,
  CreateEventScheduleSegmentInput,
  UpdateEventScheduleSegmentStatusInput,
  CreateEventOperatorDesignationInput,
  CreateEventHandoffInput,
  CreateEventEodReportInput,
  CreateEventEodReplyInput,
  PrismEventSchedule,
  PrismEventScheduleSegment,
  PrismEventRunSheet,
  PrismEventHandoff,
  PrismEventEodReport,
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
  CreateSupplierApplicationInput,
  CreatePrismInquiryInput,
  CreateRegistrationPlatformInput,
  CreateUrgentIssueInput,
  ArchiveSearchFilters,
  ReviewEventProposalInput,
  ReviewSupplierApplicationInput,
  ImportHeadcountInput,
  SubmitSupplierQuoteInput,
  UpdateCoordinatorAttendanceInput,
  UpdateEventDayTaskInput,
  UpdateInquiryStatusInput,
  UpdateRegistrationPlatformInput,
  UpdateSupplierEventStatusInput,
  UploadConformeInput,
  UploadContractInput,
} from "@prism/types";

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
  auth: {
    requestPasswordReset(email: string): Promise<{ message: string; deliveryAvailable: boolean }>;
    consumePasswordReset(token: string, password: string): Promise<{ message: string }>;
  };
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
    reviewProposal(eventId: string, input: ReviewEventProposalInput, actor?: EventOpsActorQuery): Promise<PrismEvent>;
    searchArchive(filters?: ArchiveSearchFilters, actor?: EventOpsActorQuery): Promise<PrismArchivedEventSearchHit[]>;
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
    registrationPlatform(eventId: string, actor?: EventOpsActorQuery): Promise<PrismRegistrationPlatform | null>;
    upsertRegistrationPlatform(
      eventId: string,
      input: CreateRegistrationPlatformInput,
      actor?: EventOpsActorQuery,
    ): Promise<PrismRegistrationPlatform>;
    updateRegistrationPlatform(
      eventId: string,
      input: UpdateRegistrationPlatformInput,
      actor?: EventOpsActorQuery,
    ): Promise<PrismRegistrationPlatform>;
    importHeadcount(
      eventId: string,
      input: ImportHeadcountInput,
      actor?: EventOpsActorQuery,
    ): Promise<PrismRegistrationPlatform>;
  };
  guest: {
    eventPass(accessCode: string): Promise<PrismGuestEventPass>;
    checkIn(accessCode: string, input: CreateGuestCheckInInput): Promise<PrismGuestCheckIn>;
    feedback(accessCode: string, input: CreateGuestFeedbackInput): Promise<PrismGuestFeedback>;
    roster(eventId: string, query?: string, actor?: EventOpsActorQuery): Promise<PrismGuestRosterEntry[]>;
    searchRoster(eventId: string, filters?: GuestRosterSearchInput, actor?: EventOpsActorQuery): Promise<PrismGuestRosterEntry[]>;
    importRoster(eventId: string, input: ImportGuestRosterInput, actor?: EventOpsActorQuery): Promise<PrismGuestRosterEntry[]>;
    checkInRoster(eventId: string, rosterEntryId: string, actor?: EventOpsActorQuery): Promise<PrismGuestCheckIn>;
    verifyRoster(eventId: string, rosterEntryId: string, input: UpdateGuestVerificationInput, actor?: EventOpsActorQuery): Promise<PrismGuestRosterEntry>;
    walkInPolicy(eventId: string, actor?: EventOpsActorQuery): Promise<{ eventId: string; policy: "closed" | "open" | "threshold"; threshold: number }>;
    updateWalkInPolicy(eventId: string, input: UpdateWalkInPolicyInput, actor?: EventOpsActorQuery): Promise<{ eventId: string; policy: "closed" | "open" | "threshold"; threshold: number }>;
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
    schedule(eventId: string, actor?: EventOpsActorQuery): Promise<PrismEventSchedule>;
    createScheduleDay(eventId: string, input: CreateEventScheduleDayInput, actor?: EventOpsActorQuery): Promise<unknown>;
    createScheduleSegment(eventId: string, dayId: string, input: CreateEventScheduleSegmentInput, actor?: EventOpsActorQuery): Promise<PrismEventScheduleSegment>;
    updateScheduleSegmentStatus(eventId: string, segmentId: string, input: UpdateEventScheduleSegmentStatusInput, actor?: EventOpsActorQuery): Promise<PrismEventScheduleSegment>;
    runSheet(eventId: string, dayId?: string, actor?: EventOpsActorQuery): Promise<PrismEventRunSheet | { eventId: string; authored: false; reason: 'no_schedule' }>;
    designateOperator(eventId: string, input: CreateEventOperatorDesignationInput, actor?: EventOpsActorQuery): Promise<unknown>;
    createHandoff(eventId: string, input: CreateEventHandoffInput, actor?: EventOpsActorQuery): Promise<PrismEventHandoff>;
    listEodReports(eventId: string, actor?: EventOpsActorQuery): Promise<PrismEventEodReport[]>;
    submitEodReport(eventId: string, input: CreateEventEodReportInput, actor?: EventOpsActorQuery): Promise<PrismEventEodReport>;
    replyEodReport(eventId: string, reportId: string, input: CreateEventEodReplyInput, actor?: EventOpsActorQuery): Promise<PrismEventEodReport['replies'][number]>;
    createTask(eventId: string, input: CreateEventDayTaskInput, actor?: EventOpsActorQuery): Promise<PrismEventDayTask>;
    updateTask(eventId: string, taskId: string, input: UpdateEventDayTaskInput, actor?: EventOpsActorQuery): Promise<PrismEventDayTask>;
    updateCoordinatorAttendance(eventId: string, assignmentId: string, input: UpdateCoordinatorAttendanceInput, actor?: EventOpsActorQuery): Promise<PrismCoordinatorAssignment>;
    createUrgentIssue(eventId: string, input: CreateUrgentIssueInput, actor?: EventOpsActorQuery): Promise<PrismUrgentIssue>;
  };
  supplierApplications: {
    create(input: CreateSupplierApplicationInput): Promise<PrismSupplierApplication>;
    listCategories(): Promise<{ id: string; name: string }[]>;
    listInbox(actor?: EventOpsActorQuery): Promise<PrismSupplierApplication[]>;
    review(
      applicationId: string,
      input: ReviewSupplierApplicationInput,
      actor?: EventOpsActorQuery,
    ): Promise<PrismSupplierApplication>;
  };
  communication: {
    listThreads(eventId: string, actor?: EventOpsActorQuery): Promise<PrismCommunicationThread[]>;
    listParticipants(eventId: string, actor?: EventOpsActorQuery): Promise<PrismCommunicationParticipantChoice[]>;
    createThread(input: CreateCommunicationThreadInput, actor?: EventOpsActorQuery): Promise<PrismCommunicationThread>;
    sendMessage(threadId: string, input: SendCommunicationMessageInput, actor?: EventOpsActorQuery): Promise<PrismCommunicationThread["messages"][number]>;
  };
}

export function createEventOpsClient(options: EventOpsClientOptions = {}): EventOpsClient {
  return {
    auth: {
      requestPasswordReset: (email) => prismRequest('/auth/password-reset/request', withBase(options, { method: 'POST', body: { email } })),
      consumePasswordReset: (token, password) => prismRequest('/auth/password-reset/consume', withBase(options, { method: 'POST', body: { token, password } })),
    },
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
      reviewProposal: (eventId, input, actor = {}) =>
        prismRequest<PrismEvent>(
          actorPath(`/events/${eventId}/proposal/review`, actor),
          withBase(options, { method: "PATCH", body: input }),
        ),
      searchArchive: (filters = {}, actor = {}) => {
        const query = toQueryString({ ...actor, ...filters });
        return prismRequest<PrismArchivedEventSearchHit[]>(
          query ? `/events/archive?${query}` : "/events/archive",
          withBase(options),
        );
      },
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
      registrationPlatform: (eventId, actor = {}) =>
        prismRequest<PrismRegistrationPlatform | null>(actorPath(`/events/${eventId}/registration-platform`, actor), withBase(options)),
      upsertRegistrationPlatform: (eventId, input, actor = {}) =>
        prismRequest<PrismRegistrationPlatform>(
          actorPath(`/events/${eventId}/registration-platform`, actor),
          withBase(options, { method: "POST", body: input }),
        ),
      updateRegistrationPlatform: (eventId, input, actor = {}) =>
        prismRequest<PrismRegistrationPlatform>(
          actorPath(`/events/${eventId}/registration-platform`, actor),
          withBase(options, { method: "PATCH", body: input }),
        ),
      importHeadcount: (eventId, input, actor = {}) =>
        prismRequest<PrismRegistrationPlatform>(
          actorPath(`/events/${eventId}/registration-platform/headcount-import`, actor),
          withBase(options, { method: "POST", body: input }),
        ),
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
      roster: (eventId, query = "", actor = {}) => {
        const params = toQueryString({ ...actor, ...(query.trim() ? { query: query.trim() } : {}) });
        return prismRequest<PrismGuestRosterEntry[]>(
          `/guest/events/${eventId}/roster${params ? `?${params}` : ""}`,
          withBase(options),
        );
      },
      searchRoster: (eventId, filters = {}, actor = {}) => {
        const params = toQueryString({ ...actor, ...filters });
        return prismRequest<PrismGuestRosterEntry[]>(
          `/guest/events/${eventId}/roster/search${params ? `?${params}` : ""}`,
          withBase(options),
        );
      },
      importRoster: (eventId, input, actor = {}) =>
        prismRequest<PrismGuestRosterEntry[]>(
          actorPath(`/guest/events/${eventId}/roster/import`, actor),
          withBase(options, { method: "POST", body: input }),
        ),
      checkInRoster: (eventId, rosterEntryId, actor = {}) =>
        prismRequest<PrismGuestCheckIn>(
          actorPath(`/guest/events/${eventId}/roster/${rosterEntryId}/check-in`, actor),
          withBase(options, { method: "POST" }),
        ),
      verifyRoster: (eventId, rosterEntryId, input, actor = {}) =>
        prismRequest<PrismGuestRosterEntry>(
          actorPath(`/guest/events/${eventId}/roster/${rosterEntryId}/verification`, actor),
          withBase(options, { method: "PATCH", body: input }),
        ),
      walkInPolicy: (eventId, actor = {}) =>
        prismRequest(actorPath(`/events/${eventId}/walk-in-policy`, actor), withBase(options)),
      updateWalkInPolicy: (eventId, input, actor = {}) =>
        prismRequest(actorPath(`/events/${eventId}/walk-in-policy`, actor), withBase(options, { method: "PATCH", body: input })),
    },
    coordinator: {
      workspace: (actor = {}) =>
        prismRequest<PrismCoordinatorWorkspace>(actorPath("/coordinator/workspace", actor), withBase(options)),
    },
    liveOps: {
      eventDayWorkspace: (eventId, actor = {}) =>
        prismRequest<PrismLiveOps>(actorPath(`/events/${eventId}/live-ops`, actor), withBase(options)),
      schedule: (eventId, actor = {}) => prismRequest<PrismEventSchedule>(actorPath(`/events/${eventId}/schedule`, actor), withBase(options)),
      createScheduleDay: (eventId, input, actor = {}) => prismRequest(actorPath(`/events/${eventId}/schedule/days`, actor), withBase(options, { method: 'POST', body: input })),
      createScheduleSegment: (eventId, dayId, input, actor = {}) => prismRequest<PrismEventScheduleSegment>(actorPath(`/events/${eventId}/schedule/days/${dayId}/segments`, actor), withBase(options, { method: 'POST', body: input })),
      updateScheduleSegmentStatus: (eventId, segmentId, input, actor = {}) => prismRequest<PrismEventScheduleSegment>(actorPath(`/events/${eventId}/schedule/segments/${segmentId}/status`, actor), withBase(options, { method: 'PATCH', body: input })),
      runSheet: (eventId, dayId, actor = {}) => { const query = dayId ? `?dayId=${encodeURIComponent(dayId)}` : ''; return prismRequest<PrismEventRunSheet | { eventId: string; authored: false; reason: 'no_schedule' }>(actorPath(`/events/${eventId}/run-sheet${query}`, actor), withBase(options)); },
      designateOperator: (eventId, input, actor = {}) => prismRequest(actorPath(`/events/${eventId}/operator-designation`, actor), withBase(options, { method: 'POST', body: input })),
      createHandoff: (eventId, input, actor = {}) => prismRequest<PrismEventHandoff>(actorPath(`/events/${eventId}/handoffs`, actor), withBase(options, { method: 'POST', body: input })),
      listEodReports: (eventId, actor = {}) => prismRequest<PrismEventEodReport[]>(actorPath(`/events/${eventId}/eod-reports`, actor), withBase(options)),
      submitEodReport: (eventId, input, actor = {}) => prismRequest<PrismEventEodReport>(actorPath(`/events/${eventId}/eod-reports`, actor), withBase(options, { method: 'POST', body: input })),
      replyEodReport: (eventId, reportId, input, actor = {}) => prismRequest<PrismEventEodReport['replies'][number]>(actorPath(`/events/${eventId}/eod-reports/${reportId}/replies`, actor), withBase(options, { method: 'POST', body: input })),
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
      listInbox: (actor = {}) =>
        prismRequest<PrismSupplierApplication[]>(
          actorPath("/supplier-applications/inbox", actor),
          withBase(options),
        ),
      review: (applicationId, input, actor = {}) =>
        prismRequest<PrismSupplierApplication>(
          actorPath(`/supplier-applications/${applicationId}/review`, actor),
          withBase(options, { method: "PATCH", body: input }),
        ),
    },
    communication: {
      listThreads: (eventId, actor = {}) => prismRequest<PrismCommunicationThread[]>(actorPath(`/communication/threads?eventId=${encodeURIComponent(eventId)}`, actor), withBase(options)),
      listParticipants: (eventId, actor = {}) => prismRequest<PrismCommunicationParticipantChoice[]>(actorPath(`/communication/participants?eventId=${encodeURIComponent(eventId)}`, actor), withBase(options)),
      createThread: (input, actor = {}) => prismRequest<PrismCommunicationThread>(actorPath('/communication/threads', actor), withBase(options, { method: 'POST', body: input })),
      sendMessage: (threadId, input, actor = {}) => prismRequest<PrismCommunicationThread['messages'][number]>(actorPath(`/communication/threads/${threadId}/messages`, actor), withBase(options, { method: 'POST', body: input })),
    },
  };
}
