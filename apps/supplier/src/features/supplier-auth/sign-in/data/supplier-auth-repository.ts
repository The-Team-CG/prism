import {
  PRISM_SESSION_STORAGE_KEYS,
  readPrismSession,
  savePrismSession,
} from "@prism/types";
import { SUPPLIER_AUTH_API_OFFLINE_MESSAGE } from "../model/supplier-sign-in-rules";
import type { SupplierAuthUser, SupplierSession } from "../model/supplier-sign-in-types";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";
const SESSION_KEY = PRISM_SESSION_STORAGE_KEYS.supplier;

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${API_URL}${path}`, {
      headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
      ...init,
    });
  } catch (error) {
    if (error instanceof TypeError) throw new Error(SUPPLIER_AUTH_API_OFFLINE_MESSAGE);
    throw error;
  }
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = Array.isArray(body.message) ? body.message.join(", ") : body.message;
    throw new Error(message || "Supplier sign in failed");
  }
  return body.data as T;
}

export const supplierAuthRepository = {
  readSession(): SupplierSession | null {
    return readPrismSession<SupplierSession>(SESSION_KEY);
  },

  saveSession(session: SupplierSession): void {
    savePrismSession(SESSION_KEY, session);
  },

  login(email: string, password: string): Promise<SupplierAuthUser> {
    return request<SupplierAuthUser>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
  },

  requestApproval(payload: {
    email: string;
    privacyConsentAccepted: boolean;
    privacyNoticeVersion: string;
    marketingConsentAccepted: boolean;
  }): Promise<unknown> {
    return request("/api/auth/approval-requests", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },
};
