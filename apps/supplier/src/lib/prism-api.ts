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

import { createEventOpsClient, prismRequest } from "@prism/api-client";
import { PRISM_SESSION_STORAGE_KEYS, clearPrismSession, isPrismAuthenticatedSession, privacyNoticePath } from "@prism/types";
import { portalAppPath, portalHref } from "@prism/ui/portal-path";
import type {
  PrismAuthenticatedSession,
  PrismSupplierApplication,
  PrismSupplierApplicationStatusResult,
  PrismSupplierReadinessBoard,
  PrismSupplierWorkspace,
  CreateSupplierApplicationInput,
  SupplierApplicationStatusQuery,
  SubmitSupplierQuoteInput,
} from "@prism/types";

export type { CreateSupplierApplicationInput, SupplierApplicationStatusQuery } from "@prism/types";

export type SupplierWorkspace = PrismSupplierWorkspace;

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

export const eventOpsClient = createEventOpsClient({
  getAuthToken: storedSupplierAccessToken,
  onUnauthorized: expireSupplierSession,
  onPrivacyNoticeRequired: showSupplierPrivacyNotice,
});

/** Authenticated, role-scoped API client for feature data adapters. Feature operations stay in the feature data folders. */
export const supplierApi = eventOpsClient;

function actorFromSession(session: PrismAuthenticatedSession) {
  return { actorRole: "supplier" as const, actorName: session.name, actorEmail: session.email };
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
  submitQuote: (token: string, input: SubmitSupplierQuoteInput) => eventOpsClient.supplierWorkspace.submitQuoteByLink(token, input),
  reviseQuote: (token: string, input: SubmitSupplierQuoteInput) => eventOpsClient.supplierWorkspace.reviseQuoteByLink(token, input),
  confirmAssignment: (session: PrismAuthenticatedSession, requestId: string) =>
    eventOpsClient.supplierWorkspace.confirmAssignment(requestId, actorFromSession(session)),
  confirmReadiness: (session: PrismAuthenticatedSession, requestId: string, notes: string) =>
    eventOpsClient.supplierWorkspace.confirmReadiness(requestId, { notes }, actorFromSession(session)),
  createSupplierApplication: (input: CreateSupplierApplicationInput): Promise<PrismSupplierApplication> =>
    eventOpsClient.supplierApplications.create(input),
  getSupplierApplicationStatus: (
    input: SupplierApplicationStatusQuery,
    signal?: AbortSignal,
  ): Promise<PrismSupplierApplicationStatusResult> =>
    eventOpsClient.supplierApplications.getStatus(input, { signal }),
  fileRequirements: (eventId: string, session: PrismAuthenticatedSession) =>
    eventOpsClient.events.fileRequirements(eventId, actorFromSession(session)),
  listSupplierCategories: (): Promise<{ id: string; name: string }[]> =>
    eventOpsClient.supplierApplications.listCategories(),
  communicationInbox: (session: PrismAuthenticatedSession) =>
    eventOpsClient.communication.listInbox(actorFromSession(session)),
  communicationUnreadCount: (session: PrismAuthenticatedSession) =>
    eventOpsClient.communication.unreadCount(actorFromSession(session)),
  createCommunicationThread: (eventId: string, subject: string, session: PrismAuthenticatedSession) =>
    eventOpsClient.communication.createThread({ eventId, subject }, actorFromSession(session)),
  sendCommunicationMessage: (threadId: string, body: string, idempotencyKey: string, session: PrismAuthenticatedSession) =>
    eventOpsClient.communication.sendMessage(threadId, { body, idempotencyKey }, actorFromSession(session)),
  communicationMessages: (threadId: string, cursor: string | undefined, limit: number | undefined, session: PrismAuthenticatedSession) =>
    eventOpsClient.communication.listMessages(threadId, { cursor, limit }, actorFromSession(session)),
  markCommunicationThreadRead: (threadId: string, session: PrismAuthenticatedSession) =>
    eventOpsClient.communication.markThreadRead(threadId, actorFromSession(session)),
};
