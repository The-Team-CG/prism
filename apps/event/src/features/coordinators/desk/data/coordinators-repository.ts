import type { EventSession } from "@/app/lib/session";
import { prismApi } from "@/lib/prism-api";
import type { CreateEventDayTaskInput, CreateUrgentIssueInput, CoordinatorAssignmentAcknowledgementInput, WithdrawCoordinatorAssignmentInput } from "@prism/types";

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
};
