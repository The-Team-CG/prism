import { eventApi } from "@/lib/prism-api";
import type {
  DecideFreezeExceptionInput,
  PrismAddendumConformeExecution,
  SignAddendumConformeExecutionInput,
  RecordEventDecisionInput,
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
  recordDecision(eventId: string, input: RecordEventDecisionInput) {
    return eventApi.events.recordDecision(eventId, input);
  },
  requestAddendumConforme(eventId: string, addendumId: string): Promise<PrismAddendumConformeExecution> {
    return eventApi.events.requestAddendumConforme(eventId, addendumId);
  },
  countersignAddendumConforme(eventId: string, addendumId: string, input: SignAddendumConformeExecutionInput): Promise<PrismAddendumConformeExecution> {
    return eventApi.events.countersignAddendumConforme(eventId, addendumId, input);
  },
};
