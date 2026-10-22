/** @vitest-environment jsdom */
import { fireEvent, render, screen, within } from "@testing-library/react";
import type { ComponentProps } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SupplierDetailDrawer } from "./supplier-detail-drawer";

const onClose = vi.fn();
const noOp = vi.fn();

beforeEach(() => {
  onClose.mockReset();
  Object.defineProperty(HTMLDialogElement.prototype, "showModal", { configurable: true, value() { this.setAttribute("open", ""); } });
  Object.defineProperty(HTMLDialogElement.prototype, "close", { configurable: true, value() { this.removeAttribute("open"); } });
});

function renderDrawer(props: Partial<ComponentProps<typeof SupplierDetailDrawer>> = {}) {
  return render(<SupplierDetailDrawer
    supplierId="supplier-1"
    profile={null}
    profileLoading={false}
    profileError="Supplier not found."
    categories={[]}
    engagements={null}
    engagementsLoading={false}
    engagementsError={null}
    reviews={null}
    reviewsLoading={false}
    certifications={null}
    certificationsLoading={false}
    records={null}
    recordsLoading={false}
    recordsError={null}
    profilePeriod="all"
    recordsPeriod="30d"
    engagementPage={0}
    actionSaving={false}
    actionResult={null}
    onClose={onClose}
    onRetry={noOp}
    onOpenEvent={noOp}
    onProfilePeriodChange={noOp}
    onRecordsPeriodChange={noOp}
    onEngagementPageChange={noOp}
    onSubmitAction={vi.fn(async () => ({ saved: true as const, refreshFailed: false }))}
    {...props}
  />);
}

describe("SupplierDetailDrawer", () => {
  it("opens an accessible modal drawer and keeps a missing supplier closable", () => {
    renderDrawer();
    const dialog = screen.getByRole("dialog", { name: "Supplier" });

    expect(dialog.hasAttribute("open")).toBe(true);
    expect(screen.getByText("Supplier not found")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Close supplier details" })).toBeTruthy();
  });

  it("closes through Escape and the explicit close control", () => {
    const { unmount } = renderDrawer();
    const dialog = screen.getByRole("dialog", { name: "Supplier" });
    const cancel = new Event("cancel", { bubbles: false, cancelable: true });
    dialog.dispatchEvent(cancel);

    expect(cancel.defaultPrevented).toBe(true);
    expect(onClose).toHaveBeenCalledTimes(1);
    unmount();

    renderDrawer();
    fireEvent.click(screen.getByRole("button", { name: "Close supplier details" }));
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it("shows supplier assessment evidence, certification counts and written review details", () => {
    renderDrawer({
      profileError: null,
      profile: {
        supplier: { id: "supplier-1", name: "Harborline Production", categoryId: "production", categoryName: "Production", categorySlug: "production", tier: "tier_1", bniMember: true, contactName: "Mina Santos", email: "mina@example.test", phone: "+63 900 000 0000", serviceInclusions: "Stage fabrication and installation", performanceNotes: "Recheck load-in access", applicationDate: "2026-09-01" },
        rating: { average: 4.2, count: 5 },
        lastReviewedAt: "2026-10-02T00:00:00Z",
        certifications: { verified: 2, submitted: 1, expired: 0, rejected: 0, unknown: 0, attention: "submitted" },
        reviewDimensions: [{ id: "quality", slug: "quality", name: "Build quality", sortOrder: 1, active: true }],
        scorecards: [{ dimensionId: "quality", dimensionName: "Build quality", average: 3.5, sampleCount: 2, latest: { rating: 4, reviewedBy: "Maxine Reyes", createdAt: "2026-10-02T00:00:00Z" } }],
        period: "all", asOf: "2026-10-07T00:00:00Z",
      },
      reviews: { items: [{ id: "review-1", rating: 4, notes: "Setup completed before the agreed ingress time.", reviewedBy: "Francis Cruz", eventId: "event-1", eventName: "Annual launch", createdAt: "2026-10-01T00:00:00Z", dimensionRatings: [{ dimensionId: "quality", dimensionName: "Build quality", rating: 4 }] }], totalCount: 5, page: 0, pageSize: 25, hasNextPage: false },
    });

    expect(within(screen.getByRole("region", { name: "Account summary" })).getByText("Mina Santos")).toBeTruthy();
    expect(within(screen.getByRole("region", { name: "Private PMCM notes" })).getByText("Stage fabrication and installation")).toBeTruthy();
    const performance = within(screen.getByRole("region", { name: "Supplier performance" }));
    expect(performance.getByText("2 / 3")).toBeTruthy();
    expect(performance.getByText("1 / 3")).toBeTruthy();
    const scorecards = within(screen.getByRole("region", { name: "Performance scorecards" }));
    expect(scorecards.getByText("Build quality")).toBeTruthy();
    expect(scorecards.getByText("3.5 / 5")).toBeTruthy();
    expect(scorecards.getByText("Maxine Reyes")).toBeTruthy();
    const reviews = within(screen.getByRole("region", { name: "Private review history" }));
    expect(reviews.getByText("Annual launch")).toBeTruthy();
    expect(reviews.getByText("Setup completed before the agreed ingress time.")).toBeTruthy();
    expect(reviews.getByText("Francis Cruz")).toBeTruthy();
    expect(reviews.getByText("5 reviews")).toBeTruthy();
  });
});
