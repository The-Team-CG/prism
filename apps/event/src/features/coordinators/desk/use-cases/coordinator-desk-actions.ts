import type { EventSession } from "@/app/lib/session";
import type {
  CreateEventDayTaskInput,
  CreateEventTaskReassignmentInput,
  CreateUrgentIssueInput,
  CoordinatorAssignmentAcknowledgementInput,
  DecideEventTaskReassignmentInput,
  UpdateCoordinatorAttendanceInput,
  WithdrawCoordinatorAssignmentInput,
} from "@prism/types";
import { coordinatorsRepository } from "../data/coordinators-repository";

export async function loadCoordinatorRoleView(session: EventSession, eventId: string) {
  return coordinatorsRepository.loadRoleView(session, eventId);
}

export async function acknowledgeCoordinatorAssignment(
  eventId: string,
  assignmentId: string,
  input: CoordinatorAssignmentAcknowledgementInput = { decision: "acknowledged" },
) {
  return coordinatorsRepository.acknowledge(eventId, assignmentId, input);
}

export async function acknowledgeAndRefreshRoleView(input: {
  session: EventSession;
  eventId: string;
  assignmentId: string;
  input?: CoordinatorAssignmentAcknowledgementInput;
}) {
  await acknowledgeCoordinatorAssignment(input.eventId, input.assignmentId, input.input);
  return loadCoordinatorRoleView(input.session, input.eventId);
}

export async function withdrawAndRefreshWorkspace(input: {
  session: EventSession;
  eventId: string;
  assignmentId: string;
  input: WithdrawCoordinatorAssignmentInput;
}) {
  await coordinatorsRepository.withdraw(input.session, input.eventId, input.assignmentId, input.input);
}

export async function createTaskAndRefreshRoleView(input: {
  session: EventSession;
  eventId: string;
  input: CreateEventDayTaskInput;
}) {
  await coordinatorsRepository.createEventDayTask(input.session, input.eventId, input.input);
  return loadCoordinatorRoleView(input.session, input.eventId);
}

export async function createUrgentIssueAndRefreshRoleView(input: {
  session: EventSession;
  eventId: string;
  input: CreateUrgentIssueInput;
}) {
  await coordinatorsRepository.createUrgentIssue(input.session, input.eventId, input.input);
  return loadCoordinatorRoleView(input.session, input.eventId);
}

export async function requestTaskReassignmentAndRefreshRoleView(input: {
  session: EventSession;
  eventId: string;
  taskId: string;
  input: CreateEventTaskReassignmentInput;
}) {
  await coordinatorsRepository.requestTaskReassignment(input.session, input.eventId, input.taskId, input.input);
  return loadCoordinatorRoleView(input.session, input.eventId);
}

export async function decideTaskReassignmentAndRefreshRoleView(input: {
  session: EventSession;
  eventId: string;
  requestId: string;
  input: DecideEventTaskReassignmentInput;
}) {
  await coordinatorsRepository.decideTaskReassignment(input.session, input.eventId, input.requestId, input.input);
  return loadCoordinatorRoleView(input.session, input.eventId);
}

// EP-11-S03: mirrors createTaskAndRefreshRoleView, plus assignmentId.
export async function markAttendanceAndRefreshRoleView(input: {
  session: EventSession;
  eventId: string;
  assignmentId: string;
  input: UpdateCoordinatorAttendanceInput;
}) {
  await coordinatorsRepository.updateOwnAttendance(
    input.session,
    input.eventId,
    input.assignmentId,
    input.input,
  );
  return loadCoordinatorRoleView(input.session, input.eventId);
}
