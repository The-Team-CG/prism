import { eventApi } from "@/lib/prism-api";
import { readStoredEventSession, saveEventSession, type EventSession } from "@/app/lib/session";
import { PRISM_PRIVACY_NOTICE_VERSION } from "@prism/types";
import type {
  ActivateAccountInput,
  PrismSignInSession,
  PrismAuthResponse,
  PrismTwoFactorSetup,
  PrismTwoFactorQr,
} from "@prism/types";

export const eventAuthRepository = {
  login(input: { email: string; password: string }): Promise<PrismAuthResponse> {
    return eventApi.auth.login(input);
  },

  setupTwoFactor(token: string): Promise<PrismTwoFactorSetup> {
    return eventApi.auth.setupTwoFactor(token);
  },

  developmentTwoFactorQr(token: string): Promise<PrismTwoFactorQr> {
    return eventApi.auth.developmentTwoFactorQr(token);
  },

  verifyTwoFactor(token: string, code: string): Promise<PrismSignInSession> {
    return eventApi.auth.verifyTwoFactor({ token, code });
  },

  requestPasswordReset(email: string) {
    return eventApi.auth.requestPasswordReset(email);
  },

  consumePasswordReset(input: { token: string; password: string }) {
    return eventApi.auth.consumePasswordReset(input.token, input.password);
  },

  activateAccount(input: ActivateAccountInput) {
    return eventApi.auth.activateAccount(input);
  },

  hasSignedInSession(): boolean {
    return readStoredEventSession() !== null;
  },

  acknowledgePrivacyNotice(): Promise<void> {
    return eventApi.auth.acknowledgePrivacyNotice({ version: PRISM_PRIVACY_NOTICE_VERSION });
  },

  persistSession(session: EventSession): void {
    saveEventSession(session);
  },
};
