import type {
  PrismAuthenticatedSession,
  PrismFileRequirementItem,
  PrismSupplierReadinessConcernKind,
  PrismSupplierReadinessItem,
  PrismSupplierReadinessSetupStatus,
} from "@prism/types";
import type { BookingStep, CalendarEventItem, QuoteFormState, QuoteSubmitInput, SectionMeta, SupplierDashboardSection, SupplierWorkspace, WorkspaceDerived, PrismSupplierQuote, PrismSupplierQuoteRequest, PrismSupplierReadinessBoard } from "./supplier-workspace-types";

export const EVENT_STATUS_ACTIONS = [
  { status: "arrived", label: "Arrived", helper: "Onsite at venue" },
  { status: "set_up_ready", label: "Set up and ready", helper: "Setup complete" },
  { status: "done_leaving", label: "Done and leaving", helper: "Egress started" },
] as const;

const money = new Intl.NumberFormat("en-PH", {
  style: "currency",
  currency: "PHP",
  maximumFractionDigits: 0,
});

const dateOnly = new Intl.DateTimeFormat("en-PH", {
  month: "short",
  day: "numeric",
  year: "numeric",
});

const dateTime = new Intl.DateTimeFormat("en-PH", {
  month: "short",
  day: "numeric",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

export function fmt(value: string): string {
  return value.replaceAll("_", " ");
}

export function formatMoney(amount: number): string {
  return money.format(amount);
}

export function formatDate(value?: string | null): string {
  if (!value) return "—";
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [y, m, d] = value.split("-").map(Number);
    return dateOnly.format(new Date(y, m - 1, d));
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return value.includes("T") ? dateTime.format(parsed) : dateOnly.format(parsed);
}

export function isPastDate(value?: string | null, now: number = Date.now()): boolean {
  if (!value) return false;
  const p = new Date(value);
  return !Number.isNaN(p.getTime()) && p.getTime() < now;
}

export function readinessTone(priority: string): string {
  if (priority === "critical") {
    return "border-danger/25 bg-danger/8 text-danger";
  }
  if (priority === "warning") {
    return "border-attention/25 bg-attention/8 text-attention";
  }
  if (priority === "attention") {
    return "border-primary/20 bg-primary-soft text-primary";
  }
  return "border-border bg-muted text-muted-foreground";
}

export function initialForm(quote?: PrismSupplierQuote): QuoteFormState {
  return {
    amount: quote ? String(quote.amount) : "",
    inclusions: quote?.inclusions.join("\n") ?? "",
    paymentTerms: quote?.paymentTerms ?? "",
    notes: quote?.notes ?? "",
  };
}

export function buildQuoteByRequest(
  quotes: PrismSupplierQuote[],
): Map<string, PrismSupplierQuote> {
  return new Map(
    quotes.filter((q) => q.requestId).map((q) => [q.requestId as string, q]),
  );
}

export function filterOpenRequests(
  requests: PrismSupplierQuoteRequest[],
): PrismSupplierQuoteRequest[] {
  return requests.filter((r) => !["closed", "expired", "selected"].includes(r.status));
}

export function filterSelectedRequests(
  requests: PrismSupplierQuoteRequest[],
  quoteByRequest: Map<string, PrismSupplierQuote>,
): PrismSupplierQuoteRequest[] {
  return requests.filter((r) => {
    const q = quoteByRequest.get(r.id);
    return r.status === "selected" || ["selected", "locked"].includes(q?.status ?? "");
  });
}

export function filterSelectedQuotes(quotes: PrismSupplierQuote[]): PrismSupplierQuote[] {
  return quotes.filter((q) => ["selected", "locked"].includes(q.status));
}

export function countQuotesNeedingSubmission(
  openRequests: PrismSupplierQuoteRequest[],
  quoteByRequest: Map<string, PrismSupplierQuote>,
): number {
  return openRequests.filter((r) => !quoteByRequest.get(r.id)).length;
}

export function countHandoffPending(selectedRequests: PrismSupplierQuoteRequest[]): number {
  return selectedRequests.filter(
    (r) =>
      r.assignmentStatus !== "confirmed" ||
      r.readinessStatus !== "confirmed" ||
      r.contractReviewStatus !== "accepted",
  ).length;
}

export function buildSupplierContractRequirements(workspace: Pick<SupplierWorkspace, "quoteRequests" | "supplierQuotes">): PrismFileRequirementItem[] {
  return filterSelectedRequests(workspace.quoteRequests, buildQuoteByRequest(workspace.supplierQuotes)).map((request) => ({
    key: `supplier-contract:${request.id}`,
    label: `${request.category} signed contract`,
    ownerRole: "supplier",
    visibleToRoles: ["supplier", "pmcm-admin"],
    sourceWorkflow: "supplier_contract",
    status: request.contractReviewStatus === "accepted" ? "approved"
      : request.contractReviewStatus === "submitted" ? "submitted"
        : request.contractReviewStatus === "changes_requested" ? "pending" : "missing",
    auditCategory: "documents",
    detail: buildBookingSteps(request)[2].meta,
    required: true,
    overdue: false,
  }));
}

export function countReadinessNeedsAction(
  readinessBoard: PrismSupplierReadinessBoard | null,
  quoteNeedingSubmission: number,
  handoffPending: number,
): number {
  if (readinessBoard) {
    return (
      readinessBoard.counts.critical +
      readinessBoard.counts.warning +
      readinessBoard.counts.attention
    );
  }
  return quoteNeedingSubmission + handoffPending;
}

export function countEventsThisMonth(
  requests: PrismSupplierQuoteRequest[],
  now: Date = new Date(),
): number {
  const key = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  return new Set(
    requests.filter((r) => r.createdAt.startsWith(key)).map((r) => r.eventId),
  ).size;
}

export function deriveWorkspace(
  workspace: SupplierWorkspace | null,
  readinessBoard: PrismSupplierReadinessBoard | null,
  now: Date = new Date(),
): WorkspaceDerived {
  const quotes = workspace?.supplierQuotes ?? [];
  const requests = workspace?.quoteRequests ?? [];
  const quoteByRequest = buildQuoteByRequest(quotes);
  const openRequests = filterOpenRequests(requests);
  const selectedRequests = filterSelectedRequests(requests, quoteByRequest);
  const selectedQuotes = filterSelectedQuotes(quotes);
  const quoteNeedingSubmission = countQuotesNeedingSubmission(openRequests, quoteByRequest);
  const handoffPending = countHandoffPending(selectedRequests);
  const readinessNeedsActionCount = countReadinessNeedsAction(
    readinessBoard,
    quoteNeedingSubmission,
    handoffPending,
  );

  return {
    quoteByRequest,
    openRequests,
    selectedRequests,
    selectedQuotes,
    quoteNeedingSubmission,
    handoffPending,
    readinessNeedsActionCount,
    needsActionCount: readinessNeedsActionCount,
    eventsThisMonth: countEventsThisMonth(requests, now),
  };
}

export function isRequestClosed(
  req: PrismSupplierQuoteRequest,
  quote?: PrismSupplierQuote,
): boolean {
  return (
    ["selected", "closed", "expired"].includes(req.status) ||
    ["selected", "locked", "not_selected"].includes(quote?.status ?? "")
  );
}

export function closedRequestReason(
  req: PrismSupplierQuoteRequest,
  quote?: PrismSupplierQuote,
): string {
  if (req.status === "expired") {
    return "Deadline passed. No longer accepting edits.";
  }
  if (
    ["selected", "locked"].includes(quote?.status ?? "") ||
    req.status === "selected"
  ) {
    return "PMCM selected this quote. Go to Bookings to complete the handoff.";
  }
  if (quote?.status === "not_selected") {
    return "PMCM did not select this quote.";
  }
  return "PMCM closed this request.";
}

export function parseQuoteForm(form: QuoteFormState): QuoteSubmitInput | { error: string } {
  const amount = Number(form.amount);
  if (!amount || amount <= 0) {
    return { error: "Quote amount must be greater than zero." };
  }
  return {
    amount,
    inclusions: form.inclusions
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean),
    paymentTerms: form.paymentTerms,
    notes: form.notes,
  };
}

export function mergeQuoteForms(
  existing: Record<string, QuoteFormState>,
  workspace: SupplierWorkspace,
): Record<string, QuoteFormState> {
  const qbr = buildQuoteByRequest(workspace.supplierQuotes);
  const merged: Record<string, QuoteFormState> = {};
  workspace.quoteRequests.forEach((req) => {
    merged[req.id] = existing[req.id] ?? initialForm(qbr.get(req.id));
  });
  return merged;
}

export function greetingForHour(hour: number): string {
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

export function firstNameFrom(name: string): string {
  return name.split(" ")[0] ?? name;
}

export function buildBookingSteps(
  req: PrismSupplierQuoteRequest,
): BookingStep[] {
  return [
    {
      label: "Assignment confirmed",
      done: req.assignmentStatus === "confirmed",
      meta: req.assignmentConfirmedAt ? formatDate(req.assignmentConfirmedAt) : "Pending",
    },
    {
      label: "Readiness confirmed",
      done: req.readinessStatus === "confirmed",
      meta: req.readinessConfirmedAt
        ? formatDate(req.readinessConfirmedAt)
        : "Before event day",
    },
    {
      label: "Contract accepted",
      done: req.contractReviewStatus === "accepted",
      meta: req.contractReviewStatus === "accepted" ? "Accepted by PMCM"
        : req.contractReviewStatus === "submitted" ? "Awaiting PMCM review"
          : req.contractReviewStatus === "changes_requested" ? "Upload a corrected version"
            : "Upload signed contract below",
    },
    {
      label: "Event day status",
      done: ["arrived", "set_up_ready", "done_leaving"].includes(req.eventDayStatus ?? ""),
      meta: req.eventDayStatus === "late"
        ? "Late — arrival not reported"
        : req.eventDayStatusAt ? formatDate(req.eventDayStatusAt) : "Update onsite",
    },
  ];
}

export function canReportSupplierEventDayStatus(req: PrismSupplierQuoteRequest): boolean {
  return req.status === "selected" && req.assignmentStatus === "confirmed" && req.readinessStatus === "confirmed";
}

export function buildCalendarEvents(
  workspace: SupplierWorkspace,
): CalendarEventItem[] {
  const items: CalendarEventItem[] = [];
  workspace.quoteRequests.forEach((req) => {
    if (req.dueDate) {
      items.push({
        date: req.dueDate,
        label: `Quote due: ${req.category}`,
        type: "deadline",
      });
    }
  });
  return items.sort((a, b) => a.date.localeCompare(b.date));
}

export function sectionMeta(
  section: SupplierDashboardSection,
  session: PrismAuthenticatedSession,
  workspace: SupplierWorkspace | null,
): SectionMeta {
  const first = firstNameFrom(session.name);
  const map: Record<SupplierDashboardSection, SectionMeta> = {
    dashboard: {
      eyebrow: "Supplier portal",
      title: `Hello, ${first}.`,
      description: `${workspace?.supplier.categoryName ?? session.organization} — ${workspace?.supplier.name ?? session.organization}`,
    },
    requests: {
      eyebrow: "Requests",
      title: "Quote requests",
      description: "Submit, revise, and track your quotes before the deadline.",
    },
    bookings: {
      eyebrow: "Bookings",
      title: "Bookings & events",
      description: "Confirm assignments, readiness, contracts, and event-day status.",
    },
    calendar: {
      eyebrow: "Calendar",
      title: "Your calendar",
      description: "Upcoming quote deadlines and event dates.",
    },
    quotations: {
      eyebrow: "Quotations",
      title: "Quote history",
      description: "All submitted quotations with revision history and status.",
    },
    messages: {
      eyebrow: "Messages",
      title: "Messages",
      description: "Direct communication with the PMCM team.",
    },
    files: {
      eyebrow: "Files",
      title: "Files & documents",
      description: "Uploaded contract versions, review status, and certification documents.",
    },
    payments: {
      eyebrow: "Payments",
      title: "Payment tracking",
      description: "Payment milestones for your selected and locked quotes.",
    },
    profile: {
      eyebrow: "Profile",
      title: "Services & profile",
      description: "Your supplier profile, tier, category, and service inclusions.",
    },
    support: {
      eyebrow: "Support",
      title: "Support",
      description: "Guidance on portal actions and how to reach PMCM.",
    },
  };
  return map[section];
}

export function mapSupplierWorkspaceError(
  error: unknown,
  fallback = "Unable to load supplier workspace",
): string {
  if (error instanceof Error && error.message.trim()) return error.message;
  return fallback;
}

export function quoteSubmitSuccessNotice(isRevision: boolean): string {
  return isRevision ? "Quote revision submitted." : "Quote submitted.";
}

export function eventStatusSuccessNotice(status: string): string {
  return `Status updated: ${fmt(status)}.`;
}

function pluralSuffix(count: number) {
  return count === 1 ? "" : "s";
}

export function dashboardGreetingCopy(input: {
  needsActionCount: number;
  quoteNeedingSubmission: number;
  openRequestCount: number;
}): string {
  if (input.needsActionCount > 0) {
    const quotePart = input.quoteNeedingSubmission > 0
      ? `${input.quoteNeedingSubmission} quote${pluralSuffix(input.quoteNeedingSubmission)} to submit`
      : "handoff items pending";
    return `${input.needsActionCount} action${pluralSuffix(input.needsActionCount)} need your attention — ${quotePart}.`;
  }
  if (input.openRequestCount > 0) {
    return `${input.openRequestCount} open request${pluralSuffix(input.openRequestCount)} — all quotes submitted and up to date.`;
  }
  return "No open requests right now. PMCM will notify you when a new quote request arrives.";
}

export function quoteRequestsNavDesc(quoteNeedingSubmission: number, openRequestCount: number) {
  if (quoteNeedingSubmission) return `${quoteNeedingSubmission} quote(s) need submission`;
  if (openRequestCount) return `${openRequestCount} open request(s)`;
  return "No open requests";
}

export function bookingsNavDesc(handoffPending: number, selectedRequestCount: number) {
  if (handoffPending) return `${handoffPending} handoff item(s) pending`;
  if (selectedRequestCount) return "All steps complete";
  return "No active bookings";
}

/**
 * Where a readiness item is actioned: unselected quotes live in Quote requests; selected work
 * (assignment, contract upload, schedule acknowledgment, event-day status) lives in Bookings.
 */
export function supplierReadinessSection(item: Pick<PrismSupplierReadinessItem, "quoteStatus">): SupplierDashboardSection {
  return item.quoteStatus === "selected" ? "bookings" : "requests";
}

export type SupplierReadinessEventGroup = {
  eventId: string;
  eventName: string;
  items: PrismSupplierReadinessItem[];
};

/** Groups every readiness item by event, keeping the server's priority order inside and across groups. */
export function groupReadinessItemsByEvent(items: PrismSupplierReadinessItem[]): SupplierReadinessEventGroup[] {
  const groups = new Map<string, SupplierReadinessEventGroup>();
  for (const item of items) {
    const group = groups.get(item.eventId) ?? { eventId: item.eventId, eventName: item.eventName ?? "Assigned event", items: [] };
    group.items.push(item);
    groups.set(item.eventId, group);
  }
  return [...groups.values()];
}

const READINESS_SETUP_LABELS: Record<PrismSupplierReadinessSetupStatus, string> = {
  not_started: "Setup not started",
  late: "Ingress late",
  arrived: "Arrived",
  ready: "Set up ready",
  complete: "Done and leaving",
};

export function readinessSetupLabel(status: PrismSupplierReadinessSetupStatus): string {
  return READINESS_SETUP_LABELS[status];
}

const READINESS_CONCERN_LABELS: Record<PrismSupplierReadinessConcernKind, string> = {
  schedule_change_request: "Your schedule change request",
  contract_correction: "Contract correction requested",
  event_day_note: "Your event-day note",
};

export function readinessConcernLabel(kind: PrismSupplierReadinessConcernKind): string {
  return READINESS_CONCERN_LABELS[kind];
}
