import { describe, expect, it } from "vitest";
import type { PrismSupplierReadinessItem } from "@prism/types";
import { orderRequestCards, requestCardFacts } from "./request-cards";
import type { PrismSupplierQuote, PrismSupplierQuoteRequest } from "./supplier-workspace-types";

const NOW = new Date("2026-11-20T04:00:00.000Z");

const request = (id: string, over: Partial<PrismSupplierQuoteRequest> = {}) => ({
  id, eventId: `evt_${id}`, supplierName: "XPERTO", category: "Digital Registration", message: "", accessToken: "t",
  confidentialBid: false, status: "sent", createdAt: "2026-11-01T00:00:00.000Z", dueDate: "2026-11-28T09:00:00.000Z", ...over,
}) as PrismSupplierQuoteRequest;
const quote = (over: Partial<PrismSupplierQuote> = {}) => ({
  id: "q", eventId: "evt", requestId: "r", supplierName: "XPERTO", category: "Digital Registration", amount: 420000, inclusions: [],
  paymentTerms: "", notes: "", outsideAcceptableRange: false, status: "submitted", revisionNumber: 1, createdAt: "2026-11-10T00:00:00.000Z", ...over,
}) as PrismSupplierQuote;
const readiness = (id: string, over: Partial<PrismSupplierReadinessItem> = {}) => ({ requestId: id, eventName: `Event ${id}`, eventDate: "2026-12-18", ...over }) as PrismSupplierReadinessItem;

describe("request cards", () => {
  it("asks the supplier to price a request with no quote, counting down to the deadline", () => {
    const card = requestCardFacts(request("a"), undefined, readiness("a"), NOW);
    expect(card).toMatchObject({ stage: "to-quote", eventName: "Event a", action: "Prepare quote", deadline: { label: "Due in 8 days", tone: "later" } });
  });

  it("marks a deadline within three days, and one that has passed", () => {
    expect(requestCardFacts(request("a", { dueDate: "2026-11-22T09:00:00.000Z" }), undefined, undefined, NOW).deadline).toMatchObject({ label: "Due in 2 days", tone: "soon" });
    expect(requestCardFacts(request("a", { dueDate: "2026-11-18T09:00:00.000Z" }), undefined, undefined, NOW).deadline).toMatchObject({ label: "Overdue 2 days", tone: "overdue" });
  });

  it("offers the one revision on a sent quote, and only a view once it is used", () => {
    expect(requestCardFacts(request("a"), quote(), undefined, NOW)).toMatchObject({ stage: "sent", canRevise: true, action: "Revise quote", status: { title: "1 revision left" } });
    expect(requestCardFacts(request("a"), quote({ revisionNumber: 2 }), undefined, NOW)).toMatchObject({ stage: "sent", canRevise: false, action: "View quote" });
  });

  it("closes a request PMCM did not select or that expired, with no deadline left to show", () => {
    const notSelected = requestCardFacts(request("a"), quote({ status: "not_selected" }), undefined, NOW);
    expect(notSelected).toMatchObject({ stage: "closed", deadline: null, status: { title: "Not selected" } });
    expect(requestCardFacts(request("b", { status: "expired" }), undefined, undefined, NOW).status.title).toBe("Deadline passed without a quote");
  });

  it("names a confidential bid without leaking an event name it does not have", () => {
    expect(requestCardFacts(request("a", { confidentialBid: true }), undefined, undefined, NOW).eventName).toBe("Confidential event");
  });

  it("orders requests to price and quotes with PMCM by deadline, and closed ones newest first", () => {
    const cards = [
      requestCardFacts(request("late", { dueDate: "2026-12-20T00:00:00.000Z" }), undefined, undefined, NOW),
      requestCardFacts(request("soon", { dueDate: "2026-11-21T00:00:00.000Z" }), undefined, undefined, NOW),
      requestCardFacts(request("old", { status: "closed", dueDate: "2026-10-01T00:00:00.000Z" }), undefined, undefined, NOW),
      requestCardFacts(request("recent", { status: "closed", dueDate: "2026-11-01T00:00:00.000Z" }), undefined, undefined, NOW),
    ];
    const groups = orderRequestCards(cards);
    expect(groups["to-quote"].map((card) => card.request.id)).toEqual(["soon", "late"]);
    expect(groups.closed.map((card) => card.request.id)).toEqual(["recent", "old"]);
  });
});
