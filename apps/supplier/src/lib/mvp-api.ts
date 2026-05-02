export type SupplierSession = {
  id: string;
  name: string;
  email: string;
  role: string;
  organization: string;
  signedInAt: string;
};

export type MvpSupplierCertification = {
  id: string;
  fileName: string;
  documentType?: string;
  issuer?: string;
  expiresAt?: string | null;
  status?: string;
  notes?: string;
  uploadedAt: string;
};

export type MvpSupplier = {
  id: string;
  name: string;
  categoryId: string;
  categoryName: string;
  categorySlug: string;
  tier: string;
  bniMember: boolean;
  autoTrust: boolean;
  contactName: string;
  email: string;
  phone: string;
  serviceInclusions: string;
  applicationDate: string;
  certifications: MvpSupplierCertification[];
};

export type MvpSupplierQuoteRequest = {
  id: string;
  eventId: string;
  supplierId?: string;
  categoryId?: string;
  supplierName: string;
  category: string;
  message: string;
  dueDate?: string | null;
  accessToken: string;
  confidentialBid: boolean;
  status: string;
  assignmentStatus?: string;
  assignmentConfirmedAt?: string | null;
  readinessStatus?: string;
  readinessConfirmedAt?: string | null;
  readinessNotes?: string;
  eventDayStatus?: string;
  eventDayStatusAt?: string | null;
  eventDayNotes?: string;
  statusPhotoFileName?: string | null;
  contractDocumentId?: string | null;
  createdAt: string;
};

export type MvpSupplierQuote = {
  id: string;
  eventId: string;
  requestId?: string;
  supplierId?: string;
  categoryId?: string;
  supplierName: string;
  category: string;
  amount: number;
  inclusions: string[];
  paymentTerms: string;
  notes: string;
  status: string;
  revisionNumber?: number;
  revisedAt?: string | null;
  selectedAt?: string | null;
  lockedAt?: string | null;
  createdAt: string;
};

export type SupplierWorkspace = {
  supplier: MvpSupplier;
  quoteRequests: MvpSupplierQuoteRequest[];
  supplierQuotes: MvpSupplierQuote[];
};

export type QuoteRequestDetail = {
  request: MvpSupplierQuoteRequest;
  quote: MvpSupplierQuote | null;
  eventId: string;
  eventName: string;
  clientName: string | null;
  eventDate: string | null;
};

export type SubmitQuoteInput = {
  amount: number;
  inclusions?: string[];
  paymentTerms?: string;
  notes?: string;
};

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";
const API_OFFLINE_MESSAGE = "P.R.I.S.M API is offline. Start `prism-api` on port 4000, then try again.";

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

function supplierActorQuery(session: SupplierSession) {
  return new URLSearchParams({
    actorRole: "supplier",
    actorName: session.name,
    actorEmail: session.email,
  }).toString();
}

function supplierRequestPath(session: SupplierSession, requestId: string, suffix: string) {
  return `/api/supplier/quote-requests/${requestId}/${suffix}?${supplierActorQuery(session)}`;
}

export const mvpApi = {
  supplierWorkspace: (session: SupplierSession) =>
    request<SupplierWorkspace>(`/api/supplier/workspace?${supplierActorQuery(session)}`),
  quoteRequest: (token: string) => request<QuoteRequestDetail>(`/api/quote-requests/${token}`),
  submitQuote: (token: string, input: SubmitQuoteInput) =>
    request<MvpSupplierQuote>(`/api/quote-requests/${token}/quote`, {
      method: "POST",
      body: JSON.stringify(input),
    }),
  reviseQuote: (token: string, input: SubmitQuoteInput) =>
    request<MvpSupplierQuote>(`/api/quote-requests/${token}/quote`, {
      method: "PATCH",
      body: JSON.stringify(input),
    }),
  confirmAssignment: (session: SupplierSession, requestId: string) =>
    request<MvpSupplierQuoteRequest>(supplierRequestPath(session, requestId, "assignment/confirm"), {
      method: "PATCH",
    }),
  confirmReadiness: (session: SupplierSession, requestId: string, notes: string) =>
    request<MvpSupplierQuoteRequest>(supplierRequestPath(session, requestId, "readiness/confirm"), {
      method: "PATCH",
      body: JSON.stringify({ notes }),
    }),
  uploadContract: (session: SupplierSession, requestId: string, fileName: string) =>
    request<MvpSupplierQuoteRequest>(supplierRequestPath(session, requestId, "contract"), {
      method: "POST",
      body: JSON.stringify({
        fileName,
        mimeType: "application/pdf",
        sizeBytes: 2048,
      }),
    }),
  updateEventStatus: (session: SupplierSession, requestId: string, status: string, notes: string) =>
    request<MvpSupplierQuoteRequest>(supplierRequestPath(session, requestId, "event-status"), {
      method: "PATCH",
      body: JSON.stringify({ status, notes }),
    }),
};
