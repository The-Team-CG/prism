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
  WithdrawAddendumInput,
  IssueAddendumInput,
  PrismDocument,
  PrismSupplierQuote,
} from "@prism/types";

export const changeRegisterRepository = {
  async load(eventId: string): Promise<{ addenda: PrismAddendum[]; exceptions: PrismEventFreezeException[]; documents: PrismDocument[]; bookedQuotes: PrismSupplierQuote[] }> {
    const [addenda, exceptions, workspace] = await Promise.all([
      eventApi.events.addenda(eventId),
      eventApi.events.freezeExceptions(eventId),
      eventApi.pmcm.eventWorkspace(eventId),
    ]);
    return { addenda, exceptions, documents: workspace.documents, bookedQuotes: workspace.supplierQuotes.filter((quote) => quote.status === "selected") };
  },
  issueAddendum(eventId: string, input: IssueAddendumInput): Promise<PrismAddendum> {
    return eventApi.events.issueAddendum(eventId, input);
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
  cancellationSummary(eventId: string) {
    return eventApi.lifecycle.cancellationSummary(eventId);
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
  withdrawAddendum(eventId: string, addendumId: string, input: WithdrawAddendumInput): Promise<PrismAddendum> {
    return eventApi.events.withdrawAddendum(eventId, addendumId, input);
  },
};
