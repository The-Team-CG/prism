/** @vitest-environment jsdom */
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { SupplierActionDraft } from "../use-cases/submit-supplier-action";
import { SupplierProfileActions } from "./supplier-profile-actions";

const profile = {
  supplier: { id: "supplier-1", name: "Harborline", categoryId: "cat-1", categoryName: "Production", categorySlug: "production", tier: "tier_1", bniMember: false, contactName: "Mina", email: "mina@example.test", phone: "", serviceInclusions: "", performanceNotes: "", applicationDate: "2026-01-01" },
  rating: { average: null, count: 0 },
  lastReviewedAt: null,
  certifications: { rejected: 0, expired: 0, submitted: 0, verified: 0, unknown: 0, attention: "none" },
  reviewDimensions: [{ id: "dimension-1", slug: "quality", name: "Quality", sortOrder: 1, active: true }],
  scorecards: [],
  period: "all",
  asOf: "2026-10-07T00:00:00.000Z",
} as never;

const engagements = {
  items: ["evt-a", "evt-b"].map((eventId) => ({
    eventId,
    event: { id: eventId, name: eventId === "evt-a" ? "Event A" : "Event B", date: "2026-09-01", status: "completed" },
    requests: [], requestCount: 0, hasMoreRequests: false, lastRequestAt: "2026-09-01T00:00:00.000Z", hasConfirmedAssignment: true, hasAssessment: false, canReview: true, canPromote: false,
  })),
  page: 0,
  totalCount: 2,
  hasNextPage: false,
} as never;

describe("SupplierProfileActions", () => {
  it("keeps a failed review draft and idempotency key tied to the explicitly chosen event", async () => {
    const onSubmit = vi.fn(async (_action: SupplierActionDraft) => ({ saved: false as const, message: "Server refused stale eligibility" }));
    render(<SupplierProfileActions profile={profile} categories={[]} engagements={engagements} actionSaving={false} actionResult={null} onSubmit={onSubmit} />);

    const reviewDetails = screen.getByText("Add private review").closest("details");
    if (!reviewDetails) throw new Error("Review disclosure was not rendered");
    fireEvent.click(screen.getByText("Add private review"));
    fireEvent.change(within(reviewDetails).getByLabelText("Completed event"), { target: { value: "evt-b" } });
    fireEvent.change(within(reviewDetails).getByLabelText("Review notes"), { target: { value: "Delivered on time" } });
    fireEvent.click(within(reviewDetails).getByRole("button", { name: "Save review" }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));

    fireEvent.click(within(reviewDetails).getByRole("button", { name: "Save review" }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(2));

    const firstDraft = onSubmit.mock.calls[0]?.[0];
    const secondDraft = onSubmit.mock.calls[1]?.[0];
    expect(firstDraft).toMatchObject({ kind: "review", supplierId: "supplier-1", input: { eventId: "evt-b", notes: "Delivered on time" } });
    expect(secondDraft).toEqual(firstDraft);
  });
});
