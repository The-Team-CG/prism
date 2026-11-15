import { describe, expect, it } from "vitest";
import { bookingCardFacts } from "./booking-cards";

const request = (over: Record<string, unknown> = {}) => ({ id: "req_1", eventId: "evt_1", category: "Registration", assignmentStatus: "confirmed", readinessStatus: "pending", contractReviewStatus: "accepted", ...over }) as never;
const schedule = { ingressAt: "2026-11-23T00:00:00.000Z", egressAt: "2026-11-23T12:00:00.000Z", location: "Gate 3", status: "published", revision: 3, acknowledged: false, acknowledgedAt: null, changeRequestNote: null, changeRequestedAt: null };
const readiness = (over: Record<string, unknown> = {}) => ({ requestId: "req_1", eventId: "evt_1", eventName: "Gala", eventDate: "2026-11-23", quoteStatus: "selected", assignmentStatus: "confirmed", contractStatus: "accepted", readinessStatus: "pending", schedule, ingressLate: false, ...over }) as never;

describe("one-tap booking steps", () => {
  it("offers only steps that need no form, in the order the next step follows", () => {
    expect(bookingCardFacts(request({ assignmentStatus: "pending" }), readiness({ assignmentStatus: "pending" }), [], "2026-11-16").quickAction).toEqual({ kind: "confirm-assignment" });
    expect(bookingCardFacts(request(), readiness(), [], "2026-11-16").quickAction).toEqual({ kind: "acknowledge-schedule", revision: 3 });
    // A contract to fix comes first, and it needs a file, so the card opens the booking instead.
    expect(bookingCardFacts(request(), readiness({ contractStatus: "changes_requested" }), [], "2026-11-16").quickAction).toBeNull();
    // A late arrival needs a status report, not a tap.
    expect(bookingCardFacts(request(), readiness({ ingressLate: true }), [], "2026-11-16").quickAction).toBeNull();
    expect(bookingCardFacts(request(), readiness({ schedule: { ...schedule, acknowledged: true } }), [], "2026-11-16").quickAction).toBeNull();
  });
});
