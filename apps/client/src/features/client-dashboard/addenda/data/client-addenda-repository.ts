import type { PrismAddendum, PrismAddendumConformeExecution, SignAddendumConformeExecutionInput } from "@prism/types";
import { clientApi } from "@/lib/prism-api";

export const clientAddendaRepository = {
  list(eventId: string): Promise<PrismAddendum[]> {
    return clientApi.events.addenda(eventId);
  },
  acknowledge(eventId: string, addendumId: string, input: SignAddendumConformeExecutionInput): Promise<PrismAddendumConformeExecution> {
    return clientApi.events.acknowledgeAddendumConforme(eventId, addendumId, input);
  },
};
