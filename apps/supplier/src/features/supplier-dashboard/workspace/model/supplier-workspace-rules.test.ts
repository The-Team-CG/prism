import { describe, expect, it } from "vitest";
import {
  quoteDeadlineUrgency,
  isEventStatusStepAllowed,
  buildBookingSteps,
  buildSupplierContractRequirements,
  buildSupplierFileRequirementRows,
  canReportSupplierEventDayStatus,
  buildQuoteByRequest,
  closedRequestReason,
  countEventsThisMonth,
  countHandoffPending,
  countQuotesNeedingSubmission,
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
  isQuoteLocked,
  isRequestClosed,
  requestsForQuoting,
  parseQuoteForm,
  quoteRequestsNavDesc,
  bookingsNavDesc,
  quoteSubmitSuccessNotice,
  supplierReadinessSection,
  supplierMessageEvents,
} from "./supplier-workspace-rules";
import { splitSupplierNextSteps, supplierStepFigure, supplierTodaySummary } from "./supplier-next-step";
import type { PrismFileRequirementsMatrix, PrismSupplierReadinessItem } from "@prism/types";
import type { PrismSupplierQuote, PrismSupplierQuoteRequest, SupplierWorkspace } from "./supplier-workspace-types";
import { supplierBookingHref, supplierWorkHref } from "./supplier-next-step";

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
    // The due date stays current all day in Manila, even after 8 AM when it has passed in UTC terms.
    expect(isPastDate("2026-11-12", Date.parse("2026-11-12T15:59:00.000Z"))).toBe(false);
    expect(isPastDate("2026-11-12", Date.parse("2026-11-12T16:00:00.000Z"))).toBe(true);
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
    ["missing", false, "Signed contract needed", "missing"],
    ["submitted", false, "Awaiting PMCM review", "submitted"],
    ["changes_requested", false, "Upload a corrected version", "pending"],
    ["accepted", true, "Accepted by PMCM", "approved"],
  ] as const)("keeps contract handoff aligned with %s review evidence", (contractReviewStatus, done, meta, status) => {
    const request = makeRequest({ id: "contract", status: "selected", assignmentStatus: "confirmed", readinessStatus: "confirmed", contractDocumentId: "legacy-metadata", contractReviewStatus });
    expect(buildBookingSteps(request)[2]).toMatchObject({ done, meta });
    // A contract PMCM is reviewing is no longer the supplier's work.
    expect(countHandoffPending([request])).toBe(done || contractReviewStatus === "submitted" ? 0 : 1);
    expect(buildSupplierContractRequirements({ quoteRequests: [request, makeRequest({ id: "unselected" })], supplierQuotes: [] })).toEqual([
      expect.objectContaining({ key: "supplier-contract:contract", status, detail: meta }),
    ]);
  });

  it("shows server due status only for supplier-owned requirements on selected bookings", () => {
    const selected = makeRequest({ id: "booking_selected", eventId: "event_selected", status: "selected", contractReviewStatus: "missing" });
    const unselected = makeRequest({ id: "booking_open", eventId: "event_open", status: "open" });
    const item = (key: string, ownerRole: string, required = true, visibleToRoles = ["supplier"]) => ({
      key,
      label: key,
      ownerRole,
      visibleToRoles,
      sourceWorkflow: "supplier_booking",
      status: "missing" as const,
      required,
      dueDate: "2026-10-01T00:00:00.000Z",
      overdue: true,
      auditCategory: "documents",
      detail: `${key} details`,
    });
    const matrices: PrismFileRequirementsMatrix[] = [
      { eventId: "event_selected", items: [item("supplier_contract", "supplier"), item("supplier_insurance", "supplier"), item("internal_note", "pmcm-admin"), item("hidden_supplier_file", "supplier", true, ["pmcm-admin"]), item("optional_file", "supplier", false)] },
      { eventId: "event_open", items: [item("unselected_requirement", "supplier")] },
    ];

    const rows = buildSupplierFileRequirementRows({ quoteRequests: [selected, unselected], supplierQuotes: [] }, matrices);

    expect(rows.map(({ item: rowItem, eventId, requestIds }) => [rowItem.key, eventId, requestIds])).toEqual([
      ["supplier-contract:booking_selected", "event_selected", ["booking_selected"]],
      ["supplier_insurance", "event_selected", ["booking_selected"]],
    ]);
    expect(rows[0]?.item).toMatchObject({ dueDate: "2026-10-01T00:00:00.000Z", overdue: true });
    expect(supplierBookingHref("booking_selected")).toBe("/dashboard/bookings#supplier-work-booking_selected");
    expect(supplierWorkHref({ quoteStatus: "open", requestId: "request_open" })).toBe("/dashboard/requests#supplier-work-request_open");
    expect(supplierWorkHref({ quoteStatus: "selected", requestId: "booking_selected" })).toBe("/dashboard/bookings#supplier-work-booking_selected");
  });

  it("routes every readiness item to the section where it is actioned", () => {
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
  });

  it("splits Today into the supplier's turn and work waiting on PMCM, soonest first, without closed requests", () => {
    const item = (id: string, quoteStatus: string, dueAt: string | null, ingressAt?: string) =>
      ({ id, requestId: id, eventId: "e1", eventName: "e1", quoteStatus, dueAt, schedule: ingressAt ? { ingressAt, acknowledged: true } : null, assignmentStatus: "pending", contractStatus: "missing" }) as unknown as PrismSupplierReadinessItem;
    const items = [
      item("undated", "open", null),
      item("quote-later", "open", "2026-11-20T00:00:00Z"),
      item("booked", "selected", "2026-10-01T00:00:00Z", "2026-11-02T08:00:00Z"),
      item("quote-sooner", "open", "2026-11-01T00:00:00Z"),
      item("sent", "open", "2026-11-03T00:00:00Z"),
      item("gone", "expired", "2026-10-01T00:00:00Z"),
    ];

    const steps = splitSupplierNextSteps(items, (entry) => entry.id === "sent");
    expect(steps.yourTurn.map((entry) => entry.id)).toEqual(["quote-sooner", "booked", "quote-later", "undated"]);
    expect(steps.waiting.map((entry) => entry.id)).toEqual(["sent"]);
  });

  it("shows the Today lead's number: days overdue or left on a quote deadline, else days to the event", () => {
    const now = new Date("2026-11-11T04:00:00Z");
    const item = (quoteStatus: string, dueAt: string | null, eventDate: string | null) => ({ quoteStatus, dueAt, eventDate }) as unknown as PrismSupplierReadinessItem;

    expect(supplierStepFigure(item("open", "2026-11-04T00:00:00Z", "2026-11-23"), now)).toEqual({ value: "7", label: "days overdue" });
    expect(supplierStepFigure(item("open", "2026-11-10T20:00:00Z", null), now)).toEqual({ value: "1", label: "day overdue" });
    expect(supplierStepFigure(item("open", "2026-11-14T00:00:00Z", null), now)).toEqual({ value: "3", label: "days left" });
    // Once selected the deadline no longer matters; the event date does.
    expect(supplierStepFigure(item("selected", "2026-11-04T00:00:00Z", "2026-11-23T00:00:00Z"), now)).toEqual({ value: "12", label: "days to event" });
    expect(supplierStepFigure(item("open", null, null), now)).toBeUndefined();
    expect(supplierStepFigure(item("selected", null, "2026-10-01"), now)).toBeUndefined();
  });

  it("sums up Today in one sentence", () => {
    expect(supplierTodaySummary(0, 0)).toBe("Nothing needs you right now.");
    expect(supplierTodaySummary(1, 0)).toBe("1 thing needs you.");
    expect(supplierTodaySummary(2, 1)).toBe("2 things need you · 1 waiting on PMCM.");
    expect(supplierTodaySummary(0, 2)).toBe("Nothing needs you right now · 2 waiting on PMCM.");
  });

  it("lists requests still being bid, live before closed and soonest first, leaving won work to Bookings", () => {
    const requests = [
      makeRequest({ id: "closed", status: "closed", dueDate: "2026-01-01" }),
      makeRequest({ id: "later", status: "open", dueDate: "2026-02-02" }),
      makeRequest({ id: "won", status: "selected", dueDate: "2026-01-02" }),
      makeRequest({ id: "sooner", status: "open", dueDate: "2026-02-01" }),
    ];
    expect(requestsForQuoting(requests, new Map()).map((request) => request.id)).toEqual(["sooner", "later", "closed"]);
  });

  it("locks a quote after selection or its one revision, and says why", () => {
    const open = makeRequest({ id: "r", status: "open" });
    expect(isQuoteLocked(open, makeQuote({ id: "q", requestId: "r", revisionNumber: 1 }))).toBe(false);
    const revised = makeQuote({ id: "q", requestId: "r", revisionNumber: 2 });
    expect(isQuoteLocked(open, revised)).toBe(true);
    expect(closedRequestReason(open, revised)).toMatch(/one revision/);
    expect(isQuoteLocked(makeRequest({ id: "r", status: "selected" }), makeQuote({ id: "q", requestId: "r" }))).toBe(true);
    expect(isQuoteLocked(open, null)).toBe(false);
  });

  it("counts events this month", () => {
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

  it("derives workspace aggregates whose Today count is the sum of the Requests and Bookings counts", () => {
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

    const derived = deriveWorkspace(workspace, new Date("2026-05-15T00:00:00.000Z"));
    expect(derived.openRequests).toHaveLength(1);
    expect(derived.selectedRequests).toHaveLength(1);
    expect(derived.quoteNeedingSubmission).toBe(1);
    expect(derived.handoffPending).toBe(1);
    expect(derived.needsActionCount).toBe(2);
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

describe("isEventStatusStepAllowed", () => {
  it.each([
    [undefined, "arrived", true],
    ["not_started", "arrived", true],
    ["late", "arrived", true],
    ["not_started", "done_leaving", false],
    ["arrived", "set_up_ready", true],
    ["arrived", "done_leaving", false],
    ["arrived", "arrived", true],
    ["done_leaving", "arrived", false],
  ])("from %s to %s -> %s", (current, next, allowed) => {
    expect(isEventStatusStepAllowed(current, next)).toBe(allowed);
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

describe("quoteDeadlineUrgency", () => {
  const now = new Date("2026-11-10T00:00:00Z");
  const open = (dueAt: string | null) => ({ quoteStatus: "open", dueAt }) as never;

  it("flags a quote that is past due or due within three days, and leaves later deadlines ordinary", () => {
    expect(quoteDeadlineUrgency(open("2026-11-09T00:00:00Z"), now)).toBe("overdue");
    expect(quoteDeadlineUrgency(open("2026-11-12T23:59:00Z"), now)).toBe("soon");
    expect(quoteDeadlineUrgency(open("2026-11-14T00:00:00Z"), now)).toBeNull();
  });

  it("says nothing once PMCM has selected the supplier, or when there is no deadline to judge", () => {
    expect(quoteDeadlineUrgency({ quoteStatus: "selected", dueAt: "2026-11-01T00:00:00Z" } as never, now)).toBeNull();
    expect(quoteDeadlineUrgency(open(null), now)).toBeNull();
    expect(quoteDeadlineUrgency(open("not a date"), now)).toBeNull();
  });
});
