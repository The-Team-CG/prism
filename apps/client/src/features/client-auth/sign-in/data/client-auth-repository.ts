import { PrismApiError, createEventOpsClient } from "@prism/api-client";
import {
  PRISM_PRIVACY_NOTICE_VERSION,
  PRISM_SESSION_STORAGE_KEYS,
  readPrismSession,
  savePrismSession,
  isPrismAuthenticatedSession,
  type ActivateAccountInput,
  type PrismAuthenticatedSession,
  type PrismAuthResponse,
  type PrismInvitationPreview,
  type PrismSignInSession,
  type PrivacyConsentInput,
} from "@prism/types";
import { clientApi } from "@/lib/prism-api";

export type ClientAuthSession = PrismAuthenticatedSession;

export type ClientAccountActivationOutcome = { status: "activated" } | { status: "invalid_token" };

export const clientAuthRepository = {
  /** Ends a session the API opened for an account this portal turns away, so it does not stay live on the server. */
  endRejectedSession(accessToken: string): Promise<void> {
    return createEventOpsClient({ getAuthToken: () => accessToken }).auth.logout().catch(() => undefined);
  },
  /** A session, or a two-step challenge when the account has two-step sign-in on. */
  login(input: { email: string; password: string }): Promise<PrismAuthResponse> {
    return clientApi.auth.login(input);
  },

  /** Emails a six-digit sign-in code; the answer is the same whether or not the email has an account. */
  requestEmailCode(email: string): Promise<{ message: string }> {
    return clientApi.auth.requestEmailSignInCode(email);
  },

  /** A session from an emailed code, or the authenticator step when the account has two-step sign-in on. */
  verifyEmailCode(email: string, code: string): Promise<PrismAuthResponse> {
    return clientApi.auth.verifyEmailSignInCode({ email, code });
  },

  /** Finishes a two-step sign-in with the code from the authenticator app. */
  verifyTwoStep(token: string, code: string): Promise<PrismSignInSession> {
    return clientApi.auth.verifyTwoFactor({ token, code });
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

  /** Who an invitation link is for, or null when it has expired or was already used. */
  previewInvitation(token: string): Promise<PrismInvitationPreview | null> {
    return clientApi.auth.previewInvitation(token).catch((error: unknown) => {
      if (error instanceof PrismApiError && error.status === 400) return null;
      throw error;
    });
  },

  /** Uses the invitation and signs the client in, without a password. */
  confirmInvitation(token: string): Promise<PrismAuthResponse> {
    return clientApi.auth.confirmInvitation(token);
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
