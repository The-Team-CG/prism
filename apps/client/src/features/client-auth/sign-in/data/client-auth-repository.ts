import { PrismApiError } from "@prism/api-client";
import {
  PRISM_PRIVACY_NOTICE_VERSION,
  PRISM_SESSION_STORAGE_KEYS,
  readPrismSession,
  savePrismSession,
  isPrismAuthenticatedSession,
  type ActivateAccountInput,
  type PrismAuthenticatedSession,
  type PrismSignInSession,
  type PrivacyConsentInput,
} from "@prism/types";
import { clientApi } from "@/lib/prism-api";

export type ClientAuthSession = PrismAuthenticatedSession;

export type ClientAccountActivationOutcome = { status: "activated" } | { status: "invalid_token" };

export const clientAuthRepository = {
  login(input: { email: string; password: string }): Promise<PrismSignInSession> {
    return clientApi.auth.login(input).then((response) => {
      if (!isPrismAuthenticatedSession(response)) {
        throw new Error("Client sign-in requires an authenticated session.");
      }
      return response;
    });
  },

  hasSignedInSession(): boolean {
    return isPrismAuthenticatedSession(readPrismSession(PRISM_SESSION_STORAGE_KEYS.client));
  },

  acknowledgePrivacyNotice(): Promise<void> {
    return clientApi.auth.acknowledgePrivacyNotice({ version: PRISM_PRIVACY_NOTICE_VERSION });
  },

  saveClientSession(session: ClientAuthSession): void {
    savePrismSession(PRISM_SESSION_STORAGE_KEYS.client, session);
  },

  requestApproval(email: string, consent: PrivacyConsentInput) {
    return clientApi.auth.requestApproval({
      email,
      privacyConsentAccepted: consent.privacyConsentAccepted,
      privacyNoticeVersion: PRISM_PRIVACY_NOTICE_VERSION,
      marketingConsentAccepted: Boolean(consent.marketingConsentAccepted),
    });
  },

  requestPasswordReset(email: string) {
    return clientApi.auth.requestPasswordReset(email);
  },

  consumePasswordReset(input: { token: string; password: string }) {
    return clientApi.auth.consumePasswordReset(input.token, input.password);
  },

  activateAccount(input: ActivateAccountInput): Promise<ClientAccountActivationOutcome> {
    return clientApi.auth.activateAccount(input).then(
      () => ({ status: "activated" as const }),
      (error: unknown) => {
        // The API answers 400 for an invalid, expired or already-used invitation token.
        if (error instanceof PrismApiError && error.status === 400) return { status: "invalid_token" as const };
        throw error;
      },
    );
  },
};
