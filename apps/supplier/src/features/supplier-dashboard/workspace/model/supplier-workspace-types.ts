import type { PrismSupplier, PrismSupplierQuote, PrismSupplierQuoteRequest, PrismSupplierReadinessBoard, PrismSupplierWorkspace } from "@prism/types";
import type { SupplierSession } from "@/lib/prism-api";

export type {
  PrismSupplier,
  PrismSupplierQuote,
  PrismSupplierQuoteRequest,
  PrismSupplierReadinessBoard,
  SupplierSession,
};

export type SupplierWorkspace = PrismSupplierWorkspace;

export type SupplierDashboardSection =
  | "dashboard"
  | "requests"
  | "bookings"
  | "calendar"
  | "quotations"
  | "messages"
  | "files"
  | "payments"
  | "profile"
  | "support";

export type QuoteFormState = {
  amount: string;
  inclusions: string;
  paymentTerms: string;
  notes: string;
};

export type QuoteSubmitInput = {
  amount: number;
  inclusions: string[];
  paymentTerms: string;
  notes: string;
};

export type CalendarEventItem = {
  date: string;
  label: string;
  type: "deadline" | "event" | "booking";
};

export type WorkspaceDerived = {
  quoteByRequest: Map<string, PrismSupplierQuote>;
  openRequests: PrismSupplierQuoteRequest[];
  selectedRequests: PrismSupplierQuoteRequest[];
  selectedQuotes: PrismSupplierQuote[];
  quoteNeedingSubmission: number;
  handoffPending: number;
  readinessNeedsActionCount: number;
  needsActionCount: number;
  eventsThisMonth: number;
};

export type BookingStep = {
  label: string;
  done: boolean;
  meta: string;
};

export type SectionMeta = {
  eyebrow: string;
  title: string;
  description: string;
};
