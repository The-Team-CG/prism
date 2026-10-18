import {
  decideFreezeExceptionSchema,
  freezeEventSchema,
  requestFreezeExceptionSchema,
  type DecideFreezeExceptionInput,
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
