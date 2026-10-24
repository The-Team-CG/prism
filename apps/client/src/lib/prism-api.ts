import {
  createEventOpsClient,
  resolvePrismApiOrigin,
  prismRequest,
  type PrismRequestInit,
} from "@prism/api-client";
import {
  PRISM_SESSION_STORAGE_KEYS,
  clearPrismSession,
  isPrismAuthenticatedSession,
} from "@prism/types";
import { portalAppPath, portalHref } from "@prism/ui/portal-path";

/** The API rejected the stored session: sign out locally and return here after sign-in. */
function expireClientSession() {
  if (typeof window === "undefined") return;
  clearPrismSession(PRISM_SESSION_STORAGE_KEYS.client);
  if (window.location.pathname.endsWith("/sign-in")) return;
  const next = `${portalAppPath(window.location.pathname)}${window.location.search}`;
  window.location.assign(portalHref(`/sign-in?next=${encodeURIComponent(next)}`));
}

export function storedClientAccessToken() {
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
  getAuthToken: storedClientAccessToken,
  onUnauthorized: expireClientSession,
});

export function clientApiRequest<T>(path: string, init: PrismRequestInit = {}) {
  return prismRequest<T>(path, {
    ...init,
    baseUrl: init.baseUrl ?? `${resolvePrismApiOrigin()}/api`,
    authToken: init.authToken ?? storedClientAccessToken(),
    onUnauthorized: init.onUnauthorized ?? expireClientSession,
  });
}
