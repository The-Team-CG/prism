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

import { createEventOpsClient } from "@prism/api-client";
import { PRISM_SESSION_STORAGE_KEYS, isPrismAuthenticatedSession } from "@prism/types";
import type {
  PrismAuthenticatedSession,
  PrismSupplierApplication,
  PrismSupplierApplicationStatusResult,
  PrismSupplierQuote,
  PrismSupplierQuoteRequest,
  PrismSupplierReadinessBoard,
  PrismSupplierWorkspace,
  CreateSupplierApplicationInput,
  SupplierApplicationStatusQuery,
  SubmitSupplierQuoteInput,
} from "@prism/types";

export type { CreateSupplierApplicationInput, SupplierApplicationStatusQuery } from "@prism/types";

export type SupplierWorkspace = PrismSupplierWorkspace;

export type QuoteRequestDetail = {
  request: PrismSupplierQuoteRequest;
  quote: PrismSupplierQuote | null;
  eventId: string;
  eventName: string;
  clientName: string | null;
  eventDate: string | null;
};

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";
const API_OFFLINE_MESSAGE = "P.R.I.S.M API is offline. Start `prism-api` on port 4000, then try again.";

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

const eventOpsClient = createEventOpsClient({
  baseUrl: `${API_URL}/api`,
  getAuthToken: storedSupplierAccessToken,
});

function actorFromSession(session: PrismAuthenticatedSession) {
  return { actorRole: "supplier" as const, actorName: session.name, actorEmail: session.email };
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${API_URL}${path}`, {
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
  // Identity now comes from the bearer token that getAuthToken attaches, so these
  // reads no longer pass an actor at all - the server derives it from the verified
  // session (PA-284). The `session` parameter is retained so callers still have to
  // hold a session to reach these, and so the signature stays stable.
  supplierWorkspace: (_session: PrismAuthenticatedSession) => eventOpsClient.supplierWorkspace.detail(),
  supplierReadinessBoard: (_session: PrismAuthenticatedSession): Promise<PrismSupplierReadinessBoard> =>
    eventOpsClient.supplierWorkspace.readinessBoard(),
  quoteRequest: (token: string) => request<QuoteRequestDetail>(`/api/quote-requests/${token}`),
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
  uploadContract: (session: PrismAuthenticatedSession, requestId: string, fileName: string) =>
    eventOpsClient.supplierWorkspace.uploadContract(
      requestId,
      { fileName, mimeType: "application/pdf", sizeBytes: 2048 },
      actorFromSession(session),
    ),
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
  getSupplierApplicationStatus: (input: SupplierApplicationStatusQuery): Promise<PrismSupplierApplicationStatusResult> =>
    request(`/api/supplier-applications/status?applicationId=${encodeURIComponent(input.applicationId)}&email=${encodeURIComponent(input.email)}`),
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
