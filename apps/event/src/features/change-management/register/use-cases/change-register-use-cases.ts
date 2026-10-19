import {
  decideFreezeExceptionSchema,
  recordEventDecisionSchema,
  freezeEventSchema,
  issueAddendumConformeSchema,
  requestFreezeExceptionSchema,
  signAddendumConformeSchema,
  type PrismAddendumConformeExecution,
  type DecideFreezeExceptionInput,
  type RecordEventDecisionInput,
  type FreezeEventInput,
  type RequestFreezeExceptionInput,
} from "@prism/types";
import { changeRegisterRepository } from "../data/change-register-repository";

function parseOrThrow<T>(result: { success: true; data: T } | { success: false; error: { issues: { message: string }[] } }): T {
  if (!result.success) throw new Error(result.error.issues[0]?.message ?? "Check the highlighted fields and try again.");
  return result.data;
}

export function freezeScopeUseCase(eventId: string, draft: FreezeEventInput) {
  return changeRegisterRepository.freeze(eventId, parseOrThrow(freezeEventSchema.safeParse(draft)));
}

export function requestFreezeExceptionUseCase(eventId: string, draft: RequestFreezeExceptionInput) {
  return changeRegisterRepository.requestException(eventId, parseOrThrow(requestFreezeExceptionSchema.safeParse(draft)));
}

export function decideFreezeExceptionUseCase(eventId: string, exceptionId: string, draft: DecideFreezeExceptionInput) {
  return changeRegisterRepository.decideException(eventId, exceptionId, parseOrThrow(decideFreezeExceptionSchema.safeParse(draft)));
}

export function issueAddendumConformeUseCase(eventId: string, addendumId: string, draft: { documentVersion: number; documentContent: string }) {
  return changeRegisterRepository.issueAddendumConforme(eventId, addendumId, parseOrThrow(issueAddendumConformeSchema.safeParse(draft)));
}

/** PMCM countersigns exactly the version and hash on screen; the server rejects a stale or tampered version. */
export function countersignAddendumConformeUseCase(eventId: string, conforme: Pick<PrismAddendumConformeExecution, "id" | "addendumId" | "documentVersion" | "documentSha256">) {
  const input = parseOrThrow(signAddendumConformeSchema.safeParse({
    executionId: conforme.id,
    documentVersion: conforme.documentVersion,
    documentSha256: conforme.documentSha256,
    consentAccepted: true,
  }));
  return changeRegisterRepository.countersignAddendumConforme(eventId, conforme.addendumId, input);
}

/**
 * Records a cancellation or postponement. On a frozen event the decision must name an unused approval; the
 * server enforces the same rule, so this check only avoids a round trip with a clear message.
 */
export function recordEventDecisionUseCase(eventId: string, draft: RecordEventDecisionInput, options: { frozen: boolean }) {
  if (options.frozen && !draft.freezeExceptionId) {
    throw new Error("Choose an approved freeze exception before recording this decision on a frozen event.");
  }
  return changeRegisterRepository.recordDecision(eventId, parseOrThrow(recordEventDecisionSchema.safeParse(draft)));
}
