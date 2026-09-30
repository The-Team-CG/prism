import {
  PRISM_SESSION_STORAGE_KEYS,
  savePrismSession,
  isPrismAuthenticatedSession,
  type PrismAuthenticatedSession,
  type PrismUser,
  type PrivacyConsentInput,
} from "@prism/types";
import { clientApi, isClientLocalDemoMode } from "@/lib/prism-api";
import { prismApi as samplePrismApi } from "@/compatibility/sample/prism-api";

export type ClientAuthSession =
  | PrismAuthenticatedSession
  | (PrismUser & { signedInAt: string });

export const clientAuthRepository = {
  login(input: { email: string; password: string }): Promise<ClientAuthSession> {
    if (isClientLocalDemoMode) return samplePrismApi.login(input);
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
    if (isClientLocalDemoMode) return samplePrismApi.requestApproval(email, consent);
    return clientApi.auth.requestApproval({ email, ...consent });
  },

  requestPasswordReset(email: string) {
    if (isClientLocalDemoMode) return samplePrismApi.requestPasswordReset(email);
    return clientApi.auth.requestPasswordReset(email);
  },

  consumePasswordReset(input: { token: string; password: string }) {
    if (isClientLocalDemoMode) return samplePrismApi.consumePasswordReset(input);
    return clientApi.auth.consumePasswordReset(input.token, input.password);
  },
};
