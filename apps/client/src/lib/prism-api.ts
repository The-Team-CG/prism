import {
  createEventOpsClient,
  prismRequest,
  type PrismRequestInit,
} from "@prism/api-client";
import {
  PRISM_SESSION_STORAGE_KEYS,
  isPrismAuthenticatedSession,
} from "@prism/types";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

function storedClientAccessToken() {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(PRISM_SESSION_STORAGE_KEYS.client);
  if (!raw) return null;
  try {
    const session = JSON.parse(raw) as unknown;
    return isPrismAuthenticatedSession(session) ? session.accessToken : null;
  } catch {
    return null;
  }
}

/** Role-scoped API client construction. Feature operations stay in feature data adapters. */
export const clientApi = createEventOpsClient({
  baseUrl: `${API_URL}/api`,
  getAuthToken: storedClientAccessToken,
});

export function clientApiRequest<T>(path: string, init: PrismRequestInit = {}) {
  return prismRequest<T>(path, {
    ...init,
    baseUrl: init.baseUrl ?? `${API_URL}/api`,
    authToken: init.authToken ?? storedClientAccessToken(),
  });
}
