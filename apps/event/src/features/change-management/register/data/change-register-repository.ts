import { eventApi } from "@/lib/prism-api";
import type {
  DecideFreezeExceptionInput,
  FreezeEventInput,
  PrismAddendum,
  PrismEventFreezeException,
  RequestFreezeExceptionInput,
} from "@prism/types";

export const changeRegisterRepository = {
  async load(eventId: string): Promise<{ addenda: PrismAddendum[]; exceptions: PrismEventFreezeException[] }> {
    const [addenda, exceptions] = await Promise.all([
      eventApi.events.addenda(eventId),
      eventApi.events.freezeExceptions(eventId),
    ]);
    return { addenda, exceptions };
  },
  freeze(eventId: string, input: FreezeEventInput) {
    return eventApi.events.freeze(eventId, input);
  },
  requestException(eventId: string, input: RequestFreezeExceptionInput) {
    return eventApi.events.requestFreezeException(eventId, input);
  },
  decideException(eventId: string, exceptionId: string, input: DecideFreezeExceptionInput) {
    return eventApi.events.decideFreezeException(eventId, exceptionId, input);
  },
};
