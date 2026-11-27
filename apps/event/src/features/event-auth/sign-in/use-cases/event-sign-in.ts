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
  const email = input.email.trim();
  const response = await eventAuthRepository.login({
    email,
    password: input.password,
    trustedDeviceToken: eventAuthRepository.trustedDeviceToken(email),
  });
  if ("kind" in response) {
    return {
      kind: "two_factor",
      token: response.token,
      setupRequired: response.kind === "two_factor_setup_required",
    };
  }
  const session: EventSession = response;
  const nextPath = resolveEventPostSignInPath(input.nextPath, session.role);
  if (!isEventPortalRole(session.role)) {
    void eventAuthRepository.endRejectedSession(session.accessToken);
    return { error: eventRoleRejectionMessage(session.role) };
  }
  eventAuthRepository.persistSession(session);
  return { kind: "redirect", redirectTo: response.privacyNoticeRequired ? privacyNoticePath(nextPath) : nextPath, session };
}

/** PMCM staff already signed in by the API's cookie (from the shared sign-in page) continue without signing in again. */
export async function resumeEventCookieSession(nextPath: string | null | undefined): Promise<{ redirectTo: string } | null> {
  if (eventAuthRepository.hasSignedInSession()) return null;
  const session = await eventAuthRepository.cookieSession();
  if (!session || !isEventPortalRole(session.role)) return null;
  eventAuthRepository.persistSession(session);
  const next = resolveEventPostSignInPath(nextPath, session.role);
  return { redirectTo: session.privacyNoticeRequired ? privacyNoticePath(next) : next };
}

export async function beginEventTwoFactorSetup(token: string) {
  return eventAuthRepository.setupTwoFactor(token);
}

export async function getDevelopmentEventTwoFactorQr(token: string) {
  return eventAuthRepository.developmentTwoFactorQr(token);
}

export async function verifyEventTwoFactor(input: { token: string; code: string; nextPath?: string | null; email?: string; trustDevice?: boolean }) {
  const session = await eventAuthRepository.verifyTwoFactor(input.token, input.code.trim(), input.trustDevice);
  if (!isEventPortalRole(session.role)) {
    void eventAuthRepository.endRejectedSession(session.accessToken);
    return { error: eventRoleRejectionMessage(session.role) } as const;
  }
  eventAuthRepository.persistSession(session);
  if (session.trustedDeviceToken && input.email) eventAuthRepository.rememberTrustedDevice(input.email, session.trustedDeviceToken);
  const nextPath = resolveEventPostSignInPath(input.nextPath);
  return {
    kind: "redirect",
    redirectTo: session.privacyNoticeRequired ? privacyNoticePath(nextPath) : nextPath,
    /** Shown once after a new authenticator, before going on. */
    backupCodes: session.backupCodes ?? null,
  } as const;
}
