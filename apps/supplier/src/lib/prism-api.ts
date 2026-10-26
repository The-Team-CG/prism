export type {
  PrismSupplier,
  PrismSupplierApplication,
  PrismSupplierApplicationStatusResult,
  PrismSupplierCertification,
  PrismSupplierQuote,
  PrismSupplierQuoteRequest,
  PrismSupplierReadinessBoard,
  PrismSupplierWorkspace,
  SubmitSupplierQuoteInput as SubmitQuoteInput,
} from "@prism/types";

import { createEventOpsClient, prismRequest, resolvePrismApiOrigin } from "@prism/api-client";
import { PRISM_SESSION_STORAGE_KEYS, clearPrismSession, isPrismAuthenticatedSession, privacyNoticePath } from "@prism/types";
import { portalAppPath, portalHref } from "@prism/ui/portal-path";
import type {
  PrismAuthenticatedSession,
  PrismSupplierApplication,
  PrismSupplierApplicationStatusResult,
  PrismSupplierQuote,
  PrismSupplierReadinessBoard,
  PrismSupplierWorkspace,
  CreateSupplierApplicationInput,
  SupplierApplicationStatusQuery,
  SubmitSupplierQuoteInput,
} from "@prism/types";

export type { CreateSupplierApplicationInput, SupplierApplicationStatusQuery } from "@prism/types";

export type SupplierWorkspace = PrismSupplierWorkspace;

const API_OFFLINE_MESSAGE = "Can't reach P.R.I.S.M right now. Try again in a moment.";

/**
 * Mirrors storedClientAccessToken in apps/client. Reads the persisted supplier
 * session and returns its bearer token so eventOpsClient can authenticate every
 * supplier call, rather than the server trusting a forgeable ?actorRole= param.
 */
export function storedSupplierAccessToken() {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(PRISM_SESSION_STORAGE_KEYS.supplier);
  if (!raw) return null;
  try {
    const session = JSON.parse(raw) as unknown;
    return isPrismAuthenticatedSession(session) ? session.accessToken : null;
  } catch {
    return null;
  }
}

/** The API rejected the stored session: sign out locally and return here after sign-in. */
function expireSupplierSession() {
  if (typeof window === "undefined") return;
  clearPrismSession(PRISM_SESSION_STORAGE_KEYS.supplier);
  if (window.location.pathname.endsWith("/sign-in")) return;
  const next = `${portalAppPath(window.location.pathname)}${window.location.search}`;
  window.location.assign(portalHref(`/sign-in?next=${encodeURIComponent(next)}`));
}

/** The API says the signed-in account has not acknowledged the current privacy notice: show it, then return here. */
function showSupplierPrivacyNotice() {
  if (typeof window === "undefined") return;
  const appPath = portalAppPath(window.location.pathname);
  if (appPath === "/privacy") return;
  window.location.assign(portalHref(privacyNoticePath(`${appPath}${window.location.search}`)));
}

const eventOpsClient = createEventOpsClient({
  getAuthToken: storedSupplierAccessToken,
  onUnauthorized: expireSupplierSession,
  onPrivacyNoticeRequired: showSupplierPrivacyNotice,
});

function actorFromSession(session: PrismAuthenticatedSession) {
  return { actorRole: "supplier" as const, actorName: session.name, actorEmail: session.email };
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${resolvePrismApiOrigin()}${path}`, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        ...(init.headers ?? {}),
      },
    });
  } catch (error) {
    if (error instanceof TypeError) throw new Error(API_OFFLINE_MESSAGE);
    throw error;
  }

  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = Array.isArray(body.message) ? body.message.join(", ") : body.message;
    throw new Error(message || `Request failed: ${response.status}`);
  }
  return body.data as T;
}

export const prismApi = {
  /**
   * Revokes the stored session on the server. A 401 here must not run expireSupplierSession:
   * the caller is already signing out and navigates itself.
   */
  logout: (): Promise<void> =>
    prismRequest<void>("/auth/logout", {
      method: "POST",
      authToken: storedSupplierAccessToken(),
      onUnauthorized: () => undefined,
    }),
  // Identity now comes from the bearer token that getAuthToken attaches, so these
  // reads no longer pass an actor at all - the server derives it from the verified
  // session (PA-284). The `session` parameter is retained so callers still have to
  // hold a session to reach these, and so the signature stays stable.
  supplierWorkspace: (_session: PrismAuthenticatedSession) => eventOpsClient.supplierWorkspace.detail(),
  supplierReadinessBoard: (_session: PrismAuthenticatedSession): Promise<PrismSupplierReadinessBoard> =>
    eventOpsClient.supplierWorkspace.readinessBoard(),
  submitQuote: (token: string, input: SubmitSupplierQuoteInput) =>
    request<PrismSupplierQuote>(`/api/quote-requests/${token}/quote`, {
      method: "POST",
      body: JSON.stringify(input),
    }),
  reviseQuote: (token: string, input: SubmitSupplierQuoteInput) =>
    request<PrismSupplierQuote>(`/api/quote-requests/${token}/quote`, {
      method: "PATCH",
      body: JSON.stringify(input),
    }),
  confirmAssignment: (session: PrismAuthenticatedSession, requestId: string) =>
    eventOpsClient.supplierWorkspace.confirmAssignment(requestId, actorFromSession(session)),
  confirmReadiness: (session: PrismAuthenticatedSession, requestId: string, notes: string) =>
    eventOpsClient.supplierWorkspace.confirmReadiness(requestId, { notes }, actorFromSession(session)),
  updateEventStatus: (session: PrismAuthenticatedSession, requestId: string, status: string, notes: string) =>
    eventOpsClient.supplierWorkspace.updateEventStatus(
      requestId,
      { status: status as "arrived" | "set_up_ready" | "done_leaving", notes },
      actorFromSession(session),
    ),
  createSupplierApplication: (input: CreateSupplierApplicationInput): Promise<PrismSupplierApplication> =>
    request("/api/supplier-applications", {
      method: "POST",
      body: JSON.stringify(input),
    }),
  getSupplierApplicationStatus: (
    input: SupplierApplicationStatusQuery,
    signal?: AbortSignal,
  ): Promise<PrismSupplierApplicationStatusResult> =>
    eventOpsClient.supplierApplications.getStatus(input, { signal }),
  fileRequirements: (eventId: string, session: PrismAuthenticatedSession) =>
    eventOpsClient.events.fileRequirements(eventId, actorFromSession(session)),
  listSupplierCategories: (): Promise<{ id: string; name: string }[]> =>
    request("/api/supplier-applications/categories"),
  communicationThreads: (eventId: string, session: PrismAuthenticatedSession) =>
    eventOpsClient.communication.listThreads(eventId, actorFromSession(session)),
  sendCommunicationMessage: (threadId: string, body: string, idempotencyKey: string, session: PrismAuthenticatedSession) =>
    eventOpsClient.communication.sendMessage(threadId, { body, idempotencyKey }, actorFromSession(session)),
  communicationMessages: (threadId: string, cursor: string | undefined, limit: number | undefined, session: PrismAuthenticatedSession) =>
    eventOpsClient.communication.listMessages(threadId, { cursor, limit }, actorFromSession(session)),
  markCommunicationThreadRead: (threadId: string, session: PrismAuthenticatedSession) =>
    eventOpsClient.communication.markThreadRead(threadId, actorFromSession(session)),
};
