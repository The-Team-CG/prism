import type { EventSession } from "@/app/lib/session";
import { prismApi } from "@/lib/prism-api";

export const coordinatorsRepository = {
  loadRoleView(session: EventSession, eventId: string) {
    return prismApi.coordinatorRoleView(session, eventId);
  },
  acknowledge(eventId: string, assignmentId: string) {
    return prismApi.acknowledgeCoordinator(eventId, assignmentId);
  },
};
