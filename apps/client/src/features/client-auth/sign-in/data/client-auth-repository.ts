import {
  PRISM_SESSION_STORAGE_KEYS,
  savePrismSession,
  isPrismAuthenticatedSession,
  type PrismAuthenticatedSession,
  type PrivacyConsentInput,
} from "@prism/types";
import { clientApi } from "@/lib/prism-api";

export type ClientAuthSession = PrismAuthenticatedSession;

export const clientAuthRepository = {
  login(input: { email: string; password: string }): Promise<ClientAuthSession> {
    return clientApi.auth.login(input).then((response) => {
      if (!isPrismAuthenticatedSession(response)) {
        throw new Error("Client sign-in requires an authenticated session.");
      }
      return response;
    });
  },

  saveClientSession(session: ClientAuthSession): void {
    savePrismSession(PRISM_SESSION_STORAGE_KEYS.client, session);
  },

  requestApproval(email: string, consent: PrivacyConsentInput) {
    return clientApi.auth.requestApproval({ email, ...consent });
  },

  requestPasswordReset(email: string) {
    return clientApi.auth.requestPasswordReset(email);
  },

  consumePasswordReset(input: { token: string; password: string }) {
    return clientApi.auth.consumePasswordReset(input.token, input.password);
  },
};
