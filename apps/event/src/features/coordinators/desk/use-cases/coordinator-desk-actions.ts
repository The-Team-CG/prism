import type { EventSession } from "@/app/lib/session";
import type { CreateEventDayTaskInput, CreateUrgentIssueInput } from "@prism/types";
import { coordinatorsRepository } from "../data/coordinators-repository";

export async function loadCoordinatorRoleView(session: EventSession, eventId: string) {
  return coordinatorsRepository.loadRoleView(session, eventId);
}

export async function acknowledgeCoordinatorAssignment(
  eventId: string,
  assignmentId: string,
) {
  return coordinatorsRepository.acknowledge(eventId, assignmentId);
}

export async function acknowledgeAndRefreshRoleView(input: {
  session: EventSession;
  eventId: string;
  assignmentId: string;
}) {
  await acknowledgeCoordinatorAssignment(input.eventId, input.assignmentId);
  return loadCoordinatorRoleView(input.session, input.eventId);
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
