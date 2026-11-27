import {
  createEventOpsClient,
  enablePrismSessionCookies,
  resolvePrismApiOrigin,
  prismRequest,
  type PrismRequestInit,
} from "@prism/api-client";
import {
  PRISM_SESSION_STORAGE_KEYS,
  clearPrismSession,
  isPrismAuthenticatedSession,
  privacyNoticePath,
} from "@prism/types";
import { portalAppPath, portalHref } from "@prism/ui/portal-path";

// The session token lives in the API's HttpOnly cookie for this portal; every API call sends it.
enablePrismSessionCookies();

/** The API rejected the stored session: sign out locally and return here after sign-in. */
function expireClientSession() {
  if (typeof window === "undefined") return;
  clearPrismSession(PRISM_SESSION_STORAGE_KEYS.client);
  if (window.location.pathname.endsWith("/sign-in")) return;
  const next = `${portalAppPath(window.location.pathname)}${window.location.search}`;
  window.location.assign(portalHref(`/sign-in?next=${encodeURIComponent(next)}`));
}

/** The API says the signed-in account has not acknowledged the current privacy notice: show it, then return here. */
function showClientPrivacyNotice() {
  if (typeof window === "undefined") return;
  const appPath = portalAppPath(window.location.pathname);
  if (appPath === "/privacy") return;
  window.location.assign(portalHref(privacyNoticePath(`${appPath}${window.location.search}`)));
}

/** Whether this browser has a live client sign-in; the token itself is in the API's HttpOnly cookie. */
export function hasStoredClientSession() {
  if (typeof window === "undefined") return false;
  try {
    return isPrismAuthenticatedSession(JSON.parse(window.localStorage.getItem(PRISM_SESSION_STORAGE_KEYS.client) ?? "null"));
  } catch {
    return false;
  }
}

/** A token from a sign-in stored before cookie sessions; new sign-ins store none and send the cookie instead. */
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
  onPrivacyNoticeRequired: showClientPrivacyNotice,
});

export function clientApiRequest<T>(path: string, init: PrismRequestInit = {}) {
  return prismRequest<T>(path, {
    ...init,
    baseUrl: init.baseUrl ?? `${resolvePrismApiOrigin()}/api`,
    authToken: init.authToken ?? storedClientAccessToken(),
    onUnauthorized: init.onUnauthorized ?? expireClientSession,
    onPrivacyNoticeRequired: init.onPrivacyNoticeRequired ?? showClientPrivacyNotice,
  });
}
