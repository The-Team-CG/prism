import type { EventSession } from "@/app/lib/session";
import { prismApi } from "@/lib/prism-api";
import type { CreateEventDayTaskInput, CreateUrgentIssueInput } from "@prism/types";

export const coordinatorsRepository = {
  loadRoleView(session: EventSession, eventId: string) {
    return prismApi.coordinatorRoleView(session, eventId);
  },
  acknowledge(eventId: string, assignmentId: string) {
    return prismApi.acknowledgeCoordinator(eventId, assignmentId);
  },
  createEventDayTask(session: EventSession, eventId: string, input: CreateEventDayTaskInput) {
    return prismApi.createCoordinatorEventDayTask(session, eventId, input);
  },
  createUrgentIssue(session: EventSession, eventId: string, input: CreateUrgentIssueInput) {
    return prismApi.createCoordinatorUrgentIssue(session, eventId, input);
  },
};
