import type { PrismSupplier, PrismSupplierQuoteRequest } from "@prism/types";
import { describe, expect, it } from "vitest";
import { selectSupplierReviewSubjects } from "./supplier-review-rules";

const makeSupplier = (overrides: Partial<PrismSupplier> = {}): PrismSupplier => ({
  id: "sup_1",
  name: "Acme AV",
  categoryId: "cat_av",
  categoryName: "Audio Visual",
  categorySlug: "audio-visual",
  tier: "tier_1",
  bniMember: false,
  autoTrust: false,
  contactName: "Ada Cruz",
  email: "ada@acme.test",
  phone: "+63 900 000 0000",
  serviceInclusions: "Stage and technicals",
  performanceNotes: "",
  applicationDate: "2026-01-01",
  aggregateRating: 4,
  lastEventDate: null,
  pastEvents: [],
  reviews: [],
  reliabilityNotes: [],
  certifications: [],
  ...overrides,
});

const makeRequest = (overrides: Partial<PrismSupplierQuoteRequest> = {}): PrismSupplierQuoteRequest => ({
  id: "req_1",
  eventId: "evt_close_1",
  supplierId: "sup_1",
  supplierName: "Acme AV",
  category: "Audio Visual",
  message: "Please support the event.",
  accessToken: "token",
  confidentialBid: true,
  status: "selected",
  assignmentStatus: "confirmed",
  createdAt: "2026-06-01T00:00:00.000Z",
  ...overrides,
});

describe("supplier-review-rules", () => {
  it("selects confirmed suppliers once and marks an event review complete only for the same event", () => {
    const subjects = selectSupplierReviewSubjects(
      [
        makeSupplier({
          reviews: [{
            id: "review_1",
            rating: 5,
            notes: "Done",
            reviewedBy: "Maxine",
            eventId: "evt_close_1",
            eventName: "Leadership Forum",
            createdAt: "2026-06-20T00:00:00.000Z",
            dimensionRatings: [],
          }],
        }),
        makeSupplier({ id: "sup_2", name: "Fresh Flowers", categoryId: "cat_floral", categoryName: "Florals" }),
      ],
      [
        makeRequest(),
        makeRequest({ id: "req_duplicate", supplierId: "sup_1" }),
        makeRequest({ id: "req_2", supplierId: "sup_2", supplierName: "Fresh Flowers", category: "Florals" }),
      ],
      "evt_close_1",
    );

    expect(subjects.map((subject) => [subject.supplier.id, subject.completed])).toEqual([
      ["sup_1", true],
      ["sup_2", false],
    ]);
    expect(subjects[1]?.requestCategory).toBe("Florals");
  });

  it("does not prompt for unconfirmed or missing suppliers", () => {
    const subjects = selectSupplierReviewSubjects(
      [makeSupplier()],
      [
        makeRequest({ assignmentStatus: "pending_confirmation" }),
        makeRequest({ id: "req_missing", supplierId: "sup_missing", assignmentStatus: "confirmed" }),
      ],
      "evt_close_1",
    );

    expect(subjects).toEqual([]);
  });
});
