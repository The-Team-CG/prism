/** @vitest-environment jsdom */
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { PrismEvent, PrismSupplier, PrismSupplierCategory, PrismSupplierQuoteRequest } from "@prism/types";
import { describe, expect, it, vi } from "vitest";
import { SupplierReviewPromptList } from "./supplier-review-prompt-list";

const event = { id: "evt_close_1", eventName: "Leadership Forum" } as unknown as PrismEvent;
const category = {
  id: "cat_av",
  slug: "audio-visual",
  name: "Audio Visual",
  sortOrder: 1,
  active: true,
  reviewDimensions: [{ id: "dim_reliability", slug: "reliability", name: "Reliability", sortOrder: 1, active: true }],
} satisfies PrismSupplierCategory;
const supplier = {
  id: "sup_1",
  name: "Acme AV",
  categoryId: "cat_av",
  categoryName: "Audio Visual",
  reviews: [],
} as unknown as PrismSupplier;
const request = {
  id: "req_1",
  eventId: "evt_close_1",
  supplierId: "sup_1",
  supplierName: "Acme AV",
  category: "Audio Visual",
  message: "Support the event",
  accessToken: "token",
  confidentialBid: true,
  status: "selected",
  assignmentStatus: "confirmed",
  createdAt: "2026-06-01T00:00:00.000Z",
} satisfies PrismSupplierQuoteRequest;
const promptProps = {
  event,
  categories: [category],
  suppliers: [supplier],
  quoteRequests: [request],
  reviewerName: "Maxine",
  busy: false,
} as const;

describe("SupplierReviewPromptList", () => {
  it("shows confirmed review work and marks it complete only after success", async () => {
    const onAddReview = vi.fn(async () => true);
    render(<SupplierReviewPromptList {...promptProps} onAddReview={onAddReview} />);

    expect(screen.getByText("Acme AV")).toBeTruthy();
    fireEvent.change(screen.getByPlaceholderText("Private review notes"), {
      target: { value: "Strong event-day recovery." },
    });
    fireEvent.click(screen.getByRole("button", { name: "Add review" }));

    await waitFor(() => expect(onAddReview).toHaveBeenCalledWith(
      "sup_1",
      expect.objectContaining({ rating: 4, notes: "Strong event-day recovery.", reviewedBy: "Maxine" }),
    ));
    expect(await screen.findByText("Review saved")).toBeTruthy();
  });

  it("leaves a failed submission due for retry", async () => {
    const onAddReview = vi.fn(async () => false);
    render(<SupplierReviewPromptList {...promptProps} onAddReview={onAddReview} />);

    fireEvent.change(screen.getByPlaceholderText("Private review notes"), { target: { value: "Retry this note." } });
    fireEvent.click(screen.getByRole("button", { name: "Add review" }));
    await waitFor(() => expect(onAddReview).toHaveBeenCalledTimes(1));
    expect(screen.getByPlaceholderText("Private review notes")).toBeTruthy();
    expect(screen.queryByText("Review saved")).toBeNull();
  });

  it("shows a closure empty state when no confirmed supplier is available", () => {
    render(<SupplierReviewPromptList {...promptProps} quoteRequests={[]} onAddReview={vi.fn(async () => true)} />);

    expect(screen.getByText("No confirmed supplier assignments need review.")).toBeTruthy();
  });
});
