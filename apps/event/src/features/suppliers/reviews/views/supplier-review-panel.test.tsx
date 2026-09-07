/** @vitest-environment jsdom */
import { fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { SupplierReviewPanel } from "./supplier-review-panel";

function ReviewPanelHarness() {
  const [reviewForm, setReviewForm] = useState({ rating: "4", notes: "" });
  return (
    <SupplierReviewPanel
      reviewForm={reviewForm}
      reviewDimensionRatings={{}}
      dimensions={[]}
      busy={false}
      onReviewForm={(patch) => setReviewForm((current) => ({ ...current, ...patch }))}
      onReviewDimension={vi.fn()}
      onSubmitReview={vi.fn()}
    />
  );
}

describe("SupplierReviewPanel", () => {
  it("requires private notes before allowing a review submission", () => {
    render(<ReviewPanelHarness />);

    const submit = screen.getByRole("button", { name: "Add review" });
    expect((submit as HTMLButtonElement).disabled).toBe(true);

    fireEvent.change(screen.getByPlaceholderText("Private review notes"), {
      target: { value: "Strong event-day recovery." },
    });
    expect((submit as HTMLButtonElement).disabled).toBe(false);
  });
});
