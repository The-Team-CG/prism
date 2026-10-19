import { eventApi } from "@/lib/prism-api";
import type {
  DecideFreezeExceptionInput,
  IssueAddendumConformeInput,
  RecordEventDecisionInput,
  FreezeEventInput,
  PrismAddendum,
  PrismAddendumConformeExecution,
  PrismEventFreezeException,
  RequestFreezeExceptionInput,
  SignAddendumConformeInput,
} from "@prism/types";

export const changeRegisterRepository = {
  async load(eventId: string): Promise<{ addenda: PrismAddendum[]; exceptions: PrismEventFreezeException[]; conformes: PrismAddendumConformeExecution[] }> {
    const [addenda, exceptions, conformes] = await Promise.all([
      eventApi.events.addenda(eventId),
      eventApi.events.freezeExceptions(eventId),
      eventApi.events.addendumConformes(eventId),
    ]);
    return { addenda, exceptions, conformes };
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
  issueAddendumConforme(eventId: string, addendumId: string, input: IssueAddendumConformeInput) {
    return eventApi.events.issueAddendumConforme(eventId, addendumId, input);
  },
  countersignAddendumConforme(eventId: string, addendumId: string, input: SignAddendumConformeInput) {
    return eventApi.events.countersignAddendumConforme(eventId, addendumId, input);
  },
};
