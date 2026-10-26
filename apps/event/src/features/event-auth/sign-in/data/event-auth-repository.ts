import { eventApi } from "@/lib/prism-api";
import { saveEventSession, type EventSession } from "@/app/lib/session";
import type {
  ActivateAccountInput,
  PrismAuthenticatedSession,
  PrismAuthResponse,
  PrismTwoFactorSetup,
} from "@prism/types";

export const eventAuthRepository = {
  login(input: { email: string; password: string }): Promise<PrismAuthResponse> {
    return eventApi.auth.login(input);
  },

  setupTwoFactor(token: string): Promise<PrismTwoFactorSetup> {
    return eventApi.auth.setupTwoFactor(token);
  },

  verifyTwoFactor(token: string, code: string): Promise<PrismAuthenticatedSession> {
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

  persistSession(session: EventSession): void {
    saveEventSession(session);
  },
};
