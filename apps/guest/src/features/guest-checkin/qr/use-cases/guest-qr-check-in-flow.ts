import { guestQrPassCheckInSchema, parseContract, PRISM_PRIVACY_NOTICE_VERSION } from "@prism/types";
import type {
  GuestQrCheckInInput,
  GuestQrCheckInRepository,
  GuestQrCheckInState,
} from "../model/guest-qr-check-in-types";

export const GUEST_QR_INVALID_PASS_MESSAGE =
  "This QR pass can't be used. Enter your event code or ask the registration desk for help.";

export const GUEST_QR_RETRY_MESSAGE =
  "We couldn't confirm your check-in. Check your connection and try again.";

const GUEST_QR_HTTPS_MESSAGE =
  "QR check-in needs a secure HTTPS connection. Open the secure link or check in at the registration desk.";

const GUEST_QR_CONSENT_MESSAGE = "Privacy consent is required to check in.";

export type GuestQrLocation = {
  protocol: string;
  pathname: string;
  search: string;
  hash: string;
};

export type GuestQrHistory = {
  state: unknown;
  replaceState(state: unknown, title: string, url?: string | URL | null): void;
};

function httpStatus(error: unknown): number | null {
  if (typeof error !== "object" || error === null || !("status" in error)) return null;
  const status = error.status;
  return typeof status === "number" ? status : null;
}

function isRetryable(error: unknown): boolean {
  const status = httpStatus(error);
  return status === null || status === 408 || status === 425 || status === 429 || status >= 500;
}

export function createGuestQrCheckInFlow(
  repository: GuestQrCheckInRepository,
  onStateChange: (state: GuestQrCheckInState) => void,
  createIdempotencyKey: () => string = () => globalThis.crypto.randomUUID(),
) {
  let state: GuestQrCheckInState = {
    status: "loading",
    event: null,
    secure: false,
    hasPass: false,
    message: null,
  };
  let passToken: string | null = null;
  let accessCode: string | null = null;
  let idempotencyKey: string | null = null;
  let initialized = false;
  let disposed = false;
  let inFlight: Promise<void> | null = null;

  function update(next: Partial<GuestQrCheckInState>): void {
    if (disposed) return;
    state = { ...state, ...next, hasPass: Boolean(passToken) };
    onStateChange(state);
  }

  function getState(): GuestQrCheckInState {
    return state;
  }

  async function initialize(location: GuestQrLocation, history: GuestQrHistory): Promise<void> {
    if (initialized || disposed) return;
    initialized = true;
    passToken = location.hash.startsWith("#") ? location.hash.slice(1) : location.hash;
    const secure = location.protocol === "https:";

    try {
      history.replaceState(history.state, "", `${location.pathname}${location.search}`);
    } catch {
      passToken = null;
      update({ status: "invalid", secure, message: GUEST_QR_INVALID_PASS_MESSAGE });
      return;
    }

    accessCode = new URLSearchParams(location.search).get("accessCode")?.trim() || null;
    update({ status: "loading", secure, event: null, message: null });
    if (!accessCode) {
      passToken = null;
      update({ status: "invalid", message: GUEST_QR_INVALID_PASS_MESSAGE });
      return;
    }

    try {
      const event = await repository.fetchEventByAccessCode(accessCode);
      if (disposed) return;
      if (!passToken) {
        update({ status: "invalid", event, message: GUEST_QR_INVALID_PASS_MESSAGE });
      } else {
        update({ status: secure ? "ready" : "insecure", event, message: secure ? null : GUEST_QR_HTTPS_MESSAGE });
      }
    } catch {
      if (disposed) return;
      passToken = null;
      update({ status: "error", message: "We couldn't load this event. Enter your event code or ask the registration desk for help." });
    }
  }

  async function performSubmit(consentAccepted: boolean): Promise<void> {
    if (disposed || !passToken || !accessCode) return;
    if (!state.secure) {
      update({ status: "insecure", message: GUEST_QR_HTTPS_MESSAGE });
      return;
    }
    if (!consentAccepted) {
      update({ message: GUEST_QR_CONSENT_MESSAGE });
      return;
    }

    idempotencyKey ??= createIdempotencyKey();
    let input: GuestQrCheckInInput;
    try {
      input = parseContract(guestQrPassCheckInSchema, {
        checkInMode: "qr_pass",
        passToken,
        privacyConsentAccepted: true,
        privacyNoticeVersion: PRISM_PRIVACY_NOTICE_VERSION,
        marketingConsentAccepted: false,
        idempotencyKey,
      }, "Guest QR check-in");
    } catch {
      passToken = null;
      idempotencyKey = null;
      update({ status: "invalid", message: GUEST_QR_INVALID_PASS_MESSAGE });
      return;
    }
    update({ status: "submitting", message: null });

    try {
      await repository.checkInQr(accessCode, input);
      if (disposed) return;
      passToken = null;
      idempotencyKey = null;
      update({ status: "success", message: null });
    } catch (error) {
      if (disposed) return;
      if (isRetryable(error)) {
        update({ status: "retryable", message: GUEST_QR_RETRY_MESSAGE });
      } else {
        passToken = null;
        idempotencyKey = null;
        update({ status: "invalid", message: GUEST_QR_INVALID_PASS_MESSAGE });
      }
    }
  }

  function submit(consentAccepted: boolean): Promise<void> {
    if (inFlight) return inFlight;
    const request = performSubmit(consentAccepted).finally(() => {
      if (inFlight === request) inFlight = null;
    });
    inFlight = request;
    return request;
  }

  function dispose(): void {
    disposed = true;
    passToken = null;
    idempotencyKey = null;
    state = { ...state, status: "invalid", hasPass: false, message: null };
  }

  return { initialize, submit, dispose, getState };
}
