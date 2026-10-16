import {
  createEventOpsClient,
  resolvePrismApiOrigin,
  prismRequest,
  type PrismRequestInit,
} from "@prism/api-client";
import { PRISM_SESSION_STORAGE_KEYS, isPrismAuthenticatedSession } from "@prism/types";

const API_OFFLINE_MESSAGE = "P.R.I.S.M API is offline. Start `prism-api` on port 4000, then try again.";

export function storedEventAccessToken() {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(PRISM_SESSION_STORAGE_KEYS.event);
  if (!raw) return null;
  try {
    const session = JSON.parse(raw) as unknown;
    return isPrismAuthenticatedSession(session) ? session.accessToken : null;
  } catch {
    return null;
  }
}

/** Role-scoped API client construction. Feature operations live in feature data adapters. */
export const eventApi = createEventOpsClient({
  getAuthToken: storedEventAccessToken,
});

export function apiUrl(path: string) {
  if (!path) return "#";
  return path.startsWith("http") ? path : `${resolvePrismApiOrigin()}${path}`;
}

/** Shared transport construction only; route ownership stays in feature data adapters. */
export function eventApiRequest<T>(path: string, init: PrismRequestInit = {}) {
  return prismRequest<T>(path, {
    ...init,
    baseUrl: init.baseUrl ?? resolvePrismApiOrigin(),
    authToken: init.authToken ?? storedEventAccessToken(),
  }).catch((error: unknown) => {
    if (error instanceof TypeError) throw new Error(API_OFFLINE_MESSAGE);
    throw error;
  });
}
