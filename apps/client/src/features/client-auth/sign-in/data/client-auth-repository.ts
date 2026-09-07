import {
  PRISM_SESSION_STORAGE_KEYS,
  savePrismSession,
  type PrivacyConsentInput,
} from "@prism/types";
import { prismApi } from "@/lib/prism-api";

export type ClientAuthSession = Awaited<ReturnType<typeof prismApi.login>>;

export const clientAuthRepository = {
  login(input: { email: string; password: string }): Promise<ClientAuthSession> {
    return prismApi.login(input);
  },

  saveClientSession(session: ClientAuthSession): void {
    savePrismSession(PRISM_SESSION_STORAGE_KEYS.client, session);
  },

  requestApproval(email: string, consent: PrivacyConsentInput) {
    return prismApi.requestApproval(email, consent);
  },

  requestPasswordReset(email: string) {
    return prismApi.requestPasswordReset(email);
  },

  consumePasswordReset(input: { token: string; password: string }) {
    return prismApi.consumePasswordReset(input);
  },
};
