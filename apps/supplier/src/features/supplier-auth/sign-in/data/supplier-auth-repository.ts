import {
  createEventOpsClient,
  PrismApiError,
} from "@prism/api-client";
import {
  activateAccountSchema,
  consumePasswordResetSchema,
  isPrismAuthenticatedSession,
  parseContract,
  PRISM_PRIVACY_NOTICE_VERSION,
  PRISM_SESSION_STORAGE_KEYS,
  readPrismSession,
  requestPasswordResetSchema,
  savePrismSession,
  type ActivateAccountInput,
  type PrismInvitationPreview,
  type ConsumePasswordResetInput,
  type LoginInput,
  type PrismApprovalRequestReceipt,
  type PrismAuthResponse,
  type PrismAuthenticatedSession,
  type PrismSignInSession,
  type RequestApprovalInput,
  type RequestPasswordResetInput,
} from "@prism/types";
import { storedSupplierAccessToken } from "@/lib/prism-api";
import { SUPPLIER_AUTH_API_OFFLINE_MESSAGE } from "../model/supplier-sign-in-rules";
import { ActivationTokenRejectedError } from "../../activate/model/activate-model";

const SESSION_KEY = PRISM_SESSION_STORAGE_KEYS.supplier;
const supplierAuthClient = createEventOpsClient();
const signedInSupplierClient = createEventOpsClient({ getAuthToken: storedSupplierAccessToken });

function rejectInvalidActivationToken(error: unknown): never {
  if (error instanceof PrismApiError && error.status === 400) throw new ActivationTokenRejectedError();
  throw error;
}

function apiErrorMessage(error: PrismApiError, fallback: string) {
  const body = error.body;
  if (typeof body === "object" && body !== null) {
    const message = (body as { message?: unknown }).message;
    if (Array.isArray(message)) return message.join(", ") || fallback;
    if (typeof message === "string" && message.trim()) return message;
  }
  return fallback;
}

async function runSupplierAuthRequest<T>(operation: () => Promise<T>, fallback: string): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    if (error instanceof TypeError) throw new Error(SUPPLIER_AUTH_API_OFFLINE_MESSAGE);
    if (error instanceof PrismApiError) throw new Error(apiErrorMessage(error, fallback));
    throw error;
  }
}

export const supplierAuthRepository = {
  /** Ends a session the API opened for an account this portal turns away, so it does not stay live on the server. */
  endRejectedSession(accessToken: string): Promise<void> {
    return createEventOpsClient({ getAuthToken: () => accessToken }).auth.logout().catch(() => undefined);
  },
  readSession(): PrismAuthenticatedSession | null {
    return readPrismSession<PrismAuthenticatedSession>(SESSION_KEY);
  },

  /**
   * The session the API's HttpOnly cookie holds for this portal (set by the shared "Sign in to P.R.I.S.M." page),
   * shaped like a sign-in, or null when there is none. The token itself stays in the cookie.
   */
  async cookieSession(): Promise<PrismSignInSession | null> {
    try {
      const me = await signedInSupplierClient.auth.me();
      return {
        id: me.id,
        name: me.name,
        email: me.email,
        role: me.role,
        organization: me.organization,
        approvalStatus: "approved",
        accessToken: "",
        expiresAt: me.expiresAt,
        signedInAt: new Date().toISOString(),
        privacyNoticeRequired: me.privacyNoticeRequired,
      };
    } catch {
      return null;
    }
  },

  hasSignedInSession(): boolean {
    return isPrismAuthenticatedSession(readPrismSession(SESSION_KEY));
  },

  acknowledgePrivacyNotice(): Promise<void> {
    return signedInSupplierClient.auth.acknowledgePrivacyNotice({ version: PRISM_PRIVACY_NOTICE_VERSION });
  },

  saveSession(session: PrismAuthenticatedSession): void {
    savePrismSession(SESSION_KEY, session);
  },

  login(input: LoginInput): Promise<PrismAuthResponse> {
    return runSupplierAuthRequest(
      () => supplierAuthClient.auth.login(input),
      "Supplier sign in failed",
    );
  },

  /** Emails a six-digit sign-in code; the answer is the same whether or not the email has an account. */
  requestEmailCode(email: string): Promise<{ message: string }> {
    return runSupplierAuthRequest(() => supplierAuthClient.auth.requestEmailSignInCode(email), "Could not send a sign-in code");
  },

  /** A session from an emailed code, or the authenticator step when the account has two-step sign-in on. */
  verifyEmailCode(email: string, code: string): Promise<PrismAuthResponse> {
    return runSupplierAuthRequest(() => supplierAuthClient.auth.verifyEmailSignInCode({ email, code }), "Supplier sign in failed");
  },

  /** Finishes a two-step sign-in with the code from the authenticator app. */
  verifyTwoStep(token: string, code: string): Promise<PrismSignInSession> {
    return runSupplierAuthRequest(
      () => supplierAuthClient.auth.verifyTwoFactor({ token, code }),
      "Supplier sign in failed",
    );
  },

  requestApproval(input: RequestApprovalInput): Promise<PrismApprovalRequestReceipt> {
    return runSupplierAuthRequest(
      () => supplierAuthClient.auth.requestApproval(input),
      "Unable to request supplier account approval",
    );
  },

  requestPasswordReset(input: RequestPasswordResetInput): Promise<{ message: string }> {
    const contract = parseContract(requestPasswordResetSchema, input, "Password reset request");
    return runSupplierAuthRequest(
      () => supplierAuthClient.auth.requestPasswordReset(contract.email),
      "Unable to request password reset",
    );
  },

  consumePasswordReset(input: ConsumePasswordResetInput): Promise<{ message: string }> {
    const contract = parseContract(consumePasswordResetSchema, input, "Password reset");
    return runSupplierAuthRequest(
      () => supplierAuthClient.auth.consumePasswordReset(contract.token, contract.password),
      "Unable to consume password reset",
    );
  },

  /** Who an invitation link is for, or null when it has expired or was already used. */
  previewInvitation(token: string): Promise<PrismInvitationPreview | null> {
    return supplierAuthClient.auth.previewInvitation(token).catch((error: unknown) => {
      if (error instanceof PrismApiError && error.status === 400) return null;
      throw error;
    });
  },

  /** Uses the invitation and signs the supplier in, without a password. */
  confirmInvitation(token: string): Promise<PrismAuthResponse> {
    return runSupplierAuthRequest(() => supplierAuthClient.auth.confirmInvitation(token), "Could not open your account");
  },

  async activateAccount(input: ActivateAccountInput): Promise<void> {
    const contract = parseContract(activateAccountSchema, input, "Account activation");
    await runSupplierAuthRequest(
      () => supplierAuthClient.auth.activateAccount(contract).catch(rejectInvalidActivationToken),
      "Unable to set your password.",
    );
  },
};
