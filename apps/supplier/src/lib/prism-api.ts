export type SupplierSession = {
  id: string;
  name: string;
  email: string;
  role: string;
  organization: string;
  signedInAt: string;
};

export type {
  PrismSupplier,
  PrismSupplierApplication,
  PrismSupplierCertification,
  PrismSupplierQuote,
  PrismSupplierQuoteRequest,
  PrismSupplierReadinessBoard,
  PrismSupplierWorkspace,
  SubmitSupplierQuoteInput as SubmitQuoteInput,
} from "@prism/types";

import { createEventOpsClient } from "@prism/api-client";
import type {
  PrismSupplier,
  PrismSupplierApplication,
  PrismSupplierQuote,
  PrismSupplierQuoteRequest,
  PrismSupplierReadinessBoard,
  PrismSupplierWorkspace,
  SubmitSupplierQuoteInput,
} from "@prism/types";
import type { CreateSupplierApplicationInput } from "@prism/api-client";

export type { CreateSupplierApplicationInput } from "@prism/api-client";

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
const eventOpsClient = createEventOpsClient({ baseUrl: `${API_URL}/api` });

function actorFromSession(session: SupplierSession) {
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
  supplierWorkspace: (session: SupplierSession) =>
    eventOpsClient.supplierWorkspace.detail({
      actorRole: "supplier",
      actorName: session.name,
      actorEmail: session.email,
    }),
  supplierReadinessBoard: (session: SupplierSession): Promise<PrismSupplierReadinessBoard> =>
    eventOpsClient.supplierWorkspace.readinessBoard({
      actorRole: "supplier",
      actorName: session.name,
      actorEmail: session.email,
    }),
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
  confirmAssignment: (session: SupplierSession, requestId: string) =>
    eventOpsClient.supplierWorkspace.confirmAssignment(requestId, actorFromSession(session)),
  confirmReadiness: (session: SupplierSession, requestId: string, notes: string) =>
    eventOpsClient.supplierWorkspace.confirmReadiness(requestId, { notes }, actorFromSession(session)),
  uploadContract: (session: SupplierSession, requestId: string, fileName: string) =>
    eventOpsClient.supplierWorkspace.uploadContract(
      requestId,
      { fileName, mimeType: "application/pdf", sizeBytes: 2048 },
      actorFromSession(session),
    ),
  updateEventStatus: (session: SupplierSession, requestId: string, status: string, notes: string) =>
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
  listSupplierCategories: (): Promise<{ id: string; name: string }[]> =>
    request("/api/supplier-applications/categories"),
};
