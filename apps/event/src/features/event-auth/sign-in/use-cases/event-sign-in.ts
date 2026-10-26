import { eventAuthRepository } from "../data/event-auth-repository";
import type { EventSession } from "@/app/lib/session";
import { privacyNoticePath } from "@prism/types";
import {
  eventRoleRejectionMessage,
  isEventPortalRole,
  resolveEventPostSignInPath,
} from "../model/event-sign-in-rules";

export type EventSignInResult =
  | { kind: "redirect"; redirectTo: string; session: EventSession }
  | { kind: "two_factor"; token: string; setupRequired: boolean };

export async function signInToEventPortal(input: {
  email: string;
  password: string;
  nextPath?: string | null;
}): Promise<EventSignInResult | { error: string }> {
  const response = await eventAuthRepository.login({
    email: input.email.trim(),
    password: input.password,
  });
  if ("kind" in response) {
    return {
      kind: "two_factor",
      token: response.token,
      setupRequired: response.kind === "two_factor_setup_required",
    };
  }
  const session: EventSession = response;
  const nextPath = resolveEventPostSignInPath(input.nextPath);
  if (!isEventPortalRole(session.role)) {
    return { error: eventRoleRejectionMessage(session.role) };
  }
  eventAuthRepository.persistSession(session);
  return { kind: "redirect", redirectTo: response.privacyNoticeRequired ? privacyNoticePath(nextPath) : nextPath, session };
}

export async function beginEventTwoFactorSetup(token: string) {
  return eventAuthRepository.setupTwoFactor(token);
}

export async function verifyEventTwoFactor(input: { token: string; code: string; nextPath?: string | null }) {
  const session = await eventAuthRepository.verifyTwoFactor(input.token, input.code);
  if (!isEventPortalRole(session.role)) return { error: eventRoleRejectionMessage(session.role) } as const;
  eventAuthRepository.persistSession(session);
  const nextPath = resolveEventPostSignInPath(input.nextPath);
  return { kind: "redirect", redirectTo: session.privacyNoticeRequired ? privacyNoticePath(nextPath) : nextPath } as const;
}
