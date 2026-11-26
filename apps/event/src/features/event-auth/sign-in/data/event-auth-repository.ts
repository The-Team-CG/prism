import { createEventOpsClient } from "@prism/api-client";
import { eventApi } from "@/lib/prism-api";
import { readStoredEventSession, saveEventSession, type EventSession } from "@/app/lib/session";
import { PRISM_PRIVACY_NOTICE_VERSION, PRISM_SESSION_STORAGE_KEYS } from "@prism/types";

type TrustedDevices = Record<string, string>;

function readTrustedDevices(): TrustedDevices {
  if (typeof window === "undefined") return {};
  try {
    const parsed: unknown = JSON.parse(window.localStorage.getItem(PRISM_SESSION_STORAGE_KEYS.trustedDevices) ?? "{}");
    return parsed && typeof parsed === "object" ? (parsed as TrustedDevices) : {};
  } catch {
    return {};
  }
}
import type {
  ActivateAccountInput,
  PrismSignInSession,
  PrismAuthResponse,
  PrismTwoFactorSetup,
  PrismTwoFactorQr,
} from "@prism/types";

export const eventAuthRepository = {
  /** Ends a session the API opened for an account this portal turns away, so it does not stay live on the server. */
  endRejectedSession(accessToken: string): Promise<void> {
    return createEventOpsClient({ getAuthToken: () => accessToken }).auth.logout().catch(() => undefined);
  },
  login(input: { email: string; password: string; trustedDeviceToken?: string }): Promise<PrismAuthResponse> {
    return eventApi.auth.login(input);
  },

  /** The token that lets this browser skip the authenticator step for this email, if it was trusted. */
  trustedDeviceToken(email: string): string | undefined {
    return readTrustedDevices()[email.trim().toLowerCase()];
  },

  rememberTrustedDevice(email: string, token: string): void {
    const devices = { ...readTrustedDevices(), [email.trim().toLowerCase()]: token };
    window.localStorage.setItem(PRISM_SESSION_STORAGE_KEYS.trustedDevices, JSON.stringify(devices));
  },

  setupTwoFactor(token: string): Promise<PrismTwoFactorSetup> {
    return eventApi.auth.setupTwoFactor(token);
  },

  developmentTwoFactorQr(token: string): Promise<PrismTwoFactorQr> {
    return eventApi.auth.developmentTwoFactorQr(token);
  },

  verifyTwoFactor(token: string, code: string, trustDevice = false): Promise<PrismSignInSession> {
    return eventApi.auth.verifyTwoFactor({ token, code, trustDevice });
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
