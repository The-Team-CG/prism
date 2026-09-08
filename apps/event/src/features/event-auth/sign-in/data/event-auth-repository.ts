import { prismApi } from "@/lib/prism-api";
import { saveEventSession, type EventSession } from "@/app/lib/session";
import type { PrismAuthenticatedSession, PrismAuthResponse, PrismTwoFactorSetup } from "@prism/types";

export const eventAuthRepository = {
  login(input: { email: string; password: string }): Promise<PrismAuthResponse> {
    return prismApi.login(input);
  },

  setupTwoFactor(token: string): Promise<PrismTwoFactorSetup> {
    return prismApi.setupTwoFactor(token);
  },

  verifyTwoFactor(token: string, code: string): Promise<PrismAuthenticatedSession> {
    return prismApi.verifyTwoFactor(token, code);
  },

  requestPasswordReset(email: string) {
    return prismApi.requestPasswordReset(email);
  },

  consumePasswordReset(input: { token: string; password: string }) {
    return prismApi.consumePasswordReset(input);
  },

  persistSession(session: EventSession): void {
    saveEventSession(session);
  },
};
