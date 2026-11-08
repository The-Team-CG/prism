import {
  decideFreezeExceptionSchema,
  signAddendumConformeExecutionSchema,
  withdrawAddendumSchema,
  recordEventDecisionSchema,
  freezeEventSchema,
  requestFreezeExceptionSchema,
  type DecideFreezeExceptionInput,
  type FreezeEventInput,
  type PrismAddendum,
  type RequestFreezeExceptionInput,
  type WithdrawAddendumInput,
} from "@prism/types";
import { changeRegisterRepository } from "../data/change-register-repository";
import { wholePesos, type RecordDecisionDraft } from "../model/change-register-rules";

function parseOrThrow<T>(result: { success: true; data: T } | { success: false; error: { issues: { message: string }[] } }): T {
  if (!result.success) throw new Error(result.error.issues[0]?.message ?? "Check the highlighted fields and try again.");
  return result.data;
}

export function requestAddendumConformeUseCase(eventId: string, addendumId: string) {
  return changeRegisterRepository.requestAddendumConforme(eventId, addendumId);
}

/** PMCM countersigns the exact version shown in the register; the server refuses it until the client has acknowledged. */
export function countersignAddendumConformeUseCase(eventId: string, addendum: PrismAddendum) {
  const execution = addendum.conforme;
  if (!execution) throw new Error("Request the addendum conforme before countersigning it.");
  const input = parseOrThrow(signAddendumConformeExecutionSchema.safeParse({
    executionId: execution.id,
    versionNumber: addendum.versionNumber,
    documentSha256: execution.documentSha256,
    consentAccepted: true,
  }));
  return changeRegisterRepository.countersignAddendumConforme(eventId, addendum.id, input);
}

/** PMCM closes a pending addendum with a reason. The server refuses it once the addendum is effective. */
export function withdrawAddendumUseCase(eventId: string, addendumId: string, draft: WithdrawAddendumInput) {
  return changeRegisterRepository.withdrawAddendum(eventId, addendumId, parseOrThrow(withdrawAddendumSchema.safeParse(draft)));
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

/**
 * Records a cancellation or postponement. On a frozen event the decision must name an unused approval; the
 * server enforces the same rule, so this check only avoids a round trip with a clear message.
 */
export function recordEventDecisionUseCase(eventId: string, draft: RecordDecisionDraft, options: { frozen: boolean }) {
  if (options.frozen && !draft.freezeExceptionId) {
    throw new Error("Choose an approved freeze exception before recording this decision on a frozen event.");
  }
  const { cancellationFeePesos, ...decision } = draft;
  const cancellationFeeAmount = wholePesos(cancellationFeePesos);
  if (!Number.isFinite(cancellationFeeAmount)) {
    throw new Error("Enter the cancellation fee in whole pesos, for example 12,500, or leave it blank for no fee.");
  }
  return changeRegisterRepository.recordDecision(eventId, parseOrThrow(recordEventDecisionSchema.safeParse({ ...decision, cancellationFeeAmount })));
}
