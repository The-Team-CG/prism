import { describe, expect, it } from "vitest";
import {
  buildCalendarEvents,
  buildQuoteByRequest,
  closedRequestReason,
  countEventsThisMonth,
  countHandoffPending,
  countQuotesNeedingSubmission,
  countReadinessNeedsAction,
  deriveWorkspace,
  filterOpenRequests,
  filterSelectedQuotes,
  filterSelectedRequests,
  firstNameFrom,
  formatDate,
  formatMoney,
  fmt,
  greetingForHour,
  initialForm,
  isPastDate,
  isRequestClosed,
  parseQuoteForm,
  quoteSubmitSuccessNotice,
} from "./supplier-workspace-rules";
import type {
  PrismSupplierQuote,
  PrismSupplierQuoteRequest,
  SupplierWorkspace,
} from "./supplier-workspace-types";

function makeRequest(
  overrides: Partial<PrismSupplierQuoteRequest> & { id: string },
): PrismSupplierQuoteRequest {
  return {
    accessToken: "tok",
    eventId: "e1",
    category: "Lighting",
    message: "Need lights",
    dueDate: "2026-05-14",
    status: "open",
    confidentialBid: false,
    assignmentStatus: null,
    assignmentConfirmedAt: null,
    readinessStatus: null,
    readinessConfirmedAt: null,
    readinessNotes: null,
    contractDocumentId: null,
    eventDayStatus: null,
    eventDayStatusAt: null,
    eventDayNotes: null,
    createdAt: "2026-05-01T00:00:00.000Z",
    ...overrides,
  } as PrismSupplierQuoteRequest;
}

function makeQuote(
  overrides: Partial<PrismSupplierQuote> & { id: string; requestId: string },
): PrismSupplierQuote {
  return {
    amount: 75000,
    inclusions: ["Crew"],
    paymentTerms: "50%",
    notes: "ok",
    status: "submitted",
    revisionNumber: 1,
    category: "Lighting",
    createdAt: "2026-05-02T00:00:00.000Z",
    revisedAt: null,
    lockedAt: null,
    ...overrides,
  } as PrismSupplierQuote;
}

describe("supplier-workspace-rules", () => {
  it("formats tokens, money, and dates", () => {
    expect(fmt("set_up_ready")).toBe("set up ready");
    expect(formatMoney(75000)).toContain("75");
    expect(formatDate("2026-05-14")).toMatch(/May/);
    expect(formatDate(null)).toBe("—");
  });

  it("detects past dates", () => {
    expect(isPastDate("2000-01-01", Date.parse("2026-01-01"))).toBe(true);
    expect(isPastDate("2099-01-01", Date.parse("2026-01-01"))).toBe(false);
    expect(isPastDate(null)).toBe(false);
  });

  it("builds initial quote form from quote or empty", () => {
    expect(initialForm()).toEqual({
      amount: "",
      inclusions: "",
      paymentTerms: "",
      notes: "",
    });
    const form = initialForm(
      makeQuote({ id: "q1", requestId: "r1", amount: 10, inclusions: ["A", "B"] }),
    );
    expect(form.amount).toBe("10");
    expect(form.inclusions).toBe("A\nB");
  });

  it("filters open / selected requests and quotes", () => {
    const open = makeRequest({ id: "r1", status: "open" });
    const selected = makeRequest({ id: "r2", status: "selected" });
    const closed = makeRequest({ id: "r3", status: "closed" });
    expect(filterOpenRequests([open, selected, closed]).map((r) => r.id)).toEqual(["r1"]);

    const quote = makeQuote({ id: "q2", requestId: "r4", status: "locked" });
    const map = buildQuoteByRequest([quote]);
    const withLocked = makeRequest({ id: "r4", status: "open" });
    expect(filterSelectedRequests([selected, withLocked], map).map((r) => r.id)).toEqual([
      "r2",
      "r4",
    ]);
    expect(filterSelectedQuotes([quote, makeQuote({ id: "q3", requestId: "r5", status: "submitted" })]).map((q) => q.id)).toEqual([
      "q2",
    ]);
  });

  it("counts submission and handoff work", () => {
    const r1 = makeRequest({ id: "r1" });
    const r2 = makeRequest({ id: "r2" });
    const map = buildQuoteByRequest([makeQuote({ id: "q1", requestId: "r1" })]);
    expect(countQuotesNeedingSubmission([r1, r2], map)).toBe(1);

    expect(
      countHandoffPending([
        makeRequest({
          id: "a",
          assignmentStatus: "confirmed",
          readinessStatus: "confirmed",
          contractDocumentId: "c.pdf",
        }),
        makeRequest({ id: "b", assignmentStatus: "pending" }),
      ]),
    ).toBe(1);
  });

  it("counts readiness needs and events this month", () => {
    expect(
      countReadinessNeedsAction(
        {
          counts: { critical: 1, warning: 2, attention: 3, info: 0 },
          items: [],
        } as never,
        9,
        9,
      ),
    ).toBe(6);
    expect(countReadinessNeedsAction(null, 2, 3)).toBe(5);

    const may = new Date("2026-05-15T12:00:00.000Z");
    expect(
      countEventsThisMonth(
        [
          makeRequest({ id: "1", eventId: "e1", createdAt: "2026-05-01T00:00:00.000Z" }),
          makeRequest({ id: "2", eventId: "e1", createdAt: "2026-05-02T00:00:00.000Z" }),
          makeRequest({ id: "3", eventId: "e2", createdAt: "2026-04-01T00:00:00.000Z" }),
        ],
        may,
      ),
    ).toBe(1);
  });

  it("parses quote forms and closed reasons", () => {
    expect(parseQuoteForm({ amount: "0", inclusions: "", paymentTerms: "", notes: "" })).toEqual({
      error: "Quote amount must be greater than zero.",
    });
    expect(
      parseQuoteForm({
        amount: "100",
        inclusions: "A\n\nB",
        paymentTerms: "net 30",
        notes: "n",
      }),
    ).toEqual({
      amount: 100,
      inclusions: ["A", "B"],
      paymentTerms: "net 30",
      notes: "n",
    });

    const expired = makeRequest({ id: "r", status: "expired" });
    expect(isRequestClosed(expired)).toBe(true);
    expect(closedRequestReason(expired)).toMatch(/Deadline/);
  });

  it("derives workspace aggregates and calendar events", () => {
    const workspace = {
      supplier: { name: "Xperto", categoryName: "AV" },
      quoteRequests: [
        makeRequest({ id: "r1", dueDate: "2026-05-20", status: "open" }),
        makeRequest({
          id: "r2",
          status: "selected",
          assignmentStatus: "pending",
          dueDate: "2026-05-10",
        }),
      ],
      supplierQuotes: [makeQuote({ id: "q1", requestId: "r2", status: "selected" })],
    } as unknown as SupplierWorkspace;

    const derived = deriveWorkspace(workspace, null, new Date("2026-05-15T00:00:00.000Z"));
    expect(derived.openRequests).toHaveLength(1);
    expect(derived.selectedRequests).toHaveLength(1);
    expect(derived.quoteNeedingSubmission).toBe(1);
    expect(derived.handoffPending).toBe(1);

    const events = buildCalendarEvents(workspace);
    expect(events).toHaveLength(2);
    expect(events[0].date <= events[1].date).toBe(true);
  });

  it("greeting, first name, and notices", () => {
    expect(greetingForHour(9)).toBe("Good morning");
    expect(greetingForHour(14)).toBe("Good afternoon");
    expect(greetingForHour(20)).toBe("Good evening");
    expect(firstNameFrom("Ops Lead")).toBe("Ops");
    expect(quoteSubmitSuccessNotice(true)).toBe("Quote revision submitted.");
    expect(quoteSubmitSuccessNotice(false)).toBe("Quote submitted.");
  });
});
