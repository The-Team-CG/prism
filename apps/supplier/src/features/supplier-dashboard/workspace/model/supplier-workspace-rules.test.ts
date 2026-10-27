import { describe, expect, it } from "vitest";
import {
  buildBookingSteps,
  buildSupplierContractRequirements,
  buildCalendarEvents,
  canReportSupplierEventDayStatus,
  buildQuoteByRequest,
  closedRequestReason,
  countEventsThisMonth,
  countHandoffPending,
  countQuotesNeedingSubmission,
  countReadinessNeedsAction,
  dashboardGreetingCopy,
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
  quoteRequestsNavDesc,
  bookingsNavDesc,
  groupReadinessItemsByEvent,
  quoteSubmitSuccessNotice,
  supplierReadinessSection,
  supplierMessageEvents,
} from "./supplier-workspace-rules";
import type { PrismSupplierReadinessItem } from "@prism/types";
import type { PrismSupplierQuote, PrismSupplierQuoteRequest, SupplierWorkspace } from "./supplier-workspace-types";

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
  it("keeps an automatic late flag open until the supplier reports an event-day status", () => {
    const late = buildBookingSteps(makeRequest({ id: "late", eventDayStatus: "late" })).at(-1);
    const arrived = buildBookingSteps(makeRequest({ id: "arrived", eventDayStatus: "arrived" })).at(-1);

    expect(late).toMatchObject({ done: false, meta: "Late — arrival not reported" });
    expect(arrived?.done).toBe(true);
  });

  it("requires assignment and readiness confirmation before reporting event-day status", () => {
    expect(canReportSupplierEventDayStatus(makeRequest({ id: "pending" }))).toBe(false);
    expect(canReportSupplierEventDayStatus(makeRequest({
      id: "ready",
      status: "selected",
      assignmentStatus: "confirmed",
      readinessStatus: "confirmed",
    }))).toBe(true);
    expect(canReportSupplierEventDayStatus(makeRequest({
      id: "stale-selection",
      status: "open",
      assignmentStatus: "confirmed",
      readinessStatus: "confirmed",
    }))).toBe(false);
  });

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
          contractReviewStatus: "accepted",
        }),
        makeRequest({ id: "b", assignmentStatus: "pending" }),
      ]),
    ).toBe(1);
  });

  it.each([
    ["missing", false, "Upload signed contract below", "missing"],
    ["submitted", false, "Awaiting PMCM review", "submitted"],
    ["changes_requested", false, "Upload a corrected version", "pending"],
    ["accepted", true, "Accepted by PMCM", "approved"],
  ] as const)("keeps contract handoff aligned with %s review evidence", (contractReviewStatus, done, meta, status) => {
    const request = makeRequest({ id: "contract", status: "selected", assignmentStatus: "confirmed", readinessStatus: "confirmed", contractDocumentId: "legacy-metadata", contractReviewStatus });
    expect(buildBookingSteps(request)[2]).toMatchObject({ done, meta });
    expect(countHandoffPending([request])).toBe(done ? 0 : 1);
    expect(buildSupplierContractRequirements({ quoteRequests: [request, makeRequest({ id: "unselected" })], supplierQuotes: [] })).toEqual([
      expect.objectContaining({ key: "supplier-contract:contract", status, detail: meta }),
    ]);
  });

  it("routes every readiness item to the section where it is actioned and groups all items by event", () => {
    const item = (id: string, eventId: string, quoteStatus: string, eventName: string | null = null) =>
      ({ id, eventId, eventName, quoteStatus }) as PrismSupplierReadinessItem;
    const items = [
      item("a", "e1", "selected", "Gala"),
      item("b", "e2", "open", "Summit"),
      item("c", "e1", "submitted", "Gala"),
      item("d", "e3", "selected"),
      item("e", "e2", "selected", "Summit"),
    ];

    expect(items.map(supplierReadinessSection)).toEqual(["bookings", "requests", "requests", "bookings", "bookings"]);
    expect(groupReadinessItemsByEvent(items).map((group) => [group.eventName, group.items.map((entry) => entry.id)])).toEqual([
      ["Gala", ["a", "c"]],
      ["Summit", ["b", "e"]],
      ["Assigned event", ["d"]],
    ]);
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
    expect(quoteSubmitSuccessNotice(true)).toMatch(/^Revised quote sent to PMCM for review\./);
    expect(quoteSubmitSuccessNotice(false)).toMatch(/^Quote sent to PMCM for review\./);
    for (const revised of [true, false]) {
      expect(quoteSubmitSuccessNotice(revised)).toContain("Your booking is not confirmed by this submission.");
    }
  });

  it("builds dashboard greeting and quick-nav copy", () => {
    expect(
      dashboardGreetingCopy({ needsActionCount: 2, quoteNeedingSubmission: 1, openRequestCount: 3 }),
    ).toBe("2 actions need your attention — 1 quote to submit.");
    expect(
      dashboardGreetingCopy({ needsActionCount: 1, quoteNeedingSubmission: 0, openRequestCount: 1 }),
    ).toBe("1 action need your attention — handoff items pending.");
    expect(
      dashboardGreetingCopy({ needsActionCount: 0, quoteNeedingSubmission: 0, openRequestCount: 2 }),
    ).toBe("2 open requests — all quotes submitted and up to date.");
    expect(
      dashboardGreetingCopy({ needsActionCount: 0, quoteNeedingSubmission: 0, openRequestCount: 0 }),
    ).toBe("No open requests right now. PMCM will notify you when a new quote request arrives.");
    expect(quoteRequestsNavDesc(2, 4)).toBe("2 quote(s) need submission");
    expect(quoteRequestsNavDesc(0, 3)).toBe("3 open request(s)");
    expect(bookingsNavDesc(1, 2)).toBe("1 handoff item(s) pending");
    expect(bookingsNavDesc(0, 1)).toBe("All steps complete");
  });
});

describe("supplierMessageEvents", () => {
  it("lists one named event per booking so Messages never silently picks the first", () => {
    const booking = (id: string, eventId: string) => ({ id, eventId }) as Parameters<typeof supplierMessageEvents>[0][number];
    const named = { eventId: "evt_ops", eventName: "UAT Operations Supplier Booking" } as PrismSupplierReadinessItem;
    expect(supplierMessageEvents([booking("rq_1", "evt_ops"), booking("rq_2", "evt_ops"), booking("rq_3", "evt_live")], [named])).toEqual([
      { eventId: "evt_ops", eventName: "UAT Operations Supplier Booking" },
      { eventId: "evt_live", eventName: "Assigned event" },
    ]);
  });
});
