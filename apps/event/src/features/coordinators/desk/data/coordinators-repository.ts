import type { EventSession } from "@/app/lib/session";
import { prismApi } from "@/lib/prism-api";
import type {
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
    return prismApi.coordinatorRoleView(session, eventId);
  },
  acknowledge(eventId: string, assignmentId: string, input: CoordinatorAssignmentAcknowledgementInput) {
    return prismApi.acknowledgeCoordinator(eventId, assignmentId, input);
  },
  withdraw(session: EventSession, eventId: string, assignmentId: string, input: WithdrawCoordinatorAssignmentInput) {
    return prismApi.withdrawCoordinator(session, eventId, assignmentId, input);
  },
  createEventDayTask(session: EventSession, eventId: string, input: CreateEventDayTaskInput) {
    return prismApi.createCoordinatorEventDayTask(session, eventId, input);
  },
  createUrgentIssue(session: EventSession, eventId: string, input: CreateUrgentIssueInput) {
    return prismApi.createCoordinatorUrgentIssue(session, eventId, input);
  },
  listTaskReassignments(session: EventSession, eventId: string) {
    return prismApi.listCoordinatorTaskReassignments(session, eventId);
  },
  requestTaskReassignment(
    session: EventSession,
    eventId: string,
    taskId: string,
    input: CreateEventTaskReassignmentInput,
  ) {
    return prismApi.requestCoordinatorTaskReassignment(session, eventId, taskId, input);
  },
  decideTaskReassignment(
    session: EventSession,
    eventId: string,
    requestId: string,
    input: DecideEventTaskReassignmentInput,
  ) {
    return prismApi.decideCoordinatorTaskReassignment(session, eventId, requestId, input);
  },
  updateOwnAttendance(
    session: EventSession,
    eventId: string,
    assignmentId: string,
    input: UpdateCoordinatorAttendanceInput,
  ) {
    return prismApi.updateOwnCoordinatorAttendance(session, eventId, assignmentId, input);
  },
  updateOwnTask(session: EventSession, eventId: string, taskId: string, input: UpdateEventDayTaskInput) {
    return prismApi.updateCoordinatorEventDayTask(session, eventId, taskId, input);
  },
  updateDelegatedAttendance(session: EventSession, eventId: string, assignmentId: string, input: UpdateCoordinatorAttendanceInput) {
    return prismApi.updateDelegatedCoordinatorAttendance(session, eventId, assignmentId, input);
  },
  verifySupplierStatus(session: EventSession, eventId: string, requestId: string, input: VerifySupplierStatusInput) {
    return prismApi.verifyCoordinatorSupplierStatus(session, eventId, requestId, input);
  },
};
