import { eventOpsRepository } from "@/features/event-ops";
import type { EventSession } from "@/app/lib/session";

export const coordinatorsRepository = {
  loadRoleView(session: EventSession, eventId: string) {
    return eventOpsRepository.coordinatorRoleView(session, eventId);
  },
  acknowledge(eventId: string, assignmentId: string) {
    return eventOpsRepository.acknowledgeCoordinator(eventId, assignmentId);
  },
};
