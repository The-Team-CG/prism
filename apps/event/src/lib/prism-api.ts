import {
  createEventOpsClient,
  resolvePrismApiOrigin,
  prismRequest,
  type PrismRequestInit,
} from "@prism/api-client";
import { PRISM_SESSION_STORAGE_KEYS, clearPrismSession, isPrismAuthenticatedSession, privacyNoticePath } from "@prism/types";
import { portalAppPath, portalHref } from "@prism/ui/portal-path";

const API_OFFLINE_MESSAGE = "Can't reach P.R.I.S.M right now. Try again in a moment.";

/** The API rejected the stored session: sign out locally and return here after sign-in. */
function expireEventSession() {
  if (typeof window === "undefined") return;
  clearPrismSession(PRISM_SESSION_STORAGE_KEYS.event);
  if (window.location.pathname.endsWith("/sign-in")) return;
  const next = `${portalAppPath(window.location.pathname)}${window.location.search}`;
  window.location.assign(portalHref(`/sign-in?next=${encodeURIComponent(next)}`));
}

/** The API says the signed-in account has not acknowledged the current privacy notice: show it, then return here. */
function showEventPrivacyNotice() {
  if (typeof window === "undefined") return;
  const appPath = portalAppPath(window.location.pathname);
  if (appPath === "/privacy") return;
  window.location.assign(portalHref(privacyNoticePath(`${appPath}${window.location.search}`)));
}

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
  onUnauthorized: expireEventSession,
  onPrivacyNoticeRequired: showEventPrivacyNotice,
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
    onUnauthorized: init.onUnauthorized ?? expireEventSession,
    onPrivacyNoticeRequired: init.onPrivacyNoticeRequired ?? showEventPrivacyNotice,
  }).catch((error: unknown) => {
    if (error instanceof TypeError) throw new Error(API_OFFLINE_MESSAGE);
    throw error;
  });
}
