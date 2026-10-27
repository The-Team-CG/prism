import type { PrismSupplier, PrismSupplierQuote, PrismSupplierQuoteRequest, PrismSupplierReadinessBoard, PrismSupplierWorkspace } from "@prism/types";

export type {
  PrismSupplier,
  PrismSupplierQuote,
  PrismSupplierQuoteRequest,
  PrismSupplierReadinessBoard,
};

export type SupplierWorkspace = PrismSupplierWorkspace;

export type SupplierWorkspaceStatus = "idle" | "loading" | "success" | "error";

export const SUPPLIER_DASHBOARD_SECTIONS = [
  "dashboard",
  "requests",
  "bookings",
  "calendar",
  "quotations",
  "messages",
  "files",
  "payments",
  "profile",
  "support",
] as const;

export type SupplierDashboardSection = (typeof SUPPLIER_DASHBOARD_SECTIONS)[number];

export function isSupplierDashboardSection(value: string): value is SupplierDashboardSection {
  return (SUPPLIER_DASHBOARD_SECTIONS as readonly string[]).includes(value);
}

/** Each section has its own URL, so refresh, back and shared links keep the supplier where they were. */
export function supplierSectionHref(section: SupplierDashboardSection) {
  return section === "dashboard" ? "/dashboard" : `/dashboard/${section}`;
}

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
