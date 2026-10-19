import type { PrismClientAddendumConforme, SignAddendumConformeInput } from "@prism/types";
import { clientApi } from "@/lib/prism-api";

export const clientAddendumConformeRepository = {
  list(eventId: string): Promise<PrismClientAddendumConforme[]> {
    return clientApi.events.clientAddendumConformes(eventId);
  },
  acknowledge(eventId: string, addendumId: string, input: SignAddendumConformeInput): Promise<PrismClientAddendumConforme> {
    return clientApi.events.acknowledgeAddendumConforme(eventId, addendumId, input);
  },
};
