import type { EventSession } from "@/app/lib/session";
import { eventApiRequest } from "@/lib/prism-api";
import type {
  PrismCoordinatorAssignment,
  PrismCoordinatorRoleView,
  PrismEventDayTask,
  PrismEventRunSheet,
  PrismEventTaskReassignmentRequest,
  PrismSupplierQuoteRequest,
  PrismUrgentIssue,
  CreateEventDayTaskInput,
  CreateEventTaskReassignmentInput,
  CreateUrgentIssueInput,
  CoordinatorAssignmentAcknowledgementInput,
  DecideEventTaskReassignmentInput,
  UpdateCoordinatorAttendanceInput,
  UpdateEventDayTaskInput,
  VerifySupplierStatusInput,
  WithdrawCoordinatorAssignmentInput,
} from "@prism/types";

export const coordinatorsRepository = {
  loadRoleView(session: EventSession, eventId: string) {
    return eventApiRequest<PrismCoordinatorRoleView>(
      `/api/coordinator/events/${eventId}/role-view`,
      { authToken: session.accessToken },
    );
  },
  acknowledge(eventId: string, assignmentId: string, input: CoordinatorAssignmentAcknowledgementInput) {
    return eventApiRequest<PrismCoordinatorAssignment>(
      `/api/events/${eventId}/coordinators/${assignmentId}/acknowledge`,
      { method: "PATCH", body: input },
    );
  },
  withdraw(session: EventSession, eventId: string, assignmentId: string, input: WithdrawCoordinatorAssignmentInput) {
    return eventApiRequest<PrismCoordinatorAssignment>(
      `/api/events/${eventId}/coordinators/${assignmentId}/withdraw`,
      { method: "PATCH", body: input, authToken: session.accessToken },
    );
  },
  createEventDayTask(session: EventSession, eventId: string, input: CreateEventDayTaskInput) {
    return eventApiRequest<PrismEventDayTask>(`/api/events/${eventId}/event-day/tasks`, {
      method: "POST", body: input, authToken: session.accessToken,
    });
  },
  createUrgentIssue(session: EventSession, eventId: string, input: CreateUrgentIssueInput) {
    return eventApiRequest<PrismUrgentIssue>(`/api/events/${eventId}/urgent-issues`, {
      method: "POST", body: input, authToken: session.accessToken,
    });
  },
  listTaskReassignments(session: EventSession, eventId: string) {
    return eventApiRequest<PrismEventTaskReassignmentRequest[]>(
      `/api/events/${eventId}/event-day/task-reassignments`,
      { authToken: session.accessToken },
    );
  },
  requestTaskReassignment(
    session: EventSession,
    eventId: string,
    taskId: string,
    input: CreateEventTaskReassignmentInput,
  ) {
    return eventApiRequest<PrismEventTaskReassignmentRequest>(
      `/api/events/${eventId}/event-day/tasks/${taskId}/reassignments`,
      { method: "POST", body: input, authToken: session.accessToken },
    );
  },
  decideTaskReassignment(
    session: EventSession,
    eventId: string,
    requestId: string,
    input: DecideEventTaskReassignmentInput,
  ) {
    return eventApiRequest<PrismEventTaskReassignmentRequest>(
      `/api/events/${eventId}/event-day/task-reassignments/${requestId}`,
      { method: "PATCH", body: input, authToken: session.accessToken },
    );
  },
  updateOwnAttendance(
    session: EventSession,
    eventId: string,
    assignmentId: string,
    input: UpdateCoordinatorAttendanceInput,
  ) {
    return eventApiRequest<PrismCoordinatorAssignment>(
      `/api/events/${eventId}/coordinators/${assignmentId}/status`,
      { method: "PATCH", body: input, authToken: session.accessToken },
    );
  },
  getRunSheet(session: EventSession, eventId: string, dayId?: string) {
    const query = dayId ? `?dayId=${encodeURIComponent(dayId)}` : "";
    return eventApiRequest<PrismEventRunSheet | { eventId: string; authored: false; reason: "no_schedule" }>(
      `/api/events/${eventId}/run-sheet${query}`,
      { authToken: session.accessToken },
    );
  },
  updateOwnTask(session: EventSession, eventId: string, taskId: string, input: UpdateEventDayTaskInput) {
    return eventApiRequest<PrismEventDayTask>(`/api/events/${eventId}/event-day/tasks/${taskId}`, {
      method: "PATCH", body: input, authToken: session.accessToken,
    });
  },
  updateDelegatedAttendance(session: EventSession, eventId: string, assignmentId: string, input: UpdateCoordinatorAttendanceInput) {
    return eventApiRequest<PrismCoordinatorAssignment>(
      `/api/events/${eventId}/coordinators/${assignmentId}/status`,
      { method: "PATCH", body: input, authToken: session.accessToken },
    );
  },
  verifySupplierStatus(session: EventSession, eventId: string, requestId: string, input: VerifySupplierStatusInput) {
    return eventApiRequest<PrismSupplierQuoteRequest>(
      `/api/events/${eventId}/supplier-status/${requestId}/verify`,
      { method: "PATCH", body: input, authToken: session.accessToken },
    );
  },
};
