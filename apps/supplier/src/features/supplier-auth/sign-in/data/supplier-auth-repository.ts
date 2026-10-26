import {
  createEventOpsClient,
  PrismApiError,
} from "@prism/api-client";
import {
  activateAccountSchema,
  consumePasswordResetSchema,
  parseContract,
  PRISM_SESSION_STORAGE_KEYS,
  readPrismSession,
  requestPasswordResetSchema,
  savePrismSession,
  type ActivateAccountInput,
  type ConsumePasswordResetInput,
  type LoginInput,
  type PrismApprovalRequestReceipt,
  type PrismAuthResponse,
  type PrismAuthenticatedSession,
  type RequestApprovalInput,
  type RequestPasswordResetInput,
} from "@prism/types";
import { SUPPLIER_AUTH_API_OFFLINE_MESSAGE } from "../model/supplier-sign-in-rules";
import { ActivationTokenRejectedError } from "../../activate/model/activate-model";

const SESSION_KEY = PRISM_SESSION_STORAGE_KEYS.supplier;
const supplierAuthClient = createEventOpsClient();

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
  readSession(): PrismAuthenticatedSession | null {
    return readPrismSession<PrismAuthenticatedSession>(SESSION_KEY);
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

  async activateAccount(input: ActivateAccountInput): Promise<void> {
    const contract = parseContract(activateAccountSchema, input, "Account activation");
    await runSupplierAuthRequest(
      () => supplierAuthClient.auth.activateAccount(contract).catch(rejectInvalidActivationToken),
      "Unable to set your password.",
    );
  },
};
