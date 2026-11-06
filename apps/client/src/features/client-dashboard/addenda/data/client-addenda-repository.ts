import type { PrismAddendum, PrismAddendumConformeExecution, SignAddendumConformeExecutionInput } from "@prism/types";
import { defineResource } from "@prism/portal-query";
import { clientApi } from "@/lib/prism-api";

export const clientAddendaRepository = {
  list(eventId: string): Promise<PrismAddendum[]> {
    return clientApi.events.addenda(eventId);
  },
  acknowledge(eventId: string, addendumId: string, input: SignAddendumConformeExecutionInput): Promise<PrismAddendumConformeExecution> {
    return clientApi.events.acknowledgeAddendumConforme(eventId, addendumId, input);
  },
};

/** The event's issued addenda, shared by the overview panel and prefetched when an event page opens. */
export const clientEventAddendaResource = defineResource({
  name: "client.event-addenda",
  fetch: (eventId: string) => clientAddendaRepository.list(eventId),
});
